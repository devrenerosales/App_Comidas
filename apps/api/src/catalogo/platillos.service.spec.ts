import type { Platillo } from '@menu/db';
import {
  PlatilloDuplicadoError,
  type FilaIngrediente,
  type PlatillosRepositorio,
} from './platillos.repositorio';
import { PlatillosService, calcularVistaPrevia, vistaIngrediente } from './platillos.service';
import type { FilaProducto, ProductosRepositorio } from './productos.repositorio';

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
const TAZA = {
  id: 'u-taza',
  codigo: 'taza',
  nombre: 'taza',
  magnitud: 'VOLUMEN' as const,
  factorBase: '240',
};

const PLATILLO: Platillo = {
  id: 'pl1',
  hogarId: 'h1',
  nombre: 'Pollo en crema',
  nombreNormalizado: 'pollo en crema',
  proteinaPrincipal: 'POLLO',
  porcionesBase: 4,
  activo: true,
  favorito: false,
  incompleto: false,
  calificacionPromedio: null,
  calificacionConteo: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const producto = (
  id: string,
  nombre: string,
  u: typeof LB | typeof ML,
  activo = true,
): FilaProducto => ({
  id,
  nombre,
  tipo: 'INGREDIENTE',
  unidadCompra: 'lb',
  presentacionCantidad: '1.000',
  activo,
  categoriaId: 'c',
  categoriaCodigo: 'carnes',
  categoriaNombre: 'Carnes',
  unidadId: u.id,
  unidadCodigo: u.codigo,
  unidadNombre: u.nombre,
  unidadMagnitud: u.magnitud,
  unidadFactorBase: u.factorBase,
});

const ingrediente = (
  p: FilaProducto,
  cantidad: string,
  u: typeof LB | typeof ML,
): FilaIngrediente => ({
  id: `i-${p.id}`,
  cantidad,
  producto: p,
  unidadId: u.id,
  unidadCodigo: u.codigo,
  unidadNombre: u.nombre,
  unidadMagnitud: u.magnitud,
  unidadFactorBase: u.factorBase,
});

const PECHUGA = producto('p-pechuga', 'Pechuga de pollo', LB);
const CREMA = producto('p-crema', 'Crema', ML, false);

function repos() {
  const platillos = {
    listar: jest.fn().mockResolvedValue({ filas: [PLATILLO], total: 1 }),
    buscar: jest.fn().mockResolvedValue(PLATILLO),
    buscarPorNombre: jest.fn().mockResolvedValue(undefined),
    tiempos: jest.fn().mockResolvedValue(new Map([['pl1', ['ALMUERZO']]])),
    etiquetas: jest.fn().mockResolvedValue(new Map([['pl1', ['típico']]])),
    ingredientesInactivos: jest.fn().mockResolvedValue(new Map([['pl1', 1]])),
    ingredientes: jest
      .fn()
      .mockResolvedValue([ingrediente(PECHUGA, '2.000', LB), ingrediente(CREMA, '250.000', ML)]),
    crear: jest.fn().mockResolvedValue('pl1'),
    actualizar: jest.fn().mockResolvedValue(undefined),
    cambiarActivo: jest.fn().mockResolvedValue(true),
    reemplazarIngredientes: jest.fn().mockResolvedValue(undefined),
    productosParaIngredientes: jest.fn().mockResolvedValue(
      new Map([
        [
          'p-pechuga',
          {
            id: 'p-pechuga',
            nombre: 'Pechuga de pollo',
            activo: true,
            magnitud: 'MASA',
            unidadCodigo: 'lb',
            equivalencias: [],
          },
        ],
        [
          'p-crema',
          {
            id: 'p-crema',
            nombre: 'Crema',
            activo: false,
            magnitud: 'VOLUMEN',
            unidadCodigo: 'ml',
            equivalencias: [],
          },
        ],
        [
          'p-queso',
          {
            id: 'p-queso',
            nombre: 'Queso',
            activo: false,
            magnitud: 'MASA',
            unidadCodigo: 'lb',
            equivalencias: [],
          },
        ],
        [
          'p-arroz',
          {
            id: 'p-arroz',
            nombre: 'Arroz',
            activo: true,
            magnitud: 'MASA',
            unidadCodigo: 'lb',
            equivalencias: ['taza'],
          },
        ],
      ]),
    ),
    sumaFactores: jest.fn().mockResolvedValue(2.5),
  };
  const productos = { unidades: jest.fn().mockResolvedValue([LB, ML, TAZA]) };
  const s = new PlatillosService(
    platillos as unknown as PlatillosRepositorio,
    productos as unknown as ProductosRepositorio,
  );
  return { platillos, s };
}

const CONSULTA = { estado: 'ACTIVO' as const, pagina: 1, tamano: 20 };

describe('vista previa RN-07', () => {
  it('CA-12.5 Σ 2.5 con 4 porciones: 2 lb → 1.250 y 250 ml → 156.250', () => {
    const ingredientes = [ingrediente(PECHUGA, '2.000', LB), ingrediente(CREMA, '250.000', ML)].map(
      vistaIngrediente,
    );
    expect(calcularVistaPrevia(4, 2.5, 'COMENSALES', ingredientes)).toEqual({
      porcionesBase: 4,
      sumaFactores: '2.50',
      origen: 'COMENSALES',
      ingredientes: [
        {
          productoId: 'p-pechuga',
          nombre: 'Pechuga de pollo',
          cantidadBase: '2.000',
          cantidadEscalada: '1.250',
          unidad: 'lb',
        },
        {
          productoId: 'p-crema',
          nombre: 'Crema',
          cantidadBase: '250.000',
          cantidadEscalada: '156.250',
          unidad: 'ml',
        },
      ],
    });
  });

  it('CA-12.1 Σ 6.0: 2 lb → 3.000 y 250 ml → 375.000', () => {
    const vista = calcularVistaPrevia(
      4,
      6,
      'PARAMETRO',
      [ingrediente(PECHUGA, '2', LB), ingrediente(CREMA, '250', ML)].map(vistaIngrediente),
    );
    expect(vista.ingredientes.map((i) => i.cantidadEscalada)).toEqual(['3.000', '375.000']);
  });
});

describe('PlatillosService (HU-11)', () => {
  it('lista normalizando texto y etiqueta', async () => {
    const { platillos, s } = repos();
    const pagina = await s.listar('h1', {
      ...CONSULTA,
      q: 'PEPIÁN',
      etiqueta: ' Típico ',
      tiempo: 'ALMUERZO',
    });
    expect(platillos.listar).toHaveBeenCalledWith(
      'h1',
      expect.objectContaining({ q: 'pepian', etiqueta: 'tipico', tiempo: 'ALMUERZO' }),
      1,
      20,
    );
    expect(pagina.datos[0]).toMatchObject({
      tiempos: ['ALMUERZO'],
      etiquetas: ['típico'],
      ingredientesInactivos: 1,
    });
    await s.listar('h1', CONSULTA);
    expect(platillos.listar).toHaveBeenLastCalledWith(
      'h1',
      expect.objectContaining({ q: undefined, etiqueta: undefined }),
      1,
      20,
    );
    platillos.tiempos.mockResolvedValueOnce(new Map());
    platillos.etiquetas.mockResolvedValueOnce(new Map());
    platillos.ingredientesInactivos.mockResolvedValueOnce(new Map());
    expect((await s.listar('h1', CONSULTA)).datos[0]).toMatchObject({
      tiempos: [],
      etiquetas: [],
      ingredientesInactivos: 0,
    });
  });

  it('CA-13.2 obtener muestra "Ingrediente inactivo: Crema"; 404 si es de otro hogar', async () => {
    const { platillos, s } = repos();
    const detalle = await s.obtener('h1', 'pl1');
    expect(detalle.advertencias).toEqual([
      {
        codigo: 'INGREDIENTE_INACTIVO',
        mensaje: 'Ingrediente inactivo: Crema',
        productoId: 'p-crema',
      },
    ]);
    platillos.buscar.mockResolvedValueOnce(undefined);
    await expect(s.obtener('h2', 'pl1')).rejects.toMatchObject({ status: 404 });
  });

  it('CA-11.1 crea con tiempos en orden, proteína por defecto OTRA y etiquetas sin repetir', async () => {
    const { platillos, s } = repos();
    await s.crear('h1', {
      nombre: ' Pepián  de pollo ',
      tiempos: ['CENA', 'ALMUERZO'],
      etiquetas: ['típico', 'Tipico'],
    });
    expect(platillos.crear).toHaveBeenCalledWith(
      'h1',
      {
        nombre: 'Pepián de pollo',
        nombreNormalizado: 'pepian de pollo',
        proteinaPrincipal: 'OTRA',
      },
      ['ALMUERZO', 'CENA'],
      [{ nombre: 'típico', nombreNormalizado: 'tipico' }],
    );
  });

  it('CA-11.3 duplicado → 409 "Ya existe el platillo Carne guisada" (también en carrera)', async () => {
    const { platillos, s } = repos();
    platillos.buscarPorNombre.mockResolvedValueOnce({ id: 'pl9', nombre: 'Carne guisada' });
    await expect(
      s.crear('h1', { nombre: 'carne GUISADA', tiempos: ['ALMUERZO'] }),
    ).rejects.toMatchObject({
      status: 409,
      codigo: 'PLATILLO_DUPLICADO',
      detalle: 'Ya existe el platillo Carne guisada',
      extensiones: { existenteId: 'pl9', existenteNombre: 'Carne guisada' },
    });
    platillos.crear.mockRejectedValueOnce(new PlatilloDuplicadoError());
    platillos.buscarPorNombre
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ id: 'pl9', nombre: 'Carne guisada' });
    await expect(
      s.crear('h1', { nombre: 'Carne guisada', tiempos: ['ALMUERZO'] }),
    ).rejects.toMatchObject({ status: 409 });
    platillos.crear.mockRejectedValueOnce(new Error('caída'));
    await expect(s.crear('h1', { nombre: 'Carne guisada', tiempos: ['ALMUERZO'] })).rejects.toThrow(
      'caída',
    );
  });

  it('CA-11.4 sin tiempo → 422 SIN_TIEMPO; nombre y etiquetas inválidos', async () => {
    const { s } = repos();
    const codigo = (dto: Record<string, unknown>) =>
      s.crear('h1', { tiempos: ['ALMUERZO'], ...dto }).catch((e: { codigo: string }) => e.codigo);
    await expect(codigo({ nombre: 'Chile relleno', tiempos: [] })).resolves.toBe('SIN_TIEMPO');
    await expect(codigo({ nombre: 'Chile relleno', tiempos: undefined })).resolves.toBe(
      'SIN_TIEMPO',
    );
    await expect(codigo({})).resolves.toBe('NOMBRE_OBLIGATORIO');
    await expect(codigo({ nombre: 'x'.repeat(81) })).resolves.toBe('NOMBRE_LARGO');
    await expect(
      codigo({ nombre: 'a', etiquetas: Array.from({ length: 11 }, (_, i) => `e${i}`) }),
    ).resolves.toBe('MAX_ETIQUETAS');
    await expect(codigo({ nombre: 'a', etiquetas: ['x'.repeat(31)] })).resolves.toBe(
      'ETIQUETA_LARGA',
    );
  });

  it('actualizar parcial, duplicado y 404', async () => {
    const { platillos, s } = repos();
    await s.actualizar('h1', 'pl1', { proteinaPrincipal: 'RES', favorito: true });
    expect(platillos.actualizar).toHaveBeenCalledWith(
      'h1',
      'pl1',
      { proteinaPrincipal: 'RES', favorito: true },
      undefined,
      undefined,
    );
    platillos.buscarPorNombre.mockResolvedValueOnce({ id: 'pl9', nombre: 'Carne guisada' });
    await expect(s.actualizar('h1', 'pl1', { nombre: 'Carne guisada' })).rejects.toMatchObject({
      status: 409,
    });
    expect(platillos.buscarPorNombre).toHaveBeenLastCalledWith('h1', 'carne guisada', 'pl1');
    platillos.actualizar.mockRejectedValueOnce(new PlatilloDuplicadoError());
    platillos.buscarPorNombre
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ id: 'pl9', nombre: 'X' });
    await expect(s.actualizar('h1', 'pl1', { nombre: 'X' })).rejects.toMatchObject({ status: 409 });
    platillos.actualizar.mockRejectedValueOnce(new PlatilloDuplicadoError());
    await expect(s.actualizar('h1', 'pl1', { tiempos: ['CENA'] })).rejects.toBeInstanceOf(
      PlatilloDuplicadoError,
    );
    platillos.buscar.mockResolvedValueOnce(undefined);
    await expect(s.actualizar('h2', 'pl1', {})).rejects.toMatchObject({ status: 404 });
  });

  it('CA-11.2 inactivar y reactivar; 404 si no es del hogar', async () => {
    const { platillos, s } = repos();
    await s.inactivar('h1', 'pl1');
    expect(platillos.cambiarActivo).toHaveBeenCalledWith('h1', 'pl1', false);
    await s.reactivar('h1', 'pl1');
    expect(platillos.cambiarActivo).toHaveBeenLastCalledWith('h1', 'pl1', true);
    platillos.cambiarActivo.mockResolvedValue(false);
    await expect(s.inactivar('h2', 'pl1')).rejects.toMatchObject({ status: 404 });
    await expect(s.reactivar('h2', 'pl1')).rejects.toMatchObject({ status: 404 });
  });
});

