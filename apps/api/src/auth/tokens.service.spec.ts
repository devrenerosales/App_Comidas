import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Problema } from '../comun/problema';
import { TokensService } from './tokens.service';

const SECRETO = 'secreto-de-acceso-de-32-caracteres!!';
function configRefresh(secreto: string): ConfigService {
  const config = new ConfigService();
  // ConfigService prioriza process.env sobre sus valores internos.
  jest.spyOn(config, 'getOrThrow').mockReturnValue(secreto);
  return config;
}

const config = configRefresh('secreto-refresh-de-32-caracteres!!!');

function crear(secreto = SECRETO) {
  return new TokensService(
    new JwtService({ secret: secreto, signOptions: { algorithm: 'HS256' } }),
    config,
  );
}

function codigoDe(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (error) {
    return (error as Problema).codigo;
  }
  return undefined;
}

describe('TokensService (ADR-004)', () => {
  const tokens = crear();

  it('firma un acceso de 15 min con sub, hogarId y rol y lo verifica', () => {
    const ahora = new Date();
    const { token, expiraEn } = tokens.firmarAcceso(
      { sub: 'u1', hogarId: 'h1', rol: 'ADMIN' },
      ahora,
    );
    expect(expiraEn.getTime() - Math.floor(ahora.getTime() / 1000) * 1000).toBe(15 * 60 * 1000);
    expect(tokens.verificarAcceso(token)).toEqual({
      sub: 'u1',
      hogarId: 'h1',
      rol: 'ADMIN',
      emitidoEn: ahora.getTime(),
    });
  });

  it('acepta usuario sin hogar (hogarId y rol nulos)', () => {
    const { token } = tokens.firmarAcceso({ sub: 'u1', hogarId: null, rol: null });
    expect(tokens.verificarAcceso(token)).toEqual(
      expect.objectContaining({ sub: 'u1', hogarId: null, rol: null }),
    );
  });

  it('un token vencido → TOKEN_EXPIRADO', () => {
    const { token } = tokens.firmarAcceso(
      { sub: 'u1', hogarId: null, rol: null },
      new Date(Date.now() - 16 * 60 * 1000),
    );
    expect(codigoDe(() => tokens.verificarAcceso(token))).toBe('TOKEN_EXPIRADO');
  });

  it('firmado con otra clave o mal formado → TOKEN_INVALIDO', () => {
    const ajeno = crear('otra-clave-de-32-caracteres-como-min!!').firmarAcceso({
      sub: 'u2',
      hogarId: null,
      rol: null,
    }).token;
    expect(codigoDe(() => tokens.verificarAcceso(ajeno))).toBe('TOKEN_INVALIDO');
    expect(codigoDe(() => tokens.verificarAcceso('abc.def.ghi'))).toBe('TOKEN_INVALIDO');
  });

  it.each([
    [{ hogarId: null, rol: null }],
    [{ sub: 'u1', hogarId: 5, rol: null }],
    [{ sub: 'u1', hogarId: null, rol: 'DUENO' }],
  ])('claims inválidos %j → TOKEN_INVALIDO', (claims) => {
    const token = new JwtService({ secret: SECRETO }).sign(claims);
    expect(codigoDe(() => tokens.verificarAcceso(token))).toBe('TOKEN_INVALIDO');
  });

  it('rechaza el algoritmo "none"', () => {
    const cabecera = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const carga = Buffer.from(JSON.stringify({ sub: 'u1', hogarId: null, rol: null })).toString(
      'base64url',
    );
    expect(codigoDe(() => tokens.verificarAcceso(`${cabecera}.${carga}.`))).toBe('TOKEN_INVALIDO');
  });

  it('genera refresh opacos de 32 bytes con hash HMAC de 64 hex y vencimiento a 30 días', () => {
    const ahora = new Date('2026-10-22T00:00:00Z');
    const a = tokens.generarRefresh(ahora);
    const b = tokens.generarRefresh(ahora);
    expect(Buffer.from(a.token, 'base64url')).toHaveLength(32);
    expect(a.token).not.toBe(b.token);
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(tokens.hashRefresh(a.token)).toBe(a.hash);
    expect(a.venceEn.toISOString()).toBe('2026-11-21T00:00:00.000Z');
  });

  it('el hash depende del secreto del refresh', () => {
    const otro = new TokensService(
      new JwtService({ secret: SECRETO }),
      configRefresh('otro-secreto-refresh-de-32-caracteres'),
    );
    expect(otro.hashRefresh('x')).not.toBe(tokens.hashRefresh('x'));
  });

  it('nuevaFamilia devuelve un uuid v4', () => {
    expect(tokens.nuevaFamilia()).toMatch(/^[0-9a-f-]{36}$/);
  });
});
