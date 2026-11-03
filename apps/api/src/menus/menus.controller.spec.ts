import type { Problema } from '../comun/problema';
import { MenusController } from './menus.controller';
import type { MenusAlternativaService } from './menus-alternativa.service';
import type { MenusAprobacionService } from './menus-aprobacion.service';
import type { MenusEdicionService } from './menus-edicion.service';
import type { MenusService } from './menus.service';

describe('MenusController (HU-19, HU-22, HU-23, HU-24, HU-25)', () => {
  const generar = jest.fn();
  const edicion = {
    obtenerPorSemana: jest.fn().mockResolvedValue('semana'),
    obtener: jest.fn().mockResolvedValue('menu'),
    costos: jest.fn().mockResolvedValue('costos'),
    listaDelMenu: jest.fn().mockResolvedValue('l1'),
    editar: jest.fn().mockResolvedValue('editado'),
    mover: jest.fn().mockResolvedValue('movido'),
    fijar: jest.fn().mockResolvedValue('fijado'),
    motivo: jest.fn().mockResolvedValue('motivo'),
  };
  const aprobar = jest.fn().mockResolvedValue('aprobado');
  const alternativa = jest.fn().mockResolvedValue('alternativa');
  const controlador = new MenusController(
    { generar } as unknown as MenusService,
    edicion as unknown as MenusEdicionService,
    { aprobar } as unknown as MenusAprobacionService,
    { alternativa } as unknown as MenusAlternativaService,
  );
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

  it('lee el menú por id y por la fecha de su semana', async () => {
    await expect(controlador.obtener('h1', 'm1')).resolves.toBe('menu');
    await expect(controlador.porSemana('h1', '2026-11-03')).resolves.toBe('semana');
    expect(edicion.obtenerPorSemana).toHaveBeenCalledWith('h1', '2026-11-03');
  });

  it('CU-07.1 redirige a la lista del menú aprobado (303)', async () => {
    const redirect = jest.fn();
    await controlador.lista('h1', 'm1', { redirect } as never);
    expect(edicion.listaDelMenu).toHaveBeenCalledWith('h1', 'm1');
    expect(redirect).toHaveBeenCalledWith(303, '/api/v1/listas/l1');
  });

  it('CU-06.3 lee los costos del menú', async () => {
    await expect(controlador.costos('h1', 'm1')).resolves.toBe('costos');
    expect(edicion.costos).toHaveBeenCalledWith('h1', 'm1');
  });

  it('una fecha mal formada es "sin menú" (404)', () => {
    let error: unknown;
    try {
      controlador.porSemana('h1', 'noviembre');
    } catch (e) {
      error = e;
    }
    expect(error).toMatchObject({ codigo: 'SIN_MENU' });
    expect((error as Problema).getStatus()).toBe(404);
  });

  it('delega editar, mover y fijar con hogar, usuario y menú', async () => {
    await expect(controlador.editar('h1', 'u1', 'm1', 'd1', { platilloId: 'p1' })).resolves.toBe(
      'editado',
    );
    const mover = { origenDetalleId: 'a', destinoDetalleId: 'b' };
    await expect(controlador.mover('h1', 'u1', 'm1', mover)).resolves.toBe('movido');
    await expect(controlador.fijar('h1', 'u1', 'm1', 'd1', { fijado: true })).resolves.toBe(
      'fijado',
    );
    expect(edicion.editar).toHaveBeenCalledWith('h1', 'u1', 'm1', 'd1', { platilloId: 'p1' });
    expect(edicion.mover).toHaveBeenCalledWith('h1', 'u1', 'm1', mover);
    expect(edicion.fijar).toHaveBeenCalledWith('h1', 'u1', 'm1', 'd1', { fijado: true });
  });

  it('delega aprobar con hogar, usuario, menú y versión', async () => {
    await expect(controlador.aprobar('h1', 'u1', 'm1', { version: 4 })).resolves.toBe('aprobado');
    expect(aprobar).toHaveBeenCalledWith('h1', 'u1', 'm1', { version: 4 });
  });

  it('delega el motivo con hogar, menú y espacio (HU-22)', async () => {
    await expect(controlador.motivo('h1', 'm1', 'd1')).resolves.toBe('motivo');
    expect(edicion.motivo).toHaveBeenCalledWith('h1', 'm1', 'd1');
  });

  it('delega la alternativa con hogar, usuario, menú y espacio (HU-23)', async () => {
    await expect(controlador.alternativa('h1', 'u1', 'm1', 'd1')).resolves.toBe('alternativa');
    expect(alternativa).toHaveBeenCalledWith('h1', 'u1', 'm1', 'd1');
  });
});
