import { Problema } from '../comun/problema';
import type { VinculosRepositorio } from '../vinculos/vinculos.repositorio';
import type { ResumenPreciosRepositorio } from './resumen-precios.repositorio';
import { ResumenPreciosService } from './resumen-precios.service';

/** 24/10/2026, mediodía en Guatemala. */
const AHORA = new Date('2026-10-24T18:00:00Z');

const fila = (productoId: string, supermercado: string, precio: string, fecha = '2026-10-24') => ({
  productoId,
  supermercadoId: supermercado.toLowerCase(),
  supermercado,
  precio,
  fecha,
});

async function problema(promesa: Promise<unknown>): Promise<Problema> {
  try {
    await promesa;
  } catch (error) {
    if (error instanceof Problema) return error;
    throw error;
  }
  throw new Error('Se esperaba un Problema');
}

describe('ResumenPreciosService (HU-36)', () => {
  const repo = {
    precios: jest.fn(),
    preferidos: jest.fn(),
    guardar: jest.fn(),
    eliminar: jest.fn(),
    productosConResumen: jest.fn(),
    eliminarVarios: jest.fn(),
  };
  const productos = { producto: jest.fn() };
  const servicio = new ResumenPreciosService(
    repo as unknown as ResumenPreciosRepositorio,
    productos as unknown as VinculosRepositorio,
    () => AHORA,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    repo.preferidos.mockResolvedValue(null);
    repo.productosConResumen.mockResolvedValue([]);
    productos.producto.mockResolvedValue({ id: 'p1', nombre: 'Arroz' });
  });

  describe('recalcularProducto', () => {
    it('CA-36.1 guarda la mediana y el mínimo del producto para el hogar', async () => {
      repo.precios.mockResolvedValue([
        fila('p1', 'Walmart', '12.50'),
        fila('p1', 'Paiz', '13.00'),
        fila('p1', 'La Torre', '14.25'),
      ]);

      const r = await servicio.recalcularProducto('h1', 'p1');

      expect(r).toMatchObject({ precioMediana: '13.00', precioMinimo: '12.50' });
      expect(repo.guardar).toHaveBeenCalledWith(
        'h1',
        'p1',
        expect.objectContaining({
          precioMediana: '13.00',
          precioMinimo: '12.50',
          supermercadoMinimo: 'Walmart',
          cantidadPrecios: 3,
          desactualizado: false,
        }),
        AHORA,
      );
      expect(repo.precios).toHaveBeenCalledWith('h1', 'p1');
    });

    it('usa los supermercados preferidos del hogar para el mínimo', async () => {
      repo.preferidos.mockResolvedValue(new Set(['paiz']));
      repo.precios.mockResolvedValue([fila('p1', 'Walmart', '12.50'), fila('p1', 'Paiz', '13.00')]);
      const r = await servicio.recalcularProducto('h1', 'p1');
      expect(r).toMatchObject({ precioMinimo: '13.00', supermercadoMinimo: 'Paiz' });
      expect(r!.precioMediana).toBe('12.75');
    });

    it('CA-36.4 la vigencia se cuenta contra hoy en Guatemala', async () => {
      repo.precios.mockResolvedValue([
        fila('p1', 'Walmart', '6.50'),
        fila('p1', 'Paiz', '5.90', '2026-10-03'),
      ]);
      const r = await servicio.recalcularProducto('h1', 'p1');
      expect(r).toMatchObject({ precioMinimo: '6.50', cantidadPrecios: 1, desactualizado: false });
    });

    it('E1 sin precios borra el resumen y devuelve null', async () => {
      repo.precios.mockResolvedValue([]);
      expect(await servicio.recalcularProducto('h1', 'p1')).toBeNull();
      expect(repo.eliminar).toHaveBeenCalledWith('h1', 'p1');
      expect(repo.guardar).not.toHaveBeenCalled();
    });
  });

  describe('recalcularHogar', () => {
    it('calcula cada producto con una sola lectura y borra los que ya no tienen precios', async () => {
      repo.precios.mockResolvedValue([
        fila('p1', 'Walmart', '12.50'),
        fila('p1', 'Paiz', '13.00'),
        fila('p2', 'Walmart', '6.50'),
      ]);
      repo.productosConResumen.mockResolvedValue(['p1', 'p3']);

      await servicio.recalcularHogar('h1');

      expect(repo.precios).toHaveBeenCalledTimes(1);
      expect(repo.precios).toHaveBeenCalledWith('h1');
      expect(repo.guardar).toHaveBeenCalledTimes(2);
      expect(repo.guardar.mock.calls.map((c) => c[1]).sort()).toEqual(['p1', 'p2']);
      expect(repo.eliminarVarios).toHaveBeenCalledWith('h1', ['p3']);
    });

    it('sin precios en el hogar solo borra lo guardado', async () => {
      repo.precios.mockResolvedValue([]);
      repo.productosConResumen.mockResolvedValue(['p1']);
      await servicio.recalcularHogar('h1');
      expect(repo.guardar).not.toHaveBeenCalled();
      expect(repo.eliminarVarios).toHaveBeenCalledWith('h1', ['p1']);
    });
  });

  describe('recalcularProductos (HU-31)', () => {
    it('recalcula solo los productos pedidos con una lectura y borra el que ya no tiene precios', async () => {
      repo.precios.mockResolvedValue([
        fila('p1', 'Walmart', '12.50'),
        fila('p2', 'Walmart', '6.50'),
        fila('p3', 'Walmart', '9.00'),
      ]);
      await servicio.recalcularProductos('h1', ['p1', 'p1', 'p4']);
      expect(repo.precios).toHaveBeenCalledTimes(1);
      expect(repo.precios).toHaveBeenCalledWith('h1');
      expect(repo.guardar).toHaveBeenCalledTimes(1);
      expect(repo.guardar.mock.calls[0]![1]).toBe('p1');
      expect(repo.eliminar).toHaveBeenCalledWith('h1', 'p4');
    });

    it('sin productos no lee nada', async () => {
      await servicio.recalcularProductos('h1', []);
      expect(repo.precios).not.toHaveBeenCalled();
    });
  });

  describe('obtener', () => {
    it('devuelve el resumen al día con el supermercado del mínimo', async () => {
      repo.precios.mockResolvedValue([fila('p1', 'Walmart', '12.50'), fila('p1', 'Paiz', '13.00')]);
      expect(await servicio.obtener('h1', 'p1')).toEqual({
        productoId: 'p1',
        precioMediana: '12.75',
        precioMinimo: '12.50',
        supermercadoMinimo: { id: 'walmart', nombre: 'Walmart' },
        fechaPrecioMinimo: '2026-10-24',
        cantidadPrecios: 2,
        desactualizado: false,
        fechaPrecioMasAntiguo: '2026-10-24',
        calculadoEn: AHORA.toISOString(),
      });
    });

    it('un producto sin precios es 404 SIN_PRECIO', async () => {
      repo.precios.mockResolvedValue([]);
      const p = await problema(servicio.obtener('h1', 'p1'));
      expect([p.getStatus(), p.codigo, p.detalle]).toEqual([404, 'SIN_PRECIO', 'Sin precio']);
    });

    it('un producto inexistente es 404 NO_ENCONTRADO', async () => {
      productos.producto.mockResolvedValue(null);
      const p = await problema(servicio.obtener('h1', 'p1'));
      expect([p.getStatus(), p.codigo]).toEqual([404, 'NO_ENCONTRADO']);
      expect(repo.precios).not.toHaveBeenCalled();
    });
  });
});
