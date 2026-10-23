# 2. Tu hogar

| Campo | Valor |
|---|---|
| Historias | HU-02 Crear hogar e invitar miembros (S1) · HU-03 Registrar comensales (S1) |
| Versión de la app | Sprint 1 (ramas `feature/HU-02-hogar-invitaciones` y `feature/HU-03-comensales`) |
| Estado del capítulo | Completo para S1; faltan las capturas |

En Menú Familiar todo se organiza por **hogar**: el menú de la semana, la lista de compras, el presupuesto y los platillos son del hogar y solo los ven sus integrantes. Este capítulo explica cómo crear tu hogar, invitar a tu familia y unirte a un hogar cuando alguien te invita.

> **Capturas:** los recuadros `[Captura …]` marcan dónde irá la imagen de la pantalla real (teléfono 390 × 844, carpeta `docs/05-manual-usuario/img/`).

## 2.1 Quién puede hacer qué

Cada hogar tiene un **Administrador** (quien lo creó) y **Miembros** (las personas que se unen con una invitación).

| Acción | Administrador | Miembro |
|---|---|---|
| Ver el hogar y la lista de miembros | Sí | Sí |
| Invitar por correo o con un enlace | Sí | No |
| Ver y revocar invitaciones pendientes | Sí | No |
| Ver los comensales y el total de porciones (sección 2.6) | Sí | Sí |
| Agregar, editar o quitar comensales (sección 2.6) | Sí | No |
| Cambiar presupuesto y tiempos de comida (capítulo 3) | Sí | No |

En esta versión **cada cuenta pertenece a un solo hogar**.

## 2.2 Crear tu hogar

Cuando creas tu cuenta (capítulo 1) y todavía no perteneces a un hogar, la app te muestra **Crear hogar**.

1. En **Nombre del hogar** escribe cómo quieres llamarlo, por ejemplo `Familia Rosales` (hasta 80 caracteres).
2. Toca **Crear hogar**.
3. Listo: quedas como **Administrador** y la app te lleva a **Hogar y usuarios** para invitar a tu familia.

Tu hogar empieza con esta configuración, que puedes cambiar después en **Configuración** (capítulo 3):

| Ajuste | Valor inicial |
|---|---|
| Tiempos de comida | Solo almuerzo |
| Presupuesto semanal | Q250.00 (todo para el almuerzo) |
| Semana | De domingo a sábado |
| Recordatorio para planificar | Domingo a las 8:00 a. m. |

`[Captura 2-1: pantalla "Crear hogar" con el nombre escrito — img/02-crear-hogar.png]`

> **¿Te invitaron a un hogar?** No crees uno nuevo: abre el enlace que te enviaron (sección 2.5). Si ya creaste un hogar, no podrás unirte a otro.

### Si algo sale mal al crear el hogar

| Mensaje | Qué significa | Qué hacer |
|---|---|---|
| **Ingresa el nombre del hogar** | El campo está vacío. | Escribe un nombre. |
| **Tu cuenta ya pertenece a un hogar** | Ya creaste un hogar o te uniste a uno (quizá en otro dispositivo). | Toca **Inicio** o vuelve a abrir la app. |
| **Necesitas conexión para iniciar sesión** | No hay internet. | Revisa el Wi-Fi o los datos e intenta de nuevo. |

## 2.3 Ver tu hogar y sus miembros

1. Toca la pestaña **Configuración**.
2. En **Tu hogar** toca **Hogar y usuarios**.
3. Verás la lista **Miembros de …** con el nombre, el correo y el rol de cada persona (**Administrador** o **Miembro**).

`[Captura 2-2: "Hogar y usuarios" con los miembros — img/02-hogar-usuarios.png]`

## 2.4 Invitar a tu familia (solo el administrador)

En **Hogar y usuarios**, sección **Invitar a tu familia**, tienes dos formas de invitar. Las dos generan una invitación que:

- sirve **una sola vez** (después de que alguien la usa ya no funciona);
- **vence a los 7 días**;
- puedes **revocar** mientras nadie la haya usado.

### Opción A: por correo

