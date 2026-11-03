# 7. Lista de compras

| Campo | Valor |
|---|---|
| Historias | HU-28 Consolidar ingredientes del menú aprobado (S4) · HU-30 Editar y marcar la lista (S4) |
| Versión de la app | Sprint 4 (rama `feature/HU-28-consolidar-lista`) |
| Estado del capítulo | Parcial: lista consolidada, marcar, quitar y agregar, y uso sin conexión; faltan despensa, avance, precio real y compartir, y las capturas |

> **Capturas:** los recuadros `[Captura …]` marcan dónde irá la imagen de la pantalla real (teléfono 390 × 844, carpeta `docs/05-manual-usuario/img/`).

## 7.1 Cómo se crea la lista

La lista de compras de una semana se crea sola cuando **apruebas el menú** (ver 6.3). La app toma los ingredientes de todos los platillos de la semana, los ajusta al tamaño de tu hogar y los suma por producto, en la unidad en que se compran:

- **Se ajusta a tu hogar:** si un platillo usa 2 lb de pollo para 4 porciones y en tu hogar comen el equivalente a 2.5 porciones (la suma de los factores de porción), la lista cuenta 1.25 lb.
- **Se suma por producto:** si el pollo está en dos platillos, aparece una sola vez con el total.
- **Se redondea hacia arriba:** no se compra media bolsa. Si necesitas 6.75 lb y el pollo se vende por libra, la lista dice **Comprar: 7 lb**.
- **Se convierte la unidad:** si la receta pide 800 g de tomate y se compra por libra, ves "Requerido: 800 g (≈ 1.76 lb)" y "Comprar: 2 lb".

Los platillos que todavía no tienen ingredientes registrados no aportan nada a la lista.

## 7.2 Ver la lista

1. Abre la pestaña **Lista**.
2. Elige la **semana**. La app ofrece las últimas ocho semanas ya planificadas y las próximas cuatro, y abre la más reciente que ya pasó.
3. Si el menú de esa semana está aprobado, verás los productos ordenados por nombre. Cada uno muestra **Comprar** y, debajo, lo **Requerido**.

[Captura 7.2: pestaña Lista con la semana elegida y los productos]

- **Excede por Q__:** si aprobaste el menú pasándote del presupuesto, el encabezado lo recuerda en rojo. La lista se usa igual.
- **X de Y productos:** cuántos ya están comprados; mientras no marques nada empieza en 0.

### Si dice "Aprueba el menú para generar la lista"

Esa semana todavía tiene un menú en borrador. Toca **Ir a Semana**, revísalo y aprúebalo; la lista aparece al aprobar.

### Si dice "Esta semana todavía no tiene menú"

Primero sugiere el menú en **Semana**.

## 7.3 Productos "Sin conversión"

A veces la receta usa una medida que la app no sabe pasar a la que se compra (por ejemplo, 1 cucharadita de orégano que se vende en sobre de 10 g). Ese producto aparece con la medida de la receta, la marca **Sin conversión** y 1 presentación a comprar como mínimo; revisa cuánto necesitas. El resto de la lista se calcula normalmente.

Para que no pase, registra la equivalencia de la unidad en el producto (ver capítulo 4).

## 7.4 Marcar, quitar y agregar productos

Con la lista abierta (menú aprobado) puedes llevar el control de la compra:

- **Comprado:** marca la casilla de un producto. Se tacha y el contador sube: "1 / 12 comprados". Desmarca la casilla si te equivocaste.
- **Ya lo tengo:** si ya tienes el producto en casa, toca **Ya lo tengo**. También se tacha y cuenta como cubierto, pero no es una compra. Tócalo otra vez para quitarlo.
- **Quitar:** toca **Quitar** para sacar un producto de la lista.
- **Agregar:** en **Agregar producto** escribe el nombre y la cantidad y toca **Agregar**. Sirve para lo que no viene del menú (por ejemplo, "Tortillas", 30). Si la cantidad es 0 o menor, la app dice "La cantidad debe ser mayor que 0" y no lo agrega.

Los cambios se guardan en el servidor al instante. Si otra persona de tu hogar abre la lista en su teléfono, ve los mismos cambios al volver a abrirla.

Un menú que ya pasó al historial solo se puede consultar.

## 7.5 Usar la lista en el supermercado sin conexión

La lista funciona aunque no tengas señal, siempre que la hayas abierto antes con conexión (queda guardada en tu teléfono):

1. Abre la pestaña **Lista** en tu casa, con internet.
2. En el supermercado, sin señal, sigue marcando, quitando y agregando productos como siempre. Verás **Sin conexión: los cambios se guardan en este teléfono y se envían al reconectar** y un aviso con los cambios que faltan por enviar, por ejemplo "4 cambios pendientes".
3. Cuando vuelva la conexión, la app envía los cambios sola y el aviso de pendientes desaparece. No tienes que hacer nada.

**Si dos personas cambian lo mismo**, gana el cambio más reciente (por la hora de cada teléfono). Por ejemplo, si una persona quita el azúcar a las 10:00 y otra, sin señal, lo marca como comprado a las 10:05, el azúcar vuelve a la lista como comprado en los dos teléfonos.

**Si un cambio no se puede aplicar** (por ejemplo, el producto ya no existe), la app lo descarta y te avisa, y el resto se aplica.

> **Importante:** la app todavía no se puede abrir del todo sin conexión. Abre la lista con internet antes de salir de casa y no cierres la pestaña; si la cierras sin señal, la copia guardada se vuelve a mostrar pero la app puede no cargar.
