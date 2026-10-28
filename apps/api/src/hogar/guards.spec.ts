import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Rol } from '@menu/shared';
import { Problema } from '../comun/problema';
import { extraerHogarActual } from './decoradores/hogar-actual.decorator';
import { Roles, ROLES_PERMITIDOS } from './decoradores/roles.decorator';
import { HogarGuard } from './hogar.guard';
import type { HogarRepositorio } from './hogar.repositorio';
import type { RequestConHogar } from './hogar.tipos';
import { rolCumple, RolesGuard } from './roles.guard';

function contexto(req: Partial<RequestConHogar>): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

function codigoDe(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (error) {
    return (error as Problema).codigo;
  }
  return undefined;
}

describe('HogarGuard (RNF-06)', () => {
  const hogares = { membresiaDe: jest.fn() };
  const guard = new HogarGuard(hogares as unknown as HogarRepositorio);

  beforeEach(() => jest.resetAllMocks());

  it('toma el hogar y el rol de la base, no del token', async () => {
    hogares.membresiaDe.mockResolvedValue({ hogarId: 'h-bd', rol: Rol.MIEMBRO });
    const req: Partial<RequestConHogar> = {
      usuario: { id: 'u1', hogarId: 'h-token', rol: Rol.ADMIN },
    };
    await expect(guard.canActivate(contexto(req))).resolves.toBe(true);
    expect(hogares.membresiaDe).toHaveBeenCalledWith('u1');
    expect(req.hogar).toEqual({ hogarId: 'h-bd', rol: Rol.MIEMBRO });
  });

  it('sin hogar → 403 SIN_HOGAR', async () => {
    hogares.membresiaDe.mockResolvedValue(null);
    const promesa = guard.canActivate(
      contexto({ usuario: { id: 'u1', hogarId: null, rol: null } }),
    );
    await expect(promesa).rejects.toMatchObject({ codigo: 'SIN_HOGAR' });
  });

  it('sin usuario autenticado → 401', async () => {
    await expect(guard.canActivate(contexto({}))).rejects.toMatchObject({
      codigo: 'NO_AUTENTICADO',
    });
    expect(hogares.membresiaDe).not.toHaveBeenCalled();
  });
});

describe('RolesGuard (RN-10)', () => {
  const reflector = { getAllAndOverride: jest.fn() };
  const guard = new RolesGuard(reflector as unknown as Reflector);

  beforeEach(() => jest.resetAllMocks());

  it('el administrador hereda los permisos del miembro', () => {
    expect(rolCumple(Rol.ADMIN, [Rol.MIEMBRO])).toBe(true);
    expect(rolCumple(Rol.ADMIN, [Rol.ADMIN])).toBe(true);
    expect(rolCumple(Rol.MIEMBRO, [Rol.MIEMBRO])).toBe(true);
    expect(rolCumple(Rol.MIEMBRO, [Rol.ADMIN])).toBe(false);
  });

  it('sin @Roles deja pasar', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(contexto({}))).toBe(true);
    reflector.getAllAndOverride.mockReturnValue([]);
    expect(guard.canActivate(contexto({}))).toBe(true);
  });

  it("@Roles('ADMIN'): pasa el admin, el miembro recibe 403 SOLO_ADMINISTRADOR", () => {
    reflector.getAllAndOverride.mockReturnValue([Rol.ADMIN]);
    expect(guard.canActivate(contexto({ hogar: { hogarId: 'h', rol: Rol.ADMIN } }))).toBe(true);
    expect(
      codigoDe(() => guard.canActivate(contexto({ hogar: { hogarId: 'h', rol: Rol.MIEMBRO } }))),
    ).toBe('SOLO_ADMINISTRADOR');
  });

  it('sin hogar resuelto (falta HogarGuard) también es 403', () => {
    reflector.getAllAndOverride.mockReturnValue([Rol.MIEMBRO]);
    expect(codigoDe(() => guard.canActivate(contexto({})))).toBe('SOLO_ADMINISTRADOR');
  });
});

describe('decoradores del hogar', () => {
  it('@Roles() guarda los roles permitidos', () => {
    class Controlador {
      @Roles(Rol.ADMIN)
      ruta() {
        return 1;
      }
    }
    expect(new Reflector().get(ROLES_PERMITIDOS, Controlador.prototype.ruta)).toEqual(['ADMIN']);
  });

  it('@HogarActual() devuelve el hogar o uno de sus campos', () => {
    const hogar = { hogarId: 'h1', rol: Rol.ADMIN };
    expect(extraerHogarActual(undefined, contexto({ hogar }))).toBe(hogar);
    expect(extraerHogarActual('hogarId', contexto({ hogar }))).toBe('h1');
    expect(extraerHogarActual('rol', contexto({}))).toBeUndefined();
  });
});
