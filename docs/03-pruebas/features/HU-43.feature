# language: es
# Generado por docs/03-pruebas/scripts/extraer_casos.py — no editar a mano.
# Fuente: docs/01-requerimientos/historias/M07 · CU-07.6 · RF-43
@HU-43 @M07 @S4 @prioridad-M
Característica: HU-43 Avance de compra por comida
  Como miembro del hogar, quiero ver cuántos ingredientes de cada comida ya compré o ya tengo, para saber qué comidas de la semana están listas para preparar y cuánto me falta de la compra.

  # CA-43.1 Flujo principal · PF-M7-43.1
  @CA-43.1 @S4 @prioridad-M @funcional @e2e @regresion
  Escenario: Avance parcial de una comida
    Dado el menú aprobado de la semana del 25/10/2026 con "Pepián de pollo" el miércoles en el almuerzo
    Y "Pepián de pollo" tiene 6 ingredientes en la lista: "Pollo en piezas", "Miltomate", "Tomate", "Cebolla", "Pepitoria" y "Ajonjolí"
    Y están marcados como comprados "Pollo en piezas", "Miltomate", "Tomate" y "Cebolla"
    Cuando abro la pestaña "Por comida"
    Entonces veo "Pepián de pollo · miércoles almuerzo · 4 de 6"
    Y "Pepián de pollo" no muestra "Lista para preparar"

  # CA-43.2 Flujo alterno: Ya lo tengo completa la comida · PF-M7-43.2
  @CA-43.2 @S4 @prioridad-M @funcional @integracion @regresion
  Escenario: Marcar Ya lo tengo cuenta como cubierto
    Dado que "Pepián de pollo" está en "4 de 6" y faltan "Pepitoria" y "Ajonjolí"
    Cuando marco "Pepitoria" como comprado
    Y marco "Ajonjolí" como "Ya lo tengo"
    Entonces veo "Pepián de pollo · 6 de 6" con la marca "Lista para preparar"
    Y "Ajonjolí" no suma al gasto real de la semana

  # CA-43.3 Flujo alterno: producto compartido · PF-M7-43.3
  @CA-43.3 @S4 @prioridad-M @funcional @integracion @regresion
  Escenario: Un producto compartido cuenta para todas sus comidas
    Dado que "Cebolla" es ingrediente de "Pepián de pollo", "Carne guisada" y "Caldo de res"
    Y "Cebolla" está pendiente
    Y "Carne guisada" está en "2 de 5" y "Caldo de res" en "3 de 7"
    Cuando marco "Cebolla" como comprado una sola vez
    Entonces "Carne guisada" pasa a "3 de 5" y "Caldo de res" a "4 de 7"
    Y "Pepián de pollo" también suma ese ingrediente

  # CA-43.4 Avance general de la semana · PF-M7-43.4
  @CA-43.4 @S4 @prioridad-M @funcional @integracion @regresion
  Escenario: Avance general con porcentaje redondeado
    Dado una lista con 31 productos activos
    Y 15 están comprados y 3 marcados "Ya lo tengo"
    Cuando abro la lista
    Entonces veo "18 de 31 productos (58 %)"

  # CA-43.5 Sin conexión · PF-M7-43.5
  @CA-43.5 @S4 @prioridad-M @funcional @e2e @regresion
  Escenario: El avance se actualiza en modo avión
    Dado que el teléfono está en modo avión con la lista abierta
    Y "Tortitas de carne" está en "3 de 4"
    Cuando marco "Pan molido" como comprado
    Entonces veo "Tortitas de carne · 4 de 4" con la marca "Lista para preparar"
    Y veo "1 cambio pendiente"

  # CA-43.6 Validación: desmarcar quita la marca · PF-M7-43.6
  @CA-43.6 @S4 @prioridad-M @negativo @integracion @regresion
  Escenario: Desmarcar un ingrediente de una comida lista
    Dado que "Pescado frito" está en "4 de 4" con la marca "Lista para preparar"
    Cuando desmarco "Limón"
    Entonces veo "Pescado frito · 3 de 4"
    Y "Pescado frito" ya no muestra "Lista para preparar"
