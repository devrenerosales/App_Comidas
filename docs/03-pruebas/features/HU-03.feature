# language: es
# Generado por docs/03-pruebas/scripts/extraer_casos.py — no editar a mano.
# Fuente: docs/01-requerimientos/historias/M01 · CU-01.3 · RF-03
@HU-03 @M01 @S1 @prioridad-M
Característica: HU-03 Registrar comensales del hogar
  Como administrador, quiero registrar quiénes comen en casa con un factor de porción para cada uno, para que las cantidades del menú y de la lista de compras se ajusten a lo que realmente come mi familia.

  # CA-03.1 Flujo principal · PF-M1-03.1
  @CA-03.1 @S1 @prioridad-M @funcional @e2e @regresion
  Escenario: Agregar un comensal con el factor sugerido
    Dado que el hogar "Familia Rosales" tiene los comensales "Rene" 1.0, "Ana" 1.0 y "Diego" 1.0
    Cuando agrego a "Abuela Carmen" sin cambiar el factor
    Entonces "Abuela Carmen" queda con factor de porción 1.0
    Y el hogar tiene 4 comensales con Σ factores 4.0

  # CA-03.2 Flujo alterno · PF-M1-03.2
  @CA-03.2 @S1 @prioridad-M @funcional @integracion @regresion
  Escenario: Quitar un comensal
    Dado que el hogar tiene 4 comensales activos
    Cuando quito a "Diego" y confirmo
    Entonces "Diego" queda inactivo
    Y el hogar tiene 3 comensales activos

  # CA-03.3 Validación o error · PF-M1-03.3
  @CA-03.3 @S1 @prioridad-M @negativo @integracion @regresion
  Escenario: Nombre repetido
    Dado que existe el comensal "Ana"
    Cuando intento agregar otro comensal llamado "Ana"
    Entonces veo "Ya existe un comensal con ese nombre"
    Y no se guarda

  # CA-03.4 Permisos · PF-M1-03.4
  @CA-03.4 @S1 @prioridad-M @negativo @integracion @regresion
  Escenario: Un miembro no puede modificar comensales
    Dado que inicié sesión como Miembro del hogar
    Cuando intento agregar el comensal "Abuela Carmen"
    Entonces el sistema rechaza la acción con "Solo el administrador puede modificar comensales"

  # CA-03.5 Factor de porción reducido · PF-M1-03.5
  @CA-03.5 @S1 @prioridad-M @funcional @integracion @regresion
  Escenario: Comensal pequeño con factor 0.5
    Dado que el hogar tiene "Rene" 1.0, "Ana" 1.0 y "Diego" 1.0
    Cuando agrego a "Sofía" con etiqueta niño y factor de porción 0.5
    Entonces el hogar tiene Σ factores 3.5
    Y la etiqueta "niño" no cambia el cálculo de cantidades

  # CA-03.6 Validación del rango del factor · PF-M1-03.6
  @CA-03.6 @S1 @prioridad-M @limite @integracion @regresion
  Esquema del escenario: Factor fuera de rango o fuera de paso
    Dado que edito el comensal "Diego"
    Cuando cambio su factor de porción a <factor>
    Entonces veo "El factor debe estar entre 0.25 y 2.0 en pasos de 0.25"
    Y "Diego" conserva su factor 1.0

    Ejemplos:
      | factor |
      | 0      |
      | 2.25   |
      | 0.3    |
