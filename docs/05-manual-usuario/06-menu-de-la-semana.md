# 6. Menú de la semana

| Campo | Valor |
|---|---|
| Historias | HU-19 Generar propuesta de menú (S3) · HU-24 Editar, mover y fijar platillos (S3) · HU-21 a HU-23, HU-25 y HU-26 (S3) |
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

Mientras el menú es un **borrador** puedes adaptarlo a los planes reales de la semana. Cada espacio de la tabla tiene sus botones. Cualquier miembro del hogar puede hacerlo. Un menú aprobado es de solo lectura (ver 6.4).

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

## 6.3 Aprobar el menú

Cuando el borrador te convence, toca **Aprobar menú** (abajo de la tabla). Cualquier miembro del hogar puede hacerlo y no hay una segunda pregunta de confirmación.

1. Revisa que no queden espacios con "Sin sugerencia". Si falta alguno, la app no aprueba y te dice cuáles: por ejemplo "Asigna un platillo a: viernes cena". Elige un platillo con **Cambiar** y vuelve a intentarlo.
2. Toca **Aprobar menú**. La app guarda quién lo aprobó y cuándo, congela el presupuesto y los tiempos con que se aprobó, y crea la lista de compras de esa semana.
3. El menú queda en solo lectura. Verás "Menú aprobado. La lista de compras de la semana quedó creada." y "Aprobado por <nombre> el <día/mes hora>".

**Si el costo pasa del presupuesto** de algún tiempo de comida, lo ves en rojo ("Excede por Q17.00") antes de aprobar. Puedes aprobar igual; el exceso queda registrado y se sigue mostrando en rojo en el menú aprobado.

**Si otra persona ya lo aprobó** o el menú cambió mientras lo mirabas, la app te avisa ("Ana aprobó este menú a las 09:10") y muestra la versión más reciente. Un menú aprobado no se puede volver a abrir.

Por ahora la lista de compras se crea vacía: sus ingredientes se consolidan en una etapa posterior. Mientras no haya precios, el costo aparece como incompleto y no se puede comprobar el exceso.

## 6.4 Menús aprobados y del historial

Un menú **aprobado** o una semana del **historial** se muestran en solo lectura: la tabla no tiene botones de cambiar, fijar ni mover, y la app avisa "Este menú está aprobado: solo se puede consultar."

Cuando eliges una semana, la app abre su menú si ya existe; solo si no hay uno puedes pedir **Sugerir menú**. Si dos personas cambian el mismo espacio, gana el último guardado y la otra persona verá el valor actualizado al recargar.

## 6.5 Entender por qué se sugirió un platillo

En cada espacio con platillo, toca **¿Por qué?** para ver el motivo. Funciona en el borrador y también en un menú aprobado. Se abre un panel debajo de la tabla con:

- **Una frase resumen**, por ejemplo "Sugerido sobre todo porque es de sus favoritos o está muy bien calificado".
- **Los cuatro factores con una barra** (de 0 a 1): Preferencia (favoritos y calificaciones), Novedad (hace cuánto no se prepara), Ahorro (qué tan económico es) y Afinidad (qué tanto lo preparan en esos días), cada uno con el **peso** que tenía al generar el menú.
- **El puntaje** final y el **costo estimado**. Mientras no haya precios verás "Costo incompleto" y el Ahorro aparece neutro (0.50).
- **Las reglas aplicadas**, si hay alguna (por ejemplo un reemplazo por presupuesto).

Si cambiaste el platillo tú, el panel dice **"Elegido por el usuario"** y no muestra factores.

Los pesos que ves son los de cuando se generó el menú: si el administrador cambia los pesos después, la explicación no cambia hasta que regeneres el borrador.

Toca **Cerrar** para ocultar el panel.

## 6.6 Pedir otra opción para un día

Si un platillo no te convence, no hace falta regenerar toda la semana: en el borrador, toca **Otra opción** en ese día y tiempo de comida. Es un solo toque.

- La app cambia **solo ese espacio** por el mejor candidato que no sea el actual, que no se te haya ofrecido ya para ese día, que no esté en otro día de la semana en ese tiempo y que no repita la proteína del día anterior ni del siguiente.
- El resto de la semana no se mueve. Puedes tocar **Otra opción** varias veces: cada vez verás una opción distinta.
- También funciona en un espacio que quedó en "Sin sugerencia".
- Si ya no quedan opciones válidas, la app avisa "No hay más alternativas para este día" y el platillo actual se queda.
- Si el platillo está **fijado**, el botón aparece deshabilitado: toca **Quitar fijado** primero.
- En un menú aprobado o del historial no hay botón.

