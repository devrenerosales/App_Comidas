# language: es
# Generado por docs/03-pruebas/scripts/extraer_casos.py — no editar a mano.
# Fuente: docs/01-requerimientos/historias/M07 · CU-07.7 · RF-44
@HU-44 @M07 @S4 @prioridad-M
Característica: HU-44 Precio real y promedio de compra
  Como miembro del hogar, quiero anotar cuánto pagué por cada producto al marcarlo como comprado, para conocer el precio promedio al que realmente compro y que el gasto de la semana se llene solo.

  # CA-44.1 Flujo principal · PF-M7-44.1
  @CA-44.1 @S4 @prioridad-M @funcional @e2e @regresion
  Escenario: Registrar precio y recalcular el promedio de 12 semanas
    Dado que "Pechuga de pollo" se compra en bolsa de 2 lb
    Y el hogar registró precios normalizados de Q26.50 el 13/09/2026 y Q27.00 el 04/10/2026
    Y registró Q24.00 el 12/07/2026
    Cuando el 25/10/2026 marco "Pechuga de pollo" como comprado con 1 bolsa y precio Q28.10
    Entonces el promedio de compra de "Pechuga de pollo" es Q27.20 con 3 compras
    Y veo "Promedio de compra Q27.20 · Mediana Q27.50"

  # CA-44.2 Flujo alterno: otra presentación · PF-M7-44.2
  @CA-44.2 @S4 @prioridad-M @funcional @integracion @regresion
  Escenario: Normalizar el precio de una presentación distinta
    Dado que "Pechuga de pollo" tiene presentación de catálogo bolsa de 2 lb
    Cuando marco "Pechuga de pollo" como comprado indicando bolsa de 5 lb y precio Q66.25
    Entonces el precio normalizado guardado es Q26.50

  # CA-44.3 Flujo alterno: prellenado del gasto real · PF-M7-44.3
  @CA-44.3 @S4 @prioridad-M @funcional @integracion @regresion
  Escenario: La suma de precios reales prellena el gasto de la semana
    Dado que en la lista de la semana del 25/10/2026 registré "Pollo en piezas" Q54.00, "Pechuga de pollo" Q27.00 y "Tomate" Q18.50
    Y marqué "Ajonjolí" como "Ya lo tengo"
    Y no hay gasto real guardado para la semana
    Cuando abro "Registrar gasto real"
    Entonces el monto aparece prellenado con Q99.50
    Y puedo cambiarlo a Q105.00 antes de guardar

  # CA-44.4 Respaldo cuando no hay precio vigente · PF-M7-44.4
  @CA-44.4 @S4 @prioridad-M @funcional @integracion @regresion
  Escenario: El promedio de compra respalda el costo estimado
    Dado que el último precio de mercado de "Miltomate" es del 20/09/2026, con más de 14 días
    Y el promedio de compra de "Miltomate" es Q8.75
    Cuando se calcula el costo de "Pepián de pollo"
    Entonces "Miltomate" usa Q8.75 con la etiqueta "Precio de compra promedio"

  # CA-44.5 Validación de precio · PF-M7-44.5
  @CA-44.5 @S4 @prioridad-M @limite @integracion @regresion
  Esquema del escenario: Precio inválido
    Dado que marco "Cebolla" como comprado
    Cuando escribo el precio <precio>
    Entonces veo "<mensaje>"
    Y "Cebolla" queda comprado sin precio

    Ejemplos:
      | precio | mensaje                               |
      | 0      | El precio debe ser mayor que Q0.00    |
      | -5.00  | El precio debe ser mayor que Q0.00    |
      | 12.345 | Usa máximo 2 decimales                |

  # CA-44.6 Sin conexión · PF-M7-44.6
  @CA-44.6 @S4 @prioridad-M @funcional @e2e @regresion
  Escenario: Precio registrado en modo avión
    Dado que el teléfono está en modo avión con la lista abierta
    Cuando marco "Arroz" como comprado con precio Q12.50
    Entonces veo "1 cambio pendiente"
    Y al reconectar el precio se sincroniza una sola vez aunque el envío se repita
