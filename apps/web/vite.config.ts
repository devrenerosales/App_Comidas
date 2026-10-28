/// <reference types="vitest" />
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const COLOR_TEMA = '#2F6B4F';

export default defineConfig(({ mode }) => {
  // El proxy sigue el PORT de la API del .env de la raíz (3000 si no está definido).
  const raiz = fileURLToPath(new URL('../..', import.meta.url));
  const puertoApi = loadEnv(mode, raiz, '').PORT || '3000';
  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
        manifest: {
          id: '/',
          name: 'Menú Familiar',
          short_name: 'Menú',
          description:
            'Planifica el menú semanal de tu familia, la lista de compras y el presupuesto.',
          lang: 'es-GT',
          dir: 'ltr',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'portrait',
          theme_color: COLOR_TEMA,
          background_color: '#FFFFFF',
          categories: ['food', 'lifestyle', 'productivity'],
          icons: [
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//],
        },
      }),
    ],
    server: {
      port: 5173,
      host: true,
      // Mismo origen en desarrollo, como Caddy en producción: la cookie del refresh
      // (Path=/api/v1/auth, SameSite=Strict) llega a la API sin CORS.
      proxy: { '/api': { target: `http://localhost:${puertoApi}`, changeOrigin: false } },
    },
    build: { outDir: 'dist', sourcemap: true, chunkSizeWarningLimit: 1500 },
    test: {
      // Las pruebas usan el proxy del mismo origen, independientemente del .env local.
      env: { VITE_API_URL: '/api/v1' },
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/setupTests.ts'],
      css: false,
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,tsx}'],
        exclude: [
          'src/**/*.test.{ts,tsx}',
          'src/test/**',
          'src/main.tsx',
          'src/setupTests.ts',
          'src/vite-env.d.ts',
        ],
        reporter: ['text', 'lcov', 'json-summary'],
        // RNF-09: cobertura mínima de 70 %.
        thresholds: { lines: 70, functions: 70, branches: 70, statements: 70 },
      },
    },
  };
});
