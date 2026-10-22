# language: es
# Generado por docs/03-pruebas/scripts/extraer_casos.py — no editar a mano.
# Fuente: docs/01-requerimientos/historias/M05 · CU-05.2 · RF-20
@HU-20 @M05 @S3 @prioridad-M
Característica: HU-20 Puntaje de platillos
  Como administrador del hogar, quiero que cada platillo reciba un puntaje por preferencia, novedad, ahorro y afinidad con pesos que pueda ajustar, para que las sugerencias reflejen lo que más le importa a mi familia.

  # CA-20.1 Flujo principal (cálculo con pesos por defecto) · PF-M5-20.1
  @CA-20.1 @S3 @prioridad-M @funcional @unitaria @regresion
  Escenario: Puntaje de Pollo en crema
    Dado pesos 0.40 Preferencia, 0.25 Novedad, 0.20 Ahorro y 0.15 Afinidad
    Y un presupuesto de almuerzo de Q245.00
    Y "Pollo en crema" con calificación promedio 4.6, preparado hace 4 semanas, costo Q28.00 y 6 veces en 16 semanas
    Y el platillo más frecuente del almuerzo se preparó 8 veces
    Cuando el motor calcula el puntaje
    Entonces los factores son Preferencia 0.90, Novedad 0.50, Ahorro 0.20 y Afinidad 0.75
    Y el puntaje es 0.6375

  # CA-20.2 Flujo alterno (novedad 0 y ahorro sin negativos) · PF-M5-20.2
  @CA-20.2 @S3 @prioridad-M @funcional @unitaria @regresion
  Escenario: Platillo preparado hace una semana y más caro que el presupuesto por comida
    Dado "Pepián de pollo" con calificación 5.0, preparado hace 1 semana, costo Q42.00 y 4 veces en 16 semanas
    Y el presupuesto por comida es Q35.00
    Cuando el motor calcula el puntaje
    Entonces Novedad es 0.00 y Ahorro es 0.00
    Y el puntaje es 0.4750
    Y queda por debajo de "Carne guisada" con 0.6075

  # CA-20.3 Validación de pesos · PF-M5-20.3
  @CA-20.3 @S3 @prioridad-M @negativo @unitaria @regresion
  Escenario: Pesos que no suman 1.00
    Dado que soy administrador
    Cuando ingreso pesos 0.50, 0.25, 0.20 y 0.15
    Entonces veo "Los pesos deben sumar 1.00 (suma actual 1.10)"
    Y el botón "Guardar" está deshabilitado

  # CA-20.4 Permiso · PF-M5-20.4
  @CA-20.4 @S3 @prioridad-M @negativo @unitaria @regresion
  Escenario: Un miembro no puede cambiar los pesos
    Dado que inicié sesión como miembro del hogar
    Cuando envío pesos 0.30, 0.30, 0.20 y 0.20
    Entonces la API responde 403
    Y los pesos siguen en 0.40, 0.25, 0.20 y 0.15
