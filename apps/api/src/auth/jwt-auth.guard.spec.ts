import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Problema } from '../comun/problema';
import { JwtAuthGuard, tokenBearer, type RequestAutenticada } from './jwt-auth.guard';
import { TokensService } from './tokens.service';
import { UsuariosRepositorio } from '../usuarios/usuarios.repositorio';

function contexto(req: Partial<RequestAutenticada>): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  const tokens = { verificarAcceso: jest.fn() };
  const reflector = { getAllAndOverride: jest.fn() };
  const usuarios = { buscarPorId: jest.fn() };
  const guard = new JwtAuthGuard(
    reflector as unknown as Reflector,
    tokens as unknown as TokensService,
    usuarios as unknown as UsuariosRepositorio,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    usuarios.buscarPorId.mockResolvedValue({ activo: true, sesionesInvalidasAntesDe: null });
  });

  it('deja pasar rutas @Publico() sin token', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    await expect(guard.canActivate(contexto({ headers: {} }))).resolves.toBe(true);
    expect(tokens.verificarAcceso).not.toHaveBeenCalled();
  });

  it('sin token → 401 NO_AUTENTICADO', async () => {
    await expect(guard.canActivate(contexto({ headers: {} }))).rejects.toBeInstanceOf(Problema);
    await expect(
      guard.canActivate(contexto({ headers: { authorization: 'Basic abc' } })),
    ).rejects.toMatchObject({ codigo: 'NO_AUTENTICADO' });
  });

  it('token válido: deja el usuario en la solicitud', async () => {
    tokens.verificarAcceso.mockReturnValue({
      sub: 'u1',
      hogarId: 'h1',
      rol: 'MIEMBRO',
      emitidoEn: 1000,
    });
    const req: Partial<RequestAutenticada> = { headers: { authorization: 'Bearer t0k' } };
    await expect(guard.canActivate(contexto(req))).resolves.toBe(true);
    expect(tokens.verificarAcceso).toHaveBeenCalledWith('t0k');
    expect(req.usuario).toEqual({ id: 'u1', hogarId: 'h1', rol: 'MIEMBRO' });
  });

  it('propaga el 401 del token inválido', async () => {
    tokens.verificarAcceso.mockImplementation(() => {
      throw new Problema(401, 'TOKEN_INVALIDO', 'x');
    });
    await expect(
      guard.canActivate(contexto({ headers: { authorization: 'Bearer malo' } })),
    ).rejects.toBeInstanceOf(Problema);
  });

  it.each([null, { activo: false }, { activo: true, sesionesInvalidasAntesDe: new Date(1000) }])(
    'rechaza una cuenta inactiva, ausente o una sesión revocada: %j',
    async (cuenta) => {
      tokens.verificarAcceso.mockReturnValue({
        sub: 'u1',
        hogarId: null,
        rol: null,
        emitidoEn: 1000,
      });
      usuarios.buscarPorId.mockResolvedValue(cuenta);
      await expect(
        guard.canActivate(contexto({ headers: { authorization: 'Bearer t' } })),
      ).rejects.toMatchObject({ codigo: 'SESION_REVOCADA' });
    },
  );

  it('tokenBearer acepta "bearer" sin distinguir mayúsculas', () => {
    expect(tokenBearer({ headers: { authorization: 'bearer abc' } })).toBe('abc');
    expect(tokenBearer({ headers: { authorization: 'Bearer' } })).toBeUndefined();
  });
});
