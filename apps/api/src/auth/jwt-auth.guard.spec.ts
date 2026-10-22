import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Problema } from '../comun/problema';
import { JwtAuthGuard, tokenBearer, type RequestAutenticada } from './jwt-auth.guard';
import { TokensService } from './tokens.service';

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
  const guard = new JwtAuthGuard(
    reflector as unknown as Reflector,
    tokens as unknown as TokensService,
  );

  beforeEach(() => jest.resetAllMocks());

  it('deja pasar rutas @Publico() sin token', () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    expect(guard.canActivate(contexto({ headers: {} }))).toBe(true);
    expect(tokens.verificarAcceso).not.toHaveBeenCalled();
  });

  it('sin token → 401 NO_AUTENTICADO', () => {
    expect(() => guard.canActivate(contexto({ headers: {} }))).toThrow(Problema);
    try {
      guard.canActivate(contexto({ headers: { authorization: 'Basic abc' } }));
    } catch (error) {
      expect((error as Problema).codigo).toBe('NO_AUTENTICADO');
    }
  });

  it('token válido: deja el usuario en la solicitud', () => {
    tokens.verificarAcceso.mockReturnValue({ sub: 'u1', hogarId: 'h1', rol: 'MIEMBRO' });
    const req: Partial<RequestAutenticada> = { headers: { authorization: 'Bearer t0k' } };
    expect(guard.canActivate(contexto(req))).toBe(true);
    expect(tokens.verificarAcceso).toHaveBeenCalledWith('t0k');
    expect(req.usuario).toEqual({ id: 'u1', hogarId: 'h1', rol: 'MIEMBRO' });
  });

  it('propaga el 401 del token inválido', () => {
    tokens.verificarAcceso.mockImplementation(() => {
      throw new Problema(401, 'TOKEN_INVALIDO', 'x');
    });
    expect(() =>
      guard.canActivate(contexto({ headers: { authorization: 'Bearer malo' } })),
    ).toThrow(Problema);
  });

  it('tokenBearer acepta "bearer" sin distinguir mayúsculas', () => {
    expect(tokenBearer({ headers: { authorization: 'bearer abc' } })).toBe('abc');
    expect(tokenBearer({ headers: { authorization: 'Bearer' } })).toBeUndefined();
  });
});
