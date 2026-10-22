import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Configuración Capacitor 6. La plataforma Android se agrega en el sprint de
 * empaquetado con `pnpm --filter @menu/web exec cap add android` (requiere Android SDK).
 */
const config: CapacitorConfig = {
  appId: 'gt.menufamiliar.app',
  appName: 'Menú Familiar',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
