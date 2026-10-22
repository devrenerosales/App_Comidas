# language: es
# Generado por docs/03-pruebas/scripts/extraer_casos.py — no editar a mano.
# Fuente: docs/01-requerimientos/historias/M02 · CU-02.1 · RF-05
@HU-05 @M02 @S1 @prioridad-M
Característica: HU-05 Tiempos de comida parametrizables
  Como administrador, quiero elegir si planifico solo almuerzos, dos tiempos que yo escoja o los tres tiempos, para que el menú y el presupuesto reflejen cómo come mi familia.

  # CA-05.1 Flujo principal · PF-M2-05.1
  @CA-05.1 @S1 @prioridad-M @funcional @e2e @regresion
  Escenario: Cambiar de solo almuerzo a almuerzo y cena
    Dado que el hogar tiene presupuesto semanal de Q500 y solo almuerzo activo
    Cuando activo "Cena" y acepto la distribución sugerida
    Entonces el presupuesto de almuerzo es Q300 y el de cena Q200
    Y el próximo menú sugerido incluye almuerzo y cena de domingo a sábado

  # CA-05.2 Flujo alterno: dos tiempos elegibles · PF-M2-05.2
  @CA-05.2 @S1 @prioridad-M @funcional @integracion @regresion
  Escenario: Elegir desayuno y almuerzo
    Dado que el hogar tiene presupuesto semanal de Q500 y solo almuerzo activo
    Cuando elijo "Dos tiempos", marco "Desayuno" y "Almuerzo" y acepto la distribución sugerida
    Entonces el presupuesto de desayuno es Q145 y el de almuerzo Q355

  # CA-05.3 Validación o error · PF-M2-05.3
  @CA-05.3 @S1 @prioridad-M @negativo @integracion @regresion
  Escenario: Opción dos tiempos con un solo tiempo marcado
    Dado que elegí "Dos tiempos"
    Cuando marco solo "Cena" e intento continuar
    Entonces veo "Selecciona exactamente dos tiempos"
    Y no se muestra la vista previa

  # CA-05.4 Permisos · PF-M2-05.4
  @CA-05.4 @S1 @prioridad-M @negativo @integracion @regresion
  Escenario: Un miembro no puede cambiar los tiempos
    Dado que inicié sesión como Miembro del hogar
    Cuando intento activar "Desayuno"
    Entonces veo "Solo el administrador puede cambiar los tiempos de comida"
    Y la configuración no cambia
