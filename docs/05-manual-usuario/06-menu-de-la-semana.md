# 6. Menú de la semana

| Campo | Valor |
|---|---|
| Historias | HU-19 Generar propuesta de menú (S3) · HU-24 Editar, mover y fijar platillos (S3) · HU-21 a HU-23, HU-25 y HU-26 (S3, pendientes) |
| Versión de la app | Sprint 3 (rama `feature/HU-19-generar-menu`) |
| Estado del capítulo | Parcial: "Sugerir menú" y cambiar, mover y fijar; faltan ajuste al presupuesto, motivo, alternativas y aprobación, y las capturas |

> **Capturas:** los recuadros `[Captura …]` marcan dónde irá la imagen de la pantalla real (teléfono 390 × 844, carpeta `docs/05-manual-usuario/img/`).

## 6.1 Sugerir el menú de una semana

La app propone un platillo para cada día de la semana y para cada tiempo de comida que planificas (solo almuerzo, dos tiempos o los tres). Cualquier miembro del hogar puede pedirlo.

1. Abre la pestaña **Semana**.
2. En **Semana**, elige la semana (la app ofrece las próximas cuatro, empezando por la siguiente a tu último menú aprobado).
3. Toca **Sugerir menú**.
4. Verás la tabla **Menú de la semana**: una fila por día y una columna por tiempo de comida. Debajo aparecen el presupuesto semanal y el de cada tiempo.

[Captura: pestaña Semana con el selector de semana y la tabla del menú]

El menú queda guardado como **borrador**: todavía no es el menú oficial de la semana.

### Cómo elige la app

- Para cada día toma el platillo con **mayor puntaje** (preferencia, novedad, ahorro y afinidad, con los pesos de **Configuración → Pesos del motor**).
- **No repite un platillo** en la misma semana y tiempo de comida.
- **No repite la proteína principal** (pollo, res, cerdo…) en días seguidos del mismo tiempo de comida. Los platillos con proteína "Otra" no se comparan.
- No sugiere platillos que lleven **ingredientes excluidos** (Configuración → Restricciones y gustos).
- Si dos platillos empatan, elige el más barato y, si siguen empatados, el primero por orden alfabético.

### Si ya hay un borrador

Si la semana ya tiene un borrador, la app avisa "Esta semana ya tiene un borrador" y te deja elegir **Regenerar** o **Cancelar**. Al regenerar se conservan los platillos **fijados** y se reemplaza el resto.

### Cuando no se puede sugerir

| Mensaje | Qué hacer |
|---|---|
| "Faltan 3 platillos de Cena" | Necesitas al menos 10 platillos activos por cada tiempo de comida que planificas. Toca **Ir al catálogo de platillos** y agrega los que faltan. Los platillos con ingredientes excluidos no cuentan. |
| "Esta semana ya tiene un menú aprobado" | Un menú aprobado no se regenera. Elige otra semana. |
| "Esta semana ya está registrada en el historial" | La semana ya pasó y está en el historial. Elige una semana futura. |
| "Completa los tiempos de comida y el presupuesto…" | Ve a **Configuración → Tiempos y presupuesto**. |

### Espacios sin sugerencia

Si ningún platillo cumple las reglas para un día (por ejemplo, quedan platillos con la misma proteína del día anterior), ese espacio muestra **Sin sugerencia** y la app lo avisa arriba de la tabla. Agrega más platillos de otras proteínas para evitarlo.

### El costo todavía está incompleto

La app aún no conoce los precios de los ingredientes (llegan en una versión posterior), así que ve el aviso "Costo estimado incompleto". Mientras tanto el ahorro pesa igual para todos los platillos y la sugerencia se apoya en preferencia, novedad y afinidad.

## 6.2 Cambiar, mover y fijar platillos

Mientras el menú es un **borrador** puedes adaptarlo a los planes reales de la semana. Cada espacio de la tabla tiene sus botones. Cualquier miembro del hogar puede hacerlo. Un menú aprobado es de solo lectura (ver 6.3).

### Cambiar un platillo

1. En el espacio que quieras cambiar, toca **Cambiar**.
2. Escribe al menos 2 letras en **Buscar platillo**. Solo salen platillos activos que se pueden servir en ese tiempo de comida.
3. Toca **Elegir …** en el platillo que quieras. El espacio queda con el nuevo platillo y **fijado**.

[Captura: espacio con el buscador de platillos abierto]

Un platillo elegido a mano queda fijado automáticamente: si luego pides **Regenerar**, ese espacio no cambia.

### Mover un platillo a otro día

Hay dos formas:

- **Tocando:** toca **Mover** en el platillo y después **Mover aquí** en el espacio de destino.
- **Arrastrando** (con el ratón): arrastra el platillo y suéltalo en otro espacio.

Si el destino ya tenía un platillo, los dos se **intercambian**. Los espacios que reciben un platillo quedan fijados. Si el destino estaba vacío ("Sin sugerencia"), el espacio de origen queda vacío. También puedes pasar un platillo a otro tiempo de comida del mismo día, siempre que el platillo se pueda servir en ese tiempo.

### Fijar un platillo

Toca **Fijar** para que el espacio no cambie al regenerar el menú. El botón pasa a **Quitar fijado**: tócalo de nuevo y el espacio vuelve a poder reemplazarse. Un espacio sin platillo no se puede fijar.

### Avisos al cambiar o mover

Antes de guardar, la app revisa dos reglas:

- No repetir la **misma proteína en días seguidos** del mismo tiempo de comida. Ejemplo: "Proteína res repetida en días consecutivos (jueves y viernes)". La proteína "Otra" no se compara.
- No repetir un **platillo** dentro de la semana y el tiempo de comida.

Si el cambio incumple alguna, la app lo muestra y te pregunta si quieres guardarlo de todos modos. **Confirmar** guarda el cambio (el espacio queda fijado); **Cancelar cambio** lo descarta y el menú sigue igual.

Si el platillo no se puede servir en ese tiempo de comida, el cambio se rechaza y el menú no cambia. Ejemplo: "Caldo de res no aplica a Desayuno".

## 6.3 Menús aprobados y del historial

Un menú **aprobado** o una semana del **historial** se muestran en solo lectura: la tabla no tiene botones de cambiar, fijar ni mover, y la app avisa "Este menú está aprobado: solo se puede consultar."

Cuando eliges una semana, la app abre su menú si ya existe; solo si no hay uno puedes pedir **Sugerir menú**. Si dos personas cambian el mismo espacio, gana el último guardado y la otra persona verá el valor actualizado al recargar.
