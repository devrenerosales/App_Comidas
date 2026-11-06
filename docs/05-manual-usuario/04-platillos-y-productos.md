# 4. Platillos y productos

| Campo | Valor |
|---|---|
| Historias | HU-11 Gestionar platillos (S1) · HU-12 Ingredientes por porciones base (S1) · HU-13 Catálogo de productos (S1) · HU-14 Calificar platillo (S3) · HU-35 Vincular con supermercados (S5) |
| Versión de la app | Sprint 1 (rama `feature/HU-11-13-catalogo-platillos`) |
| Estado del capítulo | Parcial: falta la captura de pantalla de cada sección; las estrellas se califican hoy desde Historial (el plan semanal llega con HU-21) |

Los **platillos** son las comidas que tu familia acostumbra preparar: de ellos sale el menú que la app te sugiere cada semana. Cada platillo tiene sus **ingredientes**, que se eligen del **catálogo de productos** (el mismo para todos los hogares) y sirven para armar la lista de compras y estimar el costo.

> **Capturas:** los recuadros `[Captura …]` marcan dónde irá la imagen de la pantalla real (teléfono 390 × 844, carpeta `docs/05-manual-usuario/img/`).

## 4.1 Quién puede hacer qué

| Acción | Administrador | Miembro | Administrador del sistema |
|---|---|---|---|
| Ver, crear, editar, inactivar y reactivar platillos del hogar | Sí | Sí | — |
| Agregar, cambiar o quitar ingredientes | Sí | Sí | — |
| Buscar productos y crear uno nuevo | Sí | Sí | Sí |
| Inactivar o reactivar un producto del catálogo | No | No | Sí |

Los platillos son **solo de tu hogar**: nadie de otro hogar los ve. Los productos, en cambio, son **comunes a todos los hogares**; por eso solo el administrador del sistema (la persona que mantiene la app) puede inactivar o corregir uno.

## 4.2 Ver y buscar tus platillos

Abre la pestaña **Platillos**.

`[Captura 4.1 — Lista de platillos con buscador y filtros]`

- La lista muestra los platillos **activos** ordenados por nombre, con sus tiempos de comida, la proteína principal y sus etiquetas.
- En **Buscar platillo** escribe parte del nombre. No importan las tildes ni las mayúsculas: `pepian` encuentra **Pepián de pollo**, y tolera pequeños errores de escritura.
- Filtra por **Tiempo de comida** (desayuno, almuerzo o cena) y por **Proteína principal**.
- Con los botones **Activos**, **Incompletos** e **Inactivos** cambias qué platillos ves.
- Si no hay resultados, la app muestra **Sin coincidencias** y te ofrece **Crear «lo que buscaste»**.

Marcas que puedes ver junto a un platillo:

| Marca | Significa |
|---|---|
| **Incompleto** | Aún no tiene ingredientes, así que no tiene costo estimado. |
| **Ingrediente inactivo** | Usa un producto que se inactivó en el catálogo; revisa sus ingredientes. |
| **Inactivo** | El platillo está inactivo (solo con el filtro Inactivos). |

## 4.3 Crear o editar un platillo

1. Toca **Nuevo platillo** (o un platillo de la lista para editarlo).
2. Escribe el **Nombre del platillo** (hasta 80 caracteres), por ejemplo `Pepián de pollo`.
3. Marca los **Tiempos de comida** en que se puede servir: desayuno, almuerzo y/o cena. Debe haber **al menos uno**.
4. Elige la **Proteína principal**: pollo, res, cerdo, pescado, huevo, embutido, vegetariana u otra. La app la usa para no repetir la misma proteína en días seguidos.
5. Escribe **Etiquetas** separadas por comas, por ejemplo `típico, fin de semana` (hasta 10).
6. Toca **Guardar platillo**. Al crear uno nuevo, la app abre el platillo para que agregues sus ingredientes.

`[Captura 4.2 — Formulario de platillo]`

Mensajes que puedes ver:

