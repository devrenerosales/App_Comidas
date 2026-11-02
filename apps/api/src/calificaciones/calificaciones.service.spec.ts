import { Problema } from '../comun/problema';
import type { CalificacionesRepositorio, DetalleParaCalificar } from './calificaciones.repositorio';
import { CalificacionesService } from './calificaciones.service';

const HOY = new Date('2026-11-12T15:00:00.000Z');

async function problema(promesa: Promise<unknown>): Promise<[number, string]> {
  try {
    await promesa;
  } catch (error) {
    if (error instanceof Problema) return [error.getStatus(), error.codigo];
    throw error;
  }
  throw new Error('Se esperaba un Problema');
}

describe('CalificacionesService (HU-14)', () => {
  const repo = { buscarDetalle: jest.fn(), guardar: jest.fn() };
  const servicio = new CalificacionesService(
    repo as unknown as CalificacionesRepositorio,
    () => HOY,
  );
  const detalle = (extra: Partial<DetalleParaCalificar> = {}): DetalleParaCalificar => ({
    id: 'd1',
    fecha: '2026-11-10',
    platilloId: 'p1',
    estadoMenu: 'APROBADO',
    ...extra,
  });
  const calificar = (valor: number) => servicio.calificar('h1', 'u1', 'm1', 'd1', valor);

  beforeEach(() => {
    jest.resetAllMocks();
    repo.buscarDetalle.mockResolvedValue(detalle());
    repo.guardar.mockResolvedValue({
      id: 'p1',
      calificacionPromedio: '4.00',
      calificacionConteo: 1,
    });
  });

  it('guarda la calificación y devuelve el promedio del platillo', async () => {
    const r = await calificar(4);
    expect(repo.buscarDetalle).toHaveBeenCalledWith('h1', 'm1', 'd1');
    expect(repo.guardar).toHaveBeenCalledWith('d1', 'p1', 'u1', 4);
    expect(r).toEqual({
      valor: 4,
      platillo: { id: 'p1', calificacionPromedio: '4.00', calificacionConteo: 1 },
    });
  });

  it.each([0, 6, -1, 2.5, Number.NaN])('el valor %s está fuera de rango (422)', async (valor) => {
    expect(await problema(calificar(valor))).toEqual([422, 'CALIFICACION_FUERA_DE_RANGO']);
    expect(repo.buscarDetalle).not.toHaveBeenCalled();
  });

  it.each([1, 5])('acepta los extremos %s', async (valor) => {
    await expect(calificar(valor)).resolves.toMatchObject({ valor });
  });

  it('una comida inexistente o de otro hogar es 404', async () => {
    repo.buscarDetalle.mockResolvedValue(undefined);
    expect(await problema(calificar(4))).toEqual([404, 'NO_ENCONTRADO']);
  });

  it('un menú en borrador es 409; aprobado e histórico sí se califican', async () => {
    repo.buscarDetalle.mockResolvedValue(detalle({ estadoMenu: 'BORRADOR' }));
    expect(await problema(calificar(4))).toEqual([409, 'MENU_NO_APROBADO']);
    repo.buscarDetalle.mockResolvedValue(detalle({ estadoMenu: 'HISTORICO' }));
    await expect(calificar(4)).resolves.toBeDefined();
  });

  it('un espacio sin platillo es 422 SIN_PLATILLO', async () => {
    repo.buscarDetalle.mockResolvedValue(detalle({ platilloId: null }));
    expect(await problema(calificar(4))).toEqual([422, 'SIN_PLATILLO']);
  });

  it('una fecha futura es 422 y la de hoy (hora de Guatemala) se permite', async () => {
    repo.buscarDetalle.mockResolvedValue(detalle({ fecha: '2026-11-13' }));
    expect(await problema(calificar(4))).toEqual([422, 'FECHA_FUTURA']);
    repo.buscarDetalle.mockResolvedValue(detalle({ fecha: '2026-11-12' }));
    await expect(calificar(4)).resolves.toBeDefined();
    expect(repo.guardar).toHaveBeenCalledTimes(1);
  });
});
