const formatoFecha = new Intl.DateTimeFormat('es-GT', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'America/Guatemala',
});

/** Fecha y hora de Guatemala para mostrar vencimientos: "jueves, 29 de octubre, 9:00 a. m.". */
export function fechaHora(iso: string): string {
  return formatoFecha.format(new Date(iso));
}
