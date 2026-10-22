# language: es
# Generado por docs/03-pruebas/scripts/extraer_casos.py — no editar a mano.
# Fuente: docs/01-requerimientos/historias/M01 · CU-01.4 · RF-04
@HU-04 @M01 @S1 @prioridad-S
Característica: HU-04 Recuperar contraseña
  Como usuario que olvidó su contraseña, quiero restablecerla con un enlace enviado a mi correo, para recuperar el acceso sin perder la información de mi hogar.

  # CA-04.1 Flujo principal · PF-M1-04.1
  @CA-04.1 @S1 @prioridad-S @funcional @e2e
  Escenario: Restablecer contraseña con enlace vigente
    Dado que existe la cuenta "ana@correo.com"
    Y solicité recuperar la contraseña hace 20 minutos
    Cuando abro el enlace e ingreso dos veces "PepianDePollo9"
    Entonces veo "Contraseña actualizada"
    Y puedo iniciar sesión con "PepianDePollo9"
    Y el enlace ya no puede volver a usarse

  # CA-04.2 Flujo alterno · PF-M1-04.2
  @CA-04.2 @S1 @prioridad-S @funcional @integracion
  Escenario: Correo no registrado
    Dado que no existe una cuenta con "nadie@correo.com"
    Cuando solicito recuperar la contraseña de "nadie@correo.com"
    Entonces veo "Si el correo existe, recibirás un enlace"
    Y no se envía ningún correo

  # CA-04.3 Validación o error · PF-M1-04.3
  @CA-04.3 @S1 @prioridad-S @negativo @integracion
  Escenario: Enlace vencido
    Dado que solicité recuperar la contraseña hace 2 horas
    Cuando abro el enlace
    Entonces veo "El enlace no es válido, solicita uno nuevo"
