import { describe, expect, it, vi } from 'vitest';
import { crearApiComensales } from './comensales';

describe('API de comensales (HU-03)', () => {
  it('usa las rutas /hogar/comensales del hogar del token (RNF-06)', async () => {
    const cliente = { peticion: vi.fn().mockResolvedValue({}) };
    const api = crearApiComensales(cliente);

    await api.listar();
    expect(cliente.peticion).toHaveBeenLastCalledWith('/hogar/comensales');
    await api.listar(true);
    expect(cliente.peticion).toHaveBeenLastCalledWith('/hogar/comensales?incluirInactivos=true');
    await api.crear({ nombre: 'Sofía', tipo: 'NINO', factorPorcion: '0.50' });
    expect(cliente.peticion).toHaveBeenLastCalledWith('/hogar/comensales', {
      metodo: 'POST',
      cuerpo: { nombre: 'Sofía', tipo: 'NINO', factorPorcion: '0.50' },
    });
    await api.editar('a/b', { factorPorcion: '1.25' });
    expect(cliente.peticion).toHaveBeenLastCalledWith('/hogar/comensales/a%2Fb', {
      metodo: 'PATCH',
      cuerpo: { factorPorcion: '1.25' },
    });
    await api.inactivar('c1');
    expect(cliente.peticion).toHaveBeenLastCalledWith('/hogar/comensales/c1', {
      metodo: 'DELETE',
    });
    await api.reactivar('c1');
    expect(cliente.peticion).toHaveBeenLastCalledWith('/hogar/comensales/c1/reactivar', {
      metodo: 'POST',
    });
  });
});
