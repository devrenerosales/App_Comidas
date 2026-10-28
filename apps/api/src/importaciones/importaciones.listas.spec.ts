import { Workbook } from 'exceljs';
import {
  generarPlantilla,
  leerArchivo,
  leerListasCsv,
  validarListas,
} from './importaciones.parser';
import { resumirGasto, resumirListas, validarPresentaciones } from './importaciones.listas';
import type { FilaLista } from './importaciones.tipos';

const HOY = '2026-10-28';
const COLUMNAS = [
  'fecha',
  'lista',
  'tipo',
  'producto',
  'cantidad',
  'unidad_compra',
  'presentacion',
  'precio_gtq',
  'supermercado',
];
const FILA = ['2026-03-01', 'Despensa', 'despensa', 'Arroz', '2', 'bolsa', '2 lb', '25.50', 'Paiz'];
const entrada = (valores: string[], numeroFila = 2) => ({ valores, numeroFila });
const validar = (...filas: string[][]) =>
  validarListas([entrada(COLUMNAS, 1), ...filas.map((f, i) => entrada(f, i + 2))], HOY);
const archivo = (texto: string | Buffer, nombre = 'listas.csv') => {
  const buffer = Buffer.from(texto);
  return { buffer, originalname: nombre, size: buffer.length };
};
const lista = (parcial: Partial<FilaLista>): FilaLista => ({
  numeroFila: 2,
  fecha: '2026-03-01',
  lista: 'Despensa',
  tipo: 'DESPENSA',
  producto: 'Arroz',
  nombreNormalizado: 'arroz',
  cantidad: '1',
  unidadCompra: 'bolsa',
  presentacion: null,
  precio: null,
  supermercado: '',
  errores: [],
  ...parcial,
});

