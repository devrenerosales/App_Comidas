# language: es
# Generado por docs/03-pruebas/scripts/extraer_casos.py — no editar a mano.
# Fuente: docs/01-requerimientos/historias/M08 · CU-09.2 · RF-36
@HU-36 @M08 @S5 @prioridad-M
Característica: HU-36 Cálculo de precio mínimo y mediana
  Como miembro del hogar, quiero que el costo estimado use la mediana y que la compra sugiera el precio mínimo con su supermercado, para planificar con un número estable y ahorrar al comprar.

  # CA-36.1 Flujo principal: número impar de precios · PF-M8-36.1
  @CA-36.1 @S5 @prioridad-M @limite @unitaria @regresion
  Escenario: Arroz con tres precios
    Dado que "Arroz blanco 2 lb" cuesta Q12.50 en Walmart, Q13.00 en Paiz y Q14.25 en La Torre, todos del 24/10/2026
    Cuando se recalcula el resumen
    Entonces la mediana es Q13.00
    Y el mínimo es Q12.50 en Walmart

  # CA-36.2 Número par de precios · PF-M8-36.2
  @CA-36.2 @S5 @prioridad-M @limite @unitaria @regresion
  Escenario: Pollo con cuatro precios
    Dado que "Pollo en piezas (lb)" cuesta Q20.75 en Super Fresh, Q21.50 en Walmart, Q22.90 en Paiz y Q23.40 en La Torre, todos vigentes
    Cuando se recalcula el resumen
    Entonces la mediana es Q22.20
    Y el mínimo es Q20.75 en Super Fresh

  # CA-36.3 Par con redondeo · PF-M8-36.3
  @CA-36.3 @S5 @prioridad-M @limite @unitaria @regresion
  Escenario: Aceite con dos precios
    Dado que "Aceite 1 L" cuesta Q24.95 en Walmart y Q26.50 en Paiz
    Cuando se recalcula el resumen
    Entonces la mediana es Q25.73

  # CA-36.4 Vigencia de 14 días · PF-M8-36.4
  @CA-36.4 @S5 @prioridad-M @limite @unitaria @regresion
  Escenario: Precio antiguo excluido
    Dado que "Tomate (lb)" cuesta Q6.50 en Walmart del 24/10/2026 y Q5.90 en Paiz del 03/10/2026
    Cuando se recalcula el resumen el 24/10/2026
    Entonces se excluye el precio de Paiz por tener 21 días
    Y el mínimo y la mediana son Q6.50 en Walmart

  # CA-36.5 Empate · PF-M8-36.5
  @CA-36.5 @S5 @prioridad-M @limite @unitaria @regresion
  Escenario: Mínimo empatado
    Dado que "Azúcar 5 lb" cuesta Q32.00 en Walmart y Q32.00 en Paiz y el hogar prefiere Paiz
    Cuando se recalcula el resumen
    Entonces el mínimo es Q32.00 en Paiz
