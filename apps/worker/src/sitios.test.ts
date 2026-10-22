import { describe, expect, it } from 'vitest';
import { esSitio, leerFlagsSitios, SITIOS } from './sitios.js';

describe('leerFlagsSitios', () => {
  it('todos los sitios están apagados por defecto', () => {
    expect(leerFlagsSitios({})).toEqual({ WALMART: false, PAIZ: false, LA_TORRE: false });
  });

  it('activa solo los sitios con valor verdadero', () => {
    expect(
      leerFlagsSitios({
        SCRAPER_WALMART_ENABLED: 'true',
        SCRAPER_PAIZ_ENABLED: ' 1 ',
        SCRAPER_LATORRE_ENABLED: 'false',
      }),
    ).toEqual({ WALMART: true, PAIZ: true, LA_TORRE: false });
  });

  it.each(['TRUE', 'sí', 'si', 'yes', 'on'])('acepta "%s" como verdadero', (v) => {
    expect(leerFlagsSitios({ SCRAPER_LATORRE_ENABLED: v }).LA_TORRE).toBe(true);
  });

  it.each(['', '0', 'no', 'off', 'cualquier cosa'])('trata "%s" como falso', (v) => {
    expect(leerFlagsSitios({ SCRAPER_WALMART_ENABLED: v }).WALMART).toBe(false);
  });

  it('usa process.env si no se pasa entorno', () => {
    expect(Object.keys(leerFlagsSitios())).toEqual(['WALMART', 'PAIZ', 'LA_TORRE']);
  });
});

describe('esSitio', () => {
  it('reconoce los sitios válidos', () => {
    SITIOS.forEach((s) => expect(esSitio(s)).toBe(true));
  });
  it.each([undefined, null, 1, 'SUPER_FRESH', 'walmart'])('rechaza %j', (v) => {
    expect(esSitio(v)).toBe(false);
  });
});