Si regeneras el borrador, las opciones ya ofrecidas para los días que cambian se olvidan y vuelven a estar disponibles. Después de pedir una alternativa puedes tocar **¿Por qué?**: el panel empieza con "Alternativa pedida" y explica por qué la propuso.

## 6.7 Qué pasa cuando el menú supera el presupuesto

Cada tiempo de comida tiene su propio presupuesto (el semanal por el porcentaje que le diste). Al sugerir el menú, la app suma lo que costarían los siete días de ese tiempo con los precios que conoce y te lo muestra debajo de la tabla:

- **Dentro del presupuesto:** "Almuerzo: presupuesto Q245.00 · costo Q229.50 · Dentro del presupuesto (Q15.50 disponibles)".
- **Excede:** "Excede por Q55.00", en rojo. El borrador se guarda igual y puedes aprobarlo (ver 6.3).
- **Costo incompleto:** si a algún platillo le falta el precio de un ingrediente o no tiene ingredientes, la app no puede afirmar que cumple. Verás "costo conocido Qxx (incompleto)" o solo el presupuesto.

**Reemplazos automáticos.** Si el costo pasa del presupuesto, la app cambia el platillo más caro por otro más barato que no repita proteína seguida ni esté ya en la semana, hasta 3 intentos por tiempo de comida. Los platillos que fijaste nunca se cambian. Los reemplazados dicen "Reemplazo por presupuesto: Q22.00 más barato" al tocar **¿Por qué?**.

**Si sigue excediendo** después de los 3 intentos, aparece **Alternativas más baratas** con hasta 3 opciones por día. Toca **Usar …** para cambiar ese día; la app vuelve a calcular el costo y lo que falta o sobra. Esa lista solo aparece justo después de sugerir; si cierras la pantalla, usa **Otra opción** en cada día.

Cada vez que cambias, mueves o pides otra opción para un día, el costo y el exceso del tiempo se recalculan.

**Mientras no haya precios** (llegan con la carga de tickets y precios) ningún platillo tiene costo y el menú se muestra con el costo incompleto, sin reemplazos.

## 6.8 Costo del menú frente al presupuesto

Debajo de la tabla, el recuadro **Costo del menú** te dice si la semana alcanza:

- **Total:** lo que cuesta toda la semana, "Total: Q229.50 de Q245.00", con una barra. Si cumple, la barra y el aviso **Disponible Q15.50** salen en verde.
- **Excede:** si el total pasa del presupuesto, la barra y el aviso **Excede por Q3.50** salen en rojo. Puedes aprobar igual (ver 6.3).
- **Por tiempo de comida:** cada tiempo se compara con su propio presupuesto. Un tiempo puede salir en rojo ("Excede por Q10.00") aunque el total de la semana esté en verde.
- **Por día:** cada platillo muestra su costo en la tabla ("Chile relleno Q34.00"). Si hay más de un tiempo de comida, el día suma lo de todos ("Día: Q480.00").
- **Costo incompleto:** si a un platillo le falta el precio de algún ingrediente, su costo lleva un asterisco ("Q34.00\*") y aparece la nota "\* Costo incompleto: hay ingredientes sin precio". El costo que ves es solo lo que se conoce, así que el real puede ser mayor.
- **Sin presupuesto:** si todavía no configuraste el presupuesto semanal, verás solo el costo y un enlace a **Configuración**.

El costo se actualiza cada vez que cambias, mueves, fijas o pides otra opción para un día.

## 6.9 Ver el menú como tabla o como calendario

Arriba de la tabla hay dos botones, **Tabla** y **Calendario**. Elige cómo quieres ver la semana; la app recuerda tu elección en ese navegador.

- **Tabla:** una fila por día y una columna por tiempo de comida, como siempre.
- **Calendario:** una tarjeta por día, de domingo a sábado, que se acomodan según el ancho de la pantalla. Cada tarjeta muestra el platillo de cada tiempo de comida, su costo, y las marcas **Fijado** y **Ajustado al presupuesto** cuando corresponden. El borde de cada espacio es verde si su tiempo de comida cumple el presupuesto y rojo si lo excede.

En el calendario tienes las mismas acciones que en la tabla: **¿Por qué?**, **Cambiar**, **Otra opción**, **Fijar**, **Mover** y arrastrar un platillo a otro día. En un menú aprobado o del historial solo se puede consultar. El recuadro **Costo del menú** (6.8) se ve igual en las dos vistas.
