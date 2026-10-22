/** Tiempos de comida configurables por hogar (RF-07, RN-06). */
export const TiempoComida = {
  DESAYUNO: 'DESAYUNO',
  ALMUERZO: 'ALMUERZO',
  CENA: 'CENA',
} as const;
export type TiempoComida = (typeof TiempoComida)[keyof typeof TiempoComida];

/** Orden canónico de los tiempos de comida en el día. */
export const ORDEN_TIEMPOS: readonly TiempoComida[] = [
  TiempoComida.DESAYUNO,
  TiempoComida.ALMUERZO,
  TiempoComida.CENA,
];

/** Roles dentro del hogar (SRS §2.3, RN-10). */
export const Rol = {
  ADMIN: 'ADMIN',
  MIEMBRO: 'MIEMBRO',
} as const;
export type Rol = (typeof Rol)[keyof typeof Rol];

/** Estado del menú semanal (M6). */
export const EstadoMenu = {
  BORRADOR: 'BORRADOR',
  APROBADO: 'APROBADO',
} as const;
export type EstadoMenu = (typeof EstadoMenu)[keyof typeof EstadoMenu];

/** Origen de un precio registrado (M8). */
export const OrigenPrecio = {
  /** Extraído por el worker de precios (Playwright). */
  AUTOMATICO: 'AUTOMATICO',
  /** Capturado a mano por un miembro del hogar. */
  MANUAL: 'MANUAL',
  /** Leído de la foto de un ticket de compra. */
  TICKET: 'TICKET',
} as const;
export type OrigenPrecio = (typeof OrigenPrecio)[keyof typeof OrigenPrecio];
