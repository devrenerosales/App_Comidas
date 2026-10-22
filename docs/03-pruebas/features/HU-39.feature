# language: es
# Generado por docs/03-pruebas/scripts/extraer_casos.py — no editar a mano.
# Fuente: docs/01-requerimientos/historias/M09 · CU-10.1 · RF-39
@HU-39 @M09 @S6 @prioridad-S
Característica: HU-39 Reporte de gasto semanal estimado vs real vs presupuesto
  Como miembro del hogar, quiero ver por semana el gasto estimado, el real y el presupuesto de las últimas 12 semanas, para saber si estamos gastando lo planeado y ajustar el presupuesto.

  # CA-39.1 Flujo principal · PF-M9-39.1
  @CA-39.1 @S6 @prioridad-S @funcional @e2e
  Escenario: Ver diferencias de una semana excedida
    Dado que hoy es jueves 2026-10-22 y el hogar tiene 12 semanas completas con datos
    Y la semana del 2026-10-11 al 2026-10-17 tiene estimado Q248.00, real Q262.40 y presupuesto Q250.00
    Cuando abro el reporte "Gasto semanal"
    Entonces veo 12 semanas, de la del 2026-07-26 a la del 2026-10-11
    Y la semana del 2026-10-11 muestra "Real vs presupuesto: +Q12.40 (+5.0 %)"
    Y muestra "Real vs estimado: +Q14.40 (+5.8 %)"
    Y la semana aparece resaltada como sobre presupuesto
    Y la semana en curso del 2026-10-18 no aparece

  # CA-39.2 Flujo alterno · PF-M9-39.2
  @CA-39.2 @S6 @prioridad-S @funcional @integracion
  Escenario: Semana sin gasto real y hogar con pocas semanas
    Dado que el hogar solo tiene 3 semanas con datos
    Y la semana del 2026-10-04 tiene estimado Q240.00, presupuesto Q250.00 y no tiene gasto real
    Cuando abro el reporte "Gasto semanal"
    Entonces veo el aviso "Mostrando 3 de 12 semanas"
    Y la semana del 2026-10-04 muestra "Real: Sin registro" sin diferencias calculadas

  # CA-39.3 Validación o error · PF-M9-39.3
  @CA-39.3 @S6 @prioridad-S @negativo @integracion
  Escenario: Aislamiento de datos entre hogares
    Dado que pertenezco al hogar "Rosales"
    Cuando solicito a la API el reporte de gasto con el hogar_id de otro hogar
    Entonces la API responde 403
    Y no se devuelve ningún monto de ese hogar

  # CA-39.4 Validación o error · PF-M9-39.4
  @CA-39.4 @S6 @prioridad-S @negativo @integracion
  Escenario: Hogar sin semanas registradas
    Dado que el hogar no tiene menús aprobados ni historial cargado
    Cuando abro el reporte "Gasto semanal"
    Entonces veo "Aún no hay semanas registradas"
    Y un botón "Cargar historial"