1. En **Correo de la persona a invitar** escribe su correo, por ejemplo `ana@correo.com`.
2. Toca **Enviar invitación por correo**.
3. Verás **Enviamos la invitación a ana@correo.com. Vence el …**. Ana recibirá un correo de Menú Familiar con el botón **Aceptar invitación**.

La invitación por correo solo la puede aceptar **la cuenta con ese mismo correo**. Si la persona usa otro correo para su cuenta, mejor usa la opción B.

`[Captura 2-3: invitación por correo enviada — img/02-invitar-correo.png]`

### Opción B: con un enlace (WhatsApp u otra app)

1. Toca **Crear enlace para compartir**.
2. Aparece el **Enlace de invitación** con tres botones:
   - **Copiar enlace**: lo copia para pegarlo donde quieras. Si el teléfono no lo permite, toca el enlace para seleccionarlo y cópialo a mano.
   - **Compartir…** (solo en teléfonos que lo permiten): abre el menú para compartir de tu teléfono.
   - **Enviar por WhatsApp**: abre WhatsApp con el mensaje y el enlace ya escritos; solo elige el contacto.

> **Importante:** el enlace se muestra **solo en ese momento**. Si lo pierdes, revoca la invitación y crea otra. Cualquiera que tenga el enlace puede unirse a tu hogar, así que compártelo solo con tu familia.

`[Captura 2-4: enlace de invitación con Copiar, Compartir y WhatsApp — img/02-invitar-enlace.png]`

### Invitaciones pendientes y revocar

En **Invitaciones pendientes** ves las invitaciones que nadie ha usado y que no han vencido, con su fecha de vencimiento. Si junto a una dice **correo no enviado**, el correo no salió (ver la tabla de abajo).

Para anular una invitación:

1. Toca **Revocar** junto a la invitación.
2. Confirma en el mensaje **¿Revocar esta invitación? El enlace dejará de funcionar.**
3. Verás **Invitación revocada.** El enlace ya no sirve.

Si vuelves a invitar al mismo correo, la invitación anterior se anula sola y vale la nueva.

### Si algo sale mal al invitar

| Mensaje | Qué significa | Qué hacer |
|---|---|---|
| **Ingresa un correo válido** | El correo no tiene el formato `nombre@dominio.com`. | Revisa que no falte la `@` ni el punto. |
| **Ya es miembro** | Esa persona (o tú) ya está en el hogar. | No hace falta invitarla. |
| **No pudimos enviar el correo. Copia el enlace y compártelo tú.** | La invitación quedó creada, pero el servicio de correo falló. | Usa **Copiar enlace** o **Enviar por WhatsApp** que aparecen debajo. |
| **Solo el administrador del hogar puede hacer esta acción** | Tu cuenta es Miembro. | Pide al administrador que envíe la invitación. |

## 2.5 Unirte a un hogar con una invitación

1. Abre el enlace que te enviaron (el botón **Aceptar invitación** del correo o el enlace de WhatsApp).
2. Verás **Únete a Familia Rosales**, quién te invitó y hasta cuándo vale la invitación.
3. Si no tienes la sesión iniciada:
   - toca **Iniciar sesión** si ya tienes cuenta, o **Crear cuenta** si es la primera vez (capítulo 1);
   - al terminar, la app te regresa a la invitación.
4. Toca **Unirme a Familia Rosales**.
5. Listo: quedas como **Miembro** del hogar y la app te lleva a **Inicio**.

`[Captura 2-5: "Únete a Familia Rosales" con el botón Unirme — img/02-aceptar-invitacion.png]`

### Si algo sale mal al unirte

| Mensaje | Qué significa | Qué hacer |
|---|---|---|
| **Invitación no válida, pide una nueva** | La invitación venció (pasaron más de 7 días), ya se usó, fue revocada o el enlace está incompleto. | Pide al administrador que te envíe una invitación nueva. |
| **Tu cuenta ya pertenece a un hogar** | Tu cuenta ya es de otro hogar (en esta versión solo puedes estar en uno). | No es posible unirte; si es un error, habla con el administrador de tu hogar actual. |
| **Esta invitación se envió a otro correo…** | La invitación por correo es para otra cuenta. | Entra con la cuenta de ese correo o pide al administrador un enlace para compartir (opción B). |

