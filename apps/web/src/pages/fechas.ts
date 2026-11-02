/** Fecha de hoy (AAAA-MM-DD) en la zona de negocio America/Guatemala (R-02). */
export const hoyGuatemala = (): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Guatemala',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
