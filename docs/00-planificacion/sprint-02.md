# Sprint 2 — Carga inicial del cuaderno

Historias previstas: HU-04, HU-08, HU-15, HU-16, HU-17 y HU-18.

## HU-04 — Recuperar contraseña

Implementación local en preparación para revisión del PO:

- Solicitud pública con mensaje neutro para correos registrados, desconocidos e inactivos.
- Enlace aleatorio de 32 bytes, hash SHA-256 en la base y vigencia de una hora.
- Validación del enlace al abrirlo; consumo único y atómico al guardar la nueva contraseña.
- Reinicio de intentos fallidos y revocación de refresh y tokens de acceso anteriores.
- Pantallas accesibles desde Iniciar sesión, correo HTML/texto y manual actualizado.
- Sin cambios de esquema: reutiliza `token_recuperacion` y `sesiones_invalidas_antes_de`.

Las rutas de recuperación usan el mismo límite de solicitudes por IP que el resto de `/auth`.
El nuevo endpoint `/auth/validar-recuperacion` comprueba la vigencia sin consumir el enlace
y permite informar de enlaces vencidos al abrirlos, antes de pedir una contraseña.

## Verificación local

- API: 218 pruebas unitarias aprobadas.
- Integración: las 149 pruebas existentes aprobaron con el guard actualizado; las siete
  pruebas nuevas de HU-04 aprobaron tras corregir los datos de prueba. Incluyen uso
  concurrente, expiración, reutilización, sesiones previas y confirmación de contraseña.
- Interfaz: siete escenarios nuevos de recuperación y pruebas del contrato HTTP y de
  limpieza de sesión. Verificación final de regresión y compilación registrada en el
  [reporte de HU-04](../03-pruebas/reportes/RE-HU-04-2026-10-26.md).

## Pendientes

- Revisión del PO y prueba de entrega con SMTP real en el entorno configurado.
- HU-18 todavía no implementada; HU-16 y HU-17 se detallan abajo.

## HU-08 — Inicio de semana y planificación

Implementación local para revisión del PO, sin migraciones:

- Selectores de día con vista previa antes de guardar; consulta disponible para miembros.
- Fechas de calendario en America/Guatemala y próxima fecha de planificación.
- Transiciones de uno a seis días posteriores al último aprobado, conservando todos los aprobados.
- Borrador de transición persistido y ajustable mientras no tenga platillos.
- Control de versión y transacción para evitar sobrescrituras entre administradores.
- Conflicto explícito si otro borrador ocupa las fechas de transición; no se pierde contenido.

El día queda guardado para HU-41. El envío efectivo del recordatorio depende del módulo
de notificaciones, previsto para el Sprint 6. La fecha calculada es la siguiente
ocurrencia del día de planificación estrictamente posterior a hoy.

Verificación: 231 unitarias de API, 167 pruebas web y 31 pruebas de integración de
configuración aprobadas. Detalles en el [reporte de HU-08](../03-pruebas/reportes/RE-HU-08-2026-10-26.md).

## Validación manual local confirmada

El PO confirmó en la sesión que funcionaron los flujos de la guía local: cuentas, hogar,
comensales, catálogo, presupuesto, configuración de semana y recuperación de contraseña.
Esto no incluye entrega real por SMTP ni validación Android o despliegue.

## HU-15 — Captura histórica manual

Implementación local para revisión, sin migraciones:

- Acceso desde Inicio al historial paginado y filtrable del hogar.
- Captura domingo–sábado con los tres tiempos y días sin dato.
- Búsqueda y creación de platillos en línea, gasto semanal opcional y notas.
- Registro Histórico en transacción, sin generar lista de compras.
- Confirmación explícita y versión esperada para reemplazos.
- Protección de menús no históricos, semanas solapadas y datos de otros hogares.

La captura del cuaderno conserva domingo–sábado aunque el hogar haya cambiado su
calendario futuro con HU-08. Los platillos se validan por hogar, sin imponer al pasado
los tiempos activos de la configuración actual. Un platillo creado desde el buscador
queda en el catálogo aunque después se cancele la captura.

Verificación: 174 pruebas compartidas (100 % de cobertura), 243 unitarias de API,
177 pruebas web y 11 de integración histórica aprobadas. Ver el
[reporte de HU-15](../03-pruebas/reportes/RE-HU-15-2026-10-26.md).

## HU-16 — Importación histórica CSV/XLSX

Implementación local para revisión del PO, sin migraciones:

- Plantillas descargables y diccionario; 5 MB y 5000 filas como límites.
- Vista previa persistida con errores por fila y columna, paginación y gastos por semana.
- Semanas domingo–sábado terminadas; coincidencia exacta de nombres y aliases del hogar.
- Omitir por defecto las semanas existentes; reemplazo explícito de históricas con versión.
- Confirmación atómica e idempotente, protección contra cambios concurrentes y cancelación.
- Interfaz accesible desde Historial y notas importadas visibles en el detalle de comidas.

La carga de listas/cuaderno sigue prevista en HU-18. Los platillos desconocidos bloquean la
confirmación hasta resolverlos con HU-17. El gasto conserva la restricción positiva de HU-15 y SQL.

Diseño y contrato: [Importación histórica](../02-diseno/importacion-historica.md).
Validación y límites: [reporte HU-16](../03-pruebas/reportes/RE-HU-16-2026-10-27.md).

## HU-17 — Resolver platillos nuevos al importar

Implementación local para revisión del PO, sin migraciones:

- Propuesta por similitud de trigramas (`pg_trgm`) sobre el nombre normalizado: "Asociar a"
  desde 80 % y "Crear nuevo" por debajo. Las coincidencias exactas con platillo o alias se
  asocian solas.
- Pantalla **Platillos por resolver** con aceptar propuesta, aceptar todas, crear con otro
  nombre o buscar y asociar otro platillo del catálogo.
- La confirmación se bloquea con "Faltan N platillos por resolver".
- Al confirmar, en la misma transacción: platillos nuevos incompletos con los tiempos y la
  proteína del archivo, y nombres escritos guardados como alias.
- Rutas nuevas `GET` y `PUT /importaciones/{id}/platillos`, con la revisión de la vista.

Hallazgo para el PO: con `pg_trgm` real, "Tortas de carne" frente a "Tortitas de carne" da
78,95 %, no el 85 % del ejemplo de CA-17.2, y se propone crear. Decisión pendiente: bajar el
umbral o mantener 80 %. Detalle en el [reporte de HU-17](../03-pruebas/reportes/RE-HU-17-2026-10-28.md).

Verificación: 316 unitarias y 197 de integración de API, 196 pruebas web, lint y tipos en verde.
Diseño y contrato: [Importación histórica](../02-diseno/importacion-historica.md).
