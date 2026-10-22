# language: es
# Generado por docs/03-pruebas/scripts/extraer_casos.py — no editar a mano.
# Fuente: docs/01-requerimientos/historias/M03 · CU-03.3 · RF-13
@HU-13 @M03 @S1 @prioridad-M
Característica: HU-13 Catálogo de productos
  Como miembro del hogar, quiero mantener un catálogo de productos con su unidad de compra y presentación, para usarlos como ingredientes y despensa y saber cuánto comprar.

  # CA-13.1 Flujo principal · PF-M3-13.1
  @CA-13.1 @S1 @prioridad-M @funcional @e2e @regresion
  Escenario: Crear producto de despensa
    Cuando creo el producto "Arroz" tipo "despensa", categoría "granos", unidad de compra "bolsa" y presentación 2 lb
    Entonces "Arroz" aparece al filtrar por tipo "despensa"
    Y se muestra como "Arroz · bolsa 2 lb"

  # CA-13.2 Flujo alterno · PF-M3-13.2
  @CA-13.2 @S1 @prioridad-M @funcional @integracion @regresion
  Escenario: Inactivar un producto usado en un platillo
    Dado que "Crema" es ingrediente de "Pollo en crema"
    Cuando inactivo "Crema"
    Entonces "Crema" no aparece en el buscador de ingredientes
    Y "Pollo en crema" muestra la advertencia "Ingrediente inactivo: Crema"

  # CA-13.3 Validación o error · PF-M3-13.3
  @CA-13.3 @S1 @prioridad-M @negativo @integracion @regresion
  Escenario: Producto duplicado
    Dado que existe "Aceite · botella 900 ml"
    Cuando intento crear "aceite" con unidad de compra "botella" y presentación 900 ml
    Entonces el sistema no lo guarda y ofrece abrir "Aceite · botella 900 ml"

  # CA-13.4 Validación o error · PF-M3-13.4
  @CA-13.4 @S1 @prioridad-M @negativo @integracion @regresion
  Escenario: Presentación inválida
    Cuando intento crear "Frijol negro" con presentación 0 lb
    Entonces el sistema no guarda y muestra "La presentación debe ser mayor que 0"
