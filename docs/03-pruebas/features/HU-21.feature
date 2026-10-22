# language: es
# Generado por docs/03-pruebas/scripts/extraer_casos.py — no editar a mano.
# Fuente: docs/01-requerimientos/historias/M05 · CU-05.3 · RF-21
@HU-21 @M05 @S3 @prioridad-M
Característica: HU-21 Menú dentro del presupuesto
  Como miembro del hogar, quiero que el menú sugerido respete el presupuesto de cada tiempo de comida, para no gastar más de lo planificado.

  # CA-21.1 Flujo principal · PF-M5-21.1
  @CA-21.1 @S3 @prioridad-M @funcional @unitaria @regresion
  Escenario: Menú que cumple sin reemplazos
    Dado un presupuesto semanal de Q245.00 con solo almuerzo al 100 %
    Cuando el motor propone un menú con costo estimado de Q229.50
    Entonces no se hace ningún reemplazo
    Y el almuerzo aparece "Dentro del presupuesto" con Q15.50 disponibles

  # CA-21.2 Flujo alterno (reemplazos RN-05) · PF-M5-21.2
  @CA-21.2 @S3 @prioridad-M @funcional @unitaria @regresion
  Escenario: Menú excedido que se corrige en 2 intentos
    Dado un presupuesto de almuerzo de Q250.00
    Y la propuesta inicial cuesta Q280.00 con "Pepián de pollo" Q48.00 y "Caldo de res" Q45.00 como los más caros
    Cuando el motor ajusta al presupuesto
    Entonces reemplaza "Pepián de pollo" por "Tortitas de carne" de Q26.00 y el costo queda en Q258.00
    Y reemplaza "Caldo de res" por "Spaghetti con carne" de Q30.00 y el costo queda en Q243.00
    Y el almuerzo aparece "Dentro del presupuesto"

  # CA-21.3 Excepción (no cumple tras 3 intentos) · PF-M5-21.3
  @CA-21.3 @S3 @prioridad-M @negativo @unitaria @regresion
  Escenario: Presupuesto insuficiente
    Dado un presupuesto de almuerzo de Q150.00
    Y la propuesta inicial cuesta Q280.00
    Cuando el motor hace 3 reemplazos y el costo queda en Q205.00
    Entonces el menú se guarda en "Borrador"
    Y veo "Almuerzo: excede por Q55.00" con alternativas más baratas

  # CA-21.4 Presupuesto por tiempo · PF-M5-21.4
  @CA-21.4 @S3 @prioridad-M @funcional @unitaria @regresion
  Escenario: Tres tiempos con presupuesto por tiempo
    Dado un presupuesto semanal de Q700.00 con distribución 20/50/30
    Cuando el motor genera el menú
    Entonces controla desayuno contra Q140.00, almuerzo contra Q350.00 y cena contra Q210.00
