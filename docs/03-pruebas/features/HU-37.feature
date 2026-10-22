# language: es
# Generado por docs/03-pruebas/scripts/extraer_casos.py — no editar a mano.
# Fuente: docs/01-requerimientos/historias/M08 · CU-08.3 · RF-37
@HU-37 @M08 @S5 @prioridad-S
Característica: HU-37 Histórico y variación de precios
  Como miembro del hogar, quiero ver cómo ha cambiado el precio de un producto en cada supermercado, para detectar subidas y decidir dónde comprar.

  # CA-37.1 Flujo principal: subida · PF-M8-37.1
  @CA-37.1 @S5 @prioridad-S @funcional @e2e
  Escenario: Pollo sube en Walmart
    Dado los precios de "Pollo en piezas (lb)" en Walmart: Q20.00 el 10/10/2026, Q21.00 el 17/10/2026 y Q22.00 el 24/10/2026
    Cuando abro el detalle de precios
    Entonces la variación vs. anterior en Walmart es "+4.8 %"
    Y la variación del periodo en Walmart es "+10.0 %"

  # CA-37.2 Baja · PF-M8-37.2
  @CA-37.2 @S5 @prioridad-S @funcional @integracion
  Escenario: Tomate baja en Paiz
    Dado los precios de "Tomate (lb)" en Paiz: Q7.00 el 17/10/2026 y Q6.30 el 24/10/2026
    Cuando abro el detalle de precios
    Entonces la variación vs. anterior en Paiz es "−10.0 %" con indicador de baja

  # CA-37.3 Flujo alterno: un solo precio · PF-M8-37.3
  @CA-37.3 @S5 @prioridad-S @limite @integracion
  Escenario: Supermercado con un solo precio
    Dado que "Arroz blanco 2 lb" solo tiene Q12.90 en Super Fresh el 24/10/2026
    Cuando abro el detalle de precios
    Entonces la variación de Super Fresh se muestra como "—"

  # CA-37.4 Aislamiento · PF-M8-37.4
  @CA-37.4 @S5 @prioridad-S @negativo @integracion
  Escenario: Precios manuales de otro hogar no se muestran
    Dado que otro hogar registró "Arroz blanco 2 lb" a Q11.00 en Super Fresh
    Cuando abro el detalle de precios en mi hogar
    Entonces no veo el precio Q11.00
