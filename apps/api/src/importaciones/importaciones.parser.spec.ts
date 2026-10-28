import { Workbook } from 'exceljs';
import { deflateRawSync } from 'node:zlib';
import { generarPlantilla, leerArchivo, validarFilas } from './importaciones.parser';
import { validarContenedorXlsx } from './archivo-zip';
import { planificarSemanas, resolverNombres } from './importaciones.vista';
import type { MenuSemanal } from '@menu/db';
const HOY = '2026-10-26';
const entrada = (valores: string[], numeroFila = 2) => ({ valores, numeroFila });
const columnas = [
  'fecha',
  'tiempo_comida',
  'platillo',
  'dia',
  'gasto_semana_gtq',
  'notas',
  'proteina_principal',
];
const fila = ['2025-04-06', 'almuerzo', 'Pepián de pollo', 'domingo', '224', 'Nota', 'pollo'];
const validar = (valores = fila) => validarFilas([entrada(columnas, 1), entrada(valores)], HOY);
const archivo = (buffer: Buffer, nombre = 'menus.csv') => ({
  buffer,
  originalname: nombre,
  size: buffer.length,
});
async function excel(configurar: (libro: Workbook) => void) {
  const libro = new Workbook();
  configurar(libro);
  return archivo(Buffer.from(await libro.xlsx.writeBuffer()), 'menus.xlsx');
}

describe('Validación de importaciones', () => {
  it('normaliza nombres, comidas, gasto y domingo de inicio', () => {
    expect(
      validar(['2025-04-08', ' Almuerzo ', 'PEPIÁN DE POLLO', 'martes', '224.5', '', 'POLLO'])[0],
    ).toMatchObject({
      semanaInicio: '2025-04-06',
      tiempo: 'ALMUERZO',
      nombreNormalizado: 'pepian de pollo',
      gasto: '224.50',
      proteinaPrincipal: 'POLLO',
      errores: [],
    });
  });
  it.each([
    [0, '2025-02-30', 'fecha'],
    [0, '0000-01-01', 'fecha'],
    [0, '0001-01-01', 'fecha'],
    [0, '2026-10-26', 'fecha'],
    [1, 'almuerso', 'tiempo_comida'],
    [2, '', 'platillo'],
    [2, 'x'.repeat(81), 'platillo'],
    [3, 'lunes', 'dia'],
    [4, '0', 'gasto_semana_gtq'],
    [4, '-1', 'gasto_semana_gtq'],
    [4, '1.999', 'gasto_semana_gtq'],
    [4, '100000', 'gasto_semana_gtq'],
    [5, 'x'.repeat(201), 'notas'],
    [6, 'desconocida', 'proteina_principal'],
    [2, 'a\u0000b', 'platillo'],
  ])('detecta valor inválido %s/%s', (indice, valor, columna) => {
    const datos = [...fila];
    datos[indice as number] = valor as string;
    expect(validar(datos)[0]!.errores).toEqual(
      expect.arrayContaining([expect.objectContaining({ columna })]),
    );
  });
  it('permite columnas opcionales ausentes y gasto vacío', () => {
    expect(
      validarFilas([entrada(columnas.slice(0, 3), 1), entrada(fila.slice(0, 3))], HOY)[0],
    ).toMatchObject({ gasto: null, proteinaPrincipal: null, errores: [] });
  });
  it.each(['fecha', 'tiempo_comida', 'platillo'])(
    'explica columna obligatoria ausente: %s',
    (columna) => {
      expect(() => validarFilas([entrada(columnas.filter((c) => c !== columna))], HOY)).toThrow(
        expect.objectContaining({
          detalle: expect.stringContaining(`Falta la columna obligatoria: ${columna}`),
        }),
      );
    },
  );
  it.each([
    [...columnas, 'fecha'],
    [...columnas, 'ajena'],
  ])('rechaza encabezados duplicados o desconocidos', (...c) => {
    expect(() => validarFilas([entrada(c)], HOY)).toThrow(
      expect.objectContaining({ detalle: expect.stringContaining('Revisa las columnas') }),
    );
  });
  it('rechaza archivos sin datos y más de 5000 filas', () => {
    expect(() => validarFilas([entrada(columnas)], HOY)).toThrow(
      expect.objectContaining({ detalle: expect.stringContaining('no contiene filas') }),
    );
    expect(() =>
      validarFilas(
        [entrada(columnas), ...Array.from({ length: 5001 }, (_, i) => entrada(fila, i + 2))],
        HOY,
      ),
    ).toThrow(expect.objectContaining({ detalle: expect.stringContaining('5000') }));
  });
  it('marca ambos duplicados y gastos semanales distintos con números de fila', () => {
    const diferente = [...fila];
    diferente[4] = '241.75';
    const resultado = validarFilas(
      [entrada(columnas, 1), entrada(fila, 2), entrada(diferente, 5)],
      HOY,
    );
    for (const r of resultado)
      expect(r.errores).toEqual(
        expect.arrayContaining([
          { columna: 'tiempo_comida', motivo: 'Comida repetida en filas 2 y 5' },
          {
            columna: 'gasto_semana_gtq',
            motivo: 'Semana 2025-04-06: gasto distinto en filas 2 y 5',
          },
        ]),
      );
  });
  it('no intenta agrupar fecha o comida inválidas', () => {
    const r = validarFilas(
      [entrada(columnas), entrada(['mala', 'mala', 'Sopa']), entrada(['mala', 'mala', 'Sopa'], 3)],
      HOY,
    );
    expect(r[0]!.semanaInicio).toBeNull();
    expect(r[0]!.errores).toHaveLength(2);
  });
});

