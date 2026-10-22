# language: es
# Generado por docs/03-pruebas/scripts/extraer_casos.py — no editar a mano.
# Fuente: docs/01-requerimientos/historias/M06 · CU-06.1 · RF-24
@HU-24 @M06 @S3 @prioridad-M
Característica: HU-24 Ajustar el menú propuesto
  Como miembro del hogar, quiero cambiar, mover y fijar platillos del menú propuesto, para adaptarlo a los planes reales de la semana.

  # CA-24.1 Flujo principal (mover con intercambio) · PF-M6-24.1
  @CA-24.1 @S3 @prioridad-M @funcional @e2e @regresion
  Escenario: Intercambiar lunes y jueves
    Dado un menú "Borrador" de solo almuerzo con lunes "Carne guisada" y jueves "Pepián de pollo"
    Y miércoles "Pescado frito" y viernes "Spaghetti con carne"
    Cuando arrastro "Carne guisada" al jueves
    Entonces veo la advertencia "Proteína res repetida en días consecutivos (jueves y viernes)"
    Y al confirmar el jueves queda "Carne guisada" fijado y el lunes "Pepián de pollo"

  # CA-24.2 Flujo alterno (editar y fijar) · PF-M6-24.2
  @CA-24.2 @S3 @prioridad-M @funcional @integracion @regresion
  Escenario: Elegir un platillo manualmente
    Dado un menú "Borrador" con martes "Tortitas de carne"
    Cuando elijo "Chile relleno" para el martes
    Entonces el martes muestra "Chile relleno" con candado
    Y al regenerar el menú el martes sigue con "Chile relleno"

  # CA-24.3 Validación de tiempo aplicable · PF-M6-24.3
  @CA-24.3 @S3 @prioridad-M @negativo @integracion @regresion
  Escenario: Mover un platillo a un tiempo no aplicable
    Dado que el hogar tiene tres tiempos activos
    Y "Caldo de res" solo aplica a "Almuerzo"
    Cuando arrastro "Caldo de res" del sábado almuerzo al sábado desayuno
    Entonces veo "Caldo de res no aplica a Desayuno"
    Y el menú no cambia

  # CA-24.4 Menú aprobado · PF-M6-24.4
  @CA-24.4 @S3 @prioridad-M @funcional @integracion @regresion
  Escenario: No se edita un menú aprobado
    Dado que el menú de la semana 2026-11-01 está "Aprobado"
    Cuando intento cambiar el domingo
    Entonces la grilla está en solo lectura
