# Despliegue en Vercel y Supabase (sin costo, para pruebas con la familia)

Alternativa al despliegue con Docker y Oracle Cloud ([despliegue.md](despliegue.md), ADR-009): la web y la API viven en un
solo proyecto de **Vercel** y la base de datos en **Supabase** (PostgreSQL). No hace falta servidor propio.

> **Estado:** probado en local (la función `api/index.js` arranca, responde `/health` y atiende el registro contra
> PostgreSQL real), **pero todavía no se ha desplegado en Vercel**. La primera vez revisa los registros de la función.

## Cómo encaja

| Pieza | Dónde corre | Cómo |
|---|---|---|
| Web (PWA) | Vercel, archivos estáticos | `apps/web/dist`; cualquier ruta que no sea `/api/…` sirve `index.html` |
| API NestJS | Vercel, función serverless | `api/index.js` carga `apps/api/dist/serverless.js`; `vercel.json` reenvía `/api/v1/*` a esa función |
| Base de datos | Supabase | Se conecta por el *pooler*; la app usa su propio inicio de sesión (no el de Supabase) |
| Worker de precios y Redis | **No se despliegan** | La extracción automática está apagada (D-07); sin `REDIS_URL` la API arranca igual |

Web y API quedan en el **mismo dominio**, igual que con Caddy: la cookie del refresh (`Path=/api/v1/auth`) funciona sin CORS.

## Lo que cambió en el código

- `apps/api/src/serverless.ts`: crea la aplicación una vez por instancia y la reutiliza (el arranque en frío solo ocurre
  en la primera petición).
- `api/index.js` y `vercel.json` (raíz): función, reescrituras, comando de compilación y cabeceras del service worker.
- Variables nuevas de la API: `REDIS_URL` pasa a ser **opcional** (el health responde `redis: disabled`), `DB_POOL_MAX`
  (conexiones del pool, 10 por defecto) y `TRUST_PROXY` (saltos de proxy de confianza para la IP; `1` en Vercel).

## Paso a paso

### 1. Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com) (plan gratuito) y guarda la contraseña de la base.
2. En el botón **Connect** del proyecto copia dos cadenas de conexión (`postgresql://postgres.<ref>:<clave>@…`):
   - **Session pooler** (puerto 5432): para las migraciones. Usan un candado de sesión (`pg_advisory_lock`) que el
     *transaction pooler* no admite.
   - **Transaction pooler** (puerto 6543): para la API en Vercel.
3. Agrega `?sslmode=no-verify` al final de ambas (el certificado del pooler no está en el almacén de confianza de Node; el
   tráfico va cifrado de todas formas).
4. Desde tu PC, en la raíz del repositorio, con la cadena de **sesión**:

   ```powershell
   $env:DATABASE_URL = "<cadena del session pooler>?sslmode=no-verify"
   pnpm db:migrate
   pnpm db:seed
   ```

   La migración crea la extensión `pg_trgm`; Supabase la permite. La semilla carga supermercados, unidades, categorías y
   productos comunes.

### 2. Vercel

1. Importa el repositorio de GitHub en [vercel.com](https://vercel.com) (plan Hobby). **Root Directory**: la raíz del
   repositorio. Vercel toma `vercel.json` (instalación con pnpm, compilación con Turbo, salida `apps/web/dist`).
2. En **Settings → Environment Variables** define, para Production:

   | Variable | Valor |
   |---|---|
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | cadena del **transaction pooler** + `?sslmode=no-verify` |
   | `DB_POOL_MAX` | `1` |
   | `TRUST_PROXY` | `1` |
   | `JWT_SECRET` | texto aleatorio de 32 caracteres o más |
   | `JWT_REFRESH_SECRET` | otro texto aleatorio distinto, de 32 o más |
   | `APP_URL` | la URL del proyecto, p. ej. `https://menu-familiar.vercel.app` (enlaces de invitación y recuperación) |
   | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | opcionales: Gmail con contraseña de aplicación. Sin ellos las invitaciones solo quedan en el registro de la función |

   **No definas** `REDIS_URL` ni `TZ` (las fechas usan `America/Guatemala` de forma explícita).
3. Despliega. Abre `https://<tu-proyecto>.vercel.app/api/v1/health`: debe decir `"status":"ok"` con
   `"redis":{"status":"disabled"}`.
4. Crea tu cuenta desde la app y prueba el flujo.

## Límites y riesgos

- **Límite de intentos en memoria.** El control de intentos de `/auth/*` (10 por minuto e IP) vive en cada instancia de la
  función; con varias instancias el tope efectivo es mayor. Para uso familiar basta; para abrirlo al público habría que
  moverlo a Redis (Upstash tiene plan gratuito).
- **Arranque en frío.** La primera petición tras un rato sin uso tarda unos segundos (Nest arranca y abre la conexión).
- **Función con límite de 30 s** (`maxDuration`). La importación de historial grande por Excel podría acercarse; si pasa,
  impórtalo en lotes.
- **Sin worker.** No hay corridas automáticas de precios ni avisos de corrida; los precios se registran a mano o por ticket.
- **Supabase gratuito** pausa el proyecto tras alrededor de una semana sin actividad y no incluye respaldos automáticos
  descargables: exporta la base de vez en cuando (`pg_dump` con la cadena de sesión). Verifica las condiciones vigentes.
- **Vercel Hobby** es para uso personal y no comercial; verifica las condiciones vigentes.
- **Módulo nativo `argon2`.** Vercel debe empaquetar su binario para Linux; si el registro falla con un error de carga de
  `argon2`, revisa los registros de la función antes de cambiar nada más.

## Volver atrás

La función y la configuración son aditivas: el despliegue con Docker (`docker-compose.yml`, `deploy/`) no cambió y sigue
funcionando. Para quitar Vercel basta con borrar el proyecto.
