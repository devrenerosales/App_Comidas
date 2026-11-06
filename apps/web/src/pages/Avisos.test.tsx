import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { ApiAvisos, Aviso } from '../api/avisos';
import { ContextoApiAvisos } from '../api/contexto-avisos';
import { ProblemaApi } from '../api/problema';
import Avisos from './Avisos';
import { estaDesactualizado } from './supermercados';

const aviso = (extra: Partial<Aviso> = {}): Aviso => ({
  id: 'a1',
  tipo: 'CORRIDA_FALLIDA',
  titulo: 'Paiz',
  mensaje: 'Paiz: 50 productos sin actualizar',
  createdAt: '2026-10-25T03:00:00.000Z',
  leido: false,
  ...extra,
});

function montar(api: Partial<ApiAvisos>) {
  render(
    <MemoryRouter>
      <ContextoApiAvisos.Provider value={api as ApiAvisos}>
        <Avisos />
      </ContextoApiAvisos.Provider>
    </MemoryRouter>,
  );
  return userEvent.setup();
}

describe('HU-38 Avisos de precios', () => {
  it('CA-38.2 muestra "Paiz: 50 productos sin actualizar" con su fecha local y sin leer', async () => {
    montar({ listar: vi.fn().mockResolvedValue([aviso()]) });
    const lista = await screen.findByRole('list', { name: 'Avisos de precios' });
    const fila = within(lista).getByRole('listitem');
    expect(fila).toHaveTextContent('Paiz: 50 productos sin actualizar');
    // 25/10 03:00 UTC es sábado 24/10 21:00 en Guatemala.
    expect(fila).toHaveTextContent('24/10/2026');
    expect(screen.getByRole('status')).toHaveTextContent('1 aviso sin leer');
  });

  it('marcar como leído lo marca y baja el contador', async () => {
    const marcarLeido = vi.fn().mockResolvedValue(undefined);
    const user = montar({
      listar: vi
        .fn()
        .mockResolvedValue([
          aviso(),
          aviso({ id: 'a2', mensaje: 'Walmart: 2 productos sin actualizar' }),
        ]),
      marcarLeido,
    });
    expect(await screen.findByText('2 avisos sin leer')).toBeVisible();
    await user.click(
      screen.getByRole('button', { name: 'Marcar como leído: Paiz: 50 productos sin actualizar' }),
    );
    expect(marcarLeido).toHaveBeenCalledWith('a1');
    expect(await screen.findByText('Leído')).toBeVisible();
    expect(screen.getByText('1 aviso sin leer')).toBeVisible();
  });

  it('sin avisos lo dice', async () => {
    montar({ listar: vi.fn().mockResolvedValue([]) });
    expect(await screen.findByText('No hay avisos de precios.')).toBeVisible();
  });

  it('con todos leídos avisa que no hay pendientes', async () => {
    montar({ listar: vi.fn().mockResolvedValue([aviso({ leido: true })]) });
    expect(await screen.findByText('No tienes avisos sin leer.')).toBeVisible();
  });

  it('un error se muestra con opción de reintentar', async () => {
    const listar = vi
      .fn()
      .mockRejectedValueOnce(
        new ProblemaApi({
          status: 403,
          codigo: 'SOLO_ADMINISTRADOR',
          detail: 'Solo el administrador',
        }),
      )
      .mockResolvedValueOnce([aviso()]);
    const user = montar({ listar });
    expect(await screen.findByRole('alert')).toHaveTextContent('Solo el administrador');
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Paiz: 50 productos sin actualizar')).toBeVisible();
  });

  it('si no se pudo marcar como leído muestra el error y deja el aviso sin leer', async () => {
    const user = montar({
      listar: vi.fn().mockResolvedValue([aviso()]),
      marcarLeido: vi
        .fn()
        .mockRejectedValue(new ProblemaApi({ status: 500, codigo: 'ERROR', detail: 'Falló' })),
    });
    await user.click(await screen.findByRole('button', { name: /Marcar como leído/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Falló');
    expect(screen.queryByText('Leído')).not.toBeInTheDocument();
  });
});

describe('estaDesactualizado (CA-38.4)', () => {
  const hoy = new Date(2026, 9, 24);
  it('más de 14 días es desactualizado y 14 todavía no', () => {
    expect(estaDesactualizado('2026-10-04', hoy)).toBe(true);
    expect(estaDesactualizado('2026-10-10', hoy)).toBe(false);
    expect(estaDesactualizado('2026-10-09', hoy)).toBe(true);
  });
});
