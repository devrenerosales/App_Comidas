# language: es
# Generado por docs/03-pruebas/scripts/extraer_casos.py — no editar a mano.
# Fuente: docs/01-requerimientos/historias/M03 · CU-11.1 · RF-14
@HU-14 @M03 @S3 @prioridad-S
Característica: HU-14 Calificar platillo
  Como miembro del hogar, quiero calificar de 1 a 5 un platillo después de comerlo, para que el sistema sugiera más seguido lo que nos gusta.

  # CA-14.1 Flujo principal · PF-M3-14.1
  @CA-14.1 @S3 @prioridad-S @funcional @e2e
  Escenario: Calificar un almuerzo ya comido
    Dado que hoy es jueves 2026-11-12
    Y el martes 2026-11-10 el almuerzo fue "Pollo en crema" sin calificación
    Cuando califico ese almuerzo con 4 estrellas
    Entonces la calificación queda en 4
    Y el catálogo muestra el promedio de "Pollo en crema" actualizado

  # CA-14.2 Flujo alterno · PF-M3-14.2
  @CA-14.2 @S3 @prioridad-S @funcional @integracion
  Escenario: Cambiar una calificación
    Dado que "Caldo de res" tiene calificaciones 3 y 5 con promedio 4.0
    Cuando cambio la calificación de 3 a 5
    Entonces el promedio de "Caldo de res" es 5.0

  # CA-14.3 Validación o error · PF-M3-14.3
  @CA-14.3 @S3 @prioridad-S @negativo @integracion
  Escenario: Intentar calificar un día futuro
    Dado que hoy es jueves 2026-11-12
    Y el sábado 2026-11-14 el almuerzo es "Spaghetti con carne"
    Cuando abro el sábado en el plan semanal
    Entonces la opción "Calificar" no está disponible

  # CA-14.4 Validación o error · PF-M3-14.4
  @CA-14.4 @S3 @prioridad-S @negativo @integracion
  Escenario: Valor fuera de rango por API
    Cuando envío una calificación con valor 6
    Entonces la API responde 422 "La calificación debe estar entre 1 y 5"
