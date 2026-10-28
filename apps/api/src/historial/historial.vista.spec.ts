import {
  cabeceraHistorica,
  paginaHistorial,
  valoresHistoricos,
  filasComidasHistoricas,
  filasTiemposHistoricos,
  type CabeceraHistorica,
  type FilaComidaHistorica,
} from './historial.vista';

const ahora = new Date('2026-10-22T15:00:00Z');
const base = { fechaInicio: '2025-04-06', detalles: [], reemplazar: false };
const semana: CabeceraHistorica = {
  id: 's1',
  fechaInicio: '2025-04-06',
  fechaFin: '2025-04-12',
  estado: 'HISTORICO',
  origen: 'CAPTURA_MANUAL',
  gastoReal: '248.50',
  notas: 'Cuaderno',
  version: 1,
};
describe('Respuesta y persistencia del historial', () => {
  it('conserva apariciones del mismo platillo en días y tiempos diferentes con atribución de captura', () => {
    const detalles = [
      { fecha: '2025-04-06', tiempo: 'ALMUERZO' as const, platilloId: 'p1' },
      { fecha: '2025-04-07', tiempo: 'ALMUERZO' as const, platilloId: 'p1' },
      { fecha: '2025-04-07', tiempo: 'CENA' as const, platilloId: 'p1' },
    ];
    const filas = filasComidasHistoricas('s1', 'u1', ahora, detalles);
    expect(filas).toHaveLength(3);
    expect(filas[1]).toEqual({
      ...detalles[1],
      menuId: 's1',
      origen: 'HISTORICO',
      modificadoPorId: 'u1',
      modificadoEn: ahora,
    });
    expect(filasTiemposHistoricos('s1', detalles)).toEqual([
      { menuId: 's1', tiempo: 'ALMUERZO', porcentaje: '0.00', presupuesto: '0.00' },
      { menuId: 's1', tiempo: 'CENA', porcentaje: '0.00', presupuesto: '0.00' },
    ]);
  });
  it('normaliza centavos y registra quién capturó el gasto, sin repartirlo', () => {
    expect(
      valoresHistoricos({ ...base, gastoReal: '248.5', notas: '  Cuaderno  ' }, 'u1', ahora),
    ).toMatchObject({
      gastoReal: '248.50',
      notas: 'Cuaderno',
      gastoRegistradoPorId: 'u1',
      gastoRegistradoEn: ahora,
      fechaFin: '2025-04-12',
    });
  });
  it.each([undefined, null])(
    'sin gasto no inventa un importe ni autor de gasto: %s',
    (gastoReal) => {
      expect(valoresHistoricos({ ...base, gastoReal }, 'u1', ahora)).toMatchObject({
        gastoReal: null,
        notas: null,
        gastoRegistradoPorId: null,
        gastoRegistradoEn: null,
      });
      expect(valoresHistoricos({ ...base, notas: '  ' }, 'u1', ahora).notas).toBeNull();
    },
  );
  it('limita la cabecera pública y conserva la versión', () => {
    const fila = { ...semana, hogarId: 'h-privado', actualizadoPorId: 'u1' };
    expect(cabeceraHistorica(fila)).toEqual(semana);
  });
  it('agrupa por semana y ordena por fecha y desayuno, almuerzo, cena', () => {
    const comida = { menuId: 's1', fecha: '2025-04-06', platilloId: 'p1', nombre: 'Pepián' };
    const detalles: FilaComidaHistorica[] = [
      { ...comida, tiempo: 'CENA' },
      { ...comida, tiempo: 'DESAYUNO' },
      { ...comida, tiempo: 'ALMUERZO' },
      { ...comida, fecha: '2025-04-07', tiempo: 'ALMUERZO' },
      { ...comida, menuId: 's2', tiempo: 'ALMUERZO', nombre: null },
    ];
    const resultado = paginaHistorial(
      [semana, { ...semana, id: 's2' }],
      detalles,
      { pagina: 2, tamano: 2 },
      3,
    );
    expect(resultado.datos[0]!.detalles.map((d) => d.tiempo)).toEqual([
      'DESAYUNO',
      'ALMUERZO',
      'CENA',
      'ALMUERZO',
    ]);
    expect(resultado.datos[1]!.detalles).toHaveLength(1);
    expect(resultado.datos[1]!.detalles[0]!.nombre).toBeNull();
    expect(resultado.datos[0]!.detalles[0]).not.toHaveProperty('menuId');
    expect(resultado.paginacion).toEqual({ pagina: 2, tamano: 2, total: 3, totalPaginas: 2 });
    expect(paginaHistorial([], [], { pagina: 1, tamano: 20 }, 0).datos).toEqual([]);
  });
});
