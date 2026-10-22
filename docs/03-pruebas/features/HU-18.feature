# language: es
# Generado por docs/03-pruebas/scripts/extraer_casos.py — no editar a mano.
# Fuente: docs/01-requerimientos/historias/M04 · CU-04.4 · RF-18
@HU-18 @M04 @S2 @prioridad-M
Característica: HU-18 Carga inicial del cuaderno familiar
  Como administrador del hogar, quiero que las 16 semanas del cuaderno y las 2 listas sueltas queden cargadas desde el inicio, para que las primeras sugerencias de menú ya consideren lo que comemos y gastamos.

  # CA-18.1 Flujo principal · PF-M4-18.1
  @CA-18.1 @S2 @prioridad-M @funcional @e2e @regresion @manual-parcial
  Escenario: Cargar las 16 semanas del cuaderno
    Dado el archivo "carga-inicial-cuaderno.xlsx" aprobado por el PO
    Cuando lo importo con origen "cuaderno" y confirmo
    Entonces el historial del hogar tiene 16 semanas en estado "Histórico" entre abril 2025 y 2026
    Y el gasto de cada semana es igual al anotado en su foto
    Y el reporte muestra el gasto mínimo, máximo y promedio semanal

  # CA-18.2 Flujo principal · PF-M4-18.2
  @CA-18.2 @S2 @prioridad-M @funcional @e2e @regresion
  Escenario: Cargar la lista de despensa de Q814
    Cuando se importa la hoja "Listas"
    Entonces cada producto de la lista de despensa existe en el catálogo
    Y está registrado como despensa del hogar con frecuencia "mensual"
    Y el reporte muestra el total de esa lista en Q814.00

  # CA-18.3 Flujo alterno · PF-M4-18.3
  @CA-18.3 @S2 @prioridad-M @funcional @integracion @regresion
  Escenario: Repetir la carga no duplica datos
    Dado que la carga inicial ya se ejecutó
    Cuando se ejecuta de nuevo con "Reemplazar" en todas las semanas
    Entonces el historial sigue teniendo 16 semanas de origen "cuaderno"
    Y no hay productos de despensa duplicados

  # CA-18.4 Validación o error · PF-M4-18.4
  @CA-18.4 @S2 @prioridad-M @negativo @integracion @regresion @manual-parcial
  Escenario: Conciliación detecta una diferencia
    Dado que la foto de la semana 2025-04-06 indica gasto Q248.50
    Y el archivo tiene Q284.50 para esa semana
    Cuando el PO compara el reporte con la foto
    Entonces la semana 2025-04-06 se corrige a Q248.50 en el archivo y se recarga
    Y el reporte final muestra Q248.50
