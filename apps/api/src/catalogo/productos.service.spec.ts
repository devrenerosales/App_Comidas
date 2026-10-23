import {
  ProductoDuplicadoError,
  type FilaProducto,
  type ProductosRepositorio,
} from './productos.repositorio';
import { ProductosService, cantidadValida, vistaProducto } from './productos.service';

const LB = {
  id: 'u-lb',
  codigo: 'lb',
  nombre: 'libra',
  magnitud: 'MASA' as const,
  factorBase: '453.592370',
};
const ML = {
  id: 'u-ml',
  codigo: 'ml',
  nombre: 'mililitro',
  magnitud: 'VOLUMEN' as const,
  factorBase: '1',
};
const KG = {
  id: 'u-kg',
  codigo: 'kg',
  nombre: 'kilogramo',
  magnitud: 'MASA' as const,
  factorBase: '1000',
};

const ARROZ: FilaProducto = {
  id: 'p-arroz',
  nombre: 'Arroz',
  tipo: 'DESPENSA',
  unidadCompra: 'bolsa',
  presentacionCantidad: '2.000',
  activo: true,
  categoriaId: 'c-granos',
  categoriaCodigo: 'granos',
  categoriaNombre: 'Granos',
  unidadId: LB.id,
  unidadCodigo: 'lb',
  unidadNombre: 'libra',
  unidadMagnitud: 'MASA',
  unidadFactorBase: '453.592370',
};

const NUEVO = {
  nombre: ' Arroz ',
  tipo: 'DESPENSA' as const,
  categoriaId: 'c-granos',
  unidadCompra: 'bolsa',
  presentacionCantidad: '2',
  presentacionUnidadId: LB.id,
};

function repo() {
  return {
    unidades: jest.fn().mockResolvedValue([LB, ML, KG]),
    unidad: jest.fn(async (id: string) => [LB, ML, KG].find((u) => u.id === id)),
    categorias: jest.fn().mockResolvedValue([]),
    existeCategoria: jest.fn().mockResolvedValue(true),
    buscar: jest.fn().mockResolvedValue(ARROZ),
    listar: jest.fn().mockResolvedValue({ filas: [ARROZ], total: 1 }),
    buscarDuplicado: jest.fn().mockResolvedValue(undefined),
    crear: jest.fn().mockResolvedValue('p-arroz'),
    actualizar: jest.fn().mockResolvedValue(undefined),
    cambiarActivo: jest.fn().mockResolvedValue(true),
    platillosQueUsan: jest.fn().mockResolvedValue([{ id: 'pl1', nombre: 'Arroz con pollo' }]),
    enUso: jest.fn().mockResolvedValue(false),
  };
}

const crearServicio = (r = repo()) => ({
  r,
  s: new ProductosService(r as unknown as ProductosRepositorio),
});

describe('vistaProducto y cantidadValida', () => {
  it('CA-13.1 etiqueta "Arroz · bolsa 2 lb"', () => {
    expect(vistaProducto(ARROZ)).toMatchObject({
      etiqueta: 'Arroz · bolsa 2 lb',
      categoria: { codigo: 'granos' },
      presentacion: { cantidad: '2.000', unidad: { codigo: 'lb', magnitud: 'MASA' } },
    });
  });

  it('CA-13.4 / CA-12.4 cantidades > 0 con hasta 3 decimales', () => {
    expect(cantidadValida('2')).toBe('2');
    expect(cantidadValida('0.125')).toBe('0.125');
    expect(cantidadValida('0')).toBeNull();
    expect(cantidadValida('-1')).toBeNull();
    expect(cantidadValida('1.0005')).toBeNull();
    expect(cantidadValida('99999999')).toBeNull();
    expect(cantidadValida('abc')).toBeNull();
  });
});

