import { Problema } from '../comun/problema';
import type { VinculosRepositorio } from './vinculos.repositorio';
import { VinculosService } from './vinculos.service';

async function problema(promesa: Promise<unknown>): Promise<Problema> {
  try {
    await promesa;
  } catch (error) {
    if (error instanceof Problema) return error;
    throw error;
  }
  throw new Error('Se esperaba un Problema');
}

const LB = {
  id: 'u-lb',
  codigo: 'lb',
  nombre: 'libra',
  magnitud: 'MASA' as const,
  factorBase: '453.592370',
};
const LITRO = {
  id: 'u-l',
  codigo: 'l',
  nombre: 'litro',
  magnitud: 'VOLUMEN' as const,
  factorBase: '1000',
};
const ARROZ = { id: 'p1', nombre: 'Arroz blanco 2 lb', presentacionCantidad: '2.000', unidad: LB };
const WALMART = { id: 's1', nombre: 'Walmart', dominio: 'walmart.com.gt', soportaExtraccion: true };
const SUPER_FRESH = { id: 's2', nombre: 'Super Fresh', dominio: null, soportaExtraccion: false };

const fila = (extra: Record<string, unknown> = {}) => ({
  id: 'v1',
  productoId: 'p1',
  supermercadoId: 's1',
  supermercado: 'Walmart',
  nombreTienda: 'Arroz blanco 2 lb',
  marca: null,
  presentacionCantidad: '2.000',
  unidad: 'lb',
  factor: '1.000000',
  url: null,
  sku: 'WM-000123',
  activo: true,
  ...extra,
});

const dto = (extra: Record<string, unknown> = {}) => ({
  supermercadoId: 's1',
  nombreTienda: 'Arroz blanco 2 lb',
  presentacionCantidad: 2,
  presentacionUnidadId: 'u-lb',
  sku: 'WM-000123',
  ...extra,
});

