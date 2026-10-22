# ADR-001 — Stack frontend y backend

| Estado | Fecha | Decisores |
|---|---|---|
| Aceptado (persistencia reemplazada por [ADR-010](ADR-010-drizzle-orm.md)) | 2026-10-22 | Rene Rosales (PO), Claude (arquitectura) |

## Contexto
Se necesita una app web instalable y una app Android (RNF-08) con una sola persona desarrollando a medio tiempo. El SRS fija el stack en R-01. Hay lógica de negocio rica (motor, escalado, precios), trabajo en segundo plano (scraping, notificaciones) y un solo servidor en casa.

## Decisión
| Capa | Tecnología |
|---|---|
| Frontend | React 18 + Ionic 8 + Vite; Capacitor 6 para Android; vite-plugin-pwa (Workbox); Dexie (IndexedDB) |
| API | NestJS 10 sobre Node 22 LTS, **monolito modular** (un módulo por M1–M10) |
| Persistencia | PostgreSQL 16 + Prisma 5 |
| Colas y tareas programadas | Redis 7 + BullMQ 5 |
| Procesos de fondo | Worker Node 22 separado con Playwright (Chromium) |
| Lenguaje | TypeScript estricto en todo el monorepo |

## Alternativas
| Opción | Por qué no |
|---|---|
| Flutter / React Native + web aparte | Dos bases de código o web de menor calidad; PWA es requisito |
| Microservicios | Sobrecarga operativa sin beneficio para 1 hogar en un servidor |
| Express o Fastify sin framework | Menos estructura para módulos, guards y DI; más código propio |
| Cron del sistema operativo en vez de BullMQ | Sin reintentos, límite de tasa ni visibilidad de trabajos |
| MongoDB | El dominio es relacional (menú, detalle, lista, precios) |

## Consecuencias
- (+) Un lenguaje y tipos compartidos de punta a punta (`packages/shared`).
- (+) Un despliegue simple: un contenedor de API y uno de worker.
- (+) El worker aísla Chromium: un fallo de scraping no tumba la API.
- (−) Ionic sobre WebView rinde menos que nativo; aceptable para listas y formularios.
- (−) Redis es un servicio más que operar y respaldar (se decide no respaldarlo, ver despliegue).