## 2.6 Comensales y factor de porción

Los **comensales** son las personas que comen en casa. Cada uno tiene un **factor de porción**: cuánto come comparado con un adulto. Menú Familiar suma los factores de todos los comensales y usa ese **total de porciones** para calcular las cantidades del menú y de la lista de compras.

| Ejemplo | Factor |
|---|---|
| Adulto (lo normal) | 1.0 |
| Niño pequeño | 0.5 |
| Persona que come poco | 0.75 |
| Persona que come el doble | 2.0 |

El factor va de **0.25 a 2.0** en pasos de **0.25**. Al agregar a alguien se sugiere **1.0**.

**Ejemplo:** Rene 1.0 + Ana 1.0 + Diego 1.0 + Sofía 0.5 = **3.5 porciones**.

### Abrir Comensales

1. Toca la pestaña **Configuración** y luego **Hogar y usuarios**.
2. En la sección **Comensales** toca **Gestionar comensales** (si eres Miembro dice **Ver comensales**).

Arriba verás el **Total de porciones** y cuántos comensales y niños hay. Debajo, en **Quiénes comen en casa**, está cada persona con su etiqueta y su porción.

`[Captura 2-6: "Comensales" con el total de porciones y los botones − / + — img/02-comensales.png]`

### Agregar un comensal (solo el administrador)

1. En **Agregar comensal** escribe el **Nombre del comensal**, por ejemplo `Abuela Carmen` (hasta 60 caracteres).
2. Si quieres, elige la **Etiqueta**: **Adulto** o **Niño**. Es solo para identificarlo: **no cambia las porciones**. Si no eliges, queda como Adulto.
3. En **Porción** usa **−** y **+** para ajustar el factor (empieza en 1.0). Para un niño pequeño baja dos veces hasta **0.5**.
4. Toca **Agregar comensal**. Verás **Agregamos a Abuela Carmen con porción 1.0.** y el total se actualiza.

### Cambiar la porción de alguien

1. Junto a la persona toca **−** o **+**. El total de porciones cambia al instante y aparece **Sin guardar**.
2. Toca **Guardar cambios** para guardar, o **Descartar** para volver a como estaba.

Los botones se desactivan cuando llegas al mínimo (0.25) o al máximo (2.0).

### Cambiar el nombre o la etiqueta

1. Toca **Editar** junto a la persona.
2. Cambia el **Nombre** o la **Etiqueta** y toca **Guardar** (o **Cancelar**).

### Quitar un comensal

1. Toca **Quitar** junto a la persona.
2. Confirma en el mensaje **¿Quitar a Diego? Dejará de contar en las porciones del hogar.**
3. La persona pasa a la sección **Quitados** y deja de sumar en el total. No se borra: los menús ya aprobados no cambian.

Para que vuelva a contar, toca **Volver a agregar** junto a su nombre en **Quitados**. Si intentas agregar de nuevo a alguien que quitaste, la app te ofrece **Volver a agregar a …**.

El hogar siempre debe tener **al menos un comensal**: no puedes quitar al último.

### Si eres Miembro

Ves la lista de comensales, la porción de cada uno y el total, pero no puedes cambiarlos. La pantalla muestra **Solo el administrador puede modificar comensales.**

### Si algo sale mal con los comensales

| Mensaje | Qué significa | Qué hacer |
|---|---|---|
| **Ingresa el nombre del comensal** | El nombre está vacío. | Escribe un nombre. |
| **Ya existe un comensal con ese nombre** | Ya hay alguien con ese nombre en tu hogar (no importan mayúsculas ni tildes: "Sofía" y "sofia" son el mismo). | Usa otro nombre, por ejemplo "Ana M.", o vuelve a agregar a quien quitaste. |
| **El factor debe estar entre 0.25 y 2.0 en pasos de 0.25** | La porción no es válida. | Usa los botones − y + para elegir un valor permitido. |
| **Debe quedar al menos un comensal activo en el hogar** | Intentaste quitar al último comensal. | Agrega a otra persona antes de quitar a esta. |
| **Solo el administrador puede modificar comensales** | Tu cuenta es Miembro. | Pide al administrador que haga el cambio. |
