# ADR-009 — Hosting en Oracle Cloud Always Free ARM con DuckDNS y Caddy

| Estado | Fecha | Decisores |
|---|---|---|
| Aceptado | 2026-10-22 | Rene Rosales (PO), Claude (arquitectura) |

Reemplaza a [ADR-002](ADR-002-hosting-casa-cloudflare-tunnel.md). Decisiones del PO: D-11 (Oracle Cloud ARM, 99 %), D-12 (DuckDNS + HTTPS automático), D-13 (Gmail SMTP). Requerimientos: R-05, S-03, RNF-03, RNF-05, RNF-10, RNF-11, IE-03.

## Contexto

ADR-002 proponía un servidor en casa expuesto por Cloudflare Tunnel, con un dominio propio de pago (~US$10/año) aún sin confirmar (PO-01) y un equipo dedicado aún sin conseguir (PO-02). La disponibilidad de 95 % dependía de la luz y del internet de la casa (RG-02) y obligaba a comprar UPS.

El PO decidió (D-11) llevar producción a la nube con costo cero y subir la meta de disponibilidad a **99 % mensual** (≈ 7 h 18 min de caída tolerada al mes). La laptop del PO (Windows + Docker Desktop) queda para desarrollo y pruebas.

Restricciones:

- Costo mensual cero (sin dominio de pago ni VPS de pago).
- HTTPS con certificado válido: lo exigen el service worker, Web Push, la instalación de la PWA y Android (RNF-05).
- Una sola persona opera el servidor: el despliegue debe ser un comando (RNF-10) y reconstruible desde cero con un script.
- El worker usa Chromium (Playwright) los sábados y domingos a las 21:00: necesita RAM holgada.

## Decisión

| Tema | Decisión |
|---|---|
| Cómputo | VM **Oracle Cloud Infrastructure (OCI) Always Free, forma `VM.Standard.A1.Flex`** (Ampere A1, **arm64**): 4 OCPU / 24 GB RAM (máximo del nivel gratis), disco de arranque 100 GB, **Ubuntu 22.04/24.04** |
| IP | **IP pública reservada** de OCI (no cambia al reiniciar o recrear la VM) |
| Dominio | Subdominio gratis de **DuckDNS** (variable `DOMINIO`, p. ej. `menufamiliar.duckdns.org`) apuntando a la IP reservada; actualización automática por contenedor/cron como respaldo |
| HTTPS | **Caddy 2.8** como proxy inverso en Compose: certificado Let's Encrypt automático (reto HTTP-01 por el puerto 80) y renovación sin intervención |
| Rutas | `/api/*` → `api:3000`; el resto → `web:80` (PWA en nginx) |
| Red | Security List/NSG de OCI: 80 y 443 abiertos a internet; 22 solo desde la IP del PO. Reglas `iptables` de la imagen Ubuntu de OCI ajustadas para 80/443 |
| Imágenes | Multi-arquitectura `linux/amd64,linux/arm64` en GHCR (`ghcr.io/devrenerosales/app_comidas-{api,worker,web}`), construidas por `release.yml` |
| Despliegue | `deploy/deploy.sh <versión>`: respaldo previo, `docker compose pull`, migraciones, `up -d`, verificación de salud |
| Respaldo | `deploy/backup.sh` diario (`pg_dump -Fc`, retención 14 días) + copia **fuera de la VM** (Object Storage de OCI Always Free o la laptop vía `rsync`) |
| Monitoreo | UptimeRobot gratis contra `https://<DOMINIO>/api/v1/health` + healthchecks de Compose |
| Correo | Gmail SMTP (`smtp.gmail.com:587`, STARTTLS) con contraseña de aplicación (D-13) |
| Desarrollo | Laptop del PO: Docker Desktop con `docker-compose.dev.yml` (postgres + redis) y `pnpm dev` |

## Alternativas

| Opción | Ventajas | Desventajas | Resultado |
|---|---|---|---|
| **Servidor en casa + Cloudflare Tunnel** (ADR-002) | Control total; sin puertos abiertos | Depende de luz e internet de casa (95 % como techo realista); requiere UPS, equipo dedicado y dominio de pago; Cloudflare ve el tráfico descifrado | Descartada (D-11) |
| **PaaS gratis** (Render, Railway, Fly.io, Koyeb) | Sin administrar SO; HTTPS incluido | Los niveles gratis duermen el servicio o limitan horas/RAM (512 MB); no admiten bien un worker con Chromium + Redis + Postgres persistente; Postgres gratis caduca o es muy pequeño; los costos aparecen al crecer | Descartada |
| **VPS de pago** (Hetzner, DigitalOcean, ~US$5–6/mes) | Simple, soporte, sin riesgo de reclamo | Costo mensual; 1–2 GB de RAM en el plan básico, justo para Chromium | Plan de contingencia |
| **Oracle Cloud Always Free ARM** | Gratis permanente; 4 OCPU / 24 GB (muy holgado para Chromium); IP reservada; 200 GB de bloque y 20 GB de Object Storage gratis; centro de datos con energía y red redundantes | arm64 obliga a imágenes multi-arquitectura; Oracle puede reclamar instancias Always Free inactivas; capacidad A1 a veces agotada al crear la VM; soporte solo comunitario | **Elegida** |

## Consecuencias

- (+) Costo cero: VM, IP, dominio, certificado, monitor y correo son gratuitos.
- (+) Disponibilidad esperada ≥ 99 % (sin dependencia de la luz ni del internet de casa); se elimina el UPS y RG-02 cambia de naturaleza.
- (+) 24 GB de RAM: el pico de Chromium deja de ser un riesgo.
- (+) HTTPS directo (Caddy) sin intermediario que descifre el tráfico.
- (−) **Puertos 80/443 abiertos a internet**: superficie mayor que con túnel. Mitigación: solo Caddy publica puertos; Postgres y Redis sin puertos al host; SSH solo desde la IP del PO y con llave; `unattended-upgrades`.
- (−) **Riesgo de reclamo de instancias Always Free inactivas** (Oracle puede detener instancias con uso de CPU, red y memoria muy bajos durante 7 días). Mitigación: la cuenta se pasa a **Pay As You Go** con límite de presupuesto y alertas (las instancias de cuentas PAYG no se reclaman; mientras se use solo el nivel gratis no hay cargos), respaldos diarios fuera de la VM y reconstrucción documentada paso a paso (RTO 4 h).
- (−) Las imágenes deben construirse para `arm64` (QEMU en GitHub Actions: builds más lentos). Playwright soporta Chromium en Linux arm64.
- (−) DuckDNS es un servicio comunitario sin SLA; si fallara, se cambia el registro DNS a otro proveedor gratuito (o a un dominio propio) sin tocar la aplicación, porque el dominio es la variable `DOMINIO`.
- (−) Gmail limita el envío (~500 correos/día): sobrado para un hogar.
- (−) El PO opera la VM: parches, respaldos y prueba mensual de restauración (ver [despliegue.md](../despliegue.md)).
