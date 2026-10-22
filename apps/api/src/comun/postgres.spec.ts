import { esViolacionUnicidad } from './postgres';

describe('esViolacionUnicidad', () => {
  it('reconoce el código 23505 directo o en cause (Drizzle)', () => {
    expect(esViolacionUnicidad({ code: '23505' })).toBe(true);
    expect(esViolacionUnicidad({ cause: { code: '23505' } })).toBe(true);
  });

  it('otros errores no lo son', () => {
    expect(esViolacionUnicidad({ code: '23503' })).toBe(false);
    expect(esViolacionUnicidad(new Error('x'))).toBe(false);
    expect(esViolacionUnicidad(null)).toBe(false);
  });
});
