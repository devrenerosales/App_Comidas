# language: es
# Generado por docs/03-pruebas/scripts/extraer_casos.py — no editar a mano.
# Fuente: docs/01-requerimientos/historias/M06 · CU-06.3 · RF-26
@HU-26 @M06 @S3 @prioridad-M
Característica: HU-26 Costo estimado vs. presupuesto
  Como miembro del hogar, quiero ver el costo estimado por día, por tiempo y total frente al presupuesto, para saber si el menú nos alcanza antes de aprobarlo.

  # CA-26.1 Flujo principal (solo almuerzo) · PF-M6-26.1
  @CA-26.1 @S3 @prioridad-M @funcional @e2e @regresion
  Escenario: Costo semanal dentro del presupuesto
    Dado un presupuesto semanal de Q245.00 con solo almuerzo
    Y el menú tiene domingo "Pollo en crema" Q28.00, lunes "Carne guisada" Q31.50, martes "Pescado frito" Q38.00, miércoles "Tortitas de carne" Q26.00, jueves "Pepián de pollo" Q42.00, viernes "Spaghetti con carne" Q30.00 y sábado "Chile relleno" Q34.00
    Cuando abro el menú
    Entonces veo total Q229.50 de Q245.00 en verde
    Y veo "Disponible Q15.50"

  # CA-26.2 Flujo alterno (dos tiempos, un tiempo excede) · PF-M6-26.2
  @CA-26.2 @S3 @prioridad-M @funcional @integracion @regresion
  Escenario: Total dentro pero almuerzo excedido
    Dado un presupuesto semanal de Q500.00 con almuerzo 60 % y cena 40 %
    Y el costo del almuerzo es Q310.00 y el de la cena Q170.00
    Cuando abro el menú
    Entonces veo almuerzo Q310.00 de Q300.00 en rojo con "Excede por Q10.00"
    Y veo cena Q170.00 de Q200.00 en verde
    Y veo total Q480.00 de Q500.00 en verde

  # CA-26.3 Costo incompleto · PF-M6-26.3
  @CA-26.3 @S3 @prioridad-M @negativo @integracion @regresion
  Escenario: Ingrediente sin precio
    Dado que "Chile relleno" usa un ingrediente sin precio registrado
    Cuando abro el menú
    Entonces el sábado muestra "Q34.00*"
    Y veo "* Costo incompleto: hay ingredientes sin precio"

  # CA-26.4 Recalculo al editar · PF-M6-26.4
  @CA-26.4 @S3 @prioridad-M @funcional @integracion @regresion
  Escenario: El costo se actualiza al cambiar un platillo
    Dado el menú del escenario CA-26.1 con total Q229.50
    Cuando cambio el miércoles de "Tortitas de carne" a "Caldo de res" de Q45.00
    Entonces el total pasa a Q248.50 en rojo con "Excede por Q3.50"
