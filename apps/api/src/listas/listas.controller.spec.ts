import { ListasController } from './listas.controller';
import type { ListasService } from './listas.service';

describe('ListasController (HU-28)', () => {
  it('lee la lista del hogar', async () => {
    const obtener = jest.fn().mockResolvedValue('lista');
    const controlador = new ListasController({ obtener } as unknown as ListasService);
    await expect(controlador.obtener('h1', 'l1')).resolves.toBe('lista');
    expect(obtener).toHaveBeenCalledWith('h1', 'l1');
  });
});
