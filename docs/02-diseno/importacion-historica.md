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

## Carga inicial del cuaderno (HU-18)

Se usa el mismo flujo de importación con `origen=CUADERNO`. No requiere migración: usa
`importacion.origen`, `importacion_fila.hoja = LISTAS`, `producto` y `despensa_item`.

**Entrada.** Un Excel con las hojas `Menus` y `Listas`, o un CSV de menús (`archivo`) y otro de
listas (`listas`) en la misma solicitud. En una importación normal la hoja Listas con datos
se sigue rechazando, para no ignorarla por accidente. Las listas son opcionales: una carga
de cuaderno puede traer solo menús.

**Hoja Listas.** Una fila por producto, con las columnas `fecha`, `lista`, `tipo`
(despensa o compras), `producto`, `cantidad`, `unidad_compra`, `presentacion`, `precio_gtq` y
`supermercado`. Se valida en la carga y cualquier error bloquea todo el archivo, igual que en
menús: fecha real y no futura; lista y producto de 1 a 80 caracteres; cantidad mayor que 0
con hasta 3 decimales; unidad de hasta 20 caracteres; presentación como "2 lb" con una unidad
que exista en el catálogo; precio de 0 a 99,999.99. No se admite el mismo producto dos veces
en la despensa ni una lista que mezcle despensa y compras. `supermercado` se valida pero no se
guarda: los precios formales llegan con M8.

**Vista previa.** Devuelve `origen` y `listas`: por lista, productos, total de precios y
cuántos productos son nuevos en el catálogo. Las filas de cada hoja se consultan por separado
(`GET /{id}/filas?hoja=LISTAS`). Con listas, la importación se puede confirmar aunque todas
las semanas se omitan, para repetir solo la carga de la despensa.

**Al confirmar**, en la misma transacción que los menús:

1. Las semanas se guardan como históricas con `origen=CUADERNO`.
2. Cada producto de las listas se asocia al catálogo común por nombre normalizado, o se crea.
   Si hay varios con ese nombre se prefiere el de la misma presentación y, si no, el más
   antiguo. Un producto nuevo toma la categoría Otros, el tipo Despensa (Ingrediente si solo
   está en listas de compras, Ambos si está en las dos) y la presentación de la fila, o 1
   unidad si no la trae. Nunca se modifica un producto existente.
3. Los productos de listas de despensa se registran como ítems del hogar con frecuencia
   `MENSUAL` (provisional hasta confirmar PA-03), la cantidad de la fila y el precio como
   `precio_referencia`. Los de listas de compras solo entran al catálogo.
4. El reporte incluye `gastoSemanal` (mínimo, máximo y promedio al centavo de las semanas
   importadas que traen gasto), `listas`, `productosCreados` y `despensaCargada`.

**Repetir la carga** no duplica nada: las semanas existentes se omiten o se reemplazan por
decisión (HU-16); los productos ya creados se reutilizan; y la despensa se actualiza por
(hogar, producto): cambia cantidad y precio de referencia, reactiva el ítem y conserva la
frecuencia que el hogar haya elegido.

**Fallos controlados.** `CATALOGO_BASE_FALTANTE` (409) si faltan la categoría Otros o las
unidades base, y `PRODUCTO_INACTIVO` (409) si el producto a crear ya existe inactivo con la
misma presentación. Ambos revierten toda la confirmación.

El reporte de conciliación no es una ruta aparte (el contrato la proponía como
`GET /{id}/conciliacion`): viaja en la respuesta de confirmar y en la vista.
