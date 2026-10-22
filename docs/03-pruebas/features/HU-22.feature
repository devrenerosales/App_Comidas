# language: es
# Generado por docs/03-pruebas/scripts/extraer_casos.py — no editar a mano.
# Fuente: docs/01-requerimientos/historias/M05 · CU-05.4 · RF-22
@HU-22 @M05 @S3 @prioridad-S
Característica: HU-22 Motivo de la sugerencia
  Como miembro del hogar, quiero ver por qué se sugirió cada platillo, para confiar en la propuesta y decidir si la cambio.

  # CA-22.1 Flujo principal · PF-M5-22.1
  @CA-22.1 @S3 @prioridad-S @funcional @e2e
  Escenario: Ver factores de Pollo en crema
    Dado que el domingo en almuerzo el motor sugirió "Pollo en crema" con puntaje 0.6375
    Cuando toco "¿Por qué?"
    Entonces veo Preferencia 0.90, Novedad 0.50, Ahorro 0.20 y Afinidad 0.75
    Y veo los pesos 0.40, 0.25, 0.20 y 0.15
    Y veo "Costo estimado Q28.00"

  # CA-22.2 Flujo alterno (platillo del usuario) · PF-M5-22.2
  @CA-22.2 @S3 @prioridad-S @funcional @integracion
  Escenario: Platillo cambiado por el usuario
    Dado que cambié el martes en almuerzo a "Chile relleno"
    Cuando toco "¿Por qué?"
    Entonces veo "Elegido por el usuario" sin factores

  # CA-22.3 Pesos cambiados después de generar · PF-M5-22.3
  @CA-22.3 @S3 @prioridad-S @funcional @integracion
  Escenario: La explicación conserva los pesos usados
    Dado que el menú se generó con pesos 0.40, 0.25, 0.20 y 0.15
    Y después el administrador cambió los pesos a 0.30, 0.30, 0.25 y 0.15
    Cuando toco "¿Por qué?" en "Carne guisada"
    Entonces veo los pesos 0.40, 0.25, 0.20 y 0.15 y el puntaje 0.6075

  # CA-22.4 Reemplazo por presupuesto · PF-M5-22.4
  @CA-22.4 @S3 @prioridad-S @funcional @integracion
  Escenario: Motivo de un reemplazo
    Dado que "Tortitas de carne" reemplazó a "Pepián de pollo" por presupuesto
    Cuando toco "¿Por qué?" en "Tortitas de carne"
    Entonces veo "Reemplazo por presupuesto: Q22.00 más barato"
