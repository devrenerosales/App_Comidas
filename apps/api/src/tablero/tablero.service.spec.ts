import { TableroService } from './tablero.service';
import type { SemanaTablero, TableroRepositorio } from './tablero.repositorio';

const semana = (extra: Partial<SemanaTablero> = {}): SemanaTablero => ({
  id: 'm1',
  fechaInicio: '2026-11-01',
  fechaFin: '2026-11-07',
  estado: 'APROBADO',
  presupuestoSemanal: '250.00',
  costoEstimado: '230.00',
  gastoReal: '180.50',
  ...extra,
});

function crear(actual: SemanaTablero | null, historial: SemanaTablero[] = []) {
  const repo = {
    semanaActual: jest.fn().mockResolvedValue(actual),
    historial: jest.fn().mockResolvedValue(historial),
    consumo: jest
      .fn()
      .mockResolvedValue({ planificadas: 21, hastaHoy: 12, costoHastaHoy: '131.25' }),
    comidasDeHoy: jest.fn().mockResolvedValue([
      { tiempo: 'CENA', platillo: 'Pepián', costoEstimado: '30.00' },
      { tiempo: 'DESAYUNO', platillo: null, costoEstimado: null },
    ]),
    tiempos: jest.fn().mockResolvedValue([
      { tiempo: 'CENA', presupuesto: '80.00', costoEstimado: '70.00' },
      { tiempo: 'DESAYUNO', presupuesto: '50.00', costoEstimado: '45.00' },
    ]),
  };
  // 2026-11-04 15:00 UTC = 09:00 en Guatemala.
  const servicio = new TableroService(
    repo as unknown as TableroRepositorio,
    () => new Date('2026-11-04T15:00:00Z'),
  );
  return { repo, servicio };
}

describe('TableroService', () => {
  it('combina la semana actual, su consumo y el historial', async () => {
    const { repo, servicio } = crear(semana(), [semana()]);
    const t = await servicio.obtener('h1');
    expect(t.hoy).toBe('2026-11-04');
    expect(t.semanaActual).toMatchObject({
      presupuesto: '250.00',
      gastoReal: '180.50',
      comidasPlanificadas: 21,
      comidasHastaHoy: 12,
      costoEstimadoHastaHoy: '131.25',
    });
    expect(t.historial).toHaveLength(1);
    // Desayuno primero, aunque la base los devuelva en otro orden.
    expect(t.semanaActual?.comidasDeHoy.map((c) => c.tiempo)).toEqual(['DESAYUNO', 'CENA']);
    expect(t.semanaActual?.tiempos.map((c) => c.tiempo)).toEqual(['DESAYUNO', 'CENA']);
    expect(repo.consumo).toHaveBeenCalledWith('m1', '2026-11-04');
  });

  it('sin semana actual no consulta el consumo', async () => {
    const { repo, servicio } = crear(null);
    const t = await servicio.obtener('h1');
    expect(t.semanaActual).toBeNull();
    expect(repo.consumo).not.toHaveBeenCalled();
    expect(repo.comidasDeHoy).not.toHaveBeenCalled();
  });

  it.each([
    [undefined, 8],
    ['4', 4],
    ['100', 26],
    ['0', 8],
    ['abc', 8],
  ])('semanas=%s pide %i semanas', async (entrada, esperado) => {
    const { repo, servicio } = crear(null);
    await servicio.obtener('h1', entrada);
    expect(repo.historial).toHaveBeenCalledWith('h1', esperado);
  });
});