describe('Validación de la hoja Listas (HU-18)', () => {
  it('normaliza tipo, cantidad, presentación y precio', () => {
    expect(validar(FILA)[0]).toMatchObject({
      lista: 'Despensa',
      tipo: 'DESPENSA',
      producto: 'Arroz',
      nombreNormalizado: 'arroz',
      cantidad: '2',
      unidadCompra: 'bolsa',
      presentacion: { cantidad: '2', unidad: 'lb' },
      precio: '25.50',
      supermercado: 'Paiz',
      errores: [],
    });
    expect(
      validar(['2026-03-01', 'Compras', ' Compras ', 'Pepián', '1,5', 'lb', '', '', ''])[0],
    ).toMatchObject({ tipo: 'COMPRAS', cantidad: '1.5', presentacion: null, precio: null });
  });
  it.each([
    ['fecha inválida', 0, '2026-02-30', 'fecha'],
    ['fecha futura', 0, '2026-11-01', 'fecha'],
    ['lista vacía', 1, '', 'lista'],
    ['tipo desconocido', 2, 'mensual', 'tipo'],
    ['producto vacío', 3, '', 'producto'],
    ['producto de más de 80 caracteres', 3, 'a'.repeat(81), 'producto'],
    ['cantidad en cero', 4, '0', 'cantidad'],
    ['cantidad con demasiados decimales', 4, '1.2345', 'cantidad'],
    ['cantidad no numérica', 4, 'dos', 'cantidad'],
    ['unidad vacía', 5, '', 'unidad_compra'],
    ['unidad de más de 20 caracteres', 5, 'u'.repeat(21), 'unidad_compra'],
    ['presentación sin unidad', 6, '2', 'presentacion'],
    ['presentación en cero', 6, '0 lb', 'presentacion'],
    ['precio negativo', 7, '-1', 'precio_gtq'],
    ['precio con tres decimales', 7, '1.234', 'precio_gtq'],
    ['precio fuera de rango', 7, '100000', 'precio_gtq'],
    ['supermercado largo', 8, 's'.repeat(81), 'supermercado'],
  ])('marca error por %s', (_caso, columna, valor, esperada) => {
    const valores = [...FILA];
    valores[columna!] = valor as string;
    expect(validar(valores)[0]!.errores).toEqual(
      expect.arrayContaining([expect.objectContaining({ columna: esperada })]),
    );
  });
  it('acepta precio cero y deja vacíos los opcionales', () => {
    expect(
      validar(['2026-03-01', 'Despensa', 'despensa', 'Sal', '1', 'bolsa', '', '0', ''])[0],
    ).toMatchObject({ precio: '0.00', errores: [] });
  });
  it('rechaza el mismo producto dos veces en la despensa, pero no entre listas de compras', () => {
    const repetido = validar(FILA, [...FILA.slice(0, 1), 'Otra', ...FILA.slice(2)]);
    expect(repetido.map((f) => f.errores.length)).toEqual([1, 1]);
    expect(repetido[0]!.errores[0]!.motivo).toContain('filas 2 y 3');
    const compras = validar(
      ['2026-03-01', 'A', 'compras', 'Arroz', '1', 'bolsa', '', '', ''],
      ['2026-03-08', 'B', 'compras', 'Arroz', '1', 'bolsa', '', '', ''],
    );
    expect(compras.every((f) => !f.errores.length)).toBe(true);
  });
  it('rechaza una lista que mezcla despensa y compras', () => {
    const filas = validar(FILA, [...FILA.slice(0, 2), 'compras', 'Sal', ...FILA.slice(4)]);
    expect(filas.map((f) => f.errores[0]?.columna)).toEqual(['tipo', 'tipo']);
  });
  it('exige las columnas obligatorias, sin duplicados ni desconocidas, y al menos una fila', () => {
    expect(() => validarListas([entrada(['fecha', 'lista'], 1)], HOY)).toThrow(
      expect.objectContaining({ codigo: 'COLUMNA_FALTANTE' }),
    );
    expect(() => validarListas([entrada([...COLUMNAS, 'fecha'], 1), entrada(FILA)], HOY)).toThrow(
      expect.objectContaining({ codigo: 'COLUMNAS_INVALIDAS' }),
    );
    expect(() => validarListas([entrada([...COLUMNAS, 'otra'], 1), entrada(FILA)], HOY)).toThrow(
      expect.objectContaining({ codigo: 'COLUMNAS_INVALIDAS' }),
    );
    expect(() => validarListas([entrada(COLUMNAS, 1)], HOY)).toThrow(
      expect.objectContaining({ codigo: 'ARCHIVO_VACIO' }),
    );
  });
  it('marca las unidades de presentación que el catálogo no conoce', () => {
    const filas = [
      lista({ presentacion: { cantidad: '2', unidad: 'lb' } }),
      lista({ presentacion: { cantidad: '1', unidad: 'saco' } }),
      lista({}),
    ];
    validarPresentaciones(filas, new Set(['lb', 'unidad']));
    expect(filas.map((f) => f.errores.length)).toEqual([0, 1, 0]);
    expect(filas[1]!.errores[0]).toMatchObject({ columna: 'presentacion' });
  });
});

