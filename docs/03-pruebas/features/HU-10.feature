# language: es
# Generado por docs/03-pruebas/scripts/extraer_casos.py — no editar a mano.
# Fuente: docs/01-requerimientos/historias/M02 · CU-02.6 · RF-10
@HU-10 @M02 @S3 @prioridad-S
Característica: HU-10 Restricciones y gustos del hogar
  Como miembro del hogar, quiero registrar ingredientes que no comemos y nuestros platillos favoritos, para que el menú sugerido evite lo que no nos gusta y repita lo que sí.

  # CA-10.1 Flujo principal · PF-M2-10.1
  @CA-10.1 @S3 @prioridad-S @funcional @e2e
  Escenario: Excluir un ingrediente
    Dado que "Chile relleno" lleva el ingrediente "Chile pimiento"
    Cuando excluyo "Chile pimiento" y guardo
    Entonces veo "1 platillo dejará de sugerirse: Chile relleno"
    Y el próximo menú sugerido no incluye "Chile relleno"

  # CA-10.2 Flujo alterno: favoritos · PF-M2-10.2
  @CA-10.2 @S3 @prioridad-S @funcional @integracion
  Escenario: Marcar platillos favoritos
    Cuando marco "Pepián de pollo" y "Caldo de res" como favoritos y guardo
    Entonces ambos aparecen en la lista de favoritos
    Y el motor les suma el factor de preferencia por favorito

  # CA-10.3 Validación o conflicto · PF-M2-10.3
  @CA-10.3 @S3 @prioridad-S @negativo @integracion
  Escenario: Favorito con ingrediente excluido
    Dado que "Chile pimiento" está excluido
    Cuando marco "Chile relleno" como favorito
    Entonces veo "Chile relleno contiene un ingrediente excluido: Chile pimiento"
    Y "Chile relleno" no se sugiere mientras la exclusión exista

  # CA-10.4 Quitar exclusión · PF-M2-10.4
  @CA-10.4 @S3 @prioridad-S @funcional @integracion
  Escenario: Quitar una exclusión
    Dado que "Chile pimiento" está excluido
    Cuando quito la exclusión y guardo
    Entonces "Chile relleno" vuelve a ser elegible para el menú sugerido
