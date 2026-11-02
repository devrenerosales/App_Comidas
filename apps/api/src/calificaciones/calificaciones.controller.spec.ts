import { CalificacionesController } from './calificaciones.controller';
import type { CalificacionesService } from './calificaciones.service';

describe('CalificacionesController (HU-14)', () => {
  const servicio = { calificar: jest.fn().mockResolvedValue('calificado') };
  const controlador = new CalificacionesController(servicio as unknown as CalificacionesService);

  it('delega en el servicio con hogar, usuario, menú, comida y valor', async () => {
    await expect(controlador.calificar('h1', 'u1', 'm1', 'd1', { valor: 4 })).resolves.toBe(
      'calificado',
    );
    expect(servicio.calificar).toHaveBeenCalledWith('h1', 'u1', 'm1', 'd1', 4);
  });
});
