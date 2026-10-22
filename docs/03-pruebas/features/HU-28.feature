# language: es
# Generado por docs/03-pruebas/scripts/extraer_casos.py — no editar a mano.
# Fuente: docs/01-requerimientos/historias/M07 · CU-07.1 · RF-28
@HU-28 @M07 @S4 @prioridad-M
Característica: HU-28 Consolidar ingredientes del menú aprobado
  Como miembro del hogar, quiero que al aprobar el menú se genere una lista con los ingredientes sumados y en la unidad en que se compran, para no calcular a mano cuánto comprar de cada producto.

  # CA-28.1 Flujo principal: escalado y suma del mismo producto · PF-M7-28.1
  @CA-28.1 @S4 @prioridad-M @funcional @unitaria @regresion
  Escenario: Pollo usado en dos platillos para 6 comensales
    Dado un hogar con 6 comensales con factor 1.0 cada uno, Σ factores 6.0
    Y el menú de la semana del 25/10/2026 al 31/10/2026 con "Pollo en crema" el domingo y "Pepián de pollo" el miércoles
    Y "Pollo en crema" usa 2 lb de "Pollo en piezas" para 4 porciones base
    Y "Pepián de pollo" usa 2.5 lb de "Pollo en piezas" para 4 porciones base
    Y "Pollo en piezas" se compra en presentación de 1 lb
    Cuando apruebo el menú
    Entonces la lista contiene una sola línea "Pollo en piezas" con 6.75 lb requeridas
    Y la cantidad a comprar es 7 lb

  # CA-28.2 Conversión de gramos a unidad de compra · PF-M7-28.2
  @CA-28.2 @S4 @prioridad-M @funcional @unitaria @regresion
  Escenario: Tomate en gramos se convierte a libras
    Dado un hogar con 4 comensales con factor 1.0 cada uno, Σ factores 4.0
    Y el menú aprobado incluye "Carne guisada" con 500 g de tomate y "Tortitas de carne" con 300 g de tomate, ambos para 4 porciones base
    Y "Tomate" se compra por libra
    Cuando se genera la lista
    Entonces "Tomate" muestra 800 g requeridos equivalentes a 1.76 lb
    Y la cantidad a comprar es 2 lb

  # CA-28.3 Excepción: ingrediente sin conversión · PF-M7-28.3
  @CA-28.3 @S4 @prioridad-M @negativo @unitaria @regresion
  Escenario: Unidad de receta sin equivalencia
    Dado que "Spaghetti con carne" usa 1 cucharadita de "Orégano"
    Y "Orégano" se compra en sobre de 10 g sin equivalencia registrada para cucharadita
    Cuando se genera la lista
    Entonces "Orégano" aparece con "1 cucharadita" y la marca "Sin conversión"
    Y los demás productos de la lista se generan normalmente

  # CA-28.4 Validación: menú en borrador · PF-M7-28.4
  @CA-28.4 @S4 @prioridad-M @negativo @integracion @regresion
  Escenario: Intentar generar la lista de un menú no aprobado
    Dado que el menú de la semana del 25/10/2026 está en estado "Borrador"
    Cuando abro la lista de compras de esa semana
    Entonces veo el mensaje "Aprueba el menú para generar la lista"
    Y no se crea ninguna lista

  # CA-28.5 Escalado con factores de porción · PF-M7-28.5
  @CA-28.5 @S4 @prioridad-M @funcional @unitaria @regresion
  Escenario: Hogar con un comensal de factor 0.5
    Dado un hogar con "Rene" 1.0, "Ana" 1.0 y "Sofía" 0.5, Σ factores 2.5
    Y el menú aprobado incluye "Pollo en crema" con 2 lb de "Pollo en piezas" para 4 porciones base
    Y "Pollo en piezas" se compra en presentación de 1 lb
    Cuando se genera la lista
    Entonces "Pollo en piezas" muestra 1.25 lb requeridas
    Y la cantidad a comprar es 2 lb

  # CA-28.6 Menú aprobado con exceso de presupuesto · PF-M7-28.6
  @CA-28.6 @S4 @prioridad-M @funcional @integracion @regresion
  Escenario: La lista muestra el exceso aprobado
    Dado que el menú de la semana del 25/10/2026 se aprobó con almuerzo Q262.00 y presupuesto Q245.00
    Cuando abro la lista de compras de esa semana
    Entonces el encabezado muestra en rojo "Excede por Q17.00"
    Y la lista se puede usar normalmente
