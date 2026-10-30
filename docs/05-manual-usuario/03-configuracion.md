# 3. Configuración: tiempos de comida y presupuesto

| Campo | Valor |
|---|---|
| Historias | HU-05 Tiempos de comida parametrizables · HU-06 Presupuesto y distribución · HU-07 Recálculo con vista previa (S1) · HU-08 Semana (S1, pendiente) · HU-09 Supermercados y marcas (S5) · HU-10 Restricciones y gustos (S3) |
| Versión de la app | Sprint 1 (rama `feature/HU-05-07-configuracion`) |
| Estado del capítulo | Parcial: secciones 3.1 a 3.5 listas; 3.6 a 3.8 se completan en sprints posteriores; faltan las capturas |

En **Configuración → Tiempos y presupuesto** decides qué comidas planifica la app (solo almuerzo, dos tiempos o los tres), cuánto gastas a la semana y cómo se reparte ese dinero entre las comidas. Todo cambio aplica a los **menús futuros**: los menús que ya aprobaste no cambian.

> **Capturas:** los recuadros `[Captura …]` marcan dónde irá la imagen de la pantalla real (teléfono 390 × 844, carpeta `docs/05-manual-usuario/img/`).

## 3.1 Quién puede cambiar esta configuración

| Acción | Administrador | Miembro |
|---|---|---|
| Ver los tiempos, el presupuesto y el reparto | Sí | Sí |
| Cambiar tiempos de comida | Sí | No |
| Cambiar el presupuesto semanal y el reparto | Sí | No |

Si eres **Miembro**, la pantalla muestra la configuración vigente sin controles y el aviso *"Solo el administrador puede cambiar los tiempos de comida"*. Pide al administrador del hogar que haga el cambio.

## 3.2 Elegir los tiempos de comida

1. Abre la pestaña **Configuración** y toca **Tiempos y presupuesto**.
2. En **¿Qué tiempos planificas?** elige una opción:
   - **Solo almuerzo** (así empieza todo hogar nuevo).
   - **Dos tiempos**: marca exactamente dos entre **Desayuno**, **Almuerzo** y **Cena**.
   - **Tres tiempos**: desayuno, almuerzo y cena.
3. Al cambiar la opción, la app propone el reparto sugerido para esos tiempos (sección 3.4) y te muestra cómo queda en la **Vista previa del reparto**.
4. Toca **Continuar** para ver la confirmación (sección 3.5) y luego **Confirmar**.

`[Captura 3-1: "¿Qué tiempos planificas?" con "Dos tiempos", Almuerzo y Cena marcados — img/03-tiempos.png]`

Ejemplo: con un presupuesto de Q500 y solo almuerzo, al marcar **Dos tiempos → Almuerzo y Cena** la vista previa muestra **Almuerzo Q300 (60 %)** y **Cena Q200 (40 %)**. Con **Desayuno y Almuerzo** serían **Q145 (29 %)** y **Q355 (71 %)**.

> **Solo un tiempo** se limita al almuerzo: no se puede planificar solo el desayuno o solo la cena.

## 3.3 Definir el presupuesto semanal

1. En **Presupuesto semanal en quetzales (Q)** escribe cuánto quieres gastar en comida por semana, por ejemplo `700` o `648.50` (hasta 2 decimales).
2. Los montos de cada tiempo se recalculan al instante con los mismos porcentajes.
3. Toca **Guardar**.

Cambiar **solo el monto** conserva los porcentajes y no pide confirmación. Ejemplo: con 20 % / 50 % / 30 % y Q700, quedan **Desayuno Q140.00**, **Almuerzo Q350.00** y **Cena Q210.00**.

## 3.4 Repartir el presupuesto entre los tiempos

En **Vista previa del reparto** puedes repartir de dos formas (**Repartir por**):

- **Porcentaje**: escribe el % de cada tiempo; la app muestra su equivalente en quetzales.
- **Quetzales**: escribe el monto de cada tiempo; la app muestra su equivalente en %. Al guardar se convierte a porcentaje con 2 decimales.

La tabla compara **Actual** (lo guardado) con **Nuevo** (lo que estás editando) y muestra la etiqueta **Sin guardar** mientras haya cambios. Debajo verás **Suma 100 % · Q…** cuando el reparto está completo.

Reparto sugerido (toca **Usar distribución sugerida** para volver a él):

| Tiempos | Desayuno | Almuerzo | Cena |
|---|---|---|---|
| Solo almuerzo | — | 100 % | — |
| Almuerzo + cena | — | 60 % | 40 % |
| Desayuno + almuerzo | 29 % | 71 % | — |
| Desayuno + cena | 40 % | — | 60 % |
| Tres tiempos | 20 % | 50 % | 30 % |

Los montos se redondean a centavos; si por el redondeo sobra o falta un centavo, se ajusta en el almuerzo (o en el tiempo con mayor porcentaje si no hay almuerzo), para que la suma sea exactamente tu presupuesto.

`[Captura 3-2: "Vista previa del reparto" con Almuerzo 60 % Q300 y Cena 40 % Q200 — img/03-reparto.png]`

## 3.5 Qué pasa con mi presupuesto al cambiar los tiempos

