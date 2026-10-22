import { IonApp } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { render } from '@testing-library/react';
import { vi } from 'vitest';
import type { ApiAuth } from '../api/auth';
import type { Sesion } from '../api/tipos';
import { ProveedorAuth } from '../auth/ProveedorAuth';
import { Rutas } from '../Rutas';

export const SESION_SIN_HOGAR: Sesion = {
  usuario: { id: 'u1', nombre: 'Rene', correo: 'rene@correo.com', esAdminSistema: false },
  accessToken: 'acceso',
  expiraEn: '2026-10-22T15:15:00.000Z',
  hogar: null,
};

export const SESION_CON_HOGAR: Sesion = {
  ...SESION_SIN_HOGAR,
  hogar: { id: 'h1', nombre: 'Familia Rosales', rol: 'ADMIN' },
};

export function apiFalsa(extra: Partial<Record<keyof ApiAuth, unknown>> = {}) {
  return {
    registrar: vi.fn().mockResolvedValue(SESION_SIN_HOGAR),
    iniciarSesion: vi.fn().mockResolvedValue(SESION_CON_HOGAR),
    restaurar: vi.fn().mockResolvedValue(null),
    cerrarSesion: vi.fn().mockResolvedValue(undefined),
    perfil: vi.fn(),
    ...extra,
  };
}

/** Cliente falso que permite simular el fin de la sesión desde el cliente HTTP. */
export function clienteFalso() {
  let oyente: ((s: Sesion | null) => void) | undefined;
  return {
    alCambiarSesion: vi.fn((fn: (s: Sesion | null) => void) => {
      oyente = fn;
      return () => (oyente = undefined);
    }),
    emitir: (s: Sesion | null) => oyente?.(s),
  };
}

/** Renderiza la app en `ruta` con la API simulada (router real sobre jsdom). */
export function renderizarApp(ruta: string, api = apiFalsa(), cliente = clienteFalso()) {
  window.history.replaceState({}, '', ruta);
  const resultado = render(
    <IonApp>
      <ProveedorAuth api={api as unknown as ApiAuth} cliente={cliente}>
        <IonReactRouter>
          <Rutas />
        </IonReactRouter>
      </ProveedorAuth>
    </IonApp>,
  );
  return { ...resultado, api, cliente };
}
