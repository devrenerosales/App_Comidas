# language: es
# Generado por docs/03-pruebas/scripts/extraer_casos.py — no editar a mano.
# Fuente: docs/01-requerimientos/historias/M07 · CU-07.4 · RF-31
@HU-31 @M07 @S5 @prioridad-S
Característica: HU-31 Agrupar lista por supermercado y categoría
  Como miembro del hogar, quiero ver la lista agrupada por el supermercado donde cada producto está más barato y por categoría, para saber qué comprar en cada tienda y ahorrar.

  # CA-31.1 Flujo principal · PF-M7-31.1
  @CA-31.1 @S5 @prioridad-S @funcional @e2e
  Escenario: Productos asignados al supermercado más barato
    Dado los precios vigentes al 24/10/2026:
      | Producto             | Walmart | Paiz   |
      | Arroz blanco 2 lb    | 12.50   | 13.00  |
      | Pollo en piezas (lb) | 22.50   | 21.90  |
      | Tomate (lb)          | 6.50    | 6.25   |
    Y la lista tiene Arroz blanco 2 lb x2, Pollo en piezas 7 lb y Tomate 2 lb
    Cuando veo la lista por supermercado
    Entonces el grupo Walmart contiene Arroz blanco 2 lb x2 por Q25.00 con subtotal Q25.00
    Y el grupo Paiz contiene Pollo en piezas 7 lb por Q153.30 en "Carnes" y Tomate 2 lb por Q12.50 en "Verduras"
    Y el subtotal de Paiz es Q165.80 y el total de la lista es Q190.80

  # CA-31.2 Flujo alterno: precio no vigente · PF-M7-31.2
  @CA-31.2 @S5 @prioridad-S @limite @integracion
  Escenario: Último precio con más de 14 días
    Dado que el único precio de "Aceite 1 L" es Q24.95 en Walmart del 03/10/2026
    Cuando veo la lista por supermercado el 24/10/2026
    Entonces "Aceite 1 L" aparece en Walmart con la advertencia "Precio del 03/10/2026"

  # CA-31.3 Flujo alterno: empate · PF-M7-31.3
  @CA-31.3 @S5 @prioridad-S @limite @unitaria
  Escenario: Mismo precio en dos supermercados
    Dado que "Azúcar 5 lb" cuesta Q32.00 en Walmart y Q32.00 en Paiz
    Y el supermercado preferido del hogar es Paiz
    Cuando veo la lista por supermercado
    Entonces "Azúcar 5 lb" aparece en el grupo Paiz

  # CA-31.4 Sin precio · PF-M7-31.4
  @CA-31.4 @S5 @prioridad-S @negativo @integracion
  Escenario: Producto sin ningún precio registrado
    Dado que "Tortillas" fue agregado como texto libre
    Cuando veo la lista por supermercado
    Entonces "Tortillas" aparece en el grupo "Sin precio"
    Y no suma a ningún subtotal
