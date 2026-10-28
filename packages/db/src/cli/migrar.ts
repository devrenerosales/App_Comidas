/**
 * `pnpm db:migrate` — aplica las migraciones pendientes a DATABASE_URL.
 * En la imagen de la API: `npm run db:migrate` (node node_modules/@menu/db/dist/migrar.js).
 */
import { cargarEntorno, variableRequerida } from '../entorno';
import { CARPETA_MIGRACIONES, migrar } from '../migraciones';

async function principal(): Promise<void> {
  cargarEntorno();
  const url = variableRequerida('DATABASE_URL');
  const inicio = Date.now();
  await migrar(url);
  console.warn(`Migraciones aplicadas desde ${CARPETA_MIGRACIONES} en ${Date.now() - inicio} ms`);
}

principal().catch((error: unknown) => {
  console.error('Error al migrar:', error instanceof Error ? error.message : error);
  process.exit(1);
});
