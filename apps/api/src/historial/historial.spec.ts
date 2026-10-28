import { HistorialService } from './historial.service';
import type { HistorialRepositorio } from './historial.repositorio';
import { HistorialController } from './historial.controller';

describe('Historial HU-15', () => {
  const repo = {
    guardar: jest.fn().mockResolvedValue({ id: 's1' }),
    listar: jest.fn().mockResolvedValue({ datos: [] }),
  };
  const hoy = new Date('2026-10-22T15:00:00Z');
  const servicio = new HistorialService(repo as unknown as HistorialRepositorio, () => hoy);
  const ctrl = new HistorialController(servicio);
  const datos = {
    fechaInicio: '2025-04-06',
    detalles: [{ fecha: '2025-04-06', tiempo: 'ALMUERZO' as const, platilloId: 'p1' }],
    reemplazar: false,
  };
  beforeEach(() => jest.clearAllMocks());
  it('valida y delega el hogar, usuario y reloj sin usar un hogar del cuerpo', async () => {
    await expect(ctrl.capturar('h1', 'u1', datos)).resolves.toEqual({ id: 's1' });
    expect(repo.guardar).toHaveBeenCalledWith('h1', 'u1', datos, hoy);
    const consulta = { pagina: 1, tamano: 20 };
    await expect(ctrl.listar('h1', consulta)).resolves.toEqual({ datos: [] });
    expect(repo.listar).toHaveBeenCalledWith('h1', consulta);
  });
  it('no escribe semanas no terminadas ni sin platillos', () => {
    expect(() => servicio.capturar('h1', 'u1', { ...datos, fechaInicio: '2026-10-18' })).toThrow(
      expect.objectContaining({ codigo: 'SEMANA_NO_TERMINADA' }),
    );
    expect(() => servicio.capturar('h1', 'u1', { ...datos, detalles: [] })).toThrow(
      expect.objectContaining({ codigo: 'SIN_PLATILLOS' }),
    );
    expect(repo.guardar).not.toHaveBeenCalled();
  });
  it.each([
    { desde: 'mal' },
    { hasta: '2025-02-31' },
    { desde: '2025-05-01', hasta: '2025-04-01' },
  ])('rechaza filtros inválidos %j', (filtros) => {
    expect(() => servicio.listar('h1', { ...filtros, pagina: 1, tamano: 20 })).toThrow(
      expect.objectContaining({ codigo: 'FECHAS_INVALIDAS' }),
    );
  });
  it('acepta un filtro válido y conserva los errores del repositorio', async () => {
    await servicio.listar('h1', {
      desde: '2025-04-01',
      hasta: '2025-04-30',
      pagina: 2,
      tamano: 20,
    });
    repo.guardar.mockRejectedValueOnce(new Error('BD caída'));
    await expect(servicio.capturar('h1', 'u1', datos)).rejects.toThrow('BD caída');
  });
});
