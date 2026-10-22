# language: es
# Generado por docs/03-pruebas/scripts/extraer_casos.py — no editar a mano.
# Fuente: docs/01-requerimientos/historias/M03 · CU-03.2 · RF-12
@HU-12 @M03 @S1 @prioridad-M
Característica: HU-12 Ingredientes del platillo por porciones base
  Como miembro del hogar, quiero registrar los ingredientes de cada platillo con cantidad y unidad para sus porciones base, para que la lista de compras y el costo se calculen según cuántos comemos.

  # CA-12.1 Flujo principal · PF-M3-12.1
  @CA-12.1 @S1 @prioridad-M @funcional @unitaria @regresion
  Escenario: Registrar ingredientes y ver el escalado
    Dado que el hogar tiene 6 comensales con factor 1.0 cada uno, Σ factores 6.0
    Y el platillo "Pollo en crema" tiene 4 porciones base
    Cuando agrego "Pechuga de pollo" 2 lb y "Crema" 250 ml y guardo
    Entonces el platillo queda con 2 ingredientes
    Y la vista previa muestra "Pechuga de pollo" 3 lb y "Crema" 375 ml

  # CA-12.2 Flujo alterno · PF-M3-12.2
  @CA-12.2 @S1 @prioridad-M @funcional @integracion @regresion
  Escenario: Crear un producto desde el buscador de ingredientes
    Dado que "Miltomate" no existe en el catálogo de productos
    Cuando lo creo desde el buscador con unidad de compra "lb" y presentación 1 lb
    Y lo agrego a "Pepián de pollo" con 1 lb
    Entonces "Miltomate" aparece como ingrediente de "Pepián de pollo"

  # CA-12.3 Validación o error · PF-M3-12.3
  @CA-12.3 @S1 @prioridad-M @negativo @integracion @regresion
  Escenario: Unidad de otra magnitud
    Dado que el producto "Carne de res para guisar" tiene presentación en lb
    Cuando lo agrego a "Carne guisada" con 500 ml
    Entonces el sistema no guarda y muestra "La unidad ml no es compatible con lb"

  # CA-12.4 Validación o error · PF-M3-12.4
  @CA-12.4 @S1 @prioridad-M @negativo @integracion @regresion
  Escenario: Cantidad cero
    Cuando agrego "Arroz" con cantidad 0 a "Tortitas de carne"
    Entonces el sistema no guarda y muestra "La cantidad debe ser mayor que 0"

  # CA-12.5 Escalado con factores de porción · PF-M3-12.5
  @CA-12.5 @S1 @prioridad-M @funcional @unitaria @regresion
  Escenario: Vista previa con Σ factores fraccionaria
    Dado que el hogar tiene "Rene" 1.0, "Ana" 1.0 y "Sofía" 0.5, Σ factores 2.5
    Y el platillo "Pollo en crema" tiene 4 porciones base con "Pechuga de pollo" 2 lb y "Crema" 250 ml
    Cuando abro la vista previa de ingredientes
    Entonces veo "Pechuga de pollo" 1.25 lb y "Crema" 156.25 ml
