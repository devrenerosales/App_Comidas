# language: es
# Generado por docs/03-pruebas/scripts/extraer_casos.py — no editar a mano.
# Fuente: docs/01-requerimientos/historias/M08 · CU-09.3 · RF-38
@HU-38 @M08 @S5 @prioridad-M
Característica: HU-38 Conservar el último precio válido
  Como miembro del hogar, quiero que si falla la consulta de precios se use el último precio válido indicando su fecha, para seguir planificando sin datos vacíos y saber qué tan reciente es cada precio.

  # CA-38.1 Flujo principal · PF-M8-38.1
  @CA-38.1 @S5 @prioridad-M @funcional @e2e @regresion
  Escenario: Paiz no responde para un producto
    Dado que el último precio válido de "Arroz blanco 2 lb" en Paiz es Q13.00 del 18/10/2026
    Cuando la corrida del sábado 24/10/2026 agota el tiempo de espera en Paiz para ese producto 3 veces
    Entonces no se guarda un precio nuevo para ese producto
    Y la lista muestra "Q13.00 · Precio del 18/10/2026" para Paiz
    Y la corrida queda "Parcial" con el error registrado

  # CA-38.2 Cambio de estructura del sitio · PF-M8-38.2
  @CA-38.2 @S5 @prioridad-M @negativo @integracion @regresion
  Escenario: Paiz cambió su página
    Dado 50 vínculos activos de Paiz
    Cuando en la corrida del 24/10/2026 los primeros 26 productos no muestran el precio en la ubicación esperada
    Entonces se detienen las consultas a Paiz en esa corrida
    Y se conservan los precios anteriores de los 50 productos
    Y el administrador ve "Paiz: 50 productos sin actualizar"

  # CA-38.3 Precio inválido · PF-M8-38.3
  @CA-38.3 @S5 @prioridad-M @negativo @integracion @regresion
  Escenario: Precio no interpretable
    Dado que el último precio válido de "Tomate (lb)" en Walmart es Q6.50 del 18/10/2026
    Cuando la página devuelve el texto "Q--.--" como precio en los 3 intentos
    Entonces se descarta el valor
    Y se conserva Q6.50 del 18/10/2026

  # CA-38.4 Último precio con más de 14 días · PF-M8-38.4
  @CA-38.4 @S5 @prioridad-M @limite @integracion @regresion
  Escenario: Precio conservado desactualizado
    Dado que el último precio válido de "Aceite 1 L" en Paiz es Q26.50 del 04/10/2026
    Cuando la corrida del 24/10/2026 falla para ese producto
    Entonces se muestra "Q26.50 · Precio del 04/10/2026" con la advertencia "Desactualizado"
