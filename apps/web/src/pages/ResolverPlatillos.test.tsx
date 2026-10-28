import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ContextoAuth, type ValorAuth } from '../auth/contexto';
import { ContextoApiCatalogo } from '../api/contexto-catalogo';
import type { ApiCatalogo } from '../api/catalogo';
import {
  ContextoApiImportaciones,
  type PlatilloPorResolver,
  type VistaImportacion,
} from '../api/importaciones';
import { ProblemaApi } from '../api/problema';
import ImportarHistorial from './ImportarHistorial';

const VISTA: VistaImportacion = {
  id: 'i1',
  nombreArchivo: 'menus.csv',
  estado: 'VISTA_PREVIA',
  revision: 'r1',
  totalFilas: 3,
  filasConError: 0,
  pendientes: ['Tortas de carne', 'Hilachas'],
  puedeConfirmar: false,
  reporte: null,
  semanas: [
    {
      semanaInicio: '2025-04-06',
      fechaFin: '2025-04-12',
      decision: 'CREAR',
      gastoSemana: null,
      existente: null,
      puedeReemplazar: false,
    },
  ],
};
const base = {
  proteinaPrincipal: null,
  automatica: false,
  platilloId: null,
  platillo: null,
  nombreFinal: null,
  decision: 'PENDIENTE' as const,
};
const TORTAS: PlatilloPorResolver = {
  ...base,
  nombreOriginal: 'Tortas de carne',
  nombreNormalizado: 'tortas de carne',
  propuesta: {
    accion: 'ASOCIAR',
    platilloId: 'p2',
    platillo: 'Tortitas de carne',
    similitud: 0.85,
  },
};
const HILACHAS: PlatilloPorResolver = {
  ...base,
  nombreOriginal: 'Hilachas',
  nombreNormalizado: 'hilachas',
  propuesta: { accion: 'CREAR', platilloId: null, platillo: null, similitud: 0.12 },
};
const pagina = (datos: PlatilloPorResolver[]) => ({
  datos,
  resumen: { total: datos.length, pendientes: datos.length },
  paginacion: { pagina: 1, tamano: 50, total: datos.length, totalPaginas: 1 },
});

function abrir(lista = [TORTAS, HILACHAS]) {
  const resuelta = { ...VISTA, revision: 'r2', pendientes: [], puedeConfirmar: true };
  const api = {
    obtener: vi.fn().mockResolvedValue(VISTA),
    filas: vi.fn().mockResolvedValue({ datos: [], paginacion: { totalPaginas: 0 } }),
    platillos: vi.fn().mockResolvedValue(pagina(lista)),
    decidirPlatillos: vi.fn().mockResolvedValue(resuelta),
    confirmar: vi.fn().mockResolvedValue({}),
    cancelar: vi.fn(),
    cargar: vi.fn(),
    plantilla: vi.fn(),
    decidir: vi.fn(),
  };
  const catalogo = {
    listarPlatillos: vi.fn().mockResolvedValue({
      datos: [{ id: 'p9', nombre: 'Caldo de res', tiempos: ['ALMUERZO'] }],
      paginacion: { pagina: 1, tamano: 100, total: 1, totalPaginas: 1 },
    }),
  };
  render(
    <MemoryRouter initialEntries={['/historial/importar/i1']}>
      <ContextoAuth.Provider value={{ hogar: { rol: 'ADMIN' } } as ValorAuth}>
        <ContextoApiCatalogo.Provider value={catalogo as unknown as ApiCatalogo}>
          <ContextoApiImportaciones.Provider value={api}>
            <Route path="/historial/importar/:id?">
              <ImportarHistorial />
            </Route>
          </ContextoApiImportaciones.Provider>
        </ContextoApiCatalogo.Provider>
      </ContextoAuth.Provider>
    </MemoryRouter>,
  );
  return { api, catalogo, user: userEvent.setup() };
}
const tarjeta = (nombre: string) => screen.findByRole('listitem', { name: `Platillo ${nombre}` });