| Mensaje | Qué hacer |
|---|---|
| Selecciona al menos un tiempo de comida | Marca desayuno, almuerzo o cena. |
| Ingresa el nombre del platillo | Escribe el nombre. |
| Ya existe el platillo Carne guisada | Ya hay uno con ese nombre (aunque cambien tildes o mayúsculas). Toca **Abrir Carne guisada** para ir al existente. |

## 4.4 Inactivar o reactivar un platillo

Los platillos **no se borran**, para no perder el historial de menús ni sus calificaciones.

1. Abre el platillo y toca **Inactivar**.
2. Confirma. El platillo deja de aparecer en la lista de activos y la app ya no lo sugerirá en los menús nuevos.
3. Para recuperarlo, en la lista toca **Inactivos**, ábrelo y toca **Reactivar**.

## 4.5 Ingredientes y porciones

En la parte de abajo del platillo está la sección **Ingredientes**.

`[Captura 4.3 — Editor de ingredientes y vista previa]`

1. En **Porciones base** indica para cuántas porciones son las cantidades de la receta (de 1 a 20; 4 por defecto).
2. En **Agregar ingrediente del catálogo** escribe el producto, por ejemplo `pollo`, y toca **Agregar Pechuga de pollo · lb 1 lb**.
3. Escribe la **Cantidad** y elige la **Unidad**. Solo aparecen unidades del mismo tipo que el producto:
   - de peso (g, kg, oz, lb) para productos que se compran por peso;
   - de volumen (ml, l, taza, cucharada, cucharadita) para líquidos;
   - de conteo (unidad, manojo, diente) para los que se cuentan.
   Al cambiar entre g y lb (o ml y taza) la cantidad se convierte sola.
4. Repite con cada ingrediente. Para quitar uno toca **Quitar**.
5. Toca **Guardar ingredientes**.

Si agregas un producto que ya está, la app te avisa para que ajustes su cantidad en lugar de repetirlo. Un platillo sin ingredientes se puede guardar, pero queda **Incompleto**.

### Cantidades para tu hogar

Después de guardar, **Cantidades para tu hogar** muestra cuánto necesitas según quiénes comen en casa. La app suma el **factor de porción** de cada comensal activo (1.0 adulto, 0.5 un niño pequeño, etc.; ver capítulo 2) y escala:

> cantidad para el hogar = cantidad de la receta × suma de factores ÷ porciones base

Ejemplo: comen Rene (1.0), Ana (1.0) y Sofía (0.5) = **2.5**. "Pollo en crema" es para 4 porciones con 2 lb de pechuga y 250 ml de crema → **1.25 lb** de pechuga y **156.25 ml** de crema.

En **Porciones a preparar (Σ factores)** puedes probar otra cantidad (por ejemplo, si tienes visitas) sin cambiar a los comensales. Si tu hogar todavía no tiene comensales, se muestran las cantidades para las porciones base.

Mensajes que puedes ver:

| Mensaje | Qué hacer |
|---|---|
| La cantidad debe ser mayor que 0 | Escribe una cantidad positiva (usa punto para decimales, hasta 3). |
| La unidad ml no es compatible con lb | Elige una unidad del mismo tipo que el producto. |
| Las porciones base deben ser un número entero de 1 a 20 | Corrige las porciones base. |

## 4.6 Catálogo de productos

En **Platillos** toca **Catálogo de productos**.

`[Captura 4.4 — Catálogo de productos]`

- Cada producto se muestra como **nombre · unidad de compra presentación**, por ejemplo **Arroz · bolsa 2 lb**: se compra en *bolsa* y cada bolsa trae *2 lb*.
- Busca por nombre (sin importar tildes) y filtra por **Tipo** (ingrediente o despensa) y **Categoría** (carnes, lácteos, verduras, frutas, granos, abarrotes, condimentos, panadería, otros).
- La app ya trae unos 45 productos básicos (pollo, res, frijol negro, arroz, tortillas, tomate, güisquil, crema, queso fresco, aceite, consomé…).

### Crear un producto

Puedes hacerlo aquí con **Nuevo producto** o, mientras agregas ingredientes, con **Crear producto «…»** cuando no encuentras lo que buscas (por ejemplo `Miltomate`).

