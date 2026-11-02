import { MenusController } from './menus.controller';
import type { MenusService } from './menus.service';

describe('MenusController (HU-19)', () => {
  const generar = jest.fn();
  const controlador = new MenusController({ generar } as unknown as MenusService);
  const dto = { semana: '2026-11-01' };
  const respuesta = () => ({ status: jest.fn() });

  it('un menú nuevo responde con el estado por defecto (201)', async () => {
    generar.mockResolvedValue({ creado: true, menu: 'menu' });
    const res = respuesta();
    await expect(controlador.generar('h1', dto, res as never)).resolves.toBe('menu');
    expect(generar).toHaveBeenCalledWith('h1', dto);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('regenerar un Borrador responde 200', async () => {
    generar.mockResolvedValue({ creado: false, menu: 'menu' });
    const res = respuesta();
    await controlador.generar('h1', { ...dto, regenerar: true }, res as never);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