describe('Lectura y plantillas', () => {
  it.each(['csv', 'xlsx'] as const)('la plantilla %s se puede importar', async (formato) => {
    const buffer = await generarPlantilla(formato);
    const r = await leerArchivo(archivo(buffer, `plantilla.${formato}`));
    const filas = validarFilas(r.entradas, HOY);
    expect(filas).toHaveLength(7);
    expect(filas.every((f) => !f.errores.length)).toBe(true);
  });
  it('lee CSV con BOM, comas entre comillas y saltos de línea', async () => {
    const csv =
      '\ufefffecha,tiempo_comida,platillo,notas\r\n2025-04-06,almuerzo,"Pollo, arroz","Nota\r\nsegunda línea"\r\n';
    const r = validarFilas((await leerArchivo(archivo(Buffer.from(csv)))).entradas, HOY);
    expect(r[0]).toMatchObject({
      platillo: 'Pollo, arroz',
      notas: 'Nota\r\nsegunda línea',
      errores: [],
    });
  });
  it.each([Buffer.from([0xff]), Buffer.from('fecha,tiempo_comida,platillo\n"sin cerrar')])(
    'rechaza UTF-8 o sintaxis CSV inválidos',
    async (buffer) => {
      await expect(leerArchivo(archivo(buffer))).rejects.toThrow(
        expect.objectContaining({ detalle: expect.stringContaining('No se pudo leer el CSV') }),
      );
    },
  );
  it('rechaza formato, tamaño y XLSX corrupto', async () => {
    await expect(leerArchivo(archivo(Buffer.from('texto'), 'menu.xls'))).rejects.toThrow(
      expect.objectContaining({ detalle: expect.stringContaining('CSV o XLSX') }),
    );
    await expect(leerArchivo({ ...archivo(Buffer.alloc(1)), size: 5242881 })).rejects.toThrow(
      expect.objectContaining({ detalle: expect.stringContaining('5 MB') }),
    );
    await expect(leerArchivo(archivo(Buffer.alloc(5242881)))).rejects.toThrow(
      expect.objectContaining({ detalle: expect.stringContaining('5 MB') }),
    );
    await expect(leerArchivo(archivo(Buffer.from('nozip'), 'menu.xlsx'))).rejects.toThrow(
      expect.objectContaining({ detalle: expect.stringContaining('XLSX') }),
    );
  });
  it('lee fechas de Excel y texto enriquecido; reporta fórmulas sin ejecutarlas', async () => {
    const a = await excel((b) => {
      const h = b.addWorksheet('Menus');
      h.addRow(columnas);
      h.addRow([
        new Date('2025-04-06T00:00:00Z'),
        'almuerzo',
        { richText: [{ text: 'Sopa' }] },
        '',
        '',
        '',
        '',
      ]);
      h.addRow(['2025-04-07', 'cena', { formula: '1+1', result: 2 }]);
    });
    const filas = validarFilas((await leerArchivo(a)).entradas, HOY);
    expect(filas[0]).toMatchObject({ fecha: '2025-04-06', platillo: 'Sopa', errores: [] });
    expect(filas[1]!.errores).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          columna: 'platillo',
          motivo: expect.stringContaining('sin fórmulas'),
        }),
      ]),
    );
  });
  it('requiere hoja Menus, no descarta Listas y limita columnas', async () => {
    await expect(
      leerArchivo(
        await excel((b) => {
          b.addWorksheet('Otra');
        }),
      ),
    ).rejects.toThrow(
      expect.objectContaining({ detalle: expect.stringContaining('Falta la hoja') }),
    );
    await expect(
      leerArchivo(
        await excel((b) => {
          b.addWorksheet('Menus');
          b.addWorksheet('Listas').addRow(['algo']);
        }),
      ),
    ).rejects.toThrow(expect.objectContaining({ detalle: expect.stringContaining('únicamente') }));
    await expect(
      leerArchivo(
        await excel((b) => {
          b.addWorksheet('Menus').addRow(Array(33).fill('columna'));
        }),
      ),
    ).rejects.toThrow(expect.objectContaining({ codigo: 'XLSX_INVALIDO' }));
  });
  it('detecta exceso de filas incluso cuando se limita la lectura del CSV', async () => {
    const csv = 'fecha,tiempo_comida,platillo\n' + '2025-04-06,almuerzo,Sopa\n'.repeat(5002);
    expect(() => validarFilas).not.toThrow();
    const r = await leerArchivo(archivo(Buffer.from(csv)));
    expect(() => validarFilas(r.entradas, HOY)).toThrow(
      expect.objectContaining({ detalle: expect.stringContaining('5000') }),
    );
  });
  it('rechaza ZIP que declara o realmente expande más de 32 MB', () => {
    const contenido = deflateRawSync(Buffer.alloc(33 * 1024 * 1024));
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(contenido.length, 20);
    central.writeUInt32LE(1, 24);
    const fin = Buffer.alloc(22);
    fin.writeUInt32LE(0x06054b50);
    fin.writeUInt16LE(1, 10);
    fin.writeUInt32LE(46, 12);
    fin.writeUInt32LE(30 + contenido.length, 16);
    expect(() => validarContenedorXlsx(Buffer.concat([local, contenido, central, fin]))).toThrow(
      expect.objectContaining({ detalle: expect.stringContaining('descompresión') }),
    );
    central.writeUInt32LE(33 * 1024 * 1024, 24);
    expect(() => validarContenedorXlsx(Buffer.concat([local, contenido, central, fin]))).toThrow(
      expect.objectContaining({ detalle: expect.stringContaining('descompresión') }),
    );
  });
  it('rechaza índices de fila dispersos antes de construir el libro de Excel', async () => {
    const a = await excel((b) => {
      const h = b.addWorksheet('Menus');
      h.getRow(10002).getCell(1).value = 'dato';
    });
    await expect(leerArchivo(a)).rejects.toThrow(
      expect.objectContaining({ codigo: 'XLSX_INVALIDO' }),
    );
  });
});

