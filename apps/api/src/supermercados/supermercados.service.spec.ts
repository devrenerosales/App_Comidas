import { Problema } from '../comun/problema';
import type { SupermercadosRepositorio } from './supermercados.repositorio';
import { SupermercadosService } from './supermercados.service';

async function problema(promesa: Promise<unknown>): Promise<[number, string]> {
  try {
    await promesa;
  } catch (error) {
    if (error instanceof Problema) return [error.getStatus(), error.codigo];
    throw error;
  }
  throw new Error('Se esperaba un Problema');
}

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';
const HOGAR = 'h1';
const PRODUCTO = 'p1';

describe('SupermercadosService (HU-09)', () => {
  const repo = {
    supermercados: jest.fn(),
    guardarSupermercados: jest.fn(),
    marcasElegidas: jest.fn(),
    producto: jest.fn(),
    marcaDe: jest.fn(),
    vinculos: jest.fn(),
    precios: jest.fn(),
    guardarMarca: jest.fn(),
  };
  const servicio = new SupermercadosService(repo as unknown as SupermercadosRepositorio);

  beforeEach(() => {
    jest.resetAllMocks();
    repo.producto.mockResolvedValue({ id: PRODUCTO, nombre: 'Aceite' });
    repo.marcaDe.mockResolvedValue(null);
    repo.precios.mockResolvedValue([]);
  });

  describe('supermercados', () => {
    it('un hogar que no decidió tiene todos como preferidos', async () => {
      repo.supermercados.mockResolvedValue([
        { id: A, nombre: 'Paiz', preferido: null },
        { id: B, nombre: 'Walmart', preferido: null },
      ]);
      expect(await servicio.supermercados(HOGAR)).toEqual([
        { supermercadoId: A, nombre: 'Paiz', preferido: true },
        { supermercadoId: B, nombre: 'Walmart', preferido: true },
      ]);
    });

    it('con una decisión previa, el que no aparece no es preferido', async () => {
      repo.supermercados.mockResolvedValue([
        { id: A, nombre: 'Paiz', preferido: true },
        { id: B, nombre: 'Walmart', preferido: false },
        { id: C, nombre: 'La Torre', preferido: null },
      ]);
      const r = await servicio.supermercados(HOGAR);
      expect(r.map((s) => s.preferido)).toEqual([true, false, false]);
    });
  });

  describe('guardarSupermercados', () => {
    beforeEach(() => {
      repo.supermercados.mockResolvedValue([
        { id: A, nombre: 'Paiz', preferido: null },
        { id: B, nombre: 'Walmart', preferido: null },
      ]);
    });

    it('CA-09.3 sin ninguno preferido es 422 y no guarda', async () => {
      expect(await problema(servicio.guardarSupermercados(HOGAR, { preferidos: [] }))).toEqual([
        422,
        'SIN_SUPERMERCADO_PREFERIDO',
      ]);
      expect(repo.guardarSupermercados).not.toHaveBeenCalled();
    });

    it('un supermercado desconocido es 404', async () => {
      expect(await problema(servicio.guardarSupermercados(HOGAR, { preferidos: [C] }))).toEqual([
        404,
        'NO_ENCONTRADO',
      ]);
      expect(repo.guardarSupermercados).not.toHaveBeenCalled();
    });

    it('guarda todos los supermercados activos con su preferencia', async () => {
      await servicio.guardarSupermercados(HOGAR, { preferidos: [B, B] });
      expect(repo.guardarSupermercados).toHaveBeenCalledWith(HOGAR, [
        { id: A, preferido: false },
        { id: B, preferido: true },
      ]);
    });
  });

  describe('marcas', () => {
    const vinculos = [
      {
        id: 'v1',
        marca: 'Ideal',
        marcaNormalizada: 'ideal',
        supermercado: 'Paiz',
        presentacionCantidad: '1.000',
        unidad: 'L',
      },
      {
        id: 'v2',
        marca: 'Ideal',
        marcaNormalizada: 'ideal',
        supermercado: 'Walmart',
        presentacionCantidad: '0.500',
        unidad: 'L',
      },
      {
        id: 'v3',
        marca: 'Capullo',
        marcaNormalizada: 'capullo',
        supermercado: 'Walmart',
        presentacionCantidad: '1.000',
        unidad: 'L',
      },
      {
        id: 'v4',
        marca: null,
        marcaNormalizada: null,
        supermercado: 'Paiz',
        presentacionCantidad: '2.000',
        unidad: 'L',
      },
    ];

    it('agrupa por marca con la presentación y el último precio de cada vínculo', async () => {
      repo.vinculos.mockResolvedValue(vinculos);
      repo.precios.mockResolvedValue([
        { productoSupermercadoId: 'v1', precio: '24.90', fechaPrecio: '2026-10-01' },
        { productoSupermercadoId: 'v1', precio: '23.00', fechaPrecio: '2026-09-01' },
      ]);
      repo.marcaDe.mockResolvedValue('Ideal');

      const r = await servicio.marcasDeProducto(HOGAR, PRODUCTO);

      expect(r.marcaPreferida).toBe('Ideal');
      expect(r.marcas.map((m) => m.marca)).toEqual(['Capullo', 'Ideal']);
      expect(r.marcas[1]!.presentaciones).toEqual([
        {
          supermercado: 'Paiz',
          presentacion: '1 L',
          ultimoPrecio: { precio: '24.90', fecha: '2026-10-01' },
        },
        { supermercado: 'Walmart', presentacion: '0.5 L', ultimoPrecio: null },
      ]);
    });

    it('4a un producto sin vínculos con marca no ofrece marcas', async () => {
      repo.vinculos.mockResolvedValue([vinculos[3]]);
      expect((await servicio.marcasDeProducto(HOGAR, PRODUCTO)).marcas).toEqual([]);
    });

    it('un producto inexistente es 404', async () => {
      repo.producto.mockResolvedValue(null);
      expect(await problema(servicio.marcasDeProducto(HOGAR, PRODUCTO))).toEqual([
        404,
        'NO_ENCONTRADO',
      ]);
    });

    it('CA-09.2 guarda la marca con el nombre del vínculo, sin importar mayúsculas ni acentos', async () => {
      repo.vinculos.mockResolvedValue(vinculos);
      await servicio.guardarMarca(HOGAR, PRODUCTO, { marca: '  IDEAL ' });
      expect(repo.guardarMarca).toHaveBeenCalledWith(HOGAR, PRODUCTO, {
        marca: 'Ideal',
        marcaNormalizada: 'ideal',
      });
    });

    it('una marca no vinculada es 422 MARCA_SIN_VINCULO', async () => {
      repo.vinculos.mockResolvedValue(vinculos);
      expect(await problema(servicio.guardarMarca(HOGAR, PRODUCTO, { marca: 'Otra' }))).toEqual([
        422,
        'MARCA_SIN_VINCULO',
      ]);
      expect(repo.guardarMarca).not.toHaveBeenCalled();
    });

    it('5a null (o vacía) quita la marca preferida', async () => {
      repo.vinculos.mockResolvedValue(vinculos);
      await servicio.guardarMarca(HOGAR, PRODUCTO, { marca: null });
      await servicio.guardarMarca(HOGAR, PRODUCTO, {});
      expect(repo.guardarMarca).toHaveBeenNthCalledWith(1, HOGAR, PRODUCTO, null);
      expect(repo.guardarMarca).toHaveBeenNthCalledWith(2, HOGAR, PRODUCTO, null);
    });

    it('marcasElegidas devuelve lo que guardó el hogar', async () => {
      repo.marcasElegidas.mockResolvedValue([
        { productoId: PRODUCTO, producto: 'Aceite', marca: 'Ideal' },
      ]);
      expect(await servicio.marcasElegidas(HOGAR)).toHaveLength(1);
    });
  });
});
