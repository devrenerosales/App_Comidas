import type { RespuestaRobots } from './robots.js';

/** Tamaño máximo que se lee de un robots.txt (el estándar sugiere 500 KiB). */
const MAXIMO_BYTES = 512 * 1024;

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * Descarga el robots.txt de un sitio (RNF-12). 2xx devuelve el texto; 4xx significa que el sitio
 * no publica reglas; 5xx, un tiempo agotado o la falta de red significan que no se sabe qué está
 * permitido, y por prudencia el sitio no se consulta.
 */
export async function descargarRobots(
  origen: string,
  agente: string,
  http: Fetch = fetch,
  tiempoMs = 10_000,
): Promise<RespuestaRobots> {
  try {
    const respuesta = await http(new URL('/robots.txt', origen).toString(), {
      headers: { 'User-Agent': agente },
      signal: AbortSignal.timeout(tiempoMs),
    });
    if (respuesta.status >= 500) return { estado: 'ERROR', motivo: `HTTP ${respuesta.status}` };
    if (respuesta.status >= 400) return { estado: 'NO_EXISTE' };
    return { estado: 'OK', texto: (await respuesta.text()).slice(0, MAXIMO_BYTES) };
  } catch (e) {
    return { estado: 'ERROR', motivo: e instanceof Error ? e.message : String(e) };
  }
}

/** Zona horaria en que se programan las corridas y se fechan los precios. */
export const ZONA_HORARIA = 'America/Guatemala';

/** Fecha de calendario local ("aaaa-mm-dd") de un instante. */
export function fechaLocal(ahora: Date, zona = ZONA_HORARIA): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: zona,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ahora);
}
