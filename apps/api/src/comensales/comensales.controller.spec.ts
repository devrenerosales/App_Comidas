import { ArgumentMetadata, ExecutionContext, ValidationPipe } from '@nestjs/common';
import { Rol } from '@menu/shared';
import type { Problema } from '../comun/problema';
import { crearErrorValidacion } from '../comun/validacion';
import type { RequestConHogar } from '../hogar/hogar.tipos';
import { AdminComensalesGuard } from './admin-comensales.guard';
import { ComensalesController, leerBandera } from './comensales.controller';
import type { ComensalesService } from './comensales.service';
import { CrearComensalDto, EditarComensalDto } from './dto/comensal.dto';

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  exceptionFactory: crearErrorValidacion,
});
const validar = (metatype: ArgumentMetadata['metatype'], valor: unknown) =>
  pipe.transform(valor, { type: 'body', metatype });

describe('ComensalesController', () => {
  const servicio = {
    listar: jest.fn().mockResolvedValue('lista'),
    crear: jest.fn().mockResolvedValue('creado'),
    editar: jest.fn().mockResolvedValue('editado'),
    inactivar: jest.fn().mockResolvedValue('inactivo'),
    reactivar: jest.fn().mockResolvedValue('activo'),
  };
  const ctrl = new ComensalesController(servicio as unknown as ComensalesService);

  it('RNF-06 delega siempre con el hogar resuelto por HogarGuard', async () => {
    await expect(ctrl.listar('h1', 'true')).resolves.toBe('lista');
    expect(servicio.listar).toHaveBeenCalledWith('h1', true);
    await ctrl.listar('h1');
    expect(servicio.listar).toHaveBeenLastCalledWith('h1', false);
    await ctrl.crear('h1', { nombre: 'Ana' });
    expect(servicio.crear).toHaveBeenCalledWith('h1', { nombre: 'Ana' });
    await ctrl.editar('h1', 'c1', { factorPorcion: 0.5 });
    expect(servicio.editar).toHaveBeenCalledWith('h1', 'c1', { factorPorcion: 0.5 });
    await ctrl.inactivar('h1', 'c1');
    expect(servicio.inactivar).toHaveBeenCalledWith('h1', 'c1');
    await ctrl.reactivar('h1', 'c1');
    expect(servicio.reactivar).toHaveBeenCalledWith('h1', 'c1');
  });

  it('?incluirInactivos acepta true o 1', () => {
    expect(leerBandera('true')).toBe(true);
    expect(leerBandera('1')).toBe(true);
    expect(leerBandera('false')).toBe(false);
    expect(leerBandera(undefined)).toBe(false);
  });
});

describe('AdminComensalesGuard (RN-10)', () => {
  const guard = new AdminComensalesGuard();
  const contexto = (req: Partial<RequestConHogar>) =>
    ({ switchToHttp: () => ({ getRequest: () => req }) }) as unknown as ExecutionContext;

  it('deja pasar al administrador', () => {
    expect(guard.canActivate(contexto({ hogar: { hogarId: 'h1', rol: Rol.ADMIN } }))).toBe(true);
  });

  it('CA-03.4 rechaza al miembro con "Solo el administrador puede modificar comensales"', () => {
    for (const req of [{ hogar: { hogarId: 'h1', rol: Rol.MIEMBRO } }, {}]) {
      try {
        guard.canActivate(contexto(req));
        throw new Error('Se esperaba 403');
      } catch (error) {
        expect((error as Problema).getResponse()).toMatchObject({
          status: 403,
          codigo: 'SOLO_ADMINISTRADOR',
          detail: 'Solo el administrador puede modificar comensales',
        });
      }
    }
  });
});

describe('DTO de comensales', () => {
  it('CrearComensalDto limpia el nombre y acepta factor número o texto', async () => {
    await expect(
      validar(CrearComensalDto, { nombre: '  Abuela   Carmen ', factorPorcion: '0.75' }),
    ).resolves.toEqual({ nombre: 'Abuela Carmen', factorPorcion: '0.75' });
    await expect(
      validar(CrearComensalDto, { nombre: 'Sofía', tipo: 'NINO', factorPorcion: 0.5 }),
    ).resolves.toMatchObject({ tipo: 'NINO', factorPorcion: 0.5 });
  });

  it('CA-03.6 factor 0, 2.25 o 0.3 → 422 FACTOR_INVALIDO', async () => {
    for (const factorPorcion of [0, 2.25, 0.3, '0.30', 'uno']) {
      await expect(validar(EditarComensalDto, { factorPorcion })).rejects.toMatchObject({
        status: 422,
        codigo: 'FACTOR_INVALIDO',
        detalle: 'El factor debe estar entre 0.25 y 2.0 en pasos de 0.25',
      });
    }
  });

  it('CU-01.3 E1 nombre vacío, no texto o de más de 60 → 422 NOMBRE_COMENSAL_INVALIDO', async () => {
    for (const nombre of ['  ', 5, 'x'.repeat(61)]) {
      await expect(validar(CrearComensalDto, { nombre })).rejects.toMatchObject({
        status: 422,
        codigo: 'NOMBRE_COMENSAL_INVALIDO',
      });
    }
    await expect(validar(EditarComensalDto, { nombre: '' })).rejects.toMatchObject({
      status: 422,
    });
  });

  it('EditarComensalDto admite un cuerpo vacío; tipo desconocido → 400', async () => {
    await expect(validar(EditarComensalDto, {})).resolves.toEqual({});
    await expect(validar(EditarComensalDto, { tipo: 'BEBE' })).rejects.toMatchObject({
      status: 400,
      codigo: 'VALIDACION',
    });
  });
});
