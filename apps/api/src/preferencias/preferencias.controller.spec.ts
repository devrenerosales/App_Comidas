import { PreferenciasController } from './preferencias.controller';
import type { PreferenciasService } from './preferencias.service';

describe('PreferenciasController (HU-10)', () => {
  const servicio = {
    obtener: jest.fn().mockResolvedValue('vista'),
    vistaPrevia: jest.fn().mockResolvedValue('previa'),
    guardar: jest.fn().mockResolvedValue('guardado'),
  };
  const controlador = new PreferenciasController(servicio as unknown as PreferenciasService);
  const dto = { ingredientesExcluidos: ['p1'], favoritos: ['d1'] };

  it('delega en el servicio con el hogar del usuario', async () => {
    await expect(controlador.obtener('h1')).resolves.toBe('vista');
    await expect(controlador.vistaPrevia('h1', dto)).resolves.toBe('previa');
    await expect(controlador.guardar('h1', dto)).resolves.toBe('guardado');
    expect(servicio.obtener).toHaveBeenCalledWith('h1');
    expect(servicio.vistaPrevia).toHaveBeenCalledWith('h1', dto);
    expect(servicio.guardar).toHaveBeenCalledWith('h1', dto);
  });
});
