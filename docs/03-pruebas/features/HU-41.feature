# language: es
# Generado por docs/03-pruebas/scripts/extraer_casos.py — no editar a mano.
# Fuente: docs/01-requerimientos/historias/M10 · CU-12.1 · RF-41
@HU-41 @M10 @S6 @prioridad-S
Característica: HU-41 Recordatorio del día de planificación
  Como miembro del hogar, quiero recibir el día de planificación un aviso de que el menú de la semana está listo para revisar, para no olvidar planificar y aprobarlo a tiempo.

  # CA-41.1 Flujo principal · PF-M10-41.1
  @CA-41.1 @S6 @prioridad-S @funcional @e2e @manual-parcial
  Escenario: Recordatorio el domingo con borrador listo
    Dado que el hogar "Rosales" tiene día de planificación domingo
    Y Rene usa la PWA con Web Push y su esposa la app Android con FCM, ambos con permiso otorgado
    Y existe el borrador de la semana del 2026-10-25 al 2026-10-31 con costo estimado Q248.00 y presupuesto Q250.00
    Cuando el programador se ejecuta el domingo 2026-10-25 a las 08:00 hora de Guatemala
    Entonces ambos reciben "Tu menú del 25 al 31 de octubre está listo para revisar · Q248.00 de Q250.00"
    Y al tocarla la app abre el borrador de esa semana
    Y se registra un solo envío para el hogar y la semana del 2026-10-25

  # CA-41.2 Flujo alterno · PF-M10-41.2
  @CA-41.2 @S6 @prioridad-S @funcional @integracion @manual-parcial
  Escenario: Día de planificación cambiado a sábado y sin borrador
    Dado que el administrador cambió el día de planificación a sábado
    Y no existe borrador para la semana del 2026-10-25
    Cuando el programador se ejecuta el sábado 2026-10-24 a las 08:00 hora de Guatemala
    Entonces el sistema genera el borrador de la semana del 2026-10-25 al 2026-10-31
    Y envía el recordatorio a los miembros
    Y el domingo 2026-10-25 no se envía otro recordatorio

  # CA-41.3 Flujo alterno · PF-M10-41.3
  @CA-41.3 @S6 @prioridad-S @funcional @integracion @manual-parcial
  Escenario: Menú ya aprobado
    Dado que el menú de la semana del 2026-10-25 ya está aprobado
    Cuando el programador se ejecuta el domingo 2026-10-25 a las 08:00
    Entonces no se envía ninguna notificación de recordatorio

  # CA-41.4 Validación o error · PF-M10-41.4
  @CA-41.4 @S6 @prioridad-S @negativo @integracion @manual-parcial
  Escenario: Token de Android inválido y reintento del job
    Dado que el token FCM de la esposa fue revocado
    Cuando el programador envía el recordatorio del 2026-10-25
    Entonces FCM responde UNREGISTERED y el sistema elimina esa suscripción
    Y Rene sí recibe la notificación en la PWA
    Y si el job se reintenta ese mismo día no se envía un segundo recordatorio