describe('PlatillosService (HU-12)', () => {
  const item = (productoId: string, cantidad: string, unidadId: string) => ({
    productoId,
    cantidad,
    unidadId,
  });

  it('CA-12.1 guarda y devuelve la vista previa con Σ de los comensales', async () => {
    const { platillos, s } = repos();
    platillos.sumaFactores.mockResolvedValueOnce(6);
    const res = await s.guardarIngredientes('h1', 'pl1', {
      porcionesBase: 4,
      ingredientes: [item('p-pechuga', '2', LB.id), item('p-crema', '250', ML.id)],
    });
    expect(platillos.reemplazarIngredientes).toHaveBeenCalledWith('h1', 'pl1', 4, [
      { productoId: 'p-pechuga', cantidad: '2', unidadId: LB.id },
      { productoId: 'p-crema', cantidad: '250', unidadId: ML.id },
    ]);
    expect(res.vistaPrevia).toMatchObject({ sumaFactores: '6.00', origen: 'COMENSALES' });
    expect(res.vistaPrevia.ingredientes.map((i) => i.cantidadEscalada)).toEqual([
      '3.000',
      '375.000',
    ]);
  });

  it('CA-12.3 / CA-12.4 / E3: errores por ítem con su campo', async () => {
    const { platillos, s } = repos();
    const error = (ingredientes: ReturnType<typeof item>[], porcionesBase = 4) =>
      s
        .guardarIngredientes('h1', 'pl1', { porcionesBase, ingredientes })
        .catch((e: { codigo: string; extensiones: unknown }) => e);
    await expect(error([item('p-pechuga', '500', ML.id)])).resolves.toMatchObject({
      codigo: 'UNIDAD_INCOMPATIBLE',
      detalle: 'La unidad ml no es compatible con lb',
      extensiones: { errores: [{ campo: 'ingredientes.0.unidadId' }] },
    });
    await expect(error([item('p-pechuga', '0', LB.id)])).resolves.toMatchObject({
      codigo: 'CANTIDAD_INVALIDA',
      detalle: 'La cantidad debe ser mayor que 0',
    });
    await expect(
      error([item('p-pechuga', '1', LB.id), item('p-pechuga', '1', LB.id)]),
    ).resolves.toMatchObject({
      codigo: 'PRODUCTO_REPETIDO',
    });
    await expect(error([item('p-nada', '1', LB.id)])).resolves.toMatchObject({
      codigo: 'PRODUCTO_NO_EXISTE',
    });
    await expect(error([item('p-queso', '1', LB.id)])).resolves.toMatchObject({
      codigo: 'PRODUCTO_INACTIVO',
    });
    await expect(error([item('p-pechuga', '1', 'u-nada')])).resolves.toMatchObject({
      codigo: 'UNIDAD_NO_EXISTE',
    });
    await expect(error([], 0)).resolves.toMatchObject({ codigo: 'PORCIONES_INVALIDAS' });
    await expect(error([], 21)).resolves.toMatchObject({ codigo: 'PORCIONES_INVALIDAS' });
    await expect(error([], 1.5)).resolves.toMatchObject({ codigo: 'PORCIONES_INVALIDAS' });
    expect(platillos.reemplazarIngredientes).not.toHaveBeenCalled();
  });

  it('la crema inactiva que ya estaba se conserva; la equivalencia taza → lb se acepta', async () => {
    const { platillos, s } = repos();
    await s.guardarIngredientes('h1', 'pl1', {
      porcionesBase: 4,
      ingredientes: [item('p-crema', '250', ML.id), item('p-arroz', '1', TAZA.id)],
    });
    expect(platillos.reemplazarIngredientes).toHaveBeenCalled();
    platillos.buscar.mockResolvedValueOnce(undefined);
    await expect(
      s.guardarIngredientes('h2', 'pl1', { porcionesBase: 4, ingredientes: [] }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('CA-12.5 vista previa: comensales, parámetro o porciones base sin comensales', async () => {
    const { platillos, s } = repos();
    await expect(s.vistaPrevia('h1', 'pl1')).resolves.toMatchObject({
      sumaFactores: '2.50',
      origen: 'COMENSALES',
    });
    await expect(s.vistaPrevia('h1', 'pl1', 8)).resolves.toMatchObject({
      sumaFactores: '8.00',
      origen: 'PARAMETRO',
    });
    platillos.sumaFactores.mockResolvedValueOnce(0);
    await expect(s.vistaPrevia('h1', 'pl1')).resolves.toMatchObject({
      sumaFactores: '4.00',
      origen: 'PORCIONES_BASE',
    });
  });
});
