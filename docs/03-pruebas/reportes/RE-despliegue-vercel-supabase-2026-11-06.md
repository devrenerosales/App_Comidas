# Verificación de la adaptación para Vercel y Supabase

Fecha: 2026-11-06. Implementación local para revisión del PO, pedida fuera del backlog de historias («desplegar en Vercel
con la base de datos en Supabase»). No requiere migraciones. **No se ha desplegado en Vercel**: lo verificado es el
comportamiento en local; la guía está en [despliegue-vercel-supabase.md](../../02-diseno/despliegue-vercel-supabase.md).

## Alcance

- **Función serverless**: `apps/api/src/serverless.ts` (aplicación creada una vez por instancia), `api/index.js` y
  `vercel.json` (compilación con Turbo, salida `apps/web/dist`, reescritura de `/api/v1/*` a la función, SPA y cabeceras del
  service worker).
- **API sin Redis**: `REDIS_URL` pasa a ser opcional; sin él el health responde `redis: disabled` y no degrada el estado.
- **Variables nuevas**: `DB_POOL_MAX` (pool de PostgreSQL, 10 por defecto) y `TRUST_PROXY` (saltos de proxy de confianza
  para la IP; por defecto las redes privadas, como antes con Caddy).
- **Documentación**: guía de despliegue con el paso a paso en Supabase y Vercel, límites y riesgos; `.env.example`.
- El despliegue con Docker y Oracle Cloud no cambió.

## Resultados

| Verificación | Resultado |
|---|---|
| API, pruebas unitarias | 632 aprobadas, 63 archivos (nuevas: `confianzaProxy`, variables de entorno, health sin Redis) |
| API, integración completa con PostgreSQL | 455 aprobadas, 35 archivos (incluye las 3 del manejador serverless) |
| Integración del manejador serverless (`serverless.e2e-spec.ts`) | 3 aprobadas con PostgreSQL real: `/health` sin Redis, la aplicación se crea una sola vez, registro y creación de hogar por el manejador (argon2, JWT) |
| Compilación con el comando de Vercel (`turbo run build --filter=@menu/web --filter=@menu/api`) | Aprobada: genera `apps/api/dist/serverless.js` y `apps/web/dist` |
| Humo de `api/index.js` en producción simulada (Redis vacío, pool 1, `TRUST_PROXY=1`) | `/health` 200 con `redis: disabled`, 401 sin sesión en `/tablero`, 404 en ruta inexistente |
| Lint, tipos y Prettier | Aprobados |

También: corregí dos pruebas de integración que todavía esperaban 4 supermercados tras agregar el Mercado
(`base-datos.e2e-spec.ts` y el título de `integracion.test.ts`); estaban rotas en `develop` y `main`.

## Qué NO está verificado

- **El despliegue real en Vercel.** No he probado el empaquetado de la función (en especial el módulo nativo `argon2`), las
  reescrituras de `vercel.json`, el tiempo de arranque en frío ni la conexión a Supabase con el pooler y `sslmode=no-verify`.
  La primera vez revisa los registros de la función.
- Migraciones y semilla contra Supabase (usan el *session pooler* por el candado de sesión).
- Navegador real y Android.

## Interpretaciones y límites para el PO

1. **Todo en Vercel, sin worker.** No hay corridas automáticas de precios; coincide con la extracción apagada (D-07).
2. **El límite de intentos de `/auth/*` vive en memoria por instancia**: para uso familiar basta; para abrirlo al público
   habría que moverlo a Redis (Upstash tiene plan gratuito).
3. **`sslmode=no-verify`** en la cadena de Supabase: el tráfico va cifrado pero no se valida el certificado del pooler.
4. **Los planes gratuitos tienen condiciones que cambian** (Supabase pausa proyectos inactivos; Vercel Hobby es no comercial).

## Validación manual propuesta

Seguir la guía: crear el proyecto de Supabase, correr `pnpm db:migrate` y `pnpm db:seed` con la cadena de sesión, importar el
repositorio en Vercel con las variables indicadas y abrir `/api/v1/health` (debe decir `ok` y `redis: disabled`). Luego crear
una cuenta, un hogar y confirmar que Inicio carga.
