import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MENSAJES_CONFIGURACION, Rol } from '@menu/shared';
import { Problema } from '../comun/problema';
import { ConfiguracionController } from './configuracion.controller';
import type { ConfiguracionService } from './configuracion.service';
import { MENSAJE_SOLO_ADMIN, SoloAdminGuard } from './solo-admin.guard';

describe('ConfiguracionController', () => {
  const servicio = {
    obtener: jest.fn().mockResolvedValue('config'),
    vistaPrevia: jest.fn().mockResolvedValue('vista'),
    guardarTiempos: jest.fn().mockResolvedValue('tiempos'),
    guardarPresupuesto: jest.fn().mockResolvedValue('presupuesto'),
  };
  const ctrl = new ConfiguracionController(servicio as unknown as ConfiguracionService);

  it('delega siempre con el hogar resuelto por HogarGuard (RNF-06)', async () => {
    await expect(ctrl.obtener('h1')).resolves.toBe('config');
    expect(servicio.obtener).toHaveBeenCalledWith('h1');
    const previa = { tiempos: ['ALMUERZO' as const] };
    await expect(ctrl.vistaPrevia('h1', previa)).resolves.toBe('vista');
    expect(servicio.vistaPrevia).toHaveBeenCalledWith('h1', previa);
    const tiempos = { version: 1, tiempos: [{ tiempo: 'ALMUERZO' as const, porcentaje: '100' }] };
    await expect(ctrl.guardarTiempos('h1', 'u1', tiempos)).resolves.toBe('tiempos');
    expect(servicio.guardarTiempos).toHaveBeenCalledWith('h1', 'u1', tiempos);
    const presupuesto = { version: 1, presupuestoSemanal: '500' };
    await expect(ctrl.guardarPresupuesto('h1', 'u1', presupuesto)).resolves.toBe('presupuesto');
    expect(servicio.guardarPresupuesto).toHaveBeenCalledWith('h1', 'u1', presupuesto);
  });

  it('CA-05.4 los guardados y la vista previa son solo del administrador', () => {
    const reflector = new Reflector();
    const mensaje = (metodo: keyof ConfiguracionController) =>
      reflector.get<string | undefined>(
        MENSAJE_SOLO_ADMIN,
        ConfiguracionController.prototype[metodo],
      );
    expect(mensaje('obtener')).toBeUndefined();
    expect(mensaje('vistaPrevia')).toBe(MENSAJES_CONFIGURACION.soloAdminTiempos);
    expect(mensaje('guardarTiempos')).toBe(MENSAJES_CONFIGURACION.soloAdminTiempos);
    expect(mensaje('guardarPresupuesto')).toBe(MENSAJES_CONFIGURACION.soloAdminConfiguracion);
  });
});

describe('SoloAdminGuard (RN-10)', () => {
  const contexto = (rol: Rol | undefined, mensaje: string | undefined) => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(mensaje) };
    const ctx = {
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({
        getRequest: () => ({ hogar: rol ? { hogarId: 'h1', rol } : undefined }),
      }),
    } as unknown as ExecutionContext;
    return { guard: new SoloAdminGuard(reflector as unknown as Reflector), ctx };
  };

  it('deja pasar rutas sin @SoloAdmin y al administrador', () => {
    const libre = contexto(Rol.MIEMBRO, undefined);
    expect(libre.guard.canActivate(libre.ctx)).toBe(true);
    const admin = contexto(Rol.ADMIN, 'mensaje');
    expect(admin.guard.canActivate(admin.ctx)).toBe(true);
  });

  it('CA-05.4 el miembro recibe 403 SOLO_ADMINISTRADOR con el mensaje de la ruta', () => {
    const { guard, ctx } = contexto(Rol.MIEMBRO, MENSAJES_CONFIGURACION.soloAdminTiempos);
    expect(() => guard.canActivate(ctx)).toThrow(Problema);
    try {
      guard.canActivate(ctx);
    } catch (error) {
      expect((error as Problema).getStatus()).toBe(403);
      expect((error as Problema).codigo).toBe('SOLO_ADMINISTRADOR');
      expect((error as Problema).detalle).toBe(
        'Solo el administrador puede cambiar los tiempos de comida',
      );
    }
    const sinHogar = contexto(undefined, 'x');
    expect(() => sinHogar.guard.canActivate(sinHogar.ctx)).toThrow(Problema);
  });
});
