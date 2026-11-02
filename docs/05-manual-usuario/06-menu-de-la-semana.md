# 6. Menú de la semana

| Campo | Valor |
|---|---|
| Historias | HU-19 Generar propuesta de menú (S3) · HU-21 a HU-26 (S3, pendientes) |
| Versión de la app | Sprint 3 (rama `feature/HU-19-generar-menu`) |
| Estado del capítulo | Parcial: solo "Sugerir menú"; faltan ajuste al presupuesto, motivo, alternativas, edición y aprobación, y las capturas |

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
