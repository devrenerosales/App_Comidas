# 1. Primeros pasos

| Campo | Valor |
|---|---|
| Historias | HU-01 Registro e inicio de sesión (S1) · HU-04 Recuperar contraseña (S2, pendiente) |
| Versión de la app | Sprint 1 (rama `feature/HU-01-registro-login`) |
| Estado del capítulo | Parcial: falta "Recuperar contraseña" (HU-04) e instalar la app Android |

Este capítulo explica cómo crear tu cuenta, entrar a Menú Familiar y salir de forma segura. Necesitas conexión a internet para crear la cuenta y para iniciar sesión.

> **Capturas:** los recuadros `[Captura …]` marcan dónde irá la imagen de la pantalla real. Se toman en el teléfono (390 × 844) y se guardan en `docs/05-manual-usuario/img/` con el nombre indicado.

## 1.1 Abrir la app

1. En el teléfono o la computadora, abre el navegador (Chrome, Edge o Safari).
2. Escribe la dirección de Menú Familiar que te compartió el administrador de tu hogar (por ejemplo `https://tu-hogar.duckdns.org`).
3. Si es la primera vez o cerraste sesión, verás la pantalla **Iniciar sesión**.

> **Consejo:** en Chrome para Android puedes tocar el menú **⋮ → Agregar a la pantalla principal** para abrir Menú Familiar como una app. La versión para instalar desde la tienda (Android) llegará en un sprint posterior.

`[Captura 1-1: pantalla "Iniciar sesión" vacía — img/01-iniciar-sesion.png]`

## 1.2 Crear tu cuenta

1. En **Iniciar sesión**, toca el enlace **Crear cuenta** (al pie de la pantalla).
2. Escribe tu **Nombre**, por ejemplo `Rene`. Es el nombre que verá tu familia.
3. Escribe tu **Correo**, por ejemplo `rene@correo.com`. No importa si usas mayúsculas: la app lo guarda en minúsculas.
4. Escribe una **Contraseña** que cumpla la regla que aparece debajo del campo:
   - al menos **8 caracteres**,
   - al menos **una letra**,
   - al menos **un número**.

   Ejemplo válido: `Almuerzo2026`. Ejemplo no válido: `pollo`.
5. Toca el botón **Crear cuenta**.
6. Listo: tu cuenta queda creada, ya tienes la sesión iniciada y la app te lleva a **Crear hogar**. Allí podrás crear tu hogar e invitar a tu familia ([capítulo 2](02-tu-hogar.md)). Si te invitaron a un hogar, abre el enlace de la invitación: después de crear la cuenta la app te regresa a ella.

`[Captura 1-2: formulario "Crear cuenta" lleno — img/01-crear-cuenta.png]`

`[Captura 1-3: pantalla "Crear hogar" con el saludo — img/01-crear-hogar.png]`

### Si algo sale mal al crear la cuenta

| Mensaje | Qué significa | Qué hacer |
|---|---|---|
| **La contraseña debe tener al menos 8 caracteres, una letra y un número** | La contraseña es muy corta o le falta una letra o un número. | Escribe una contraseña más larga que combine letras y números. |
| **Este correo ya tiene cuenta** | Ya existe una cuenta con ese correo (quizá la creaste antes). | Toca el botón **Iniciar sesión** que aparece debajo del mensaje: la app abre la pantalla de inicio con tu correo ya escrito. |
| **Ingresa un correo válido** | El correo no tiene el formato `nombre@dominio.com`. | Revisa que no falte la `@` ni el punto. |
| **Ingresa tu nombre** | El campo Nombre está vacío. | Escribe tu nombre. |
| **Necesitas conexión para iniciar sesión** | El teléfono no tiene internet o no alcanza el servidor. | Revisa el Wi-Fi o los datos y vuelve a intentarlo. |

`[Captura 1-4: mensaje "Este correo ya tiene cuenta" con el botón "Iniciar sesión" — img/01-correo-registrado.png]`

## 1.3 Iniciar sesión

1. Abre la app. Si no tienes la sesión iniciada, verás **Iniciar sesión**.
2. Escribe tu **Correo** y tu **Contraseña**.
3. Toca **Entrar**.
4. La app te lleva a:
   - **Inicio** de tu hogar, si ya perteneces a uno;
   - **Crear hogar**, si todavía no perteneces a ninguno;
   - la página que intentabas abrir (por ejemplo **Semana**), si llegaste a Iniciar sesión desde un enlace.

