# language: es
# Generado por docs/03-pruebas/scripts/extraer_casos.py — no editar a mano.
# Fuente: docs/01-requerimientos/historias/M08 · CU-09.1 · RF-33
@HU-33 @M08 @S5 @prioridad-M
Característica: HU-33 Corrida automática de precios
  Como miembro del hogar, quiero que los precios de Walmart y Paiz se actualicen solos cada fin de semana, para planificar el menú del domingo con precios recientes sin capturarlos a mano.

  # CA-33.1 Flujo principal · PF-M8-33.1
  @CA-33.1 @S5 @prioridad-M @funcional @e2e @regresion
  Escenario: Corrida del sábado
    Dado 70 vínculos activos de Walmart y 50 de Paiz con permiso de extracción
    Cuando llega el sábado 24/10/2026 a las 21:00 hora de Guatemala
    Entonces se crea una corrida que consulta los 120 productos
    Y se guardan 120 precios con origen "automático" y fecha 24/10/2026
    Y la corrida queda "Completada" con 70 de Walmart y 50 de Paiz
    Y se encola el recálculo de mínimo y mediana

  # CA-33.2 Límite de solicitudes · PF-M8-33.2
  @CA-33.2 @S5 @prioridad-M @limite @integracion @regresion
  Escenario: Respeto de 1 solicitud por segundo
    Dado 70 vínculos activos de Walmart
    Cuando se ejecuta la corrida
    Entonces el registro de solicitudes no muestra dos solicitudes a Walmart con menos de 1 segundo entre sí
    Y la consulta de Walmart dura al menos 70 segundos

  # CA-33.3 Flujo alterno: robots.txt prohíbe · PF-M8-33.3
  @CA-33.3 @S5 @prioridad-M @negativo @integracion @regresion
  Escenario: Paiz prohíbe la ruta de productos
    Dado que el robots.txt de Paiz prohíbe la ruta de páginas de producto
    Cuando se ejecuta la corrida del domingo 25/10/2026
    Entonces no se consulta ningún producto de Paiz
    Y la corrida registra Paiz como "Bloqueado por robots.txt"
    Y se conservan los últimos precios válidos de Paiz
    Y el administrador ve el aviso "Paiz bloqueado: registra precios manualmente"

  # CA-33.4 Flujo alterno: La Torre en fase 2 · PF-M8-33.4
  @CA-33.4 @S5 @prioridad-M @funcional @integracion @regresion
  Escenario: Sitio no habilitado
    Dado 15 vínculos activos de La Torre y el sitio La Torre deshabilitado
    Cuando se ejecuta la corrida
    Entonces no se consulta La Torre
    Y la corrida registra La Torre como "Sitio no habilitado"

  # CA-33.5 Excepción: corrida en curso · PF-M8-33.5
  @CA-33.5 @S5 @prioridad-M @negativo @integracion @regresion
  Escenario: Disparo con corrida anterior sin terminar
    Dado que la corrida del sábado 24/10/2026 sigue "En curso"
    Cuando se dispara otra corrida
    Entonces la nueva se registra como "Omitida"
