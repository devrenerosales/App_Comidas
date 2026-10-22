import { defineConfig } from 'drizzle-kit';

/**
 * drizzle-kit: `pnpm db:generate` crea una migración SQL en ./drizzle comparando el esquema
 * con el último snapshot (no necesita base de datos). `db:studio` y `db:check` usan DATABASE_URL.
 * Las migraciones se aplican con el runner propio (`pnpm db:migrate`), no con `drizzle-kit migrate`.
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './drizzle',
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      'postgresql://menu:cambiar-esta-clave@localhost:5432/menu_familiar',
  },
  migrations: { schema: 'drizzle', table: '__drizzle_migrations' },
  strict: true,
  verbose: true,
});
