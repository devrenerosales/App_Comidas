# language: es
# Generado por docs/03-pruebas/scripts/extraer_casos.py — no editar a mano.
# Fuente: docs/01-requerimientos/historias/M04 · CU-04.2 · RF-16
@HU-16 @M04 @S2 @prioridad-M
Característica: HU-16 Importar historial desde CSV o XLSX
  Como administrador del hogar, quiero importar el historial de menús desde un archivo CSV o Excel con una plantilla, para cargar muchas semanas de una vez sin capturarlas una por una.

  # CA-16.1 Flujo principal · PF-M4-16.1
  @CA-16.1 @S2 @prioridad-M @funcional @e2e @regresion
  Escenario: Importar tres semanas válidas
    Dado que todos los platillos del archivo existen en el catálogo
    Y el archivo "historial.xlsx" tiene 21 filas de almuerzo de las semanas 2025-04-06, 2025-04-13 y 2025-04-20
    Y los gastos de esas semanas son Q224.00, Q241.75 y Q265.00
    Cuando importo el archivo y confirmo
    Entonces se crean 3 semanas en estado "Histórico" con 7 almuerzos cada una
    Y el reporte muestra "3 semanas creadas, 0 reemplazadas, 0 omitidas"

  # CA-16.2 Flujo alterno · PF-M4-16.2
  @CA-16.2 @S2 @prioridad-M @negativo @integracion @regresion
  Escenario: Omitir una semana que ya existe
    Dado que la semana 2025-04-13 ya está registrada con gasto Q224.00
    Cuando importo "historial.xlsx" y dejo esa semana en "Omitir"
    Entonces se crean 2 semanas
    Y la semana 2025-04-13 conserva el gasto Q224.00

  # CA-16.3 Validación o error · PF-M4-16.3
  @CA-16.3 @S2 @prioridad-M @negativo @integracion @regresion
  Escenario: Filas con errores bloquean la importación
    Dado un archivo donde la fila 8 tiene tiempo_comida "almuerso" y la fila 12 tiene fecha "2025-02-30"
    Cuando lo importo
    Entonces la vista previa muestra "Fila 8, tiempo_comida: valor no permitido" y "Fila 12, fecha: fecha inválida"
    Y el botón "Confirmar" está deshabilitado
    Y no se registra ninguna semana

  # CA-16.4 Validación o error · PF-M4-16.4
  @CA-16.4 @S2 @prioridad-M @negativo @integracion @regresion
  Escenario: Falta una columna obligatoria
    Dado un archivo "menus.csv" sin la columna "platillo"
    Cuando lo importo
    Entonces el sistema rechaza el archivo con "Falta la columna obligatoria: platillo"

  # CA-16.5 Validación o error · PF-M4-16.5
  @CA-16.5 @S2 @prioridad-M @negativo @integracion @regresion
  Escenario: Gasto inconsistente en la misma semana
    Dado que las filas 2 y 5 son de la semana 2025-04-06 con gasto_semana_gtq 248.50 y 250.00
    Cuando importo el archivo
    Entonces la vista previa muestra "Semana 2025-04-06: gasto distinto en filas 2 y 5"
