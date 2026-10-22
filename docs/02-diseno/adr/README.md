# Registro de decisiones de arquitectura (ADR)

Formato MADR corto: Contexto, Decisión, Alternativas, Consecuencias, Estado. Un ADR aceptado no se edita: si la decisión cambia se crea uno nuevo que lo reemplaza y el anterior pasa a "Reemplazado por ADR-xxx".

| ADR | Título | Estado | Fecha | Requerimientos |
|---|---|---|---|---|
| [ADR-001](ADR-001-stack.md) | Stack frontend y backend | Aceptado | 2026-10-22 | R-01, RNF-08, RNF-09 |
| [ADR-002](ADR-002-hosting-casa-cloudflare-tunnel.md) | Hosting en servidor propio con Cloudflare Tunnel | Propuesto (dominio pendiente, PO-01) | 2026-10-22 | R-05, D-09, RNF-03, RNF-05 |
| [ADR-003](ADR-003-monorepo.md) | Monorepo pnpm + Turborepo | Aceptado | 2026-10-22 | RNF-09, RNF-10 |
| [ADR-004](ADR-004-autenticacion.md) | Autenticación JWT + refresh rotativo | Propuesto | 2026-10-22 | RF-01, RNF-05, RNF-06 |
| [ADR-005](ADR-005-offline-sincronizacion.md) | Estrategia offline y sincronización | Propuesto | 2026-10-22 | RF-30, RNF-04 |
| [ADR-006](ADR-006-motor-reglas.md) | Motor de sugerencias por reglas como paquete puro | Aceptado | 2026-10-22 | RF-19–23, RNF-01, RNF-09 |
| [ADR-007](ADR-007-extraccion-precios.md) | Extracción de precios con Playwright apagada por sitio | Aceptado | 2026-10-22 | RF-33, RF-38, RNF-12, D-07 |
| [ADR-008](ADR-008-notificaciones.md) | Notificaciones Web Push + FCM | Aceptado | 2026-10-22 | RF-41, RF-42, IE-04 |

Estados: **Propuesto** (espera visto bueno del PO) · **Aceptado** · **Reemplazado** · **Obsoleto**.