describe('Plan de importación', () => {
  it('resuelve nombre canónico antes de alias y deja pendientes sin crear platillos', () => {
    expect(
      resolverNombres(
        validar(),
        [{ id: 'p1', nombreNormalizado: 'pepian de pollo' }],
        [{ platilloId: 'p2', aliasNormalizado: 'pepian de pollo' }],
      )[0],
    ).toMatchObject({ decision: 'ASOCIAR', platilloId: 'p1' });
    expect(
      resolverNombres(
        validar(),
        [],
        [{ platilloId: 'p2', aliasNormalizado: 'pepian de pollo' }],
      )[0]!.platilloId,
    ).toBe('p2');
    expect(resolverNombres(validar(), [], [])[0]).toMatchObject({
      decision: 'PENDIENTE',
      platilloId: null,
    });
  });
  it('crea nuevas, omite existentes y protege menús activos o solapados', () => {
    const filas = validar();
    expect(planificarSemanas(filas, [])[0]).toMatchObject({ decision: 'CREAR', instantanea: null });
    const anterior = {
      id: 's1',
      fechaInicio: '2025-04-06',
      fechaFin: '2025-04-12',
      version: 1,
      gastoReal: '100',
      estado: 'HISTORICO',
    } as MenuSemanal;
    expect(planificarSemanas(filas, [anterior])[0]).toMatchObject({
      decision: 'OMITIR',
      instantanea: { protegida: false },
    });
    for (const s of [
      { ...anterior, estado: 'BORRADOR' },
      { ...anterior, fechaInicio: '2025-04-05' },
    ])
      expect(planificarSemanas(filas, [s as MenuSemanal])[0]!.instantanea!.protegida).toBe(true);
    expect(planificarSemanas(filas, [anterior, anterior])[0]!.instantanea!.protegida).toBe(true);
  });
});
