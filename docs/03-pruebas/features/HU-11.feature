# language: es
# Generado por docs/03-pruebas/scripts/extraer_casos.py — no editar a mano.
# Fuente: docs/01-requerimientos/historias/M03 · CU-03.1 · RF-11
@HU-11 @M03 @S1 @prioridad-M
Característica: HU-11 Gestionar platillos del hogar
  Como miembro del hogar, quiero crear, editar, buscar e inactivar platillos con sus tiempos de comida, proteína y etiquetas, para tener un catálogo propio del que el sistema sugiera el menú.

  # CA-11.1 Flujo principal · PF-M3-11.1
  @CA-11.1 @S1 @prioridad-M @funcional @e2e @regresion
  Escenario: Crear un platillo nuevo
    Dado que el hogar no tiene el platillo "Pepián de pollo"
    Cuando creo el platillo "Pepián de pollo" para "Almuerzo" con proteína "pollo" y etiquetas "típico, fin de semana"
    Entonces el platillo aparece en la lista de platillos activos
    Y al filtrar por proteína "pollo" el resultado incluye "Pepián de pollo"

  # CA-11.2 Flujo alterno · PF-M3-11.2
  @CA-11.2 @S1 @prioridad-M @funcional @integracion @regresion
  Escenario: Inactivar un platillo
    Dado que el platillo "Pescado frito" está activo
    Cuando lo inactivo y confirmo
    Entonces "Pescado frito" no aparece en la lista de activos
    Y aparece con el filtro "Inactivos"
    Y no se considera para nuevas sugerencias de menú

  # CA-11.3 Validación o error · PF-M3-11.3
  @CA-11.3 @S1 @prioridad-M @negativo @integracion @regresion
  Escenario: Nombre duplicado sin distinguir tildes ni mayúsculas
    Dado que existe el platillo "Carne guisada"
    Cuando intento crear el platillo "carne GUISADA"
    Entonces el sistema no lo guarda
    Y muestra "Ya existe el platillo Carne guisada" con la opción de abrirlo

  # CA-11.4 Validación o error · PF-M3-11.4
  @CA-11.4 @S1 @prioridad-M @negativo @integracion @regresion
  Escenario: Platillo sin tiempo de comida
    Cuando intento guardar "Chile relleno" sin seleccionar ningún tiempo de comida
    Entonces el sistema no lo guarda e indica "Selecciona al menos un tiempo de comida"
