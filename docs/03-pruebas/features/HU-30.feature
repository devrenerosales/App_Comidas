# language: es
# Generado por docs/03-pruebas/scripts/extraer_casos.py — no editar a mano.
# Fuente: docs/01-requerimientos/historias/M07 · CU-07.3 · RF-30
@HU-30 @M07 @S4 @prioridad-M
Característica: HU-30 Editar y marcar la lista de compras
  Como miembro del hogar, quiero agregar, quitar y marcar productos comprados aunque no tenga señal en el supermercado, para llevar el control de la compra sin depender de la conexión.

  # CA-30.1 Flujo principal con conexión · PF-M7-30.1
  @CA-30.1 @S4 @prioridad-M @funcional @e2e @regresion
  Escenario: Marcar un producto como comprado
    Dado una lista con 12 productos y ninguno comprado
    Cuando marco "Pollo en piezas 7 lb" como comprado
    Entonces el producto aparece tachado
    Y el contador muestra "1 / 12 comprados"
    Y el cambio queda guardado en el servidor

  # CA-30.2 Flujo alterno sin conexión · PF-M7-30.2
  @CA-30.2 @S4 @prioridad-M @funcional @e2e @regresion
  Escenario: Cambios en modo avión se sincronizan al reconectar
    Dado que el teléfono está en modo avión con la lista abierta
    Cuando marco 3 productos como comprados
    Y agrego "Tortillas" con cantidad 30
    Entonces veo "4 cambios pendientes"
    Y al desactivar el modo avión los 4 cambios se envían sin acción del usuario
    Y el indicador de pendientes desaparece

  # CA-30.3 Flujo alterno: conflicto entre dispositivos · PF-M7-30.3
  @CA-30.3 @S4 @prioridad-M @negativo @e2e @regresion
  Escenario: Producto eliminado en un dispositivo y comprado en otro
    Dado que Rene quita "Azúcar 5 lb" de la lista a las 10:00 con conexión
    Y su esposa, sin conexión, marca "Azúcar 5 lb" como comprado a las 10:05
    Cuando el teléfono de su esposa se sincroniza
    Entonces "Azúcar 5 lb" vuelve a la lista marcado como comprado en ambos dispositivos

  # CA-30.4 Validación · PF-M7-30.4
  @CA-30.4 @S4 @prioridad-M @negativo @integracion @regresion
  Escenario: Agregar producto con cantidad inválida
    Cuando agrego "Cebolla" con cantidad 0
    Entonces veo "La cantidad debe ser mayor que 0"
    Y el producto no se agrega
