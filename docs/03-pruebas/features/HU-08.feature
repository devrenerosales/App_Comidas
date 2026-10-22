# language: es
# Generado por docs/03-pruebas/scripts/extraer_casos.py — no editar a mano.
# Fuente: docs/01-requerimientos/historias/M02 · CU-02.4 · RF-08
@HU-08 @M02 @S1 @prioridad-S
Característica: HU-08 Inicio de semana y día de planificación
  Como administrador, quiero definir qué día empieza la semana del menú y qué día planificamos, para adaptar la app a nuestra rutina de compras.

  # CA-08.1 Flujo principal: valores por defecto · PF-M2-08.1
  @CA-08.1 @S1 @prioridad-S @funcional @e2e
  Escenario: Hogar nuevo usa domingo
    Dado que creo el hogar "Familia Rosales" el 2026-10-22
    Cuando abro Configuración → "Semana"
    Entonces el día de inicio es "Domingo" y el día de planificación es "Domingo"
    Y la próxima semana va del domingo 2026-10-25 al sábado 2026-10-31

  # CA-08.2 Flujo alterno: semana de transición · PF-M2-08.2
  @CA-08.2 @S1 @prioridad-S @limite @integracion
  Escenario: Cambiar inicio a lunes con un menú aprobado
    Dado que el menú del 2026-10-18 al 2026-10-24 está aprobado y hoy es 2026-10-22
    Cuando cambio el día de inicio a "Lunes" y guardo
    Entonces se crea una semana de transición de un día: domingo 2026-10-25
    Y la siguiente semana va del lunes 2026-10-26 al domingo 2026-11-01

  # CA-08.3 Día de planificación · PF-M2-08.3
  @CA-08.3 @S1 @prioridad-S @funcional @integracion @manual-parcial
  Escenario: Cambiar el día de planificación a sábado
    Dado que el día de planificación es "Domingo"
    Cuando lo cambio a "Sábado" y guardo
    Entonces el recordatorio de planificación se programa para el sábado 2026-10-24

  # CA-08.4 Permisos · PF-M2-08.4
  @CA-08.4 @S1 @prioridad-S @negativo @integracion
  Escenario: Un miembro no puede cambiar la semana
    Dado que inicié sesión como Miembro
    Cuando intento cambiar el día de inicio a "Lunes"
    Entonces veo "Solo el administrador puede cambiar esta configuración"
