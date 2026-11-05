/** Ayudantes puros de la pantalla Registrar precio (HU-34). */

/** Fecha de calendario de hoy en el dispositivo, "aaaa-mm-dd". */
export function hoyEnDispositivo(ahora: Date = new Date()): string {
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${ahora.getFullYear()}-${dos(ahora.getMonth() + 1)}-${dos(ahora.getDate())}`;
}
