import { Workbook, type CellValue, type Worksheet } from 'exceljs';
import { parse } from 'csv-parse/sync';
import {
  aCentavos,
  deCentavos,
  diasSemanaHistorica,
  esFechaCalendario,
  normalizarNombreCatalogo,
  ORDEN_TIEMPOS,
  ProteinaPrincipal,
  type TiempoComida,
} from '@menu/shared';
import { Problema } from '../comun/problema';
import { validarContenedorXlsx } from './archivo-zip';
import {
  COLUMNAS_LISTAS,
  COLUMNAS_MENUS,
  LIMITE_ARCHIVO,
  LIMITE_FILAS,
  type ArchivoImportacion,
  type FilaLista,
  type FilaMenu,
} from './importaciones.tipos';

type Celda = string | { error: string };
export interface Entrada {
  numeroFila: number;
  valores: Celda[];
}
const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const fallo = (codigo: string, mensaje: string) => new Problema(422, codigo, mensaje);

function celdaExcel(valor: CellValue): Celda {
  if (valor === null || valor === undefined) return '';
  if (valor instanceof Date)
    return Number.isFinite(valor.getTime())
      ? valor.toISOString().slice(0, 10)
      : { error: 'fecha inválida' };
  if (typeof valor === 'string' || typeof valor === 'number') return String(valor).trim();
  if (typeof valor === 'object' && 'richText' in valor)
    return valor.richText
      .map((r) => r.text)
      .join('')
      .trim();
  return { error: 'Usa valores de texto o números, sin fórmulas ni enlaces' };
}
function comprobarArchivo(archivo: ArchivoImportacion) {
  if (archivo.size > LIMITE_ARCHIVO || archivo.buffer.length > LIMITE_ARCHIVO)
    throw new Problema(413, 'ARCHIVO_DEMASIADO_GRANDE', 'El archivo admite hasta 5 MB');
  const extension = archivo.originalname.toLowerCase().split('.').at(-1);
  if (extension !== 'csv' && extension !== 'xlsx')
    throw new Problema(415, 'FORMATO_NO_PERMITIDO', 'Selecciona un archivo CSV o XLSX');
  return extension;
}
function leerCsv(archivo: ArchivoImportacion): Entrada[] {
  try {
    const texto = new TextDecoder('utf-8', { fatal: true }).decode(archivo.buffer);
    const registros = parse(texto, {
      bom: true,
      trim: true,
      skip_empty_lines: true,
      info: true,
      max_record_size: 16384,
      to: LIMITE_FILAS + 2,
    }) as unknown as { record: string[]; info: { lines: number } }[];
    return registros.map((r) => ({ numeroFila: r.info.lines, valores: r.record }));
  } catch {
    throw fallo(
      'CSV_INVALIDO',
      'No se pudo leer el CSV. Usa UTF-8, separador coma y comillas válidas',
    );
  }
}
function entradasDeHoja(hoja: Worksheet): Entrada[] {
  if (hoja.actualRowCount > LIMITE_FILAS + 1 || hoja.rowCount > 10001)
    throw fallo('DEMASIADAS_FILAS', 'El archivo admite hasta 5000 filas de datos');
  const entradas: Entrada[] = [];
  hoja.eachRow((fila, numeroFila) => {
    if (fila.cellCount > 32) throw fallo('COLUMNAS_INVALIDAS', 'La hoja tiene demasiadas columnas');
    const valores = Array.from({ length: fila.cellCount }, (_, i) =>
      celdaExcel(fila.getCell(i + 1).value),
    );
    if (valores.some((v) => typeof v !== 'string' || v.trim() !== ''))
      entradas.push({ numeroFila, valores });
  });
  return entradas;
}
/**
 * Lee el archivo de menús. Con `conListas` (carga del cuaderno) también devuelve la hoja
 * Listas de un XLSX; sin ella, una hoja Listas con datos se rechaza para no ignorarla.
 */