Cuando cambias los tiempos de comida y tocas **Continuar**, la app muestra **Confirma el cambio de tiempos** sin guardar nada todavía:

- La tabla **Actual → Nuevo** por tiempo. Ejemplo: de almuerzo Q360 y cena Q240 (Q600) a tres tiempos: **Desayuno — → Q120**, **Almuerzo Q360 → Q300**, **Cena Q240 → Q180**.
- **Desde qué semana** se usa la nueva configuración. Si la próxima semana ya tiene un menú aprobado, se usa desde la semana siguiente.
- Los **menús aprobados que no cambian**: conservan sus tiempos, platillos y presupuesto.
- Los **menús en borrador** de semanas futuras que se marcarán **"Desactualizado"**. Sus platillos no se cambian solos: ábrelos en **Semana** y usa **Regenerar** cuando quieras (la generación de menús llega con HU-19).

Puedes ajustar los porcentajes antes de confirmar; si no suman 100 %, **Confirmar** queda deshabilitado. Toca **Cancelar** para descartar todo: el hogar sigue con su configuración anterior.

`[Captura 3-3: confirmación con la semana de aplicación y un menú aprobado conservado — img/03-confirmar.png]`

### Si algo sale mal

| Mensaje | Qué significa | Qué hacer |
|---|---|---|
| Selecciona exactamente dos tiempos | Elegiste "Dos tiempos" con uno o tres marcados. | Marca exactamente dos. |
| Faltan 5 % por asignar / Sobran 5 % | Los porcentajes no suman 100 %. | Ajusta los valores o toca **Usar distribución sugerida**. |
| Faltan Q20.00 por asignar / Excede el presupuesto por Q20.00 | En modo quetzales, los montos no suman el presupuesto. | Ajusta los montos. |
| Ingresa un presupuesto mayor a Q0.00 | El presupuesto está vacío, es cero, negativo o tiene más de 2 decimales. | Escribe un monto válido. |
| La configuración cambió, revisa de nuevo | Otro administrador guardó un cambio mientras editabas. | Revisa los valores que se recargaron y vuelve a guardar. |
| Solo el administrador puede cambiar los tiempos de comida | Tu rol es Miembro. | Pide el cambio al administrador. |

## 3.6 Inicio de semana y día de planificación

1. Abre **Configuración → Configurar semana**.
2. Elige el **Día de inicio de semana** y el **Día de planificación**. Ambos son domingo por defecto.
3. Toca **Ver fechas** para comprobar la próxima semana y la próxima fecha de planificación.
4. Si aparece una **Semana de transición**, revisa sus fechas: es una semana corta de uno a seis días que evita cambiar los menús aprobados.
5. Toca **Guardar semana**. Si vuelves a cambiar un selector antes de guardar, toca **Ver fechas** otra vez.

Ejemplo: si el menú aprobado termina el sábado 24 de octubre de 2026 y cambias el inicio a lunes,
se crea un borrador de transición para el domingo 25. La siguiente semana completa va del lunes
26 de octubre al domingo 1 de noviembre. Los platillos de los menús aprobados se conservan.

Los miembros pueden consultar esta pantalla, pero solo el administrador puede cambiarla.
Si otro administrador guardó primero, la app avisa y recarga la configuración para que la revises.
Si ya hay un borrador que ocupa las fechas de transición, el cambio se rechaza para conservarlo.
Una transición todavía vacía puede ajustarse si vuelves a cambiar el inicio.

La fecha de planificación es la siguiente ocurrencia del día elegido, posterior a hoy, en hora
de Guatemala. La hora se conserva. El envío de recordatorios estará disponible con el módulo
de notificaciones (HU-41); guardar esta configuración todavía no envía una notificación.

## 3.7 Supermercados y marcas preferidas — próximamente (HU-09, Sprint 5)

Se completará cuando se implemente HU-09.

## 3.7b Pesos del motor

El motor puntúa cada platillo con cuatro factores: **Preferencia** (calificaciones y favoritos),
**Novedad** (cuánto hace que no se prepara), **Ahorro** (qué tan barato es frente al presupuesto por
comida) y **Afinidad** (cuánto se ha preparado en las últimas 16 semanas). Los pesos indican cuánto
cuenta cada uno. Por defecto son 0.40, 0.25, 0.20 y 0.15.

1. Abre **Configuración → Pesos del motor**.
2. Cambia los pesos. La **Suma** se actualiza mientras escribes y debe ser 1.00.
3. Si no suma 1.00 verás, por ejemplo, "Los pesos deben sumar 1.00 (suma actual 1.10)" y **Guardar**
   queda deshabilitado.
4. Toca **Guardar**. Los pesos se aplican al próximo menú que se sugiera; los menús ya generados
   conservan los pesos con que se crearon.
5. **Restaurar valores por defecto** vuelve a 0.40 / 0.25 / 0.20 / 0.15 sin guardar hasta que toques **Guardar**.

Los miembros pueden ver los pesos, pero solo el administrador puede cambiarlos.

## 3.8 Restricciones y platillos favoritos — próximamente (HU-10, Sprint 3)

Se completará cuando se implemente HU-10.