describe('Lectura de listas y plantillas (HU-18)', () => {
  const xlsx = async (hojas: string[]) => {
    const libro = new Workbook();
    libro.addWorksheet('Menus').addRow(['fecha', 'tiempo_comida', 'platillo']);
    for (const nombre of hojas) libro.addWorksheet(nombre);
    return archivo(Buffer.from(await libro.xlsx.writeBuffer()), 'cuaderno.xlsx');
  };
  const conDatos = async (nombre = 'Listas') => {
    const libro = new Workbook();
    libro.addWorksheet('Menus').addRow(['fecha', 'tiempo_comida', 'platillo']);
    const hoja = libro.addWorksheet(nombre);
    hoja.addRow(COLUMNAS);
    hoja.addRow(FILA);
    return archivo(Buffer.from(await libro.xlsx.writeBuffer()), 'cuaderno.xlsx');
  };
  it('lee la hoja Listas del Excel solo en la carga del cuaderno', async () => {
    const r = await leerArchivo(await conDatos(), { conListas: true });
    expect(r.entradasListas).toHaveLength(2);
    expect(
      (await leerArchivo(await xlsx(['Listas']), { conListas: true })).entradasListas,
    ).toBeNull();
    await expect(leerArchivo(await conDatos())).rejects.toThrow(
      expect.objectContaining({ codigo: 'HOJA_NO_PERMITIDA' }),
    );
    await expect(leerArchivo(await conDatos('Otra'), { conListas: true })).rejects.toThrow(
      expect.objectContaining({ codigo: 'HOJA_NO_PERMITIDA' }),
    );
  });
  it('lee un CSV de listas aparte y rechaza otros formatos', () => {
    expect(leerListasCsv(archivo(`${COLUMNAS.join(',')}\n${FILA.join(',')}`))).toHaveLength(2);
    expect(() => leerListasCsv(archivo('x', 'listas.xlsx'))).toThrow(
      expect.objectContaining({ codigo: 'FORMATO_NO_PERMITIDO' }),
    );
    expect(() => leerListasCsv(archivo(Buffer.from([0xff, 0xfe, 0x00])))).toThrow(
      expect.objectContaining({ codigo: 'CSV_INVALIDO' }),
    );
  });
  it('la plantilla de listas en CSV se puede validar tal cual', async () => {
    const r = leerListasCsv(archivo(await generarPlantilla('csv', 'listas')));
    expect(validarListas(r, HOY).every((f) => !f.errores.length)).toBe(true);
  });
  it('la plantilla del cuaderno trae Menus, Listas e Instrucciones y se puede importar', async () => {
    const plantilla = archivo(await generarPlantilla('xlsx', 'cuaderno'), 'cuaderno.xlsx');
    const libro = new Workbook();
    await libro.xlsx.load(new Uint8Array(plantilla.buffer).buffer as ArrayBuffer);
    expect(libro.worksheets.map((h) => h.name)).toEqual(['Menus', 'Listas', 'Instrucciones']);
    const r = await leerArchivo(plantilla, { conListas: true });
    expect(validarListas(r.entradasListas!, HOY).every((f) => !f.errores.length)).toBe(true);
  });
  it('la plantilla normal no incluye la hoja Listas', async () => {
    const libro = new Workbook();
    const plantilla = await generarPlantilla('xlsx');
    await libro.xlsx.load(new Uint8Array(plantilla).buffer as ArrayBuffer);
    expect(libro.worksheets.map((h) => h.name)).toEqual(['Menus', 'Instrucciones']);
  });
});

describe('Resúmenes del reporte de conciliación (CA-18.1 y CA-18.2)', () => {
  it('resume cada lista con productos, total y productos nuevos', () => {
    const filas = [
      lista({ precio: '30.00', nombreNormalizado: 'leche', producto: 'Leche' }),
      lista({ precio: '784.00', nombreNormalizado: 'arroz' }),
      lista({ lista: 'Compras', tipo: 'COMPRAS', nombreNormalizado: 'sal' }),
    ];
    expect(resumirListas(filas, new Set(['arroz']))).toEqual([
      { lista: 'Despensa', tipo: 'DESPENSA', productos: 2, total: '814.00', nuevos: 1 },
      { lista: 'Compras', tipo: 'COMPRAS', productos: 1, total: null, nuevos: 1 },
    ]);
  });
  it('calcula mínimo, máximo y promedio al centavo e ignora semanas sin gasto', () => {
    expect(resumirGasto(['224.00', null, '241.75', '265.00'])).toEqual({
      semanas: 3,
      minimo: '224.00',
      maximo: '265.00',
      promedio: '243.58',
    });
    expect(resumirGasto([null, null])).toBeNull();
    expect(resumirGasto([])).toBeNull();
  });
});
