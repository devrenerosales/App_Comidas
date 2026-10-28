# Validación de integración — 2026-10-26

Validación local de `develop` con los cambios de estabilización sin commit.
No sustituye la aceptación funcional del Product Owner ni las pruebas E2E de navegador.

## Entorno

- Windows, Node 25.6.0; la versión declarada por el repositorio sigue siendo Node 20.
- PostgreSQL 16 Alpine en un contenedor temporal separado, publicado solo en localhost.
- Cada suite utiliza bases temporales con migraciones aplicadas y las elimina al terminar.
- Redis está simulado en las pruebas de integración de datos de la API.
- URL pública y SMTP de prueba aislados del `.env` local.

## Resultados

| Suite | Aprobadas | Fallidas | Omitidas | Cobertura de líneas |
|---|---:|---:|---:|---:|
| `@menu/db` | 174 | 0 | 0 | 99.73 % |
| API: integración (8 suites) | 149 | 0 | 0 | 96.29 % |

Comandos de verificación (con `TEST_DATABASE_URL` apuntando al servidor temporal):

```powershell
pnpm.cmd --filter @menu/db test
pnpm.cmd --filter @menu/api exec jest --config test/jest-e2e.json --coverage --maxWorkers=2
```

Lint, tipos y formato de la configuración modificada también aprobados.

## Corrección realizada

La primera ejecución de la API aprobó 148 de 149 pruebas: el enlace de invitación
heredaba el dominio del `.env` local en vez del origen esperado por la prueba.
`test/setup-env.ts` ahora define `APP_URL` local y desactiva SMTP, manteniendo
los correos dentro del entorno de pruebas. La repetición completa aprobó las 149 pruebas.

## Observaciones

- Jest informó del cierre forzado de un worker al finalizar la ejecución con dos procesos,
  aunque las ocho suites aprobaron y el comando terminó con código 0. Se requiere
  investigar el cierre de recursos si el aviso se reproduce.
- Diagnóstico dirigido: las siete pruebas de `health.e2e-spec.ts` pasaron con
  `--runInBand --detectOpenHandles`, sin reportar recursos abiertos. Esto no
  identifica la causa del aviso de la ejecución completa.
- No se validaron en esta ejecución navegación real, Redis real, SMTP externo,
  Android ni despliegue de producción.
