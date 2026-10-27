# Importación histórica — HU-16

Implementación local CSV/XLSX. No requiere migración: reutiliza las cuatro tablas
de staging existentes y `menu_semanal.importacion_id`. HU-17 y HU-18 siguen pendientes.

## Contrato implementado

Todas las rutas `/api/v1/importaciones` requieren sesión, hogar y rol ADMIN.

- `GET /plantilla?formato=csv|xlsx`: archivo autenticado, sin caché. Excel incorpora
  hoja Instrucciones. CSV lleva BOM UTF-8 para apertura con Excel.
- `POST /`: multipart `archivo`, `origen=ARCHIVO` opcional. No guarda menús todavía.
- `GET /{id}`: misma vista previa devuelta al cargar.
- `GET /{id}/filas?pagina=1&tamano=50&soloErrores=true`: datos y errores por fila,
  paginados, tamaño máximo 100. `soloErrores` predeterminado false.
- `PUT /{id}/semanas`: `{revision, decisiones:[{semanaInicio,decision}]}`. Solo admite
  OMITIR/REEMPLAZAR para semanas existentes. Las nuevas se crean automáticamente.
- `POST /{id}/confirmar`: `{revision}`; devuelve el reporte final.
- `POST /{id}/cancelar`: `{revision}`; devuelve la vista cerrada.

La vista contiene `id`, `nombreArchivo`, `estado`, `revision`, `totalFilas`,
`filasConError`, `pendientes` (nombres), `puedeConfirmar`, `reporte` y `semanas`.
Cada semana expone `semanaInicio`, `fechaFin`, `gastoSemana`, `decision`,
`existente` (snapshot o null) y `puedeReemplazar`.

El reporte confirmado contiene `semanasCreadas`, `reemplazadas`, `omitidas`,
`platillosCreados`, `aliasCreados` y `despensaCargada`. Los últimos tres son cero en HU-16.
Las rutas de decisiones de platillos y conciliación del contrato general aún son propuestas.

## Consistencia y protección de datos

Las mutaciones bloquean hogar y cabecera, siempre en ese orden. El identificador UUID
`revision` cambia con cada decisión para rechazar vistas desactualizadas. Se comprueba
la identidad y versión de cada menú a reemplazar, además del control de solapamientos
y estado histórico. La confirmación comparte una sola transacción con el repositorio
de captura manual. Un error revierte todos los menús y deja abierta la importación.
Una confirmación repetida devuelve el reporte sin volver a guardar; una cancelación
repetida conserva el resultado. Cancelar después de confirmar devuelve 409.

Los errores de cualquier fila bloquean todo el archivo. Los nombres canónicos tienen
prioridad sobre aliases exactos normalizados del hogar. No se crean platillos nuevos:
los desconocidos quedan pendientes hasta volver a cargar el archivo con catálogo actualizado.
Los identificadores de otras casas responden 404; los miembros sin rol administrador, 403.

Se almacenan datos normalizados, errores y decisiones, no el archivo original. La carga
se limita a 5 MB y 5000 filas. Antes de leer XLSX se valida el contenedor ZIP y se limita
su expansión real a 32 MB y 1000 entradas. Se rechazan fórmulas/enlaces y hojas de datos
adicionales para no ignorar listas que correspondan al flujo futuro de HU-18.

El gasto opcional debe ser positivo, máximo Q99,999.99. Esto conserva la regla de
captura manual y la restricción SQL vigente; sustituye la propuesta de aceptar cero
en el diseño original de plantilla. El monto se mantiene semanal y las notas, por comida.

Las dependencias de lectura se fijan en `exceljs@4.4.0` y `csv-parse@6.1.0`.
Referencias: [ExcelJS](https://github.com/exceljs/exceljs/tree/v4.4.0),
[opciones CSV](https://csv.js.org/parse/options/).
