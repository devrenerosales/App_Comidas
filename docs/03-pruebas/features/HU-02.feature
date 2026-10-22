# language: es
# Generado por docs/03-pruebas/scripts/extraer_casos.py — no editar a mano.
# Fuente: docs/01-requerimientos/historias/M01 · CU-01.2 · RF-02
@HU-02 @M01 @S1 @prioridad-M
Característica: HU-02 Crear hogar e invitar miembros
  Como administrador del hogar, quiero crear mi hogar e invitar a mi esposa por correo o enlace, para planificar juntos el menú y la lista de compras.

  # CA-02.1 Flujo principal · PF-M1-02.1
  @CA-02.1 @S1 @prioridad-M @funcional @e2e @regresion
  Escenario: Crear hogar e invitar por correo
    Dado que inicié sesión como "rene@correo.com" y no pertenezco a un hogar
    Cuando creo el hogar "Familia Rosales"
    Y invito a "ana@correo.com" por correo
    Entonces soy Administrador de "Familia Rosales"
    Y "ana@correo.com" recibe un correo con un enlace de invitación válido por 7 días

  # CA-02.2 Flujo alterno · PF-M1-02.2
  @CA-02.2 @S1 @prioridad-M @funcional @integracion @regresion
  Escenario: Unirse con enlace compartido
    Dado que el administrador generó un enlace de invitación hace 2 días
    Y "ana@correo.com" no pertenece a ningún hogar
    Cuando Ana abre el enlace e inicia sesión
    Entonces Ana queda como Miembro de "Familia Rosales"
    Y el enlace ya no puede volver a usarse

  # CA-02.3 Validación o error · PF-M1-02.3
  @CA-02.3 @S1 @prioridad-M @negativo @integracion @regresion
  Escenario: Invitación vencida
    Dado una invitación creada hace 8 días
    Cuando el invitado abre el enlace
    Entonces ve "Invitación no válida, pide una nueva"
    Y no se une al hogar

  # CA-02.4 Aislamiento · PF-M1-02.4
  @CA-02.4 @S1 @prioridad-M @negativo @integracion @regresion
  Escenario: Usuario que ya pertenece a otro hogar
    Dado que "luis@correo.com" es miembro del hogar "Familia López"
    Cuando abre un enlace de invitación de "Familia Rosales"
    Entonces ve "Tu cuenta ya pertenece a un hogar"
    Y no puede ver datos de "Familia Rosales"
