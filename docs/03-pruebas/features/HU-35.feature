# language: es
# Generado por docs/03-pruebas/scripts/extraer_casos.py — no editar a mano.
# Fuente: docs/01-requerimientos/historias/M08 · CU-08.2 · RF-35
@HU-35 @M08 @S5 @prioridad-M
Característica: HU-35 Vincular producto con su equivalente por supermercado
  Como miembro del hogar, quiero vincular cada producto con su equivalente en cada supermercado, para comparar precios de la misma marca y presentación.

  # CA-35.1 Flujo principal · PF-M8-35.1
  @CA-35.1 @S5 @prioridad-M @funcional @e2e @regresion
  Escenario: Vincular con la misma presentación
    Dado el producto "Arroz blanco 2 lb" con presentación de compra bolsa de 2 lb
    Cuando lo vinculo con Walmart, nombre en tienda "Arroz blanco 2 lb", presentación 2 lb y SKU de ejemplo "WM-000123"
    Entonces se guarda un vínculo activo con factor 1
    Y el producto se consulta en la siguiente corrida automática

  # CA-35.2 Presentación distinta · PF-M8-35.2
  @CA-35.2 @S5 @prioridad-M @funcional @integracion @regresion
  Escenario: Paiz solo vende bolsa de 5 lb
    Dado el producto "Arroz blanco 2 lb" con presentación de compra bolsa de 2 lb
    Cuando lo vinculo con Paiz en presentación de 5 lb
    Entonces el factor es 2.5
    Y un precio de Q31.25 por la bolsa de 5 lb se normaliza a Q12.50

  # CA-35.3 Flujo alterno: vínculo existente · PF-M8-35.3
  @CA-35.3 @S5 @prioridad-M @funcional @integracion @regresion
  Escenario: Reemplazar vínculo activo
    Dado que "Arroz blanco 2 lb" ya tiene vínculo activo en Walmart
    Cuando creo otro vínculo en Walmart y confirmo el reemplazo
    Entonces el vínculo anterior queda inactivo con su histórico de precios
    Y el nuevo queda activo

  # CA-35.4 Validación · PF-M8-35.4
  @CA-35.4 @S5 @prioridad-M @negativo @integracion @regresion
  Escenario: Unidad no convertible
    Dado el producto "Pollo en piezas (lb)"
    Cuando intento vincularlo con presentación "1 L"
    Entonces veo "La unidad de la presentación no es convertible a libras"
    Y no se guarda el vínculo
