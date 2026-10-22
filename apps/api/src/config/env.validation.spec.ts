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

  it('correo: sin SMTP_HOST no exige credenciales y usa APP_URL y puerto por defecto', () => {
    const env = validarEntorno({ ...base, SMTP_HOST: '' });
    expect(env.SMTP_PORT).toBe(587);
    expect(env.APP_URL).toBe('http://localhost:5173');
  });

  it('correo: con SMTP_HOST exige SMTP_USER, SMTP_PASS y SMTP_FROM', () => {
    expect(() => validarEntorno({ ...base, SMTP_HOST: 'smtp.gmail.com' })).toThrow(
      /SMTP_USER.*SMTP_PASS.*SMTP_FROM/,
    );
    const env = validarEntorno({
      ...base,
      SMTP_HOST: 'smtp.gmail.com',
      SMTP_PORT: '587',
      SMTP_USER: 'cuenta@gmail.com',
      SMTP_PASS: 'abcd efgh ijkl mnop',
      SMTP_FROM: 'Menú Familiar <cuenta@gmail.com>',
      APP_URL: 'https://menu.duckdns.org',
    });
    expect(env.SMTP_PORT).toBe(587);
    expect(env.APP_URL).toBe('https://menu.duckdns.org');
  });

  it('rechaza un APP_URL que no es URL', () => {
    expect(() => validarEntorno({ ...base, APP_URL: 'menu-familiar' })).toThrow(/APP_URL/);
  });
});
