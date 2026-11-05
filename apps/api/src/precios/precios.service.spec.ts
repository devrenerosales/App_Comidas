import { Problema } from '../comun/problema';
import type { VinculosRepositorio } from '../vinculos/vinculos.repositorio';
import type { VinculosService } from '../vinculos/vinculos.service';
import type { CrearPrecioDto } from './dto/precios.dto';
import type { PreciosRepositorio } from './precios.repositorio';
import { PreciosService } from './precios.service';

async function problema(promesa: Promise<unknown>): Promise<Problema> {
  try {
    await promesa;
  } catch (error) {
    if (error instanceof Problema) return error;
    throw error;
  }
  throw new Error('Se esperaba un Problema');
}

/** 25/10/2026, mediodía en Guatemala. */
const AHORA = new Date('2026-10-25T18:00:00Z');
const VINCULO = { id: 'v1', activo: true, factor: '1.000000' };

const dto = (extra: Partial<CrearPrecioDto> = {}): CrearPrecioDto => ({
  productoSupermercadoId: 'v1',
  precio: '20.75',
  fechaPrecio: '2026-10-24',
  ...extra,
});

describe('PreciosService (HU-34)', () => {
  const repo = { insertarManual: jest.fn() };
  const vinculosRepo = {
    vinculo: jest.fn(),
    producto: jest.fn(),
    vinculoActivo: jest.fn(),
  };
  const vinculos = { crear: jest.fn(), vistaDe: jest.fn() };
  const servicio = new PreciosService(
    repo as unknown as PreciosRepositorio,
    vinculosRepo as unknown as VinculosRepositorio,
    vinculos as unknown as VinculosService,
    () => AHORA,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    vinculosRepo.vinculo.mockResolvedValue(VINCULO);
    vinculosRepo.producto.mockResolvedValue({ id: 'p1', nombre: 'Pollo en piezas' });
    vinculosRepo.vinculoActivo.mockResolvedValue(null);
    repo.insertarManual.mockResolvedValue({ id: 'pr1' });
    vinculos.vistaDe.mockResolvedValue({ id: 'v1' });
    vinculos.crear.mockResolvedValue({ id: 'v9' });
  });

  describe('registrar sobre un vínculo', () => {
    it('CA-34.1 guarda el precio manual del hogar con su fecha', async () => {
      const r = await servicio.registrar('h1', 'u1', dto());

      expect(repo.insertarManual).toHaveBeenCalledWith({
        productoSupermercadoId: 'v1',
        hogarId: 'h1',
        registradoPorId: 'u1',
        precio: '20.75',
        precioNormalizado: '20.75',
        fechaPrecio: '2026-10-24',
      });
      expect(r).toMatchObject({
        id: 'pr1',
        precio: '20.75',
        origen: 'MANUAL',
        vinculo: { id: 'v1' },
        vinculoCreado: false,
      });
    });

    it('CA-35.2 normaliza con el factor: Q31.25 por 5 lb contra 2 lb es Q12.50', async () => {
      vinculosRepo.vinculo.mockResolvedValue({ ...VINCULO, factor: '2.500000' });
      await servicio.registrar('h1', 'u1', dto({ precio: 31.25 }));
      expect(repo.insertarManual.mock.calls[0]![0]).toMatchObject({
        precio: '31.25',
        precioNormalizado: '12.50',
      });
    });

    it('acepta el precio con coma y lo guarda con dos decimales', async () => {
      await servicio.registrar('h1', 'u1', dto({ precio: '6,5' }));
      expect(repo.insertarManual.mock.calls[0]![0].precio).toBe('6.50');
    });

    it('un vínculo inexistente es 404 y uno inactivo es 422', async () => {
      vinculosRepo.vinculo.mockResolvedValueOnce(null);
      expect((await problema(servicio.registrar('h1', 'u1', dto()))).getStatus()).toBe(404);
      vinculosRepo.vinculo.mockResolvedValueOnce({ ...VINCULO, activo: false });
      expect((await problema(servicio.registrar('h1', 'u1', dto()))).codigo).toBe(
        'VINCULO_INACTIVO',
      );
      expect(repo.insertarManual).not.toHaveBeenCalled();
    });
  });

  describe('CA-34.4 datos inválidos', () => {
    it.each([
      ['0.00', 'El precio debe ser mayor que 0'],
      ['12.905', 'El precio admite como máximo 2 decimales'],
      ['abc', 'Ingresa un precio válido (usa punto para los decimales)'],
    ])('el precio %p es 422 PRECIO_INVALIDO y no guarda', async (precio, mensaje) => {
      const p = await problema(servicio.registrar('h1', 'u1', dto({ precio })));
      expect([p.getStatus(), p.codigo, p.detalle]).toEqual([422, 'PRECIO_INVALIDO', mensaje]);
      expect(repo.insertarManual).not.toHaveBeenCalled();
    });

    it('la fecha 30/10/2026 es futura', async () => {
      const p = await problema(servicio.registrar('h1', 'u1', dto({ fechaPrecio: '2026-10-30' })));
      expect([p.getStatus(), p.codigo, p.detalle]).toEqual([
        422,
        'FECHA_FUTURA',
        'La fecha de compra no puede ser futura',
      ]);
      expect(repo.insertarManual).not.toHaveBeenCalled();
    });

    it('hoy es válido y una fecha que no existe no', async () => {
      await servicio.registrar('h1', 'u1', dto({ fechaPrecio: '2026-10-25' }));
      const p = await problema(servicio.registrar('h1', 'u1', dto({ fechaPrecio: '2026-02-30' })));
      expect(p.codigo).toBe('FECHA_INVALIDA');
    });

    it('un precio inválido no crea el vínculo mínimo', async () => {
      await problema(
        servicio.registrar('h1', 'u1', {
          productoId: 'p1',
          supermercadoId: 's1',
          presentacionCantidad: 1,
          presentacionUnidadId: 'u-lb',
          precio: '0',
          fechaPrecio: '2026-10-24',
        }),
      );
      expect(vinculos.crear).not.toHaveBeenCalled();
    });
  });

  describe('registrar por producto y supermercado', () => {
    const porPar = (extra: Partial<CrearPrecioDto> = {}): CrearPrecioDto => ({
      productoId: 'p1',
      supermercadoId: 's1',
      precio: '20.75',
      fechaPrecio: '2026-10-24',
      ...extra,
    });

    it('usa el vínculo activo del par', async () => {
      vinculosRepo.vinculoActivo.mockResolvedValue('v1');
      const r = await servicio.registrar('h1', 'u1', porPar());
      expect(vinculos.crear).not.toHaveBeenCalled();
      expect(r.vinculoCreado).toBe(false);
    });

    it('1a sin vínculo crea uno mínimo con la presentación indicada', async () => {
      vinculosRepo.vinculo.mockResolvedValue({ ...VINCULO, id: 'v9' });
      const r = await servicio.registrar(
        'h1',
        'u1',
        porPar({ presentacionCantidad: '1', presentacionUnidadId: 'u-lb' }),
      );

      expect(vinculos.crear).toHaveBeenCalledWith(
        'h1',
        'u1',
        'p1',
        {
          supermercadoId: 's1',
          nombreTienda: 'Pollo en piezas',
          presentacionCantidad: '1',
          presentacionUnidadId: 'u-lb',
        },
        false,
      );
      expect(repo.insertarManual.mock.calls[0]![0].productoSupermercadoId).toBe('v9');
      expect(r.vinculoCreado).toBe(true);
    });

    it('sin vínculo ni presentación es 422 VINCULO_REQUERIDO', async () => {
      const p = await problema(servicio.registrar('h1', 'u1', porPar()));
      expect(p.codigo).toBe('VINCULO_REQUERIDO');
      expect(repo.insertarManual).not.toHaveBeenCalled();
    });

    it('sin producto o supermercado es 422 DATOS_INCOMPLETOS', async () => {
      const sinSuper = await problema(
        servicio.registrar('h1', 'u1', porPar({ supermercadoId: undefined })),
      );
      expect(sinSuper.codigo).toBe('DATOS_INCOMPLETOS');
      const sinProducto = await problema(
        servicio.registrar('h1', 'u1', porPar({ productoId: undefined })),
      );
      expect(sinProducto.codigo).toBe('DATOS_INCOMPLETOS');
    });

    it('un producto inexistente es 404', async () => {
      vinculosRepo.producto.mockResolvedValue(null);
      expect((await problema(servicio.registrar('h1', 'u1', porPar()))).getStatus()).toBe(404);
    });
  });
});
