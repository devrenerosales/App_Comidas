# language: es
# Generado por docs/03-pruebas/scripts/extraer_casos.py — no editar a mano.
# Fuente: docs/01-requerimientos/historias/M06 · CU-06.2 · RF-25
@HU-25 @M06 @S3 @prioridad-M
Característica: HU-25 Aprobar el menú semanal
  Como miembro del hogar, quiero aprobar el menú de la semana, para fijar lo que vamos a cocinar y obtener la lista de compras.

  # CA-25.1 Flujo principal · PF-M6-25.1
  @CA-25.1 @S3 @prioridad-M @funcional @e2e @regresion
  Escenario: Aprobar un menú dentro del presupuesto
    Dado un menú "Borrador" de la semana 2026-11-01 con 7 almuerzos asignados y costo Q229.50
    Y un presupuesto de almuerzo de Q245.00
    Cuando toco "Aprobar menú"
    Entonces el menú pasa a estado "Aprobado" con mi usuario y la fecha
    Y se crea la lista de compras de la semana 2026-11-01
    Y la grilla queda en solo lectura

  # CA-25.2 Flujo alterno (aprobar con exceso) · PF-M6-25.2
  @CA-25.2 @S3 @prioridad-M @funcional @integracion @regresion
  Escenario: Aprobar con presupuesto excedido
    Dado un menú "Borrador" con costo de almuerzo Q262.00 y presupuesto Q245.00
    Y el botón "Aprobar menú" muestra en rojo "Almuerzo: Excede por Q17.00"
    Cuando toco "Aprobar menú"
    Entonces el menú pasa a "Aprobado" sin pedir confirmación adicional
    Y el menú aprobado muestra en rojo "Excede por Q17.00"
    Y la lista de compras de la semana muestra en rojo "Excede por Q17.00"
    Y queda registrado un exceso al aprobar de Q17.00

  # CA-25.3 Validación de espacios vacíos · PF-M6-25.3
  @CA-25.3 @S3 @prioridad-M @negativo @integracion @regresion
  Escenario: No se aprueba con espacios vacíos
    Dado un menú "Borrador" de almuerzo y cena con la cena del viernes "Sin sugerencia"
    Cuando toco "Aprobar menú"
    Entonces veo "Asigna un platillo a: viernes cena"
    Y el menú sigue en "Borrador" y no se crea lista de compras

  # CA-25.4 Falla al crear la lista · PF-M6-25.4
  @CA-25.4 @S3 @prioridad-M @negativo @integracion @regresion
  Escenario: Se revierte la aprobación si falla la lista
    Dado un menú "Borrador" completo
    Y la creación de la lista de compras falla
    Cuando toco "Aprobar menú"
    Entonces el menú sigue en "Borrador"
    Y veo "No se pudo aprobar, intenta de nuevo"
