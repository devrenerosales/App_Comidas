# language: es
# Generado por docs/03-pruebas/scripts/extraer_casos.py — no editar a mano.
# Fuente: docs/01-requerimientos/historias/M01 · CU-01.1 · RF-01
@HU-01 @M01 @S1 @prioridad-M
Característica: HU-01 Registro e inicio de sesión
  Como integrante de la familia, quiero crear una cuenta e iniciar sesión con mi correo y contraseña, para acceder de forma segura al menú y la lista de compras de mi hogar.

  # CA-01.1 Flujo principal · PF-M1-01.1
  @CA-01.1 @S1 @prioridad-M @funcional @e2e @regresion
  Escenario: Registro exitoso de un usuario nuevo
    Dado que no existe una cuenta con el correo "rene@correo.com"
    Cuando me registro con nombre "Rene", correo "rene@correo.com" y contraseña "Almuerzo2026"
    Entonces se crea la cuenta con la contraseña cifrada
    Y quedo con sesión iniciada
    Y la app me lleva a "Crear hogar"

  # CA-01.2 Flujo alterno · PF-M1-01.2
  @CA-01.2 @S1 @prioridad-M @negativo @integracion @regresion
  Escenario: Registro con un correo ya existente
    Dado que existe una cuenta con el correo "rene@correo.com"
    Cuando intento registrarme con el correo "rene@correo.com"
    Entonces veo el mensaje "Este correo ya tiene cuenta"
    Y se me ofrece la opción "Iniciar sesión"

  # CA-01.3 Validación o error · PF-M1-01.3
  @CA-01.3 @S1 @prioridad-M @negativo @integracion @regresion
  Escenario: Bloqueo por intentos fallidos
    Dado que la cuenta "rene@correo.com" tiene 4 intentos fallidos en los últimos 15 minutos
    Cuando inicio sesión con la contraseña "incorrecta1"
    Entonces veo el mensaje "Correo o contraseña incorrectos"
    Y la cuenta queda bloqueada para iniciar sesión durante 15 minutos

  # CA-01.4 Validación de contraseña · PF-M1-01.4
  @CA-01.4 @S1 @prioridad-M @negativo @integracion @regresion
  Escenario: Contraseña que no cumple la política
    Cuando me registro con la contraseña "pollo"
    Entonces veo "La contraseña debe tener al menos 8 caracteres, una letra y un número"
    Y no se crea la cuenta
