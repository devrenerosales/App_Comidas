# language: es
# Generado por docs/03-pruebas/scripts/extraer_casos.py — no editar a mano.
# Fuente: docs/01-requerimientos/historias/M05 · CU-05.5 · RF-23
@HU-23 @M05 @S3 @prioridad-M
Característica: HU-23 Alternativa para un día
  Como miembro del hogar, quiero pedir otra opción para un día concreto sin regenerar toda la semana, para cambiar solo lo que no nos convence.

  # CA-23.1 Flujo principal · PF-M5-23.1
  @CA-23.1 @S3 @prioridad-M @funcional @e2e @regresion
  Escenario: Cambiar solo el martes
    Dado un menú "Borrador" de solo almuerzo con lunes "Carne guisada" (res), martes "Pescado frito" (pescado) y miércoles "Tortitas de carne" (res)
    Cuando toco "Otra opción" en el martes
    Entonces el martes muestra el mejor candidato que no es de res ni de pescado y no está en la semana, por ejemplo "Pollo en crema"
    Y los otros 6 días no cambian
    Y el costo de la semana se recalcula

  # CA-23.2 Flujo alterno (alternativa excede presupuesto) · PF-M5-23.2
  @CA-23.2 @S3 @prioridad-M @funcional @integracion @regresion
  Escenario: La alternativa supera el presupuesto
    Dado un menú con costo Q240.00 y presupuesto de almuerzo Q245.00
    Y el martes tiene "Tortitas de carne" de Q26.00
    Cuando pido otra opción y el sistema asigna "Caldo de res" de Q45.00
    Entonces el costo queda en Q259.00
    Y veo "Almuerzo: excede por Q14.00"

  # CA-23.3 Sin más alternativas · PF-M5-23.3
  @CA-23.3 @S3 @prioridad-M @negativo @integracion @regresion
  Escenario: Se agotan los candidatos
    Dado que ya pedí todas las alternativas válidas para el jueves
    Cuando toco "Otra opción" en el jueves
    Entonces veo "No hay más alternativas para este día"
    Y el jueves conserva su platillo actual

  # CA-23.4 Espacio fijado · PF-M5-23.4
  @CA-23.4 @S3 @prioridad-M @funcional @integracion @regresion
  Escenario: No se ofrece alternativa en un día fijado
    Dado que el domingo tiene "Pepián de pollo" fijado
    Entonces la opción "Otra opción" del domingo está deshabilitada
