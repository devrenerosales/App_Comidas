import { describe, expect, it, vi } from 'vitest';
import { crearApiPrecios } from './precios';

describe('API de precios (HU-34)', () => {
  it('registrar envía el precio manual a POST /precios', async () => {
    const peticion = vi.fn().mockResolvedValue({});
    const api = crearApiPrecios({ peticion } as never);
    const datos = { productoSupermercadoId: 'v1', precio: '20.75', fechaPrecio: '2026-10-24' };

    await api.registrar(datos);

    expect(peticion).toHaveBeenCalledWith('/precios', { metodo: 'POST', cuerpo: datos });
  });
});
