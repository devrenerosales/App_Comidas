# language: es
# Generado por docs/03-pruebas/scripts/extraer_casos.py — no editar a mano.
# Fuente: docs/01-requerimientos/historias/M04 · CU-04.3 · RF-17
@HU-17 @M04 @S2 @prioridad-M
Característica: HU-17 Resolver platillos nuevos al importar
  Como administrador del hogar, quiero que al importar el sistema detecte platillos que no están en el catálogo y me proponga crearlos o asociarlos a uno parecido, para no duplicar platillos por diferencias de escritura.

  # CA-17.1 Flujo principal · PF-M4-17.1
  @CA-17.1 @S2 @prioridad-M @funcional @e2e @regresion
  Escenario: Coincidencia exacta tras normalizar
    Dado que el catálogo tiene "Pepián de pollo"
    Cuando importo un archivo con el platillo "pepian  de Pollo"
    Entonces la fila se asocia a "Pepián de pollo" sin pedir decisión

  # CA-17.2 Flujo alterno · PF-M4-17.2
  @CA-17.2 @S2 @prioridad-M @funcional @integracion @regresion
  Escenario: Asociar a un platillo parecido y recordarlo
    Dado que el catálogo tiene "Tortitas de carne"
    Y la similitud calculada entre "Tortas de carne" y "Tortitas de carne" es 85 %
    Cuando importo un archivo con "Tortas de carne"
    Entonces el sistema propone "Asociar a Tortitas de carne (85 %)"
    Cuando acepto la propuesta y confirmo la importación
    Entonces las filas quedan asociadas a "Tortitas de carne"
    Y en una importación posterior "Tortas de carne" se asocia sin preguntar

  # CA-17.3 Flujo alterno · PF-M4-17.3
  @CA-17.3 @S2 @prioridad-M @funcional @integracion @regresion
  Escenario: Crear un platillo sin parecido
    Dado que ningún platillo del catálogo supera 80 % de similitud con "Hilachas"
    Cuando importo un archivo con "Hilachas" en almuerzo y proteína "res"
    Entonces el sistema propone "Crear nuevo"
    Cuando acepto y confirmo la importación
    Entonces existe el platillo "Hilachas" para almuerzo, proteína "res" y estado "Incompleto"

  # CA-17.4 Validación o error · PF-M4-17.4
  @CA-17.4 @S2 @prioridad-M @negativo @integracion @regresion
  Escenario: Confirmar con nombres sin resolver
    Dado una importación con 2 platillos sin decisión
    Cuando intento confirmar
    Entonces el sistema no importa y muestra "Faltan 2 platillos por resolver"
