# Importación histórica — HU-16 y HU-17

Implementación local CSV/XLSX. No requiere migración: reutiliza las cuatro tablas
de staging existentes, `platillo_alias` y `menu_semanal.importacion_id`. HU-18 sigue pendiente.

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
La ruta de conciliación del contrato general (HU-18) sigue siendo propuesta.

## Consistencia y protección de datos

Las mutaciones bloquean hogar y cabecera, siempre en ese orden. El identificador UUID
`revision` cambia con cada decisión para rechazar vistas desactualizadas. Se comprueba
la identidad y versión de cada menú a reemplazar, además del control de solapamientos
y estado histórico. La confirmación comparte una sola transacción con el repositorio
de captura manual. Un error revierte todos los menús y deja abierta la importación.
Una confirmación repetida devuelve el reporte sin volver a guardar; una cancelación
repetida conserva el resultado. Cancelar después de confirmar devuelve 409.

Los errores de cualquier fila bloquean todo el archivo. Los nombres canónicos tienen
prioridad sobre aliases exactos normalizados del hogar.
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

## Resolución de platillos nuevos (HU-17)

Al cargar el archivo, cada nombre distinto se normaliza (minúsculas, sin tildes, espacios
simples) y se resuelve así:

1. Si coincide con un platillo o alias del hogar, queda asociado (`decision=ASOCIAR`,
   `similitud=1.0000`) y no admite decisión.
2. Si no, se busca el platillo **activo** más parecido con `similarity()` de `pg_trgm`
   sobre el nombre normalizado, en una sola consulta. Se guardan `platillo_sugerido_id` y
   `similitud`; la decisión queda `PENDIENTE`.
3. La propuesta es "Asociar a" si la similitud es **≥ 0,80** (`UMBRAL_SIMILITUD`) y
   "Crear nuevo" en otro caso. La propuesta se calcula al leer, no se guarda.

`PUT /{id}/platillos` aplica decisiones con la misma revisión UUID que las semanas.
`aceptarPropuestas` resuelve todos los pendientes con su propuesta y las decisiones
explícitas del mismo envío tienen prioridad. Se rechaza: elegir un platillo inactivo o de
otro hogar, decidir dos veces el mismo nombre en un envío, cambiar un nombre asociado
automáticamente, un nombre nuevo de 0 o más de 80 caracteres, un nombre nuevo que ya usa un
platillo o alias del hogar (409) y dos nombres nuevos iguales (422). Un rechazo no cambia
nada.

Al confirmar, en la misma transacción que los menús y solo con los nombres de las semanas
que se importan:

- **Crear**: inserta el platillo (`incompleto`, 4 porciones base) con la proteína del archivo
  o `OTRA`, y los tiempos de comida en que aparece. Si el nombre se corrigió, el nombre
  escrito en el archivo se guarda también como alias.
- **Asociar**: guarda el nombre del archivo como alias (`origen=IMPORTACION`) salvo que la
  coincidencia haya sido automática.

Si el catálogo cambió y el platillo nuevo ya existe, la confirmación falla con 409
`CATALOGO_MODIFICADO` y no guarda nada. Con nombres sin decisión responde 422
`PLATILLOS_PENDIENTES` y "Faltan N platillos por resolver". El reporte informa
`platillosCreados` y `aliasCreados`.

Supuesto: `pg_trgm` no coincide con el 85 % que supone el ejemplo de CA-17.2: "Tortas de
carne" frente a "Tortitas de carne" da 78,95 %, por debajo del umbral, y se propone crear.
Las pruebas de integración usan un par que supera el umbral ("pepian de pollo" y
"pepian de pollos", 82,35 %). El umbral es una constante; la decisión del PO sobre si
conviene bajarlo queda pendiente.
