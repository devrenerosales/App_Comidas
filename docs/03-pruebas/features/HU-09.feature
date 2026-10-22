# language: es
# Generado por docs/03-pruebas/scripts/extraer_casos.py — no editar a mano.
# Fuente: docs/01-requerimientos/historias/M02 · CU-02.5 · RF-09
@HU-09 @M02 @S5 @prioridad-S
Característica: HU-09 Supermercados y marcas preferidas
  Como miembro del hogar, quiero indicar en qué supermercados compro y qué marca prefiero de cada producto, para que la lista sugiera dónde comprar lo que realmente usamos.

  # CA-09.1 Flujo principal · PF-M2-09.1
  @CA-09.1 @S5 @prioridad-S @funcional @e2e
  Escenario: La sugerencia de compra respeta los supermercados preferidos
    Dado que mis supermercados preferidos son Walmart y Paiz
    Y el arroz 2 lb cuesta Q12.50 en Walmart, Q13.00 en Paiz y Q11.75 en La Torre
    Cuando veo la lista de compras
    Entonces el arroz aparece agrupado en Walmart con Q12.50
    Y el costo estimado usa Q12.50 como mediana de los tres supermercados

  # CA-09.2 Flujo alterno: marca preferida · PF-M2-09.2
  @CA-09.2 @S5 @prioridad-S @funcional @integracion
  Escenario: Elegir marca preferida de aceite
    Dado que el producto "Aceite 1 L" tiene vinculadas las marcas "Ideal" y "Capullo"
    Cuando elijo "Ideal" como marca preferida y guardo
    Entonces la lista de compras sugiere "Aceite Ideal 1 L" en el supermercado preferido más barato

  # CA-09.3 Validación o error · PF-M2-09.3
  @CA-09.3 @S5 @prioridad-S @negativo @integracion
  Escenario: Desmarcar todos los supermercados
    Dado que solo Walmart está marcado como preferido
    Cuando desmarco Walmart e intento guardar
    Entonces veo "Debes tener al menos un supermercado preferido"
    Y las preferencias no cambian

  # CA-09.4 Marca sin precio vigente · PF-M2-09.4
  @CA-09.4 @S5 @prioridad-S @negativo @integracion
  Escenario: Marca preferida con precio antiguo
    Dado que la marca preferida "Ideal" tiene su último precio de Q24.90 del 2026-10-01
    Cuando veo la lista de compras el 2026-10-22
    Entonces se muestra Q24.90 con la advertencia "Precio del 01/10/2026"
