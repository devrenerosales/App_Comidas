import type { Pagina } from './catalogo.tipos';

export const TAMANO_POR_DEFECTO = 20;
export const TAMANO_MAXIMO = 100;

/** Desplazamiento SQL de la página (1 = primera). */
export function desplazamiento(pagina: number, tamano: number): number {
  return (pagina - 1) * tamano;
}

/** Arma la respuesta paginada de api-contrato §1.3. */
export function paginar<T>(datos: T[], pagina: number, tamano: number, total: number): Pagina<T> {
  return {
    datos,
    paginacion: { pagina, tamano, total, totalPaginas: Math.ceil(total / tamano) },
  };
}

/** Escapa `%`, `_` y `\` para usar un texto dentro de un patrón LIKE. */
export function patronContiene(texto: string): string {
  return `%${texto.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}
