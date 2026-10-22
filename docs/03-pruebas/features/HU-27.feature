# language: es
# Generado por docs/03-pruebas/scripts/extraer_casos.py — no editar a mano.
# Fuente: docs/01-requerimientos/historias/M06 · CU-06.4 · RF-27
@HU-27 @M06 @S4 @prioridad-S
Característica: HU-27 Registrar gasto real
  Como miembro del hogar, quiero registrar cuánto gastamos realmente en la semana, para comparar con lo estimado y mejorar el presupuesto.

  # CA-27.1 Flujo principal · PF-M6-27.1
  @CA-27.1 @S4 @prioridad-S @funcional @e2e
  Escenario: Registrar el gasto de la semana
    Dado el menú "Aprobado" de la semana 2026-11-01 con costo estimado Q229.50 y presupuesto Q245.00
    Cuando registro un gasto real de Q238.75
    Entonces se guarda el gasto con mi usuario y la fecha
    Y veo "Q9.25 más que lo estimado"
    Y veo "Q6.25 por debajo del presupuesto"

  # CA-27.2 Flujo alterno (corrección) · PF-M6-27.2
  @CA-27.2 @S4 @prioridad-S @funcional @integracion
  Escenario: Corregir un gasto ya registrado
    Dado que la semana 2026-11-01 tiene gasto real Q238.75
    Cuando lo corrijo a Q251.40
    Entonces el gasto real queda en Q251.40
    Y veo "Q6.40 por encima del presupuesto"

  # CA-27.3 Validación de monto · PF-M6-27.3
  @CA-27.3 @S4 @prioridad-S @limite @integracion
  Esquema del escenario: Montos inválidos
    Dado el menú "Aprobado" de la semana 2026-11-01
    Cuando registro un gasto real de "<monto>"
    Entonces veo "<mensaje>"
    Y no se guarda el gasto

    Ejemplos:
      | monto  | mensaje                                   |
      | 0      | El monto debe ser mayor que Q0.00         |
      | -15.00 | El monto debe ser mayor que Q0.00         |
      | 120.555| El monto admite como máximo 2 decimales   |

  # CA-27.4 Menú en borrador · PF-M6-27.4
  @CA-27.4 @S4 @prioridad-S @funcional @integracion
  Escenario: No se registra gasto en un borrador
    Dado que el menú de la semana 2026-11-08 está en "Borrador"
    Entonces la opción "Registrar gasto real" no está disponible
