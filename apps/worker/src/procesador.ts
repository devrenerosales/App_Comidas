import type { LimitadorPorSitio } from './limitador.js';
import { esSitio, type FlagsSitios, type Sitio } from './sitios.js';

export const COLA_PRECIOS = 'precios';

export interface DatosJobPrecio {
  sitio: Sitio;
  /** Identificador del vínculo PRODUCTO_SUPERMERCADO a consultar. */
  productoSupermercadoId: string;
  url?: string;
}

export type ResultadoJobPrecio =
  | { estado: 'omitido'; motivo: string }
  | { estado: 'pendiente'; sitio: Sitio; esperaMs: number };

export interface JobMinimo {
  id?: string;
  name: string;
  data: unknown;
}

export interface DependenciasProcesador {
  flags: FlagsSitios;
  limitador: LimitadorPorSitio;
}

/**
 * Processor de la cola "precios" (stub del Sprint 0).
 * 1. Valida el sitio. 2. Si el sitio está deshabilitado, omite el job sin tocar la red.
 * 3. Respeta el limitador por sitio. 4. La extracción con Playwright llega en M8 (HU-33).
 */
export function crearProcesadorPrecios({ flags, limitador }: DependenciasProcesador) {
  return async (job: JobMinimo): Promise<ResultadoJobPrecio> => {
    const datos = job.data as Partial<DatosJobPrecio> | null;
    const sitio = datos?.sitio;
    if (!esSitio(sitio)) {
      throw new Error(`Job ${job.id ?? '?'}: sitio inválido "${String(sitio)}"`);
    }
    if (!flags[sitio]) {
      return { estado: 'omitido', motivo: `sitio ${sitio} deshabilitado` };
    }
    const esperaMs = await limitador.esperarTurno(sitio);
    // TODO(HU-33): abrir Playwright (chromium headless), respetar robots.txt y extraer precio.
    return { estado: 'pendiente', sitio, esperaMs };
  };
}
