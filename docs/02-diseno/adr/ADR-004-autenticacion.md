# ADR-004 — Autenticación JWT + refresh rotativo

| Estado | Fecha | Decisores |
|---|---|---|
| Propuesto | 2026-10-22 | Claude (arquitectura); requiere visto bueno del PO |

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
