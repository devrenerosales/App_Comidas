import { defineConfig } from 'vitest/config';

// Con TEST_DATABASE_URL corren también las pruebas de integración contra PostgreSQL real
// y se exige cobertura; sin ella solo corren las pruebas de esquema (sin base de datos).
const conBaseDeDatos = Boolean(process.env.TEST_DATABASE_URL);

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    testTimeout: 20_000,
    hookTimeout: 60_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/cli/**', 'src/index.ts', 'src/tipos.ts'],
      reporter: ['text', 'lcov', 'json-summary'],
      thresholds: conBaseDeDatos
        ? { lines: 90, functions: 90, branches: 80, statements: 90 }
        : undefined,
    },
  },
});
