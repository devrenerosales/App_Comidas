/** Supermercados consultados por el worker (IE-02). Super Fresh es solo manual/ticket. */
export const Sitio = {
  WALMART: 'WALMART',
  PAIZ: 'PAIZ',
  LA_TORRE: 'LA_TORRE',
} as const;
export type Sitio = (typeof Sitio)[keyof typeof Sitio];

export const SITIOS: readonly Sitio[] = Object.values(Sitio);

export function esSitio(valor: unknown): valor is Sitio {
  return typeof valor === 'string' && (SITIOS as readonly string[]).includes(valor);
}

export type FlagsSitios = Readonly<Record<Sitio, boolean>>;

const VARIABLE_POR_SITIO: Readonly<Record<Sitio, string>> = {
  WALMART: 'SCRAPER_WALMART_ENABLED',
  PAIZ: 'SCRAPER_PAIZ_ENABLED',
  LA_TORRE: 'SCRAPER_LATORRE_ENABLED',
};

function verdadero(valor: string | undefined): boolean {
  return ['true', '1', 'si', 'sí', 'yes', 'on'].includes((valor ?? '').trim().toLowerCase());
}

/**
 * Lee qué sitios están habilitados. Todos están APAGADOS por defecto (R-03, RNF-12):
 * solo se activan tras confirmar que los términos de uso y robots.txt lo permiten.
 */
export function leerFlagsSitios(env: NodeJS.ProcessEnv = process.env): FlagsSitios {
  return {
    WALMART: verdadero(env[VARIABLE_POR_SITIO.WALMART]),
    PAIZ: verdadero(env[VARIABLE_POR_SITIO.PAIZ]),
    LA_TORRE: verdadero(env[VARIABLE_POR_SITIO.LA_TORRE]),
  };
}
