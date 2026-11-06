import type { AdaptadorSitio } from './adaptador.js';

/**
 * Adaptadores de lectura disponibles, por código de supermercado.
 *
 * Está vacío a propósito: el lector de cada sitio se escribe cuando el PO revisa sus términos de
 * uso y robots.txt (PA-02, R-03, D-07) y se ven sus páginas reales. Mientras un sitio no tenga
 * adaptador, la corrida lo registra como "Sitio no habilitado" y no abre ninguna conexión.
 */
export function crearAdaptadores(): Map<string, AdaptadorSitio> {
  return new Map();
}
