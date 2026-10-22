# language: es
# Generado por docs/03-pruebas/scripts/extraer_casos.py — no editar a mano.
# Fuente: docs/01-requerimientos/historias/M10 · CU-12.2 · RF-42
@HU-42 @M10 @S6 @prioridad-S
Característica: HU-42 Alerta de costo estimado sobre presupuesto
  Como miembro del hogar, quiero recibir una alerta cuando el costo estimado del menú supere el presupuesto en más de 10 %, para ajustar platillos antes de ir al supermercado.

  # CA-42.1 Flujo principal · PF-M10-42.1
  @CA-42.1 @S6 @prioridad-S @limite @e2e
  Escenario: Edición que supera el umbral
    Dado que el presupuesto semanal es Q250.00 y el umbral de alerta es Q275.00
    Y el menú de la semana del 2026-10-25 cuesta Q262.00 y está en estado normal
    Cuando cambio "Tortitas de carne" por "Pescado frito" y el costo estimado sube a Q276.50
    Entonces los miembros reciben "El menú del 25 al 31 de octubre cuesta Q276.50 y excede el presupuesto de Q250.00 por Q26.50 (10.6 %)"
    Y el menú queda en estado alertado

  # CA-42.2 Flujo alterno · PF-M10-42.2
  @CA-42.2 @S6 @prioridad-S @negativo @integracion
  Escenario: Subida de precios del worker sin alertas duplicadas
    Dado que el menú aprobado de la semana del 2026-10-25 cuesta Q262.00 con presupuesto Q250.00
    Cuando la corrida de precios del sábado 2026-10-24 a las 21:00 sube la mediana y el costo pasa a Q281.25
    Entonces los miembros reciben la alerta con exceso de Q31.25 (12.5 %)
    Y si la corrida del domingo deja el costo en Q284.00 no se envía otra alerta

  # CA-42.3 Validación o error · PF-M10-42.3
  @CA-42.3 @S6 @prioridad-S @limite @integracion
  Escenario: Exactamente 10 % no alerta
    Dado que el presupuesto semanal es Q250.00
    Cuando el costo estimado del menú queda en Q275.00
    Entonces no se envía ninguna alerta
    Y el menú permanece en estado normal

  # CA-42.4 Flujo alterno · PF-M10-42.4
  @CA-42.4 @S6 @prioridad-S @limite @integracion @manual-parcial
  Escenario: Nueva alerta tras volver bajo el umbral
    Dado que el menú de la semana del 2026-10-25 está alertado con costo Q281.25 y presupuesto Q250.00
    Cuando cambio "Caldo de res" por "Pollo en crema" y el costo baja a Q270.00
    Entonces el menú vuelve a estado normal sin enviar notificación
    Y si luego el costo sube a Q278.00 los miembros reciben una nueva alerta con exceso de Q28.00 (11.2 %)