export async function leerArchivo(
  archivo: ArchivoImportacion,
  opciones: { conListas?: boolean } = {},
): Promise<{ formato: 'CSV' | 'XLSX'; entradas: Entrada[]; entradasListas: Entrada[] | null }> {
  const extension = comprobarArchivo(archivo);
  if (extension === 'csv')
    return { formato: 'CSV', entradas: leerCsv(archivo), entradasListas: null };
  validarContenedorXlsx(archivo.buffer);
  const libro = new Workbook();
  try {
    await libro.xlsx.load(new Uint8Array(archivo.buffer).buffer as ArrayBuffer);
  } catch {
    throw fallo('XLSX_INVALIDO', 'No se pudo leer el archivo XLSX');
  }
  const hoja = libro.worksheets.find((h) => h.name.toLowerCase() === 'menus');
  if (!hoja) throw fallo('HOJA_FALTANTE', 'Falta la hoja obligatoria: Menus');
  const permitidas = ['menus', 'instrucciones', ...(opciones.conListas ? ['listas'] : [])];
  if (
    libro.worksheets.some((h) => !permitidas.includes(h.name.toLowerCase()) && h.actualRowCount > 0)
  )
    throw fallo(
      'HOJA_NO_PERMITIDA',
      opciones.conListas
        ? 'Carga únicamente las hojas Menus y Listas'
        : 'Carga únicamente la hoja Menus. Las listas se cargan con la carga inicial del cuaderno',
    );
  const listas = opciones.conListas
    ? libro.worksheets.find((h) => h.name.toLowerCase() === 'listas')
    : undefined;
  const entradasListas = listas ? entradasDeHoja(listas) : [];
  return {
    formato: 'XLSX',
    entradas: entradasDeHoja(hoja),
    entradasListas: entradasListas.length ? entradasListas : null,
  };
}
/** Hoja Listas en un CSV aparte (carga del cuaderno). */
export function leerListasCsv(archivo: ArchivoImportacion): Entrada[] {
  if (comprobarArchivo(archivo) !== 'csv')
    throw new Problema(415, 'FORMATO_NO_PERMITIDO', 'El archivo de listas debe ser CSV');
  return leerCsv(archivo);
}

