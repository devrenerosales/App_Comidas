import type { Db } from '@menu/db';
import type { HistorialRepositorio } from '../historial/historial.repositorio';
import { ImportacionesRepositorio } from './importaciones.repositorio';
import { validarFilas } from './importaciones.parser';

// Doble del transporte SQL. La atomicidad y los filtros de hogar se prueban en PostgreSQL.
function preparar(resultados: unknown[][], sugerencias: unknown[] = []) {
  const escrituras: { operacion: string; valores: unknown }[] = [];
  const consulta = (resultado: unknown[]) => {
    const cadena = {
      from: jest.fn(),
      where: jest.fn(),
      for: jest.fn(),
      orderBy: jest.fn(),
      limit: jest.fn(),
      offset: jest.fn(),
      leftJoin: jest.fn(),
      returning: jest.fn(),
      onConflictDoNothing: jest.fn(),
      then: (bien: (r: unknown[]) => unknown, mal?: (e: unknown) => unknown) =>
        Promise.resolve(resultado).then(bien, mal),
    };
    for (const metodo of [
      'from',
      'where',
      'for',
      'orderBy',
      'limit',
      'offset',
      'leftJoin',
      'returning',
      'onConflictDoNothing',
    ] as const)
      cadena[metodo].mockReturnValue(cadena);
    return cadena;
  };
  const select = jest.fn(() => {
    const siguiente = resultados.shift();
    if (!siguiente) throw new Error('Falta respuesta SQL de prueba');
    return consulta(siguiente);
  });
  const mutar = (operacion: string) => ({
    values: (valores: unknown) => {
      escrituras.push({ operacion, valores });
      return consulta([{ id: 'i1' }]);
    },
    set: (valores: unknown) => {
      escrituras.push({ operacion, valores });
      return consulta([]);
    },
    where: () => {
      escrituras.push({ operacion, valores: null });
      return consulta([]);
    },
  });
  const tx = {
    select,
    execute: jest.fn(async () => ({ rows: sugerencias })),
    insert: jest.fn(() => mutar('insert')),
    update: jest.fn(() => mutar('update')),
    delete: jest.fn(() => mutar('delete')),
  };
  const db = {
    ...tx,
    transaction: jest.fn(async (trabajo: (t: typeof tx) => unknown) => trabajo(tx)),
  };
  const historial = { guardarEnTransaccion: jest.fn().mockResolvedValue({ id: 'm1' }) };
  const repo = new ImportacionesRepositorio(
    db as unknown as Db,
    historial as unknown as HistorialRepositorio,
  );
  return { repo, db, historial, escrituras, resultados };
}
const CASA = [{ id: 'h1' }];
const CABECERA = {
  id: 'i1',
  estado: 'VISTA_PREVIA',
  nombreArchivo: 'menus.csv',
  totalFilas: 1,
  filasConError: 0,
  reporte: { revision: 'r1', versiones: {} },
};
const SEMANA = {
  semanaInicio: '2025-04-06',
  decision: 'CREAR',
  gastoSemana: '224.00',
  yaExiste: false,
};
const PLATO = {
  nombreOriginal: 'Sopa',
  nombreNormalizado: 'sopa',
  platilloId: 'p1',
  decision: 'ASOCIAR',
  similitud: '1.0000',
};
const FILAS = validarFilas(
  [
    { numeroFila: 1, valores: ['fecha', 'tiempo_comida', 'platillo'] },
    { numeroFila: 2, valores: ['2025-04-06', 'almuerzo', 'Sopa'] },
  ],
  '2026-10-27',
);
const HOY = new Date('2026-10-27T15:00:00Z');

