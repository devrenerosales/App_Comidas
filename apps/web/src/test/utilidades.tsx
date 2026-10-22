import { IonApp } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { render } from '@testing-library/react';
import { vi } from 'vitest';
import type { ApiAuth } from '../api/auth';
import { ContextoApiHogar } from '../api/contexto-hogar';
import type { ApiHogar } from '../api/hogar';
import type { Invitacion, InvitacionCreada, Sesion, VistaHogar } from '../api/tipos';
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

export const SESION_MIEMBRO: Sesion = {
  ...SESION_SIN_HOGAR,
  usuario: { id: 'u2', nombre: 'Ana', correo: 'ana@correo.com', esAdminSistema: false },
  hogar: { id: 'h1', nombre: 'Familia Rosales', rol: 'MIEMBRO' },
};

export const HOGAR_ROSALES: VistaHogar = {
  id: 'h1',
  nombre: 'Familia Rosales',
  miembros: [
    {
      usuarioId: 'u1',
      nombre: 'Rene',
      correo: 'rene@correo.com',
      rol: 'ADMIN',
      desde: '2026-10-22T15:00:00.000Z',
    },
  ],
};

export const INVITACION_CORREO: InvitacionCreada = {
  id: 'i1',
  medio: 'CORREO',
  correo: 'ana@correo.com',
  estado: 'VIGENTE',
  venceEn: '2026-10-29T15:00:00.000Z',
  creadaEn: '2026-10-22T15:00:00.000Z',
  correoEnviado: true,
  usadaEn: null,
  usadaPor: null,
  enlace: 'https://menu.duckdns.org/invitacion/tok-correo',
};

export const INVITACION_ENLACE: InvitacionCreada = {
  ...INVITACION_CORREO,
  id: 'i2',
  medio: 'ENLACE',
  correo: null,
  correoEnviado: false,
  enlace: 'https://menu.duckdns.org/invitacion/tok-enlace',
};

/** Quita el enlace (la lista de invitaciones no lo trae). */
export function sinEnlace({ enlace: _enlace, ...resto }: InvitacionCreada): Invitacion {
  return resto;
}

export function apiHogarFalsa(extra: Partial<Record<keyof ApiHogar, unknown>> = {}) {
  return {
    crearHogar: vi.fn().mockResolvedValue({
      hogar: { id: 'h1', nombre: 'Familia Rosales', rol: 'ADMIN' },
      rol: 'ADMIN',
      accessToken: 'acceso-con-hogar',
      expiraEn: '2026-10-22T15:15:00.000Z',
    }),
    obtenerHogar: vi.fn().mockResolvedValue(HOGAR_ROSALES),
    invitar: vi.fn().mockResolvedValue(INVITACION_CORREO),
    listarInvitaciones: vi.fn().mockResolvedValue([]),
    revocarInvitacion: vi.fn().mockResolvedValue(undefined),
    verInvitacion: vi.fn().mockResolvedValue({
      hogarNombre: 'Familia Rosales',
      invitadoPor: 'Rene',
      medio: 'ENLACE',
      correo: null,
      venceEn: '2026-10-29T15:00:00.000Z',
    }),
    aceptarInvitacion: vi.fn().mockResolvedValue({
      hogar: { id: 'h1', nombre: 'Familia Rosales', rol: 'MIEMBRO' },
      rol: 'MIEMBRO',
      accessToken: 'acceso-miembro',
      expiraEn: '2026-10-22T15:15:00.000Z',
    }),
    ...extra,
  };
}

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

/** Renderiza la app en `ruta` con las API simuladas (router real sobre jsdom). */
export function renderizarApp(
  ruta: string,
  api = apiFalsa(),
  cliente = clienteFalso(),
  apiHogar = apiHogarFalsa(),
) {
  window.history.replaceState({}, '', ruta);
  const resultado = render(
    <IonApp>
      <ContextoApiHogar.Provider value={apiHogar as unknown as ApiHogar}>
        <ProveedorAuth api={api as unknown as ApiAuth} cliente={cliente}>
          <IonReactRouter>
            <Rutas />
          </IonReactRouter>
        </ProveedorAuth>
      </ContextoApiHogar.Provider>
    </IonApp>,
  );
  return { ...resultado, api, cliente, apiHogar };
}