export function validarFilas(entradas: Entrada[], hoy: string): FilaMenu[] {
  const [encabezado, ...datos] = entradas;
  const columnas =
    encabezado?.valores.map((v) => (typeof v === 'string' ? v.trim().toLowerCase() : '')) ?? [];
  for (const requerida of ['fecha', 'tiempo_comida', 'platillo'])
    if (!columnas.includes(requerida))
      throw fallo('COLUMNA_FALTANTE', `Falta la columna obligatoria: ${requerida}`);
  if (
    new Set(columnas).size !== columnas.length ||
    columnas.some((c) => !COLUMNAS_MENUS.includes(c as (typeof COLUMNAS_MENUS)[number]))
  )
    throw fallo(
      'COLUMNAS_INVALIDAS',
      'Revisa las columnas: usa los encabezados de la plantilla sin duplicarlos',
    );
  if (!datos.length) throw fallo('ARCHIVO_VACIO', 'El archivo no contiene filas de menús');
  if (datos.length > LIMITE_FILAS)
    throw fallo('DEMASIADAS_FILAS', 'El archivo admite hasta 5000 filas de datos');
  const filas = datos.map((r): FilaMenu => {
    const errores: FilaMenu['errores'] = [];
    const leer = (col: string) => {
      const i = columnas.indexOf(col);
      const valor = i < 0 ? '' : (r.valores[i] ?? '');
      if (typeof valor === 'object') {
        errores.push({ columna: col, motivo: valor.error });
        return '';
      }
      const texto = valor.trim();
      const sinControles = [...texto]
        .filter((c) => c.charCodeAt(0) >= 32 || ['\t', '\n', '\r'].includes(c))
        .join('');
      if (sinControles !== texto) {
        errores.push({ columna: col, motivo: 'El texto contiene caracteres no permitidos' });
        return sinControles;
      }
      return texto;
    };
    const fecha = leer('fecha');
    const dia = normalizarNombreCatalogo(leer('dia'));
    const tiempo = normalizarNombreCatalogo(leer('tiempo_comida')).toUpperCase() as TiempoComida;
    const nombre = leer('platillo');
    const proteina = normalizarNombreCatalogo(leer('proteina_principal')).toUpperCase();
    const gastoTexto = leer('gasto_semana_gtq');
    const notas = leer('notas');
    let semanaInicio: string | null = null;
    if (!esFechaCalendario(fecha)) errores.push({ columna: 'fecha', motivo: 'fecha inválida' });
    else {
      const n = new Date(`${fecha}T00:00:00Z`).getUTCDay();
      semanaInicio = new Date(Date.parse(`${fecha}T00:00:00Z`) - n * 86400000)
        .toISOString()
        .slice(0, 10);
      if (!esFechaCalendario(semanaInicio)) {
        semanaInicio = null;
        errores.push({ columna: 'fecha', motivo: 'fecha inválida' });
      } else if (diasSemanaHistorica(semanaInicio)[6]! >= hoy)
        errores.push({ columna: 'fecha', motivo: 'Solo se pueden importar semanas terminadas' });
      if (dia && dia !== DIAS[n])
        errores.push({ columna: 'dia', motivo: 'El día no coincide con la fecha' });
    }
    if (!ORDEN_TIEMPOS.includes(tiempo))
      errores.push({ columna: 'tiempo_comida', motivo: 'valor no permitido' });
    if (!nombre || nombre.length > 80)
      errores.push({ columna: 'platillo', motivo: 'Indica un nombre de 1 a 80 caracteres' });
    if (proteina && !Object.values(ProteinaPrincipal).includes(proteina as ProteinaPrincipal))
      errores.push({ columna: 'proteina_principal', motivo: 'valor no permitido' });
    if (notas.length > 200)
      errores.push({ columna: 'notas', motivo: 'Admite hasta 200 caracteres' });
    const centavos = gastoTexto ? aCentavos(gastoTexto) : null;
    if (gastoTexto && (centavos === null || centavos <= 0 || centavos > 9999999))
      errores.push({
        columna: 'gasto_semana_gtq',
        motivo: 'El gasto debe ser un monto positivo en quetzales, con hasta 2 decimales',
      });
    return {
      numeroFila: r.numeroFila,
      fecha,
      semanaInicio,
      tiempo,
      platillo: nombre,
      nombreNormalizado: normalizarNombreCatalogo(nombre),
      proteinaPrincipal: Object.values(ProteinaPrincipal).includes(proteina as ProteinaPrincipal)
        ? (proteina as ProteinaPrincipal)
        : null,
      gasto: centavos !== null && centavos > 0 && centavos <= 9999999 ? deCentavos(centavos) : null,
      notas,
      errores,
    };
  });
  const espacios = new Map<string, FilaMenu>();
  for (const fila of filas) {
    if (!fila.semanaInicio || !ORDEN_TIEMPOS.includes(fila.tiempo)) continue;
    const clave = `${fila.fecha}:${fila.tiempo}`;
    const anterior = espacios.get(clave);
    if (anterior) {
      const motivo = `Comida repetida en filas ${anterior.numeroFila} y ${fila.numeroFila}`;
      anterior.errores.push({ columna: 'tiempo_comida', motivo });
      fila.errores.push({ columna: 'tiempo_comida', motivo });
    } else espacios.set(clave, fila);
  }
  const semanas = new Map<string, FilaMenu[]>();
  for (const f of filas)
    if (f.semanaInicio) semanas.set(f.semanaInicio, [...(semanas.get(f.semanaInicio) ?? []), f]);
  for (const [semana, grupo] of semanas) {
    const conGasto = grupo.filter((f) => f.gasto !== null);
    if (new Set(conGasto.map((f) => f.gasto)).size > 1) {
      const motivo = `Semana ${semana}: gasto distinto en filas ${conGasto.map((f) => f.numeroFila).join(' y ')}`;
      for (const f of conGasto) f.errores.push({ columna: 'gasto_semana_gtq', motivo });
    }
  }
  return filas;
}