`[Captura 1-5: pantalla "Inicio" después de entrar — img/01-inicio.png]`

### ¿Por cuánto tiempo queda abierta la sesión?

- No tienes que volver a escribir tu contraseña cada vez: la app renueva tu sesión sola mientras la uses al menos una vez cada **30 días** en ese dispositivo.
- Si pasan más de 30 días sin abrirla, o si cierras sesión, la app te pedirá entrar de nuevo.
- Si en algún momento ves de nuevo **Iniciar sesión** mientras usabas la app, es porque tu sesión terminó por seguridad: vuelve a entrar con tu correo y contraseña.

### Si algo sale mal al iniciar sesión

| Mensaje | Qué significa | Qué hacer |
|---|---|---|
| **Correo o contraseña incorrectos** | El correo no tiene cuenta o la contraseña no coincide. Por seguridad la app no dice cuál de los dos está mal. | Revisa el correo y la contraseña (mayúsculas incluidas) y vuelve a intentarlo. |
| **Por seguridad, el inicio de sesión de esta cuenta está bloqueado 15 minutos…** | Hubo **5 intentos fallidos en 15 minutos**. La cuenta se bloquea 15 minutos para protegerla. El mensaje indica la hora a la que puedes volver a intentarlo. | Espera hasta la hora indicada. Si olvidaste tu contraseña, toca **¿Olvidaste tu contraseña?** y sigue los pasos de recuperación. |
| **Demasiados intentos. Espera un minuto e intenta de nuevo.** | Se hicieron muchas solicitudes seguidas desde la misma red. | Espera un minuto. |
| **Necesitas conexión para iniciar sesión** | Sin internet. | Conéctate y vuelve a intentarlo. |

`[Captura 1-6: mensaje "Correo o contraseña incorrectos" — img/01-credenciales-incorrectas.png]`

## 1.4 Cerrar sesión

Cierra sesión cuando uses un teléfono o computadora que no es tuyo.

1. Toca la pestaña **Configuración** (abajo a la derecha). Si todavía no tienes hogar, el botón está en la pantalla **Crear hogar**.
2. En la sección **Tu cuenta** verás tu nombre y correo.
3. Toca **Cerrar sesión**.
4. La app vuelve a **Iniciar sesión**. La sesión de ese dispositivo queda cerrada; tus otros dispositivos siguen con su sesión.

`[Captura 1-7: pestaña "Configuración" con el botón "Cerrar sesión" — img/01-cerrar-sesion.png]`

## 1.5 Recuperar contraseña

1. En **Iniciar sesión**, toca **¿Olvidaste tu contraseña?**.
2. Escribe tu correo y toca **Enviar enlace**. Verás **Si el correo existe, recibirás un enlace**; el mensaje es el mismo aunque no haya una cuenta con ese correo.
3. Revisa tu correo y la carpeta de spam. Abre **Crear nueva contraseña** en el mensaje de Menú Familiar. El enlace vence en **una hora**.
4. Escribe la nueva contraseña y repítela en **Confirmar contraseña**. Debe cumplir la política indicada en pantalla.
5. Toca **Guardar contraseña**. Cuando veas **Contraseña actualizada**, toca **Iniciar sesión** y usa la nueva contraseña.

El enlace sirve una sola vez. Si venció o ya se usó, la pantalla ofrece **Solicitar otro enlace**. Al actualizar la contraseña se cierran las sesiones anteriores en todos tus dispositivos, se invalidan los demás enlaces de recuperación y se reinicia el bloqueo por intentos fallidos. Los datos de tu hogar se conservan.

Si no solicitaste el correo, puedes ignorarlo: solicitar un enlace no cambia la contraseña ni cierra tus sesiones.

## 1.6 Tu seguridad

- Tu contraseña se guarda cifrada (argon2id): nadie, ni el administrador, puede leerla.
- La conexión siempre es segura (HTTPS).
- Si alguien intenta adivinar tu contraseña, la cuenta se bloquea 15 minutos después de 5 intentos fallidos.