describe('Orquestación segura de importaciones', () => {
  it('crea únicamente staging por lotes y devuelve vista con snapshot de semana anterior', async () => {
    const anterior = {
      id: 's1',
      version: 1,
      fechaInicio: '2025-04-06',
      fechaFin: '2025-04-12',
      estado: 'HISTORICO',
      gastoReal: '100.00',
    };
    const c = {
      ...CABECERA,
      reporte: { revision: 'r1', versiones: { '2025-04-06': { ...anterior, protegida: false } } },
    };
    const p = preparar([
      CASA,
      [PLATO],
      [],
      [anterior],
      CASA,
      [c],
      [{ ...SEMANA, decision: 'OMITIR', yaExiste: true }],
      [PLATO],
    ]);
    const r = await p.repo.crear(
      'h1',
      'u1',
      { originalname: 'menus.csv', buffer: Buffer.from('csv'), size: 3 },
      'CSV',
      FILAS,
    );
    expect(r).toMatchObject({
      revision: 'r1',
      puedeConfirmar: false,
      pendientes: [],
      semanas: [{ puedeReemplazar: true, existente: { id: 's1' } }],
    });
    expect(p.escrituras).toHaveLength(4);
    expect(p.historial.guardarEnTransaccion).not.toHaveBeenCalled();
    expect(p.escrituras[0]!.valores).toMatchObject({
      hogarId: 'h1',
      usuarioId: 'u1',
      estado: 'VISTA_PREVIA',
    });
  });
  it('marca filas erróneas y nombres pendientes sin crear catálogo', async () => {
    const filas = FILAS.map((f) => ({ ...f, errores: [{ columna: 'fecha', motivo: 'error' }] }));
    const p = preparar([
      CASA,
      [],
      [],
      [],
      CASA,
      [{ ...CABECERA, estado: 'CON_ERRORES', filasConError: 1 }],
      [SEMANA],
      [{ ...PLATO, platilloId: null, decision: 'PENDIENTE' }],
    ]);
    expect(
      await p.repo.crear(
        'h1',
        'u1',
        { originalname: '\u0000', buffer: Buffer.alloc(0), size: 0 },
        'CSV',
        filas,
      ),
    ).toMatchObject({ puedeConfirmar: false, pendientes: ['Sopa'] });
    expect(p.escrituras[0]!.valores).toMatchObject({
      nombreArchivo: 'archivo',
      estado: 'CON_ERRORES',
      filasConError: 1,
    });
  });
  it('rechaza hogares e importaciones inexistentes antes de escribir', async () => {
    const hogar = preparar([[]]);
    await expect(hogar.repo.obtener('h1', 'i1')).rejects.toMatchObject({ codigo: 'NO_ENCONTRADO' });
    const ajena = preparar([CASA, []]);
    await expect(ajena.repo.obtener('h1', 'i1')).rejects.toMatchObject({ codigo: 'NO_ENCONTRADO' });
    expect(ajena.escrituras).toHaveLength(0);
  });
  it('pagina filas y conserva el total de errores', async () => {
    const p = preparar([[CABECERA], [{ total: 2 }], [{ numeroFila: 12 }]]);
    expect(await p.repo.filas('h1', 'i1', { soloErrores: 'true', pagina: 2, tamano: 1 })).toEqual({
      datos: [{ numeroFila: 12 }],
      paginacion: { pagina: 2, tamano: 1, total: 2, totalPaginas: 2 },
    });
  });
  it.each([
    [{ ...CABECERA, estado: 'CANCELADA' }, 'r1', 'IMPORTACION_CERRADA'],
    [CABECERA, 'anterior', 'VISTA_DESACTUALIZADA'],
    [{ ...CABECERA, filasConError: 1 }, 'r1', 'FILAS_CON_ERROR'],
  ])('rechaza confirmación cerrada, vieja o con errores', async (c, revision, codigo) => {
    const p = preparar([CASA, [c]]);
    await expect(p.repo.confirmar('h1', 'u1', 'i1', revision as string, HOY)).rejects.toMatchObject(
      { codigo },
    );
    expect(p.escrituras).toHaveLength(0);
  });
  it('no confirma nombres pendientes ni un archivo con todas las semanas omitidas', async () => {
    const pendiente = preparar([
      CASA,
      [CABECERA],
      [{ ...PLATO, platilloId: null, decision: 'PENDIENTE' }],
    ]);
    await expect(pendiente.repo.confirmar('h1', 'u1', 'i1', 'r1', HOY)).rejects.toMatchObject({
      codigo: 'PLATILLOS_PENDIENTES',
      detalle: 'Falta 1 platillo por resolver',
    });
    const omitida = preparar([
      CASA,
      [CABECERA],
      [PLATO],
      FILAS.map((datos) => ({ datos })),
      [{ ...SEMANA, decision: 'OMITIR' }],
    ]);
    await expect(omitida.repo.confirmar('h1', 'u1', 'i1', 'r1', HOY)).rejects.toMatchObject({
      codigo: 'SIN_SEMANAS',
    });
  });
  it('confirma en la misma transacción y no llama a guardar para omitidas', async () => {
    const p = preparar([
      CASA,
      [CABECERA],
      [PLATO],
      FILAS.map((datos) => ({ datos })),
      [SEMANA, { ...SEMANA, semanaInicio: '2025-04-13', decision: 'OMITIR' }],
    ]);
    expect(await p.repo.confirmar('h1', 'u1', 'i1', 'r1', HOY)).toMatchObject({
      semanasCreadas: 1,
      omitidas: 1,
    });
    expect(p.historial.guardarEnTransaccion).toHaveBeenCalledTimes(1);
    expect(p.historial.guardarEnTransaccion).toHaveBeenCalledWith(
      expect.anything(),
      'h1',
      'u1',
      expect.objectContaining({ fechaInicio: SEMANA.semanaInicio, reemplazar: false }),
      HOY,
      'i1',
    );
    expect(p.escrituras[0]!.valores).toMatchObject({ estado: 'CONFIRMADA', confirmadaEn: HOY });
  });
  it('devuelve el reporte ya confirmado sin escribir otra vez', async () => {
    const reporte = { semanasCreadas: 1 };
    const p = preparar([CASA, [{ ...CABECERA, estado: 'CONFIRMADA', reporte }]]);
    expect(await p.repo.confirmar('h1', 'u1', 'i1', 'r1', HOY)).toEqual(reporte);
    expect(p.escrituras).toHaveLength(0);
  });
  it('valida de nuevo las semanas terminadas antes de guardar', async () => {
    const p = preparar([CASA, [CABECERA], [PLATO], FILAS.map((datos) => ({ datos })), [SEMANA]]);
    await expect(
      p.repo.confirmar('h1', 'u1', 'i1', 'r1', new Date('2025-04-08T15:00:00Z')),
    ).rejects.toMatchObject({ codigo: 'SEMANA_NO_TERMINADA' });
    expect(p.historial.guardarEnTransaccion).not.toHaveBeenCalled();
  });
  it('descarta staging al cancelar y no vuelve a borrar una cancelación repetida', async () => {
    const p = preparar([
      CASA,
      [CABECERA],
      CASA,
      [{ ...CABECERA, estado: 'CANCELADA', reporte: null }],
      [],
      [],
    ]);
    expect(await p.repo.cancelar('h1', 'i1', 'r1')).toMatchObject({
      estado: 'CANCELADA',
      revision: null,
    });
    expect(p.escrituras.filter((e) => e.operacion === 'delete')).toHaveLength(3);
    expect(p.historial.guardarEnTransaccion).not.toHaveBeenCalled();
    const repetida = preparar([
      CASA,
      [{ ...CABECERA, estado: 'CANCELADA' }],
      CASA,
      [{ ...CABECERA, estado: 'CANCELADA' }],
      [],
      [],
    ]);
    await repetida.repo.cancelar('h1', 'i1', 'r1');
    expect(repetida.escrituras).toHaveLength(0);
  });
  it('guarda la sugerencia más parecida de cada nombre pendiente y la similitud exacta de los automáticos', async () => {
    const filas = validarFilas(
      [
        { numeroFila: 1, valores: ['fecha', 'tiempo_comida', 'platillo'] },
        { numeroFila: 2, valores: ['2025-04-06', 'almuerzo', 'Sopa'] },
        { numeroFila: 3, valores: ['2025-04-07', 'almuerzo', 'Tortas de carne'] },
      ],
      '2026-10-27',
    );
    const p = preparar(
      [CASA, [{ id: 'p1', nombreNormalizado: 'sopa' }], [], [], CASA, [CABECERA], [], [], []],
      [{ nombre: 'tortas de carne', id: 'p2', similitud: 0.85 }],
    );
    await p.repo.crear(
      'h1',
      'u1',
      { originalname: 'menus.csv', buffer: Buffer.from('csv'), size: 3 },
      'CSV',
      filas,
    );
    expect(p.db.execute).toHaveBeenCalledTimes(1);
    const guardados = p.escrituras.find(
      (e) => Array.isArray(e.valores) && 'nombreNormalizado' in (e.valores[0] as object),
    )!.valores as Record<string, unknown>[];
    expect(guardados).toEqual([
      expect.objectContaining({
        nombreNormalizado: 'sopa',
        decision: 'ASOCIAR',
        platilloSugeridoId: 'p1',
        similitud: '1.0000',
      }),
      expect.objectContaining({
        nombreNormalizado: 'tortas de carne',
        decision: 'PENDIENTE',
        platilloSugeridoId: 'p2',
        similitud: '0.8500',
      }),
    ]);
  });
  it('crea el platillo incompleto con los tiempos de sus filas y guarda el alias al confirmar', async () => {
    const nuevo = {
      ...PLATO,
      nombreOriginal: 'Hilachas',
      nombreNormalizado: 'sopa',
      platilloId: null,
      decision: 'CREAR',
      similitud: null,
      nombreFinal: 'Hilachas de res',
      proteinaPrincipal: 'RES',
    };
    const p = preparar([CASA, [CABECERA], [nuevo], FILAS.map((datos) => ({ datos })), [SEMANA]]);
    expect(await p.repo.confirmar('h1', 'u1', 'i1', 'r1', HOY)).toMatchObject({
      semanasCreadas: 1,
      platillosCreados: 1,
      aliasCreados: 1,
    });
    const valores = p.escrituras.map((e) => e.valores as Record<string, unknown>);
    expect(valores).toContainEqual(
      expect.objectContaining({
        nombre: 'Hilachas de res',
        nombreNormalizado: 'hilachas de res',
        proteinaPrincipal: 'RES',
      }),
    );
    expect(valores).toContainEqual([expect.objectContaining({ tiempo: 'ALMUERZO' })]);
    expect(valores).toContainEqual(
      expect.objectContaining({
        alias: 'Hilachas',
        aliasNormalizado: 'sopa',
        origen: 'IMPORTACION',
      }),
    );
    expect(p.historial.guardarEnTransaccion).toHaveBeenCalledWith(
      expect.anything(),
      'h1',
      'u1',
      expect.objectContaining({ detalles: [expect.objectContaining({ platilloId: 'i1' })] }),
      HOY,
      'i1',
    );
  });
});
