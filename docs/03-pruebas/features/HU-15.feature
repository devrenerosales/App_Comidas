# language: es
# Generado por docs/03-pruebas/scripts/extraer_casos.py — no editar a mano.
# Fuente: docs/01-requerimientos/historias/M04 · CU-04.1 · RF-15
@HU-15 @M04 @S2 @prioridad-M
Característica: HU-15 Capturar menú de semana pasada
  Como administrador del hogar, quiero capturar los menús y el gasto de semanas pasadas, para que el sistema conozca lo que ya comimos y cuánto gastamos.

  # CA-15.1 Flujo principal · PF-M4-15.1
  @CA-15.1 @S2 @prioridad-M @funcional @e2e @regresion
  Escenario: Capturar una semana completa de almuerzos
    Dado que hoy es 2026-10-22
    Cuando capturo la semana que inicia el domingo 2025-04-06 con los almuerzos:
      | día       | platillo            |
      | domingo   | Pepián de pollo     |
      | lunes     | Pollo en crema      |
      | martes    | Tortitas de carne   |
      | miércoles | Spaghetti con carne |
      | jueves    | Caldo de res        |
      | viernes   | Pescado frito       |
      | sábado    | Chile relleno       |
    Y registro un gasto semanal de Q248.50
    Entonces la semana queda en estado "Histórico" con 7 almuerzos
    Y el gasto real de la semana es Q248.50

  # CA-15.2 Flujo alterno · PF-M4-15.2
  @CA-15.2 @S2 @prioridad-M @funcional @integracion @regresion
  Escenario: Reemplazar una semana ya registrada
    Dado que la semana 2025-04-13 está registrada con gasto Q224.00
    Cuando la capturo de nuevo con gasto Q231.00 y elijo "Reemplazar"
    Entonces existe una sola semana 2025-04-13 con gasto Q231.00

  # CA-15.3 Validación o error · PF-M4-15.3
  @CA-15.3 @S2 @prioridad-M @negativo @integracion @regresion
  Escenario: Semana que no ha terminado
    Dado que hoy es 2026-10-22
    Cuando intento capturar la semana que inicia el 2026-10-18
    Entonces el sistema no guarda y muestra "Solo se pueden capturar semanas terminadas"

  # CA-15.4 Validación o error · PF-M4-15.4
  @CA-15.4 @S2 @prioridad-M @negativo @integracion @regresion
  Escenario: Gasto negativo
    Cuando capturo la semana 2025-05-04 con gasto -Q50
    Entonces el sistema no guarda y muestra "El gasto debe ser un monto positivo en quetzales"
