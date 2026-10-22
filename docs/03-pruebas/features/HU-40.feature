# language: es
# Generado por docs/03-pruebas/scripts/extraer_casos.py — no editar a mano.
# Fuente: docs/01-requerimientos/historias/M09 · CU-10.2 · RF-40
@HU-40 @M09 @S6 @prioridad-C
Característica: HU-40 Reporte de platillos frecuentes y olvidados
  Como miembro del hogar, quiero ver los platillos que más repetimos y los que no preparamos hace más de 4 semanas, para variar el menú y recuperar platillos que nos gustan.

  # CA-40.1 Flujo principal · PF-M9-40.1
  @CA-40.1 @S6 @prioridad-C @funcional @e2e
  Escenario: Ver los platillos más frecuentes
    Dado que hoy es 2026-10-22
    Y en las últimas 12 semanas se preparó "Pollo en crema" 6 veces, "Pepián de pollo" 5 veces y "Carne guisada" 4 veces
    Cuando abro el reporte "Platillos"
    Entonces "Más frecuentes" muestra en orden "Pollo en crema (6)", "Pepián de pollo (5)" y "Carne guisada (4)"

  # CA-40.2 Flujo alterno · PF-M9-40.2
  @CA-40.2 @S6 @prioridad-C @funcional @integracion
  Escenario: Platillos no preparados en más de 4 semanas
    Dado que hoy es 2026-10-22
    Y "Caldo de res" se preparó por última vez el 2026-09-13
    Y "Carne guisada" se preparó por última vez el 2026-09-27
    Y "Chile relleno" está activo y nunca se ha preparado
    Cuando abro el reporte "Platillos"
    Entonces "No preparados en más de 4 semanas" muestra "Caldo de res — hace 39 días"
    Y muestra "Chile relleno — Nunca preparado"
    Y no muestra "Carne guisada"

  # CA-40.3 Validación o error · PF-M9-40.3
  @CA-40.3 @S6 @prioridad-C @limite @integracion
  Escenario: Límite exacto de 4 semanas y platillo inactivo
    Dado que hoy es 2026-10-22
    Y "Pescado frito" se preparó por última vez el 2026-09-24
    Y "Spaghetti con carne" está inactivo y se preparó por última vez el 2026-08-02
    Cuando abro el reporte "Platillos"
    Entonces "Pescado frito" no aparece en olvidados porque tiene exactamente 28 días
    Y "Spaghetti con carne" no aparece porque está inactivo
