import { describe, expect, it, vi } from 'vitest';
import { crearApiPrecios } from './precios';
import { ProblemaApi } from './problema';

describe('API de precios (HU-34 y HU-36)', () => {
  it('registrar envía el precio manual a POST /precios', async () => {
    const peticion = vi.fn().mockResolvedValue({});
    const api = crearApiPrecios({ peticion } as never);
    const datos = { productoSupermercadoId: 'v1', precio: '20.75', fechaPrecio: '2026-10-24' };

    await api.registrar(datos);

    expect(peticion).toHaveBeenCalledWith('/precios', { metodo: 'POST', cuerpo: datos });
  });

  describe('resumen (HU-36)', () => {
    it('lee GET /productos/{id}/resumen-precio', async () => {
      const resumen = { productoId: 'p1', precioMediana: '13.00' };
      const peticion = vi.fn().mockResolvedValue(resumen);
      const api = crearApiPrecios({ peticion } as never);

      expect(await api.resumen('p1')).toBe(resumen);
      expect(peticion).toHaveBeenCalledWith('/productos/p1/resumen-precio');
    });

    it('SIN_PRECIO es null: el producto todavía no tiene precios', async () => {
      const peticion = vi
        .fn()
        .mockRejectedValue(
          new ProblemaApi({ status: 404, codigo: 'SIN_PRECIO', detail: 'Sin precio' }),
        );
      expect(await crearApiPrecios({ peticion } as never).resumen('p1')).toBeNull();
    });

    it('cualquier otro error se propaga', async () => {
      const error = new ProblemaApi({ status: 404, codigo: 'NO_ENCONTRADO', detail: 'No existe' });
      const peticion = vi.fn().mockRejectedValue(error);
      await expect(crearApiPrecios({ peticion } as never).resumen('p1')).rejects.toBe(error);
    });
  });
});
