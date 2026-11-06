import { Problema } from '../comun/problema';
import { AvisosService } from './avisos.service';
import type { AvisosRepositorio } from './avisos.repositorio';

describe('AvisosService (HU-38)', () => {
  const repo = { listar: jest.fn(), marcarLeido: jest.fn() };
  const AHORA = new Date('2026-10-25T12:00:00Z');
  const servicio = new AvisosService(repo as unknown as AvisosRepositorio, () => AHORA);

  beforeEach(() => jest.resetAllMocks());

  it('lista los avisos del hogar con fecha ISO y si ya se leyeron', async () => {
    repo.listar.mockResolvedValue([
      {
        id: 'a1',
        tipo: 'CORRIDA_FALLIDA',
        titulo: 'Paiz',
        mensaje: 'Paiz: 50 productos sin actualizar',
        createdAt: new Date('2026-10-24T21:00:00Z'),
        leidoEn: null,
      },
      {
        id: 'a2',
        tipo: 'SITIO_BLOQUEADO',
        titulo: 'Walmart bloqueado',
        mensaje: 'Walmart bloqueado: registra precios manualmente',
        createdAt: new Date('2026-10-23T21:00:00Z'),
        leidoEn: new Date('2026-10-24T08:00:00Z'),
      },
    ]);
    const r = await servicio.listar('h1', true);
    expect(repo.listar).toHaveBeenCalledWith('h1', true);
    expect(r.map((a) => [a.id, a.leido, a.createdAt])).toEqual([
      ['a1', false, '2026-10-24T21:00:00.000Z'],
      ['a2', true, '2026-10-23T21:00:00.000Z'],
    ]);
  });

  it('marca un aviso como leído con la hora del reloj', async () => {
    repo.marcarLeido.mockResolvedValue(true);
    await expect(servicio.marcarLeido('h1', 'u1', 'a1')).resolves.toBeUndefined();
    expect(repo.marcarLeido).toHaveBeenCalledWith('h1', 'u1', 'a1', AHORA);
  });

  it('un aviso que no existe o es de otro hogar es 404', async () => {
    repo.marcarLeido.mockResolvedValue(false);
    const error = await servicio.marcarLeido('h1', 'u1', 'a9').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Problema);
    expect((error as Problema).getStatus()).toBe(404);
  });
});
