# ADR-004 — Autenticación JWT + refresh rotativo

| Estado | Fecha | Decisores |
|---|---|---|
| Aceptado (D-14, visto bueno del PO 2026-10-22) | 2026-10-22 | Claude (arquitectura), Rene Rosales (PO) |

## Contexto
RNF-05 exige hash fuerte, JWT con expiración y HTTPS; RNF-06 exige aislamiento por hogar. La familia usa la app en el teléfono a diario y no quiere iniciar sesión seguido. M01 suponía un JWT de 24 h, lo que deja una ventana larga si el token se filtra. Hay dos clientes: PWA (mismo origen que la API) y Android Capacitor (origen local).

## Decisión
| Elemento | Decisión |
|---|---|
| Hash | argon2id (19 MiB, t=2, p=1) |
| Token de acceso | JWT HS256, **15 min**, claims `sub`, `hogarId`, `rol`; viaja en `Authorization: Bearer` |
| Refresh token | Opaco de 32 bytes, **30 días**, guardado como hash SHA-256 en `refresh_token` con `familiaId`; **rotación en cada uso**; reutilización de uno ya rotado revoca toda la familia |
| Almacenamiento | PWA: cookie `HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth`. Android: almacenamiento seguro (Keystore) vía plugin de Capacitor |
| Autorización | `JwtAuthGuard` global, `RolesGuard` (RN-10), `HogarGuard` + filtro Prisma por `hogarId` |
| Cierre de sesión | Revoca la familia del refresh; el acceso expira en ≤ 15 min |
| Anti fuerza bruta | 5 intentos fallidos en 15 min bloquean la cuenta 15 min; throttling por IP |

## Alternativas
| Opción | Por qué no |
|---|---|
| JWT de 24 h sin refresh (supuesto M01) | Ventana de robo larga y sin revocación |
| Sesiones en servidor (cookie + Redis) | Complica el cliente Android (cookies entre orígenes en WebView) |
| Proveedor externo (Auth0, Firebase Auth, Keycloak) | Dependencia y costo extra o un servicio más que operar en casa |

## Consecuencias
- (+) Token robado sirve como máximo 15 min; refresh revocable.
- (+) Al cambiar el rol o el hogar de un usuario se refleja en el siguiente refresh.
- (−) La app debe renovar el token de forma transparente (interceptor con cola de reintento) y antes de sincronizar la cola offline.
- (−) Tabla `refresh_token` con limpieza periódica de vencidos.
- Reemplaza el supuesto de 24 h de M01 CU-01.1.

## Notas de implementación (HU-01, `feature/HU-01-registro-login`)

La decisión no cambia; estas notas fijan detalles que el ADR dejaba abiertos.

| Tema | Implementación |
|---|---|
| Transporte del refresh | **PWA** (mismo origen vía Caddy): cookie `mf_refresh` `HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth`, 30 días; el cuerpo de la respuesta **no** incluye `refreshToken`. **Android/Capacitor**: la app envía `X-Cliente: android`; la API responde el `refreshToken` en el cuerpo y no crea cookie; la app lo manda en el cuerpo de `/auth/refresh` y `/auth/logout`. La API acepta el refresh del cuerpo o de la cookie (el cuerpo tiene prioridad). |
| Almacenamiento en Android | Pendiente hasta agregar la plataforma Android (sprint de empaquetado): mientras tanto el cliente nativo guarda el refresh solo en memoria. Al agregarla se usará un plugin de almacenamiento seguro (Keystore) detrás de la misma interfaz del cliente HTTP. |
| Hash del refresh | HMAC-SHA256 con `JWT_REFRESH_SECRET` (64 hex en `refresh_token.token_hash`) en lugar de SHA-256 simple: una copia de la base sin el secreto no sirve para validar tokens robados. |
| Rotación y reutilización | En una transacción con `SELECT … FOR UPDATE`: el token usado queda con `revocado_en` y `reemplazado_por_id`; si llega uno que ya tiene `reemplazado_por_id`, se revocan todos los tokens vigentes de su `familia` (401 `SESION_REVOCADA`). Cada login o registro crea una familia nueva (una por dispositivo), así la reutilización en un dispositivo no cierra los demás. |
| Concurrencia en la PWA | Varias pestañas comparten la cookie: el cliente serializa la renovación con la Web Locks API (`menu-familiar-refresh`) y comparte una sola solicitud por pestaña, para no disparar la detección de reutilización. |
| Token de acceso | HS256 con `JWT_SECRET`, `exp − iat = 900 s`, claims `sub`, `hogarId`, `rol` (nulos sin hogar). Se verifica con `algorithms: ['HS256']`. `expiraEn` en las respuestas es el instante ISO 8601 UTC de vencimiento. |
| Guard y decoradores | `JwtAuthGuard` como `APP_GUARD` (toda ruta exige token); `@Publico()` abre `registro`, `login`, `refresh` y `health`; `@UsuarioActual()` entrega `{ id, hogarId, rol }`. `RolesGuard` y `HogarGuard` llegan con HU-02. |
| Anti fuerza bruta | Ventana de 15 min desde el primer fallo (`primer_intento_fallido_en`); al 5.º fallo `bloqueado_hasta = ahora + 15 min` (ese 5.º intento responde el 401 genérico, CA-01.3; los siguientes, 423 `CUENTA_BLOQUEADA` con `bloqueadoHasta`). El conteo es atómico (`FOR UPDATE`). Si el correo no existe se ejecuta una verificación argon2 ficticia para igualar tiempos. Throttling de `/auth/*`: 10 solicitudes/min por IP (`AUTH_LIMITE_POR_MINUTO`), con `trust proxy` para leer la IP real detrás de Caddy. |
| Cierre de sesión | `POST /auth/logout` exige token de acceso y revoca la familia del refresh solo si pertenece al usuario del token; borra la cookie. No hay "cerrar todas las sesiones" en v1 (el contrato no lo prevé; lo cubrirá `/auth/restablecer`, HU-04, con `sesiones_invalidas_antes_de`). |

## Notas de implementación de HU-04

`/auth/recuperar` responde con un mensaje neutro y envía un enlace de un solo uso,
vigente una hora. El token aleatorio tiene 32 bytes; solo su SHA-256 se guarda en
`token_recuperacion`. La comprobación de vigencia no consume el enlace.

El restablecimiento bloquea la fila del usuario y comprueba el token dentro de una
transacción. Actualiza el hash de contraseña, reinicia los intentos fallidos, consume
todos los enlaces pendientes y revoca los refresh de la cuenta.

El guard global consulta la cuenta en cada solicitud protegida para rechazar cuentas
inactivas y accesos emitidos antes o en `sesiones_invalidas_antes_de`. Los JWT nuevos
incluyen `emitidoEn` en milisegundos para distinguir sesiones del mismo segundo;
los JWT anteriores usan `iat` como referencia. Esto añade una lectura por solicitud
protegida. El cliente limpia sus tokens en memoria y avisa al proveedor de sesión
cuando se restablece la contraseña.
