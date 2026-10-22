import { Entorno, validarEntorno } from './env.validation';

const base = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  JWT_SECRET: 'x'.repeat(32),
  JWT_REFRESH_SECRET: 'y'.repeat(32),
};

describe('validarEntorno', () => {
  it('acepta un entorno mínimo y aplica valores por defecto', () => {
    const env = validarEntorno(base);
    expect(env.PORT).toBe(3000);
    expect(env.NODE_ENV).toBe(Entorno.Development);
    expect(env.TZ).toBe('America/Guatemala');
    expect(env.CORS_ORIGIN).toBe('http://localhost:5173');
  });

  it('convierte PORT de texto a número', () => {
    expect(validarEntorno({ ...base, PORT: '8080' }).PORT).toBe(8080);
  });

  it('rechaza secretos JWT cortos', () => {
    expect(() => validarEntorno({ ...base, JWT_SECRET: 'corto' })).toThrow(/JWT_SECRET/);
  });

  it('rechaza si falta DATABASE_URL', () => {
    const { DATABASE_URL: _omit, ...sinBd } = base;
    expect(() => validarEntorno(sinBd)).toThrow(/DATABASE_URL/);
  });
});