describe('VinculosService (HU-35)', () => {
  const repo = {
    producto: jest.fn(),
    supermercado: jest.fn(),
    supermercados: jest.fn(),
    unidad: jest.fn(),
    vinculosDe: jest.fn(),
    vinculo: jest.fn(),
    vinculoActivo: jest.fn(),
    precios: jest.fn(),
    crear: jest.fn(),
    actualizar: jest.fn(),
  };
  const servicio = new VinculosService(repo as unknown as VinculosRepositorio);

  beforeEach(() => {
    jest.resetAllMocks();
    repo.producto.mockResolvedValue(ARROZ);
    repo.supermercado.mockResolvedValue(WALMART);
    repo.unidad.mockResolvedValue(LB);
    repo.vinculoActivo.mockResolvedValue(null);
    repo.precios.mockResolvedValue([]);
    repo.crear.mockResolvedValue('v1');
    repo.vinculo.mockResolvedValue(fila());
  });

  describe('crear', () => {
    it('CA-35.1 la misma presentación se guarda con factor 1', async () => {
      const vista = await servicio.crear('h1', 'u1', 'p1', dto(), false);

      expect(repo.crear).toHaveBeenCalledWith(
        expect.objectContaining({
          productoId: 'p1',
          supermercadoId: 's1',
          presentacionCantidad: '2',
          factor: '1.000000',
          sku: 'WM-000123',
          creadoPorHogarId: 'h1',
          creadoPorUsuarioId: 'u1',
        }),
        null,
      );
      expect(vista).toMatchObject({
        id: 'v1',
        factor: '1',
        presentacion: { cantidad: '2', unidad: 'lb', texto: '2 lb' },
        ultimoPrecio: null,
      });
    });

    it('CA-35.2 una bolsa de 5 lb contra una de 2 lb da factor 2.5', async () => {
      await servicio.crear('h1', 'u1', 'p1', dto({ presentacionCantidad: '5' }), false);
      expect(repo.crear.mock.calls[0]![0].factor).toBe('2.500000');
    });

    it('CA-35.4 una unidad de otra magnitud es 422 y no guarda', async () => {
      repo.unidad.mockResolvedValue(LITRO);
      const p = await problema(
        servicio.crear('h1', 'u1', 'p1', dto({ presentacionUnidadId: 'u-l' }), false),
      );
      expect([p.getStatus(), p.codigo, p.detalle]).toEqual([
        422,
        'UNIDAD_NO_CONVERTIBLE',
        'La unidad de la presentación no es convertible a libras',
      ]);
      expect(repo.crear).not.toHaveBeenCalled();
    });

    it('CA-35.3 con un vínculo activo es 409 con ese vínculo para ofrecer reemplazarlo', async () => {
      repo.vinculoActivo.mockResolvedValue('v0');
      repo.vinculo.mockResolvedValue(fila({ id: 'v0' }));
      const p = await problema(servicio.crear('h1', 'u1', 'p1', dto(), false));
      expect([p.getStatus(), p.codigo]).toEqual([409, 'VINCULO_ACTIVO_EXISTE']);
      expect(p.extensiones.vinculoExistente).toMatchObject({ id: 'v0' });
      expect(repo.crear).not.toHaveBeenCalled();
    });

    it('CA-35.3 con reemplazar inactiva el anterior al crear el nuevo', async () => {
      repo.vinculoActivo.mockResolvedValue('v0');
      await servicio.crear('h1', 'u1', 'p1', dto(), true);
      expect(repo.crear).toHaveBeenCalledWith(expect.anything(), 'v0');
    });

    it('la marca se guarda también normalizada', async () => {
      await servicio.crear('h1', 'u1', 'p1', dto({ marca: '  Ideal ' }), false);
      expect(repo.crear.mock.calls[0]![0]).toMatchObject({
        marca: 'Ideal',
        marcaNormalizada: 'ideal',
      });
    });

    it('un supermercado con consulta automática pide URL o SKU', async () => {
      const p = await problema(servicio.crear('h1', 'u1', 'p1', dto({ sku: undefined }), false));
      expect([p.getStatus(), p.codigo]).toEqual([422, 'URL_O_SKU_REQUERIDO']);
    });

    it('2a Super Fresh no pide URL ni SKU', async () => {
      repo.supermercado.mockResolvedValue(SUPER_FRESH);
      await servicio.crear('h1', 'u1', 'p1', dto({ supermercadoId: 's2', sku: undefined }), false);
      expect(repo.crear.mock.calls[0]![0]).toMatchObject({ url: null, sku: null });
    });

    it('E2 una URL de otro dominio es 422', async () => {
      const p = await problema(
        servicio.crear('h1', 'u1', 'p1', dto({ url: 'https://paiz.com.gt/producto' }), false),
      );
      expect([p.getStatus(), p.codigo]).toEqual([422, 'URL_FUERA_DE_DOMINIO']);
    });

    it('una URL del dominio se acepta', async () => {
      await servicio.crear(
        'h1',
        'u1',
        'p1',
        dto({ url: 'https://www.walmart.com.gt/producto/1' }),
        false,
      );
      expect(repo.crear.mock.calls[0]![0].url).toBe('https://www.walmart.com.gt/producto/1');
    });

    it('un texto que no es una URL es 422 URL_INVALIDA', async () => {
      repo.supermercado.mockResolvedValue(SUPER_FRESH);
      const p = await problema(
        servicio.crear('h1', 'u1', 'p1', dto({ url: 'super-fresh' }), false),
      );
      expect([p.getStatus(), p.codigo]).toEqual([422, 'URL_INVALIDA']);
    });

    it('sin nombre en tienda es 422', async () => {
      const p = await problema(
        servicio.crear('h1', 'u1', 'p1', dto({ nombreTienda: '  ' }), false),
      );
      expect(p.codigo).toBe('NOMBRE_TIENDA_OBLIGATORIO');
    });

    it.each([0, -1, 'abc', ''])('la presentación %p no es válida', async (valor) => {
      const p = await problema(
        servicio.crear('h1', 'u1', 'p1', dto({ presentacionCantidad: valor }), false),
      );
      expect(p.codigo).toBe('PRESENTACION_INVALIDA');
    });

    it('una unidad que no existe es 422', async () => {
      repo.unidad.mockResolvedValue(null);
      const p = await problema(servicio.crear('h1', 'u1', 'p1', dto(), false));
      expect(p.codigo).toBe('UNIDAD_NO_EXISTE');
    });

    it('un producto o supermercado inexistente es 404', async () => {
      repo.producto.mockResolvedValue(null);
      expect((await problema(servicio.crear('h1', 'u1', 'p1', dto(), false))).getStatus()).toBe(
        404,
      );
      repo.producto.mockResolvedValue(ARROZ);
      repo.supermercado.mockResolvedValue(null);
      expect((await problema(servicio.crear('h1', 'u1', 'p1', dto(), false))).getStatus()).toBe(
        404,
      );
    });
  });

  describe('supermercados', () => {
    it('indica cuáles piden URL o SKU', async () => {
      repo.supermercados.mockResolvedValue([WALMART, SUPER_FRESH]);
      expect(await servicio.supermercados()).toEqual([
        { id: 's1', nombre: 'Walmart', requiereEnlace: true, dominio: 'walmart.com.gt' },
        { id: 's2', nombre: 'Super Fresh', requiereEnlace: false, dominio: null },
      ]);
    });
  });

  describe('listar', () => {
    it('trae el último precio de cada vínculo', async () => {
      repo.vinculosDe.mockResolvedValue([fila(), fila({ id: 'v2', activo: false })]);
      repo.precios.mockResolvedValue([
        {
          productoSupermercadoId: 'v1',
          precio: '12.50',
          precioNormalizado: '12.50',
          fechaPrecio: '2026-10-20',
          origen: 'MANUAL',
        },
        {
          productoSupermercadoId: 'v1',
          precio: '11.00',
          precioNormalizado: '11.00',
          fechaPrecio: '2026-09-20',
          origen: 'MANUAL',
        },
      ]);

      const r = await servicio.listar('h1', 'p1');

      expect(r.map((v) => v.id)).toEqual(['v1', 'v2']);
      expect(r[0]!.ultimoPrecio).toEqual({
        precio: '12.50',
        precioNormalizado: '12.50',
        fecha: '2026-10-20',
        origen: 'MANUAL',
      });
      expect(r[1]!.ultimoPrecio).toBeNull();
    });

    it('un producto inexistente es 404', async () => {
      repo.producto.mockResolvedValue(null);
      expect((await problema(servicio.listar('h1', 'p1'))).getStatus()).toBe(404);
    });
  });

  describe('actualizar', () => {
    it('cambia el nombre en tienda y la marca (con su forma normalizada)', async () => {
      await servicio.actualizar('h1', 'v1', { nombreTienda: ' Arroz Gallo ', marca: 'Gallo' });
      expect(repo.actualizar).toHaveBeenCalledWith('v1', {
        nombreTienda: 'Arroz Gallo',
        marca: 'Gallo',
        marcaNormalizada: 'gallo',
      });
    });

    it('una marca vacía la quita', async () => {
      await servicio.actualizar('h1', 'v1', { marca: '' });
      expect(repo.actualizar).toHaveBeenCalledWith('v1', { marca: null, marcaNormalizada: null });
    });

    it('sin cambios no escribe', async () => {
      await servicio.actualizar('h1', 'v1', {});
      expect(repo.actualizar).not.toHaveBeenCalled();
    });

    it('no deja un vínculo de Walmart sin URL ni SKU', async () => {
      const p = await problema(servicio.actualizar('h1', 'v1', { sku: '' }));
      expect(p.codigo).toBe('URL_O_SKU_REQUERIDO');
      expect(repo.actualizar).not.toHaveBeenCalled();
    });

    it('cambia la URL cuando es del dominio', async () => {
      await servicio.actualizar('h1', 'v1', { url: 'https://walmart.com.gt/p/9' });
      expect(repo.actualizar).toHaveBeenCalledWith('v1', { url: 'https://walmart.com.gt/p/9' });
    });

    it('una URL de otro dominio es 422', async () => {
      const p = await problema(servicio.actualizar('h1', 'v1', { url: 'https://otro.com/p' }));
      expect(p.codigo).toBe('URL_FUERA_DE_DOMINIO');
    });

    it('un nombre en tienda vacío es 422', async () => {
      const p = await problema(servicio.actualizar('h1', 'v1', { nombreTienda: ' ' }));
      expect(p.codigo).toBe('NOMBRE_TIENDA_OBLIGATORIO');
    });

    it('un vínculo inexistente es 404 y uno inactivo es 422', async () => {
      repo.vinculo.mockResolvedValueOnce(null);
      expect((await problema(servicio.actualizar('h1', 'v1', {}))).getStatus()).toBe(404);
      repo.vinculo.mockResolvedValueOnce(fila({ activo: false }));
      expect((await problema(servicio.actualizar('h1', 'v1', {}))).codigo).toBe('VINCULO_INACTIVO');
    });

    it('si el supermercado ya no existe es 404', async () => {
      repo.supermercado.mockResolvedValue(null);
      expect((await problema(servicio.actualizar('h1', 'v1', {}))).getStatus()).toBe(404);
    });
  });
});
