# language: es
# Generado por docs/03-pruebas/scripts/extraer_casos.py — no editar a mano.
# Fuente: docs/01-requerimientos/historias/M02 · CU-02.2 · RF-06
@HU-06 @M02 @S1 @prioridad-M
Característica: HU-06 Presupuesto semanal y su distribución
  Como administrador, quiero definir el presupuesto semanal y repartirlo por tiempo de comida en porcentaje o en quetzales, para que cada menú se ajuste a lo que puedo gastar.

  # CA-06.1 Flujo principal · PF-M2-06.1
  @CA-06.1 @S1 @prioridad-M @funcional @e2e @regresion
  Escenario: Distribución por porcentaje con tres tiempos
    Dado que el hogar tiene desayuno, almuerzo y cena activos
    Cuando defino un presupuesto semanal de Q700 con 20 %, 50 % y 30 %
    Y guardo
    Entonces el presupuesto de desayuno es Q140.00, el de almuerzo Q350.00 y el de cena Q210.00

  # CA-06.2 Flujo alterno: distribución por monto · PF-M2-06.2
  @CA-06.2 @S1 @prioridad-M @funcional @integracion @regresion
  Escenario: Distribución por monto con almuerzo y cena
    Dado que el hogar tiene almuerzo y cena activos y presupuesto semanal de Q500
    Cuando asigno Q320 al almuerzo y Q180 a la cena y guardo
    Entonces la distribución queda en 64 % almuerzo y 36 % cena

  # CA-06.3 Validación: porcentajes incompletos · PF-M2-06.3
  @CA-06.3 @S1 @prioridad-M @limite @integracion @regresion
  Escenario: Porcentajes que no suman 100 %
    Dado que el hogar tiene desayuno, almuerzo y cena activos
    Cuando asigno 20 %, 50 % y 25 %
    Entonces veo "Faltan 5 % por asignar"
    Y el botón "Guardar" está deshabilitado

  # CA-06.4 Validación: montos excedidos · PF-M2-06.4
  @CA-06.4 @S1 @prioridad-M @limite @integracion @regresion
  Escenario: Montos que exceden el presupuesto
    Dado que el presupuesto semanal es Q500 con almuerzo y cena activos
    Cuando asigno Q320 al almuerzo y Q200 a la cena
    Entonces veo "Excede el presupuesto por Q20.00"
    Y no se guarda la distribución
