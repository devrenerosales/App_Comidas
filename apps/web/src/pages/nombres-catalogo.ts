import type { TiempoComida } from '@menu/shared';

/** Nombre visible de cada tiempo de comida (catálogo de platillos, HU-11). */
export const NOMBRES_TIEMPO: Readonly<Record<TiempoComida, string>> = {
  DESAYUNO: 'Desayuno',
  ALMUERZO: 'Almuerzo',
  CENA: 'Cena',
};