const CANTIDAD = /^\d{1,7}(\.\d{1,3})?$/;
const PRESENTACION = /^(\d{1,7}(?:\.\d{1,3})?)\s*([a-z]{1,10})$/;
/** Valida la hoja Listas: una fila por producto de cada lista (CU-04.2, RF-18). */
export function validarListas(entradas: Entrada[], hoy: string): FilaLista[] {
  const [encabezado, ...datos] = entradas;
  const columnas =
    encabezado?.valores.map((v) => (typeof v === 'string' ? v.trim().toLowerCase() : '')) ?? [];
  for (const requerida of ['fecha', 'lista', 'tipo', 'producto', 'cantidad', 'unidad_compra'])
    if (!columnas.includes(requerida))
      throw fallo('COLUMNA_FALTANTE', `Falta la columna obligatoria de listas: ${requerida}`);
  if (
    new Set(columnas).size !== columnas.length ||
    columnas.some((c) => !COLUMNAS_LISTAS.includes(c as (typeof COLUMNAS_LISTAS)[number]))
  )
    throw fallo(
      'COLUMNAS_INVALIDAS',
      'Revisa las columnas de listas: usa los encabezados de la plantilla sin duplicarlos',
    );
  if (!datos.length) throw fallo('ARCHIVO_VACIO', 'El archivo de listas no contiene filas');
  if (datos.length > LIMITE_FILAS)
    throw fallo('DEMASIADAS_FILAS', 'El archivo admite hasta 5000 filas de datos');
  const filas = datos.map((r): FilaLista => {
    const errores: FilaLista['errores'] = [];
    const leer = (col: string) => {
      const i = columnas.indexOf(col);
      const valor = i < 0 ? '' : (r.valores[i] ?? '');
      if (typeof valor === 'object') {
        errores.push({ columna: col, motivo: valor.error });
        return '';
      }
      const texto = valor.trim();
      const limpio = [...texto].filter((c) => c.charCodeAt(0) >= 32).join('');
      if (limpio !== texto)
        errores.push({ columna: col, motivo: 'El texto contiene caracteres no permitidos' });
      return limpio;
    };
    const fecha = leer('fecha');
    const lista = leer('lista');
    const tipoTexto = normalizarNombreCatalogo(leer('tipo'));
    const producto = leer('producto');
    const cantidad = leer('cantidad').replace(',', '.');
    const unidadCompra = leer('unidad_compra');
    const presentacionTexto = normalizarNombreCatalogo(leer('presentacion')).replace(',', '.');
    const precioTexto = leer('precio_gtq');
    const supermercado = leer('supermercado');
    if (!esFechaCalendario(fecha)) errores.push({ columna: 'fecha', motivo: 'fecha inválida' });
    else if (fecha > hoy)
      errores.push({ columna: 'fecha', motivo: 'La fecha de la lista no puede ser futura' });
    if (!lista || lista.length > 80)
      errores.push({ columna: 'lista', motivo: 'Indica un nombre de lista de 1 a 80 caracteres' });
    if (tipoTexto !== 'despensa' && tipoTexto !== 'compras')
      errores.push({ columna: 'tipo', motivo: 'Usa despensa o compras' });
    if (!producto || producto.length > 80)
      errores.push({ columna: 'producto', motivo: 'Indica un nombre de 1 a 80 caracteres' });
    if (!CANTIDAD.test(cantidad) || Number(cantidad) <= 0)
      errores.push({
        columna: 'cantidad',
        motivo: 'La cantidad debe ser mayor que 0, con hasta 3 decimales',
      });
    if (!unidadCompra || unidadCompra.length > 20)
      errores.push({ columna: 'unidad_compra', motivo: 'Indica una unidad de 1 a 20 caracteres' });
    const coincidencia = presentacionTexto ? PRESENTACION.exec(presentacionTexto) : null;
    if (presentacionTexto && (!coincidencia || Number(coincidencia[1]) <= 0))
      errores.push({
        columna: 'presentacion',
        motivo: 'Usa cantidad y unidad, por ejemplo "2 lb"',
      });
    const centavos = precioTexto ? aCentavos(precioTexto) : null;
    if (precioTexto && (centavos === null || centavos < 0 || centavos > 9999999))
      errores.push({
        columna: 'precio_gtq',
        motivo: 'El precio debe ser un monto en quetzales de 0 a 99999.99, con hasta 2 decimales',
      });
    if (supermercado.length > 80)
      errores.push({ columna: 'supermercado', motivo: 'Admite hasta 80 caracteres' });
    return {
      numeroFila: r.numeroFila,
      fecha,
      lista,
      tipo: tipoTexto === 'compras' ? 'COMPRAS' : 'DESPENSA',
      producto,
      nombreNormalizado: normalizarNombreCatalogo(producto),
      cantidad,
      unidadCompra,
      presentacion:
        coincidencia && Number(coincidencia[1]) > 0
          ? { cantidad: String(Number(coincidencia[1])), unidad: coincidencia[2]! }
          : null,
      precio:
        centavos !== null && centavos >= 0 && centavos <= 9999999 ? deCentavos(centavos) : null,
      supermercado,
      errores,
    };
  });
  const marcar = (fila: FilaLista, columna: string, motivo: string) =>
    fila.errores.push({ columna, motivo });
  const tiposPorLista = new Map<string, FilaLista>();
  const despensa = new Map<string, FilaLista>();
  for (const fila of filas) {
    const clave = normalizarNombreCatalogo(fila.lista);
    const primera = tiposPorLista.get(clave);
    if (primera && primera.tipo !== fila.tipo) {
      const motivo = `La lista "${fila.lista}" mezcla tipos en las filas ${primera.numeroFila} y ${fila.numeroFila}`;
      marcar(primera, 'tipo', motivo);
      marcar(fila, 'tipo', motivo);
    } else if (!primera) tiposPorLista.set(clave, fila);
    if (fila.tipo !== 'DESPENSA' || !fila.nombreNormalizado) continue;
    const anterior = despensa.get(fila.nombreNormalizado);
    if (anterior) {
      const motivo = `Producto repetido en la despensa, filas ${anterior.numeroFila} y ${fila.numeroFila}`;
      marcar(anterior, 'producto', motivo);
      marcar(fila, 'producto', motivo);
    } else despensa.set(fila.nombreNormalizado, fila);
  }
  return filas;
}

