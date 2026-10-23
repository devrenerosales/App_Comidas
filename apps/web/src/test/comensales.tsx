import { IonApp } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { render } from '@testing-library/react';
import { vi } from 'vitest';
import type { ApiAuth } from '../api/auth';
import type { ApiComensales, Comensal, ListaComensales } from '../api/comensales';
import { ContextoApiComensales } from '../api/contexto-comensales';
import { ContextoApiHogar } from '../api/contexto-hogar';
import type { ApiHogar } from '../api/hogar';
import type { Sesion } from '../api/tipos';
import { ProveedorAuth } from '../auth/ProveedorAuth';
import { Rutas } from '../Rutas';
import { apiFalsa, apiHogarFalsa, clienteFalso } from './utilidades';

/** Comensal de prueba con factor 1.00, adulto y activo. */
export function comensal(nombre: string, extra: Partial<Comensal> = {}): Comensal {
  return {
    id: `c-${nombre}`,
    nombre,
    tipo: 'ADULTO',
    factorPorcion: '1.00',
    activo: true,
    ...extra,
  };
}

/** "Familia Rosales": Rene, Ana y Diego con 1.0. */
export const ROSALES: Comensal[] = [comensal('Rene'), comensal('Ana'), comensal('Diego')];

export function lista(comensales: Comensal[]): ListaComensales {
  const activos = comensales.filter((c) => c.activo);
  const suma = activos.reduce((s, c) => s + Number(c.factorPorcion), 0);
  return {
    comensales,
    totales: {
      activos: activos.length,
      adultos: activos.filter((c) => c.tipo === 'ADULTO').length,
      ninos: activos.filter((c) => c.tipo === 'NINO').length,
      sumaFactores: suma.toFixed(2),
    },
  };
}

export function apiComensalesFalsa(extra: Partial<Record<keyof ApiComensales, unknown>> = {}) {
  const respuesta = (c: Comensal) => ({ comensal: c, totales: lista(ROSALES).totales });
  return {
    listar: vi.fn().mockResolvedValue(lista(ROSALES)),
    crear: vi.fn().mockResolvedValue(respuesta(comensal('Abuela Carmen'))),
    editar: vi.fn().mockResolvedValue(respuesta(comensal('Diego'))),
    inactivar: vi.fn().mockResolvedValue(respuesta(comensal('Diego', { activo: false }))),
    reactivar: vi.fn().mockResolvedValue(respuesta(comensal('Diego'))),
    ...extra,
  };
}

/** Renderiza la app en `ruta` con la sesión indicada y las API simuladas. */
export function renderizarConComensales(
  ruta: string,
  sesion: Sesion,
  apiComensales = apiComensalesFalsa(),
) {
  window.history.replaceState({}, '', ruta);
  const api = apiFalsa({ restaurar: vi.fn().mockResolvedValue(sesion) });
  const resultado = render(
    <IonApp>
      <ContextoApiHogar.Provider value={apiHogarFalsa() as unknown as ApiHogar}>
        <ContextoApiComensales.Provider value={apiComensales as unknown as ApiComensales}>
          <ProveedorAuth api={api as unknown as ApiAuth} cliente={clienteFalso()}>
            <IonReactRouter>
              <Rutas />
            </IonReactRouter>
          </ProveedorAuth>
        </ContextoApiComensales.Provider>
      </ContextoApiHogar.Provider>
    </IonApp>,
  );
  return { ...resultado, apiComensales };
}
