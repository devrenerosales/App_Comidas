/** Ayudantes puros de la pantalla Supermercados y marcas (HU-09). */

/** Un precio es vigente hasta 14 días de antigüedad (RN-08). */
export const DIAS_PRECIO_VIGENTE = 14;

/** "2026-10-01" → "01/10/2026". */
export const fechaCompleta = (fecha: string): string =>
  `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}/${fecha.slice(0, 4)}`;

/** Días completos entre la fecha del precio ("aaaa-mm-dd") y hoy, sin depender de la zona horaria. */
export function diasDesde(fecha: string, hoy: Date): number {
  const [a, m, d] = fecha.split('-').map(Number) as [number, number, number];
  const inicioHoy = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return Math.round((inicioHoy - Date.UTC(a, m - 1, d)) / 86_400_000);
}

/** "Q24.90", y con la fecha ("Q24.90 · Precio del 01/10/2026") cuando ya no es vigente (CA-09.4). */
export function textoPrecio(ultimo: { precio: string; fecha: string } | null, hoy: Date): string {
  if (!ultimo) return 'Sin precio registrado';
  const monto = `Q${ultimo.precio}`;
  return diasDesde(ultimo.fecha, hoy) > DIAS_PRECIO_VIGENTE
    ? `${monto} · Precio del ${fechaCompleta(ultimo.fecha)}`
    : monto;
}