const EJEMPLOS_LISTAS = [
  ['2025-06-01', 'Despensa junio', 'despensa', 'Arroz', '2', 'bolsa', '2 lb', '25.00', 'Paiz'],
  ['2025-06-01', 'Despensa junio', 'despensa', 'Aceite', '1', 'botella', '1 l', '', ''],
];
export async function generarPlantilla(
  formato: 'csv' | 'xlsx',
  hoja: 'menus' | 'listas' | 'cuaderno' = 'menus',
): Promise<Buffer> {
  if (formato === 'csv' && hoja === 'listas')
    return Buffer.from(
      '\ufeff' +
        [COLUMNAS_LISTAS, ...EJEMPLOS_LISTAS].map((r) => r.join(',')).join('\r\n') +
        '\r\n',
      'utf8',
    );
  const ejemplos = diasSemanaHistorica('2025-04-06').map((fecha, i) => [
    fecha,
    DIAS[i]!,
    'almuerzo',
    'Pepián de pollo',
    'pollo',
    '248.50',
    'Ejemplo: reemplaza estos datos',
  ]);
  if (formato === 'csv')
    return Buffer.from(
      '\ufeff' + [COLUMNAS_MENUS, ...ejemplos].map((r) => r.join(',')).join('\r\n') + '\r\n',
      'utf8',
    );
  const libro = new Workbook();
  const menus = libro.addWorksheet('Menus');
  menus.addRow([...COLUMNAS_MENUS]);
  menus.addRows(ejemplos);
  menus.views = [{ state: 'frozen', ySplit: 1 }];
  menus.columns.forEach((c) => {
    c.width = 24;
  });
  menus.getRow(1).font = { bold: true };
  if (hoja === 'cuaderno') {
    const listas = libro.addWorksheet('Listas');
    listas.addRow([...COLUMNAS_LISTAS]);
    listas.addRows(EJEMPLOS_LISTAS);
    listas.views = [{ state: 'frozen', ySplit: 1 }];
    listas.columns.forEach((c) => {
      c.width = 22;
    });
    listas.getRow(1).font = { bold: true };
  }
  const instrucciones = libro.addWorksheet('Instrucciones');
  instrucciones.addRows([
    ['Campo', 'Uso'],
    ['fecha', 'Obligatorio: AAAA-MM-DD o celda fecha; semana terminada'],
    ['tiempo_comida', 'Obligatorio: desayuno, almuerzo o cena'],
    ['platillo', 'Obligatorio: nombre del catálogo, hasta 80 caracteres'],
    ['dia', 'Opcional; debe coincidir con la fecha'],
    ['proteina_principal', 'Opcional: proteína del catálogo'],
    ['gasto_semana_gtq', 'Opcional, positivo hasta 99999.99; igual en toda la semana'],
    ['notas', 'Opcional: hasta 200 caracteres por comida'],
    ['Límites', '5 MB, 5000 filas por hoja. Pega valores sin fórmulas.'],
  ]);
  if (hoja === 'cuaderno')
    instrucciones.addRows([
      [
        'Hoja Listas',
        'Solo en la carga inicial del cuaderno; en una importación normal se rechaza.',
      ],
      ['lista, tipo', 'Nombre de la lista y su tipo: despensa o compras'],
      [
        'producto, cantidad, unidad_compra',
        'Obligatorios; cantidad mayor que 0 (hasta 3 decimales)',
      ],
      ['presentacion', 'Opcional: contenido del empaque con cantidad y unidad, por ejemplo 2 lb'],
      ['precio_gtq, supermercado', 'Opcionales; el precio es de referencia, de 0 a 99999.99'],
    ]);
  instrucciones.getColumn(1).width = 24;
  instrucciones.getColumn(2).width = 90;
  return Buffer.from(await libro.xlsx.writeBuffer());
}
