# ADR-008 — Notificaciones Web Push + FCM

| Estado | Fecha | Decisores |
|---|---|---|
| Aceptado | 2026-10-22 | Rene Rosales (PO), Claude (arquitectura) |

## Contexto
RF-41 (recordatorio domingo 08:00, D-08) y RF-42 (alerta de costo > 10 %) deben llegar a la PWA y a Android (IE-04). Un hogar tiene pocos dispositivos; no se justifica un proveedor pagado.

## Decisión
| Canal | Tecnología |
|---|---|
| PWA (Chrome, Edge, Firefox; Safari iOS 16.4+ instalada en pantalla de inicio) | Web Push estándar con claves **VAPID** (`web-push` en Node); el service worker muestra la notificación y abre el deep link |
| Android (APK Capacitor) | **Firebase Cloud Messaging** HTTP v1 con `firebase-admin` y `@capacitor/push-notifications` |
| Registro | `POST /api/v1/notificaciones/suscripciones` guarda en `suscripcion_push` (usuario, canal, endpoint o token, claves) |
| Envío | Cola `notificaciones-envio` procesada en la API: 4 intentos con backoff exponencial; 404/410 o `UNREGISTERED` elimina la suscripción |
| Idempotencia | `notificacion_enviada` única por (hogar, tipo, semana) para el recordatorio; estado `alertado` en `menu_semanal` para la alerta |
| Programación | Scheduler `recordatorio-planificacion` cada hora en `America/Guatemala`, selecciona hogares por día y hora de planificación |

## Alternativas
| Opción | Por qué no |
|---|---|
| Solo FCM también para web | Agrega el SDK de Firebase a la PWA; Web Push estándar basta |
| OneSignal u otro proveedor | Dependencia y datos en terceros sin necesidad |
| Correo o WhatsApp | Menos inmediato; WhatsApp Business API tiene costo |
| Notificaciones locales programadas en el dispositivo | No sirven para la alerta de costo, que depende del servidor |

## Consecuencias
- (+) Sin costo; el envío es saliente y funciona igual con Cloudflare Tunnel o Tailscale.
- (−) Requiere HTTPS válido (resuelto en ADR-002) y un proyecto Firebase con credenciales en secretos.
- (−) En iOS solo llega si la PWA está instalada en la pantalla de inicio.
- (−) Dos adaptadores que mantener detrás de una interfaz `CanalPush`.
