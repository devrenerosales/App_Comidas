import { vi } from 'vitest';

/** `localStorage` simulado en memoria (el del entorno de pruebas no es utilizable). */
export function simularAlmacenamiento(inicial: Record<string, string> = {}) {
  const datos = new Map(Object.entries(inicial));
  const almacen = {
    getItem: vi.fn((clave: string) => datos.get(clave) ?? null),
    setItem: vi.fn((clave: string, valor: string) => void datos.set(clave, valor)),
    removeItem: vi.fn((clave: string) => void datos.delete(clave)),
    clear: vi.fn(() => datos.clear()),
  };
  vi.stubGlobal('localStorage', almacen);
  return { almacen, datos };
}
