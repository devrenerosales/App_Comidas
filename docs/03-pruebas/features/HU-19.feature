# language: es
# Generado por docs/03-pruebas/scripts/extraer_casos.py — no editar a mano.
# Fuente: docs/01-requerimientos/historias/M05 · CU-05.1 · RF-19
@HU-19 @M05 @S3 @prioridad-M
Característica: HU-19 Generar propuesta de menú semanal
  Como miembro del hogar, quiero que la app me proponga el menú de la semana para los tiempos de comida que planificamos, para no tener que decidir cada día qué cocinar.

  # CA-19.1 Flujo principal (solo almuerzo) · PF-M5-19.1
  @CA-19.1 @S3 @prioridad-M @funcional @e2e @regresion
  Escenario: Generar menú con solo almuerzo activo
    Dado que el hogar tiene solo "Almuerzo" activo y presupuesto semanal de Q245.00
    Y tiene 25 platillos activos de almuerzo
    Cuando pido "Sugerir menú" para la semana del 2026-11-01 al 2026-11-07
    Entonces se crea un menú en estado "Borrador" con 7 almuerzos de domingo a sábado
    Y ningún platillo se repite en la semana
    Y no hay dos días consecutivos con la misma proteína principal

  # CA-19.2 Flujo alterno (dos tiempos y regeneración con fijado) · PF-M5-19.2
  @CA-19.2 @S3 @prioridad-M @funcional @integracion @regresion
  Escenario: Regenerar un borrador de almuerzo y cena conservando un fijado
    Dado que el hogar tiene "Almuerzo" y "Cena" activos
    Y existe un borrador de la semana 2026-11-01 con "Pepián de pollo" fijado el domingo en almuerzo
    Cuando pido "Sugerir menú" y confirmo la regeneración
    Entonces el menú tiene 14 asignaciones
    Y el domingo en almuerzo sigue "Pepián de pollo"
    Y el lunes en almuerzo no tiene un platillo con proteína "pollo"

  # CA-19.3 Validación de platillos insuficientes · PF-M5-19.3
  @CA-19.3 @S3 @prioridad-M @negativo @integracion @regresion
  Escenario: Faltan platillos de cena
    Dado que el hogar tiene "Almuerzo" y "Cena" activos
    Y tiene 12 platillos de almuerzo y 7 platillos de cena
    Cuando pido "Sugerir menú"
    Entonces no se crea ningún menú
    Y veo el mensaje "Faltan 3 platillos de Cena" con un enlace al catálogo

  # CA-19.4 Semana ya aprobada · PF-M5-19.4
  @CA-19.4 @S3 @prioridad-M @funcional @integracion @regresion
  Escenario: No se regenera una semana aprobada
    Dado que la semana del 2026-11-01 tiene un menú "Aprobado"
    Cuando pido "Sugerir menú" para esa semana
    Entonces veo "Esta semana ya tiene un menú aprobado"
    Y el menú aprobado no cambia
