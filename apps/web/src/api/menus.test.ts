import { describe, expect, it, vi } from 'vitest';
import { crearApiMenus } from './menus';

describe('API de menús (api-contrato §2.5)', () => {
  it('usa las rutas, métodos y cuerpos del contrato', async () => {
    const cliente = { peticion: vi.fn().mockResolvedValue({}) };
    const api = crearApiMenus(cliente);

    await api.generar({ semana: '2026-11-01', regenerar: true });
    expect(cliente.peticion).toHaveBeenLastCalledWith('/menus/generar', {
      metodo: 'POST',
      cuerpo: { semana: '2026-11-01', regenerar: true },
    });

    await api.obtenerPorSemana('2026-11-03');
    expect(cliente.peticion).toHaveBeenLastCalledWith('/menus/semana/2026-11-03');

    await api.editar('m 1', 'd/1', { platilloId: 'p1', confirmar: true });
    expect(cliente.peticion).toHaveBeenLastCalledWith('/menus/m%201/detalles/d%2F1', {
      metodo: 'PATCH',
      cuerpo: { platilloId: 'p1', confirmar: true },
    });

    const mover = { origenDetalleId: 'a', destinoDetalleId: 'b' };
    await api.mover('m1', mover);
    expect(cliente.peticion).toHaveBeenLastCalledWith('/menus/m1/mover', {
      metodo: 'POST',
      cuerpo: mover,
    });

    await api.aprobar('m 1', 4);
    expect(cliente.peticion).toHaveBeenLastCalledWith('/menus/m%201/aprobar', {
      metodo: 'POST',
      cuerpo: { version: 4 },
    });

    await api.fijar('m1', 'd1', true);
    expect(cliente.peticion).toHaveBeenLastCalledWith('/menus/m1/detalles/d1/fijado', {
      metodo: 'PUT',
      cuerpo: { fijado: true },
    });
  });
});
