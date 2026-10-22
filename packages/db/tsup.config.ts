import { defineConfig } from 'tsup';

export default defineConfig({
  // Entradas planas en dist/ (misma profundidad que src/*.ts): la ruta ../drizzle
  // de las migraciones se resuelve igual desde el código fuente y desde el build.
  entry: {
    index: 'src/index.ts',
    migrar: 'src/cli/migrar.ts',
    sembrar: 'src/cli/sembrar.ts',
  },
  format: ['esm', 'cjs'],
  dts: { entry: { index: 'src/index.ts' } },
  sourcemap: true,
  clean: true,
  shims: true,
  target: 'es2022',
});
