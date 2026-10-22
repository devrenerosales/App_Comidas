# language: es
# Generado por docs/03-pruebas/scripts/extraer_casos.py — no editar a mano.
# Fuente: docs/01-requerimientos/historias/M07 · CU-07.2 · RF-29
@HU-29 @M07 @S4 @prioridad-M
Característica: HU-29 Agregar despensa según frecuencia
  Como miembro del hogar, quiero que la lista incluya automáticamente los productos de despensa que tocan esa semana, para no olvidar arroz, aceite o azúcar cuando se terminan.

  # CA-29.1 Flujo principal · PF-M7-29.1
  @CA-29.1 @S4 @prioridad-M @funcional @e2e @regresion
  Escenario: Solo se agregan los productos que tocan
    Dado la despensa del hogar:
      | Producto          | Cantidad | Frecuencia | Última inclusión |
      | Arroz blanco 2 lb | 2        | semanal    | 18/10/2026       |
      | Aceite 1 L        | 1        | quincenal  | 11/10/2026       |
      | Azúcar 5 lb       | 1        | mensual    | 04/10/2026       |
    Cuando se genera la lista de la semana del 25/10/2026
    Entonces la lista incluye "Arroz blanco 2 lb" x2 y "Aceite 1 L" x1 con origen "Despensa"
    Y no incluye "Azúcar 5 lb" porque solo han pasado 3 de 4 semanas
    Y la última inclusión de arroz y aceite queda en 25/10/2026

  # CA-29.2 Flujo alterno: producto también usado en el menú · PF-M7-29.2
  @CA-29.2 @S4 @prioridad-M @funcional @integracion @regresion
  Escenario: Aceite requerido por un platillo y por la despensa
    Dado que "Pescado frito" requiere 0.5 L de "Aceite" y se compra 1 botella de 1 L por el menú
    Y "Aceite 1 L" de despensa toca esta semana con cantidad 1
    Cuando se genera la lista
    Entonces aparece una sola línea "Aceite 1 L" con 2 botellas y origen "Menú + Despensa"

  # CA-29.3 Flujo alterno: producto nuevo en despensa · PF-M7-29.3
  @CA-29.3 @S4 @prioridad-M @funcional @integracion @regresion
  Escenario: Producto sin inclusión previa
    Dado que agrego "Frijol negro 1 lb" x2 semanal a la despensa el 22/10/2026
    Cuando se genera la lista de la semana del 25/10/2026
    Entonces la lista incluye "Frijol negro 1 lb" x2

  # CA-29.4 Validación · PF-M7-29.4
  @CA-29.4 @S4 @prioridad-M @negativo @integracion @regresion
  Escenario: Cantidad inválida
    Cuando intento guardar "Café 400 g" en la despensa con cantidad 0
    Entonces veo "La cantidad debe ser mayor que 0"
    Y el producto no se guarda
