/** Datos y API simulada del catálogo para las pruebas de la web (HU-11..13). */
import { vi } from 'vitest';
import type {
  ApiCatalogo,
  Categoria,
  DetallePlatillo,
  Producto,
  ResumenPlatillo,
  Unidad,
  VistaPrevia,
} from '../api/catalogo';

export const ID_PLATILLO = '11111111-1111-4111-8111-111111111111';

const unidad = (
  id: string,
  codigo: string,
  nombre: string,
  magnitud: Unidad['magnitud'],
  factorBase: string | null,
): Unidad => ({
  id,
  codigo,
  nombre,
  magnitud,
  factorBase,
});

export const LB = unidad('u-lb', 'lb', 'libra', 'MASA', '453.592370');
export const G = unidad('u-g', 'g', 'gramo', 'MASA', '1');
export const ML = unidad('u-ml', 'ml', 'mililitro', 'VOLUMEN', '1');
export const TAZA = unidad('u-taza', 'taza', 'taza', 'VOLUMEN', '240');
export const UNIDADES: Unidad[] = [G, LB, ML, TAZA];

export const CATEGORIAS: Categoria[] = [
  { id: 'c-carnes', codigo: 'carnes', nombre: 'Carnes', orden: 1 },
  { id: 'c-lacteos', codigo: 'lacteos', nombre: 'Lácteos', orden: 2 },
  { id: 'c-granos', codigo: 'granos', nombre: 'Granos', orden: 5 },
];

export function producto(nombre: string, u: Unidad, extra: Partial<Producto> = {}): Producto {
  return {
    id: `p-${nombre.toLowerCase().replace(/\s+/g, '-')}`,
    nombre,
    tipo: 'INGREDIENTE',
    categoria: { id: 'c-carnes', codigo: 'carnes', nombre: 'Carnes' },
    unidadCompra: u.codigo,
    presentacion: { cantidad: '1.000', unidad: u },
    etiqueta: `${nombre} · ${u.codigo} 1 ${u.codigo}`,
    activo: true,
    ...extra,
  };
}

export const PECHUGA = producto('Pechuga de pollo', LB);
export const CREMA = producto('Crema', ML, { etiqueta: 'Crema · bolsa 500 ml' });

export const RESUMEN: ResumenPlatillo = {
  id: ID_PLATILLO,
  nombre: 'Pepián de pollo',
  tiempos: ['ALMUERZO'],
  proteinaPrincipal: 'POLLO',
  etiquetas: ['típico', 'fin de semana'],
  porcionesBase: 4,
  favorito: false,
  incompleto: true,
  activo: true,
  calificacionPromedio: null,
  ingredientesInactivos: 0,
};

export const PLATILLO: DetallePlatillo = { ...RESUMEN, ingredientes: [], advertencias: [] };

const ingrediente = (p: Producto, cantidad: string) => ({
  id: `i-${p.id}`,
  producto: {
    id: p.id,
    nombre: p.nombre,
    etiqueta: p.etiqueta,
    activo: p.activo,
    presentacionUnidad: p.presentacion.unidad,
  },
  cantidad,
  unidad: p.presentacion.unidad,
});

export const POLLO_EN_CREMA: DetallePlatillo = {
  ...PLATILLO,
  nombre: 'Pollo en crema',
  incompleto: false,
  ingredientes: [ingrediente(PECHUGA, '2.000'), ingrediente(CREMA, '250.000')],
};

export function vistaPrevia(
  suma: string,
  escaladas: [string, string],
  origen: VistaPrevia['origen'] = 'COMENSALES',
): VistaPrevia {
  return {
    porcionesBase: 4,
    sumaFactores: suma,
    origen,
    ingredientes: [
      {
        productoId: PECHUGA.id,
        nombre: 'Pechuga de pollo',
        cantidadBase: '2.000',
        cantidadEscalada: escaladas[0],
        unidad: 'lb',
      },
      {
        productoId: CREMA.id,
        nombre: 'Crema',
        cantidadBase: '250.000',
        cantidadEscalada: escaladas[1],
        unidad: 'ml',
      },
    ],
  };
}

export function pagina<T>(datos: T[]) {
  return {
    datos,
    paginacion: { pagina: 1, tamano: 100, total: datos.length, totalPaginas: 1 },
  };
}

export function apiCatalogoFalsa(extra: Partial<Record<keyof ApiCatalogo, unknown>> = {}) {
  return {
    listarUnidades: vi.fn().mockResolvedValue(UNIDADES),
    listarCategorias: vi.fn().mockResolvedValue(CATEGORIAS),
    listarProductos: vi.fn().mockResolvedValue(pagina([PECHUGA, CREMA])),
    crearProducto: vi.fn(),
    inactivarProducto: vi
      .fn()
      .mockResolvedValue({ producto: { ...CREMA, activo: false }, platillosAfectados: [] }),
    reactivarProducto: vi.fn().mockResolvedValue({ producto: CREMA }),
    listarPlatillos: vi.fn().mockResolvedValue(pagina([RESUMEN])),
    obtenerPlatillo: vi.fn().mockResolvedValue(PLATILLO),
    crearPlatillo: vi.fn().mockResolvedValue(PLATILLO),
    actualizarPlatillo: vi.fn().mockResolvedValue(PLATILLO),
    inactivarPlatillo: vi.fn().mockResolvedValue({ ...PLATILLO, activo: false }),
    reactivarPlatillo: vi.fn().mockResolvedValue(PLATILLO),
    guardarIngredientes: vi.fn(),
    vistaPrevia: vi.fn().mockResolvedValue({
      porcionesBase: 4,
      sumaFactores: '4.00',
      origen: 'PORCIONES_BASE',
      ingredientes: [],
    }),
    ...extra,
  };
}
