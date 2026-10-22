# language: es
# Generado por docs/03-pruebas/scripts/extraer_casos.py — no editar a mano.
# Fuente: docs/01-requerimientos/historias/M07 · CU-07.5 · RF-32
@HU-32 @M07 @S4 @prioridad-C
Característica: HU-32 Compartir la lista de compras
  Como miembro del hogar, quiero compartir la lista por WhatsApp, para que otra persona de la familia pueda hacer la compra.

  # CA-32.1 Flujo principal · PF-M7-32.1
  @CA-32.1 @S4 @prioridad-C @funcional @e2e
  Escenario: Compartir pendientes por WhatsApp
    Dado una lista de la semana del 25/10/2026 con 12 productos y 4 marcados como comprados
    Cuando toco "Compartir" y elijo WhatsApp
    Entonces el mensaje inicia con "Lista de compras 25/10–31/10"
    Y contiene los 8 productos pendientes con su cantidad, por ejemplo "Pollo en piezas — 7 lb"

  # CA-32.2 Flujo alterno: sin conexión y sin compartir nativo · PF-M7-32.2
  @CA-32.2 @S4 @prioridad-C @funcional @e2e @manual-parcial
  Escenario: Navegador de escritorio sin compartir nativo
    Dado que uso la PWA en un navegador que no soporta compartir
    Y no tengo conexión
    Cuando toco "Compartir"
    Entonces el texto de la lista se copia al portapapeles
    Y veo "Lista copiada"

  # CA-32.3 Excepción: sin pendientes · PF-M7-32.3
  @CA-32.3 @S4 @prioridad-C @negativo @e2e
  Escenario: Todos los productos comprados
    Dado que los 12 productos de la lista están marcados como comprados
    Cuando toco "Compartir"
    Entonces veo "No hay productos pendientes" y la opción "Incluir comprados"
