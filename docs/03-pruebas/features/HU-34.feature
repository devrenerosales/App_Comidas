# language: es
# Generado por docs/03-pruebas/scripts/extraer_casos.py — no editar a mano.
# Fuente: docs/01-requerimientos/historias/M08 · CU-08.1 · RF-34
@HU-34 @M08 @S5 @prioridad-M
Característica: HU-34 Registrar precio manual o desde ticket
  Como miembro del hogar, quiero registrar precios a mano o tomando foto del ticket, para tener precios de Super Fresh y otras tiendas que no se consultan automáticamente.

  # CA-34.1 Flujo principal manual · PF-M8-34.1
  @CA-34.1 @S5 @prioridad-M @funcional @e2e @regresion
  Escenario: Registrar precio de Super Fresh
    Dado que "Pollo en piezas (lb)" tiene precio vigente Q21.90 en Paiz y Q22.50 en Walmart
    Cuando registro "Pollo en piezas (lb)" en Super Fresh a Q20.75 con fecha 24/10/2026
    Entonces el precio se guarda con origen "manual"
    Y el precio mínimo del producto pasa a ser Q20.75 en Super Fresh

  # CA-34.2 Flujo principal ticket · PF-M8-34.2
  @CA-34.2 @S5 @prioridad-M @funcional @e2e @regresion @manual-parcial
  Escenario: Ticket con tres líneas
    Dado una foto de ticket de Super Fresh del 24/10/2026 con las líneas "POLLO PZ LB 20.75", "TOMATE LB 6.00" y "ARROZ 2LB 12.90"
    Cuando la subo
    Entonces veo 3 líneas propuestas: "Pollo en piezas (lb)" Q20.75, "Tomate (lb)" Q6.00 y "Arroz blanco 2 lb" Q12.90
    Cuando corrijo el tomate a Q6.10 y confirmo
    Entonces se guardan 3 precios con origen "ticket" y la foto adjunta

  # CA-34.3 Flujo alterno: ticket ilegible · PF-M8-34.3
  @CA-34.3 @S5 @prioridad-M @negativo @integracion @regresion @manual-parcial
  Escenario: OCR sin líneas legibles
    Dado una foto de ticket borrosa
    Cuando la subo
    Entonces veo "No se pudo leer el ticket"
    Y se abre la captura manual con la foto visible

  # CA-34.4 Validación · PF-M8-34.4
  @CA-34.4 @S5 @prioridad-M @limite @integracion @regresion
  Esquema del escenario: Datos inválidos
    Cuando registro "Arroz blanco 2 lb" en Super Fresh a <precio> con fecha <fecha>
    Entonces veo "<mensaje>" y no se guarda el precio

    Ejemplos:
      | precio | fecha      | mensaje                                   |
      | 0.00   | 24/10/2026 | El precio debe ser mayor que 0            |
      | 12.905 | 24/10/2026 | El precio admite como máximo 2 decimales  |
      | 12.90  | 30/10/2026 | La fecha de compra no puede ser futura    |