describe('ProductosService (HU-13)', () => {
  it('lista normalizando el texto y el filtro de activos', async () => {
    const { r, s } = crearServicio();
    const pagina = await s.listar({ q: ' GÜISQUIL ', activo: 'todos', pagina: 2, tamano: 10 });
    expect(r.listar).toHaveBeenCalledWith(
      { q: 'guisquil', tipo: undefined, categoria: undefined, activo: null },
      2,
      10,
    );
    expect(pagina.paginacion).toEqual({ pagina: 2, tamano: 10, total: 1, totalPaginas: 1 });
    await s.listar({ activo: 'false', pagina: 1, tamano: 20 });
    expect(r.listar).toHaveBeenLastCalledWith(
      expect.objectContaining({ activo: false, q: undefined }),
      1,
      20,
    );
    await s.listar({ activo: 'true', q: '   ', pagina: 1, tamano: 20 });
    expect(r.listar).toHaveBeenLastCalledWith(
      expect.objectContaining({ activo: true, q: undefined }),
      1,
      20,
    );
  });

  it('unidades, categorías y obtener; 404 si no existe', async () => {
    const { r, s } = crearServicio();
    await expect(s.unidades()).resolves.toHaveLength(3);
    await expect(s.categorias()).resolves.toEqual([]);
    await expect(s.obtener('p-arroz')).resolves.toMatchObject({ nombre: 'Arroz' });
    r.buscar.mockResolvedValueOnce(undefined);
    await expect(s.obtener('x')).rejects.toMatchObject({ status: 404 });
  });

  it('CA-13.1 crea con nombre limpio y normalizado', async () => {
    const { r, s } = crearServicio();
    await expect(s.crear(NUEVO)).resolves.toMatchObject({ etiqueta: 'Arroz · bolsa 2 lb' });
    expect(r.crear).toHaveBeenCalledWith(
      expect.objectContaining({
        nombre: 'Arroz',
        nombreNormalizado: 'arroz',
        presentacionCantidad: '2',
      }),
    );
  });

  it('CA-13.3 duplicado → 409 PRODUCTO_DUPLICADO con el existente (también en carrera)', async () => {
    const { r, s } = crearServicio();
    r.buscarDuplicado.mockResolvedValueOnce(ARROZ);
    await expect(s.crear(NUEVO)).rejects.toMatchObject({
      status: 409,
      codigo: 'PRODUCTO_DUPLICADO',
      detalle: 'Ya existe Arroz · bolsa 2 lb',
      extensiones: { existenteId: 'p-arroz', existente: 'Arroz · bolsa 2 lb' },
    });
    r.crear.mockRejectedValueOnce(new ProductoDuplicadoError());
    r.buscarDuplicado.mockResolvedValueOnce(undefined).mockResolvedValueOnce(ARROZ);
    await expect(s.crear(NUEVO)).rejects.toMatchObject({ status: 409 });
    r.crear.mockRejectedValueOnce(new Error('caída'));
    await expect(s.crear(NUEVO)).rejects.toThrow('caída');
  });

  it('CA-13.4 y demás validaciones 422', async () => {
    const { r, s } = crearServicio();
    const codigo = (extra: Partial<typeof NUEVO>) =>
      s.crear({ ...NUEVO, ...extra }).catch((e: { codigo: string }) => e.codigo);
    await expect(codigo({ presentacionCantidad: '0' })).resolves.toBe('PRESENTACION_INVALIDA');
    await expect(codigo({ nombre: ' ' })).resolves.toBe('NOMBRE_OBLIGATORIO');
    await expect(codigo({ nombre: 'x'.repeat(81) })).resolves.toBe('NOMBRE_LARGO');
    await expect(codigo({ unidadCompra: 'x'.repeat(21) })).resolves.toBe('UNIDAD_COMPRA_INVALIDA');
    r.existeCategoria.mockResolvedValueOnce(false);
    await expect(codigo({})).resolves.toBe('CATEGORIA_NO_EXISTE');
    await expect(codigo({ presentacionUnidadId: 'nada' })).resolves.toBe('UNIDAD_NO_EXISTE');
  });

  it('actualizar: 404, cambio de magnitud en uso, duplicado y éxito', async () => {
    const { r, s } = crearServicio();
    r.buscar.mockResolvedValueOnce(undefined);
    await expect(s.actualizar('x', {})).rejects.toMatchObject({ status: 404 });

    r.enUso.mockResolvedValueOnce(true);
    await expect(s.actualizar('p-arroz', { presentacionUnidadId: ML.id })).rejects.toMatchObject({
      codigo: 'MAGNITUD_EN_USO',
    });
    // Misma magnitud (kg) no necesita revisar el uso.
    r.enUso.mockClear();
    await expect(s.actualizar('p-arroz', { presentacionUnidadId: KG.id })).resolves.toBeDefined();
    expect(r.enUso).not.toHaveBeenCalled();
    // Otra magnitud sin uso se permite.
    await expect(s.actualizar('p-arroz', { presentacionUnidadId: ML.id })).resolves.toBeDefined();

    r.buscarDuplicado.mockResolvedValueOnce(ARROZ);
    await expect(s.actualizar('p-arroz', { nombre: 'Arroz' })).rejects.toMatchObject({
      status: 409,
    });
    expect(r.buscarDuplicado).toHaveBeenLastCalledWith('arroz', '2', LB.id, 'p-arroz');

    r.actualizar.mockRejectedValueOnce(new ProductoDuplicadoError());
    r.buscarDuplicado.mockResolvedValueOnce(undefined).mockResolvedValueOnce(ARROZ);
    await expect(
      s.actualizar('p-arroz', { tipo: 'AMBOS', unidadCompra: 'saco', categoriaId: 'c2' }),
    ).rejects.toMatchObject({
      status: 409,
    });
  });

  it('CA-13.2 inactivar y reactivar devuelven los platillos afectados del hogar', async () => {
    const { r, s } = crearServicio();
    await expect(s.inactivar('p-arroz', 'h1')).resolves.toMatchObject({
      platillosAfectados: [{ id: 'pl1', nombre: 'Arroz con pollo' }],
    });
    expect(r.cambiarActivo).toHaveBeenCalledWith('p-arroz', false);
    expect(r.platillosQueUsan).toHaveBeenCalledWith('p-arroz', 'h1');
    await s.reactivar('p-arroz', 'h1');
    expect(r.cambiarActivo).toHaveBeenLastCalledWith('p-arroz', true);
    r.cambiarActivo.mockResolvedValueOnce(false);
    await expect(s.inactivar('x', 'h1')).rejects.toMatchObject({ status: 404 });
  });
});
