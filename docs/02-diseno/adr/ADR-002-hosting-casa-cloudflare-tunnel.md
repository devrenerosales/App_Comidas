# ADR-002 — Hosting en servidor propio con Cloudflare Tunnel

| Estado | Fecha | Decisores |
|---|---|---|
| **Reemplazado por [ADR-009](ADR-009-hosting-oracle-cloud.md)** (antes: Propuesto, falta confirmar dominio, PO-01) | 2026-10-22 | Rene Rosales (PO), Claude (arquitectura) |

> **Reemplazado por [ADR-009](ADR-009-hosting-oracle-cloud.md)** el 2026-10-22 (decisión D-11: producción en Oracle Cloud Always Free ARM). El contenido se conserva como registro histórico.

## Contexto
El PO decidió hospedar en casa (D-09) con disponibilidad objetivo de 95 % (RNF-03). Los proveedores de internet residenciales suelen dar IP dinámica o CGNAT y abrir puertos expone el router. Web Push, el service worker y Android exigen HTTPS con certificado válido (RNF-05).

## Decisión
- Servidor Ubuntu Server 24.04 LTS con Docker Compose (RNF-10).
- Exposición con **Cloudflare Tunnel** (`cloudflared` en Compose): conexión saliente, sin puertos abiertos, TLS de Cloudflare.
- **Dominio propio** en Cloudflare (~US$10/año), subdominio `menu.<dominio>`.
- Respaldo cifrado fuera del servidor (restic), UPS y monitor externo de uptime.

## Alternativas
| Opción | Por qué no (o cuándo sí) |
|---|---|
| Abrir puertos 80/443 + Let's Encrypt + DDNS | Expone el router; falla con CGNAT |
| Tailscale `serve` | Válida si solo la familia usa la app y acepta tener el VPN activo; sin dominio ni monitor externo. Queda como plan B |
| VPS en la nube (~US$5–6/mes) | Descartado por el PO (D-09); sería el plan de contingencia si la disponibilidad real cae bajo 95 % |
| Túnel rápido `trycloudflare.com` | URL cambia en cada reinicio; inservible para el APK y para Web Push |

## Consecuencias
- (+) Costo casi nulo y control total de los datos.
- (+) Cero puertos abiertos; HTTPS válido automático.
- (−) Dependencia de la luz e internet de casa (RG-02); mitigado con UPS y offline (RNF-04).
- (−) Dependencia de Cloudflare como intermediario (ve el tráfico descifrado en su borde).
- (−) El PO opera el servidor: actualizaciones, respaldos y pruebas de restauración.