describe('HU-17 Resolver platillos nuevos al importar', () => {
  it('CA-17.2 muestra la propuesta de asociar con su similitud y envía la decisión al aceptarla', async () => {
    const { api, user } = abrir();
    const t = await tarjeta('Tortas de carne');
    expect(
      within(t).getByText('Propuesta: Asociar a Tortitas de carne (85 %)'),
    ).toBeInTheDocument();
    await user.click(within(t).getByRole('button', { name: 'Aceptar propuesta' }));
    expect(api.decidirPlatillos).toHaveBeenCalledWith('i1', 'r1', {
      decisiones: [{ nombreNormalizado: 'tortas de carne', decision: 'ASOCIAR', platilloId: 'p2' }],
    });
  });
  it('CA-17.3 propone crear nuevo cuando no hay parecido', async () => {
    const { api, user } = abrir();
    const t = await tarjeta('Hilachas');
    expect(within(t).getByText('Propuesta: Crear nuevo')).toBeInTheDocument();
    await user.click(within(t).getByRole('button', { name: 'Aceptar propuesta' }));
    expect(api.decidirPlatillos).toHaveBeenCalledWith('i1', 'r1', {
      decisiones: [{ nombreNormalizado: 'hilachas', decision: 'CREAR' }],
    });
  });
  it('CA-17.4 indica cuántos platillos faltan y mantiene bloqueada la confirmación', async () => {
    abrir();
    expect(await screen.findByText(/Faltan 2 platillos por resolver/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar importación' })).toBeDisabled();
  });
  it('acepta todas las propuestas con una sola acción y habilita la confirmación', async () => {
    const { api, user } = abrir();
    await user.click(await screen.findByRole('button', { name: 'Aceptar todas las propuestas' }));
    expect(api.decidirPlatillos).toHaveBeenCalledWith('i1', 'r1', { aceptarPropuestas: true });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Confirmar importación' })).toBeEnabled(),
    );
    expect(screen.queryByText(/por resolver\./)).not.toBeInTheDocument();
  });
  it('permite corregir el nombre al crear', async () => {
    const { api, user } = abrir();
    const t = await tarjeta('Hilachas');
    await user.click(within(t).getByText('Otras opciones'));
    const campo = within(t).getByLabelText('Nombre nuevo para Hilachas');
    await user.clear(campo);
    await user.type(campo, 'Hilachas de res');
    await user.click(within(t).getByRole('button', { name: 'Crear nuevo' }));
    expect(api.decidirPlatillos).toHaveBeenCalledWith('i1', 'r1', {
      decisiones: [
        { nombreNormalizado: 'hilachas', decision: 'CREAR', nombreFinal: 'Hilachas de res' },
      ],
    });
  });
  it('permite buscar y asociar a otro platillo del catálogo', async () => {
    const { api, catalogo, user } = abrir();
    const t = await tarjeta('Hilachas');
    await user.click(within(t).getByText('Otras opciones'));
    await user.type(within(t).getByLabelText('Buscar platillo para Hilachas'), 'caldo');
    await user.selectOptions(
      await within(t).findByLabelText('Platillo existente para Hilachas'),
      'p9',
    );
    expect(catalogo.listarPlatillos).toHaveBeenCalledWith({ q: 'caldo' });
    await user.click(within(t).getByRole('button', { name: 'Asociar' }));
    expect(api.decidirPlatillos).toHaveBeenCalledWith('i1', 'r1', {
      decisiones: [{ nombreNormalizado: 'hilachas', decision: 'ASOCIAR', platilloId: 'p9' }],
    });
  });
  it('muestra la decisión tomada y permite cambiarla', async () => {
    abrir([
      {
        ...HILACHAS,
        decision: 'CREAR',
        nombreFinal: 'Hilachas de res',
      },
    ]);
    const t = await tarjeta('Hilachas');
    expect(within(t).getByText('Se creará Hilachas de res')).toBeInTheDocument();
    expect(within(t).queryByRole('button', { name: 'Aceptar propuesta' })).not.toBeInTheDocument();
    expect(within(t).getByText('Cambiar decisión')).toBeInTheDocument();
  });
  it('informa el error del servidor sin perder la lista', async () => {
    const { api, user } = abrir();
    api.decidirPlatillos.mockRejectedValueOnce(
      new ProblemaApi({
        status: 409,
        codigo: 'NOMBRE_EN_USO',
        detail: 'Ya existe un platillo llamado Sopa',
      }),
    );
    await user.click(await screen.findByRole('button', { name: 'Aceptar todas las propuestas' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ya existe un platillo llamado Sopa',
    );
    expect(screen.getByRole('listitem', { name: 'Platillo Hilachas' })).toBeInTheDocument();
  });
});