1. **Nombre del producto**.
2. **Tipo**: ingrediente (se usa en platillos), despensa (se compra aparte, como café) o ambos.
3. **Categoría**: define el pasillo en la lista de compras.
4. **Unidad de compra**: cómo se compra (bolsa, lb, unidad, frasco, botella…).
5. **Presentación**: cuánto trae esa unidad y en qué unidad (por ejemplo `2` y `lb`).
6. Toca **Guardar producto**.

| Mensaje | Qué hacer |
|---|---|
| La presentación debe ser mayor que 0 | Escribe una cantidad positiva. |
| Ya existe Aceite · botella 900 ml | Ese producto ya está con esa presentación: toca **Usar Aceite · botella 900 ml**. |

### Inactivar un producto (administrador del sistema)

El administrador del sistema ve **Inactivar** junto a cada producto. Un producto inactivo deja de aparecer en el buscador de ingredientes; los platillos que lo usan lo conservan y muestran **Ingrediente inactivo: …** para que los revises. Con **Ver inactivos** se puede **Reactivar**.

## 4.6b Vincular un producto con los supermercados

Para comparar precios, cada producto se vincula con su equivalente en cada supermercado: el nombre con que aparece en la tienda, su marca y la presentación en que lo venden. Cualquier miembro puede hacerlo y el vínculo sirve para todos los hogares.

1. En **Productos**, toca **Supermercados** junto al producto (por ejemplo "Arroz · bolsa 2 lb"). Arriba verás la presentación de compra del producto y los vínculos que ya tiene.
2. En **Vincular supermercado** elige el **Supermercado**.
3. Escribe el **Nombre en la tienda** y, si quieres, la **Marca**.
4. Indica la **Cantidad de la presentación** y su **Unidad**. Si Paiz solo vende la bolsa de 5 lb y tu producto es de 2 lb, escribe 5 y libra: la app te dice "Esa presentación equivale a 2.5 veces la tuya" y con ese factor ajusta los precios para compararlos.
5. En Walmart y Paiz, que se consultan automáticamente, escribe también la **URL del producto** o su **SKU**. En Super Fresh, Mercado y La Torre no hace falta.
6. Toca **Vincular**. Verás "Vínculo guardado."

Cada producto tiene un solo vínculo activo por supermercado. Si ya existe, la app te lo muestra y te pregunta si quieres **Reemplazar**: el anterior queda inactivo, marcado "(reemplazado)", y conserva su historial de precios.

**Editar.** En un vínculo activo toca **Editar** para cambiar el nombre en la tienda, la marca, la URL o el SKU. La presentación no se edita: si cambió, crea un vínculo nuevo y reemplaza el anterior.

| Mensaje | Qué hacer |
|---|---|
| La unidad de la presentación no es convertible a libras | Elige una unidad de la misma clase que la de tu producto (peso con peso, líquido con líquido). |
| Para Walmart indica la URL o el SKU del producto | Walmart y Paiz piden la URL o el SKU para poder consultar su precio. |
| La URL no pertenece a … | Pega la dirección del producto en el sitio del supermercado elegido. |

[Captura 4.6b: pantalla Supermercados de un producto]



Después de comer un platillo puedes calificarlo de 1 a 5 estrellas. Con esas calificaciones el motor sugiere más seguido lo que le gusta a tu familia. Por ahora se califica desde **Historial**; cuando exista el plan semanal también se hará desde allí.

1. Abre **Historial** y toca **Ver platillos de la semana** en la semana que quieras.
2. Junto a cada comida con platillo verás cinco estrellas. Toca la estrella que corresponda (por ejemplo, 4 estrellas).
3. La app muestra "Calificación guardada: 4 de 5 para Pollo en crema. Promedio: 4.00."
4. Para cambiarla, toca otra estrella: la nueva calificación reemplaza a la anterior y el promedio se recalcula.

El **promedio** de cada platillo aparece como "★ 4.50" en la pestaña **Platillos** y en el detalle del platillo; si todavía no tiene calificaciones no se muestra.

No se pueden calificar comidas futuras: las estrellas solo aparecen para comidas de hoy o anteriores. Cualquier miembro del hogar puede calificar y la última calificación registrada de esa comida es la que cuenta.
