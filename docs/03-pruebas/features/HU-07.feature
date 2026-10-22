# language: es
# Generado por docs/03-pruebas/scripts/extraer_casos.py — no editar a mano.
# Fuente: docs/01-requerimientos/historias/M02 · CU-02.3 · RF-07
@HU-07 @M02 @S1 @prioridad-M
Característica: HU-07 Recálculo de la distribución con vista previa
  Como administrador, quiero ver cómo cambia la distribución del presupuesto antes de guardar un cambio de tiempos de comida, para decidir con información y sin afectar los menús que ya aprobé.

  # CA-07.1 Flujo principal · PF-M2-07.1
  @CA-07.1 @S1 @prioridad-M @funcional @unitaria @regresion
  Escenario: Vista previa al pasar de dos a tres tiempos
    Dado que el hogar tiene presupuesto semanal de Q600 con almuerzo 60 % (Q360) y cena 40 % (Q240)
    Cuando activo "Desayuno" y pulso "Continuar"
    Entonces la vista previa muestra:
      | Tiempo   | Actual | Nuevo |
      | Desayuno | —      | Q120  |
      | Almuerzo | Q360   | Q300  |
      | Cena     | Q240   | Q180  |
    Y no se ha guardado ningún cambio

  # CA-07.2 Los menús aprobados no cambian · PF-M2-07.2
  @CA-07.2 @S1 @prioridad-M @funcional @unitaria @regresion
  Escenario: Confirmar con un menú aprobado en la semana siguiente
    Dado que el menú de la semana del 2026-10-25 está aprobado con almuerzo y cena
    Y su almuerzo del lunes es "Pollo en crema" con presupuesto de almuerzo Q360
    Cuando confirmo la vista previa de tres tiempos
    Entonces el menú de la semana del 2026-10-25 conserva almuerzo y cena, "Pollo en crema" y el presupuesto Q360
    Y el menú de la semana del 2026-11-01 se sugiere con desayuno Q120, almuerzo Q300 y cena Q180

  # CA-07.3 Flujo alterno: cancelar · PF-M2-07.3
  @CA-07.3 @S1 @prioridad-M @funcional @unitaria @regresion
  Escenario: Cancelar desde la vista previa
    Dado que el hogar tiene solo almuerzo con Q250
    Cuando activo "Cena", veo la vista previa con almuerzo Q150 y cena Q100 y pulso "Cancelar"
    Entonces el hogar sigue con solo almuerzo y Q250

  # CA-07.4 Flujo alterno: menú en borrador · PF-M2-07.4
  @CA-07.4 @S1 @prioridad-M @funcional @unitaria @regresion
  Escenario: Borrador futuro queda desactualizado
    Dado que el menú de la semana del 2026-11-01 está en Borrador con solo almuerzo
    Cuando confirmo el cambio a almuerzo y cena
    Entonces ese menú se marca "Desactualizado" con la opción "Regenerar"
    Y sus platillos, como "Pepián de pollo" del martes, no se modifican automáticamente

  # CA-07.5 Validación o error · PF-M2-07.5
  @CA-07.5 @S1 @prioridad-M @negativo @unitaria @regresion
  Escenario: Ajuste en vista previa que no suma 100 %
    Dado que la vista previa propone 20 %, 50 % y 30 %
    Cuando cambio el almuerzo a 45 %
    Entonces veo "Faltan 5 % por asignar"
    Y el botón "Confirmar" está deshabilitado
