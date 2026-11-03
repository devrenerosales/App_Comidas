import { Problema } from '../comun/problema';
import type { ListasRepositorio } from './listas.repositorio';
import { ListasService } from './listas.service';

describe('ListasService (HU-28)', () => {
  const repo = { cargar: jest.fn() };
  const servicio = new ListasService(repo as unknown as ListasRepositorio);

  it('devuelve la lista del hogar', async () => {
    repo.cargar.mockResolvedValue({
      id: 'l1',
      menuId: 'm1',
      version: 1,
      fechaInicio: '2026-11-01',
      fechaFin: '2026-11-07',
      excesoAlAprobar: null,
      items: [],
    });
    await expect(servicio.obtener('h1', 'l1')).resolves.toMatchObject({ id: 'l1', total: 0 });
    expect(repo.cargar).toHaveBeenCalledWith('h1', 'l1');
  });

  it('una lista de otro hogar o inexistente es 404', async () => {
    repo.cargar.mockResolvedValue(undefined);
    const error = await servicio.obtener('h1', 'lx').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Problema);
    expect((error as Problema).getStatus()).toBe(404);
  });
});
