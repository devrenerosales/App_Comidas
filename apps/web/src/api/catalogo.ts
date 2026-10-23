/** Endpoints del catálogo: productos, platillos e ingredientes (M03 · HU-11..13, api-contrato §2.3). */
import type { MagnitudUnidad, ProteinaPrincipal, TiempoComida, TipoProducto } from '@menu/shared';
import type { ClienteHttp } from './cliente';

export interface Unidad {
  id: string;
  codigo: string;
  nombre: string;
  magnitud: MagnitudUnidad;
  factorBase: string | null;
}

export interface Categoria {
  id: string;
  codigo: string;
  nombre: string;
  orden: number;
}

export interface Producto {
  id: string;
  nombre: string;
  tipo: TipoProducto;
  categoria: { id: string; codigo: string; nombre: string };
  unidadCompra: string;
  presentacion: { cantidad: string; unidad: Unidad };
  etiqueta: string;
  activo: boolean;
}

export interface Pagina<T> {
  datos: T[];
  paginacion: { pagina: number; tamano: number; total: number; totalPaginas: number };
}

export interface ResumenPlatillo {
  id: string;
  nombre: string;
  tiempos: TiempoComida[];
  proteinaPrincipal: ProteinaPrincipal;
  etiquetas: string[];
  porcionesBase: number;
  favorito: boolean;
  incompleto: boolean;
  activo: boolean;
  calificacionPromedio: string | null;
  ingredientesInactivos: number;
}

export interface IngredientePlatillo {
  id: string;
  producto: {
    id: string;
    nombre: string;
    etiqueta: string;
    activo: boolean;
    presentacionUnidad: Unidad;
  };
  cantidad: string;
  unidad: Unidad;
}

export interface DetallePlatillo extends ResumenPlatillo {
  ingredientes: IngredientePlatillo[];
  advertencias: { codigo: string; mensaje: string; productoId: string }[];
}

export interface VistaPrevia {
  porcionesBase: number;
  sumaFactores: string;
  origen: 'COMENSALES' | 'PARAMETRO' | 'PORCIONES_BASE';
  ingredientes: {
    productoId: string;
    nombre: string;
    cantidadBase: string;
    cantidadEscalada: string;
    unidad: string;
  }[];
}

export interface FiltrosPlatillos {
  q?: string;
  tiempo?: TiempoComida | '';
  proteina?: ProteinaPrincipal | '';
  estado?: 'ACTIVO' | 'INACTIVO' | 'INCOMPLETO';
}

export interface FiltrosProductos {
  q?: string;
  tipo?: TipoProducto | '';
  categoria?: string;
  activo?: 'true' | 'false' | 'todos';
  tamano?: number;
}

export interface DatosPlatillo {
  nombre?: string;
  tiempos?: TiempoComida[];
  proteinaPrincipal?: ProteinaPrincipal;
  etiquetas?: string[];
}

export interface DatosProducto {
  nombre: string;
  tipo: TipoProducto;
  categoriaId: string;
  unidadCompra: string;
  presentacionCantidad: string;
  presentacionUnidadId: string;
}

export interface ItemIngrediente {
  productoId: string;
  cantidad: string;
  unidadId: string;
}

/** `?a=1&b=2` sin los valores vacíos. */
export function consulta(parametros: object): string {
  const pares = Object.entries(parametros).filter(
    ([, v]) => v !== undefined && v !== null && v !== '',
  );
  if (pares.length === 0) return '';
  return `?${new URLSearchParams(pares.map(([k, v]) => [k, String(v)])).toString()}`;
}

const id = (valor: string) => encodeURIComponent(valor);

export function crearApiCatalogo(cliente: Pick<ClienteHttp, 'peticion'>) {
  return {
    listarUnidades: () => cliente.peticion<Unidad[]>('/unidades'),
    listarCategorias: () => cliente.peticion<Categoria[]>('/categorias'),
    listarProductos: (filtros: FiltrosProductos = {}) =>
      cliente.peticion<Pagina<Producto>>(`/productos${consulta(filtros)}`),
    crearProducto: (datos: DatosProducto) =>
      cliente.peticion<Producto>('/productos', { metodo: 'POST', cuerpo: datos }),
    inactivarProducto: (productoId: string) =>
      cliente.peticion<{
        producto: Producto;
        platillosAfectados: { id: string; nombre: string }[];
      }>(`/productos/${id(productoId)}/inactivar`, { metodo: 'POST' }),
    reactivarProducto: (productoId: string) =>
      cliente.peticion<{ producto: Producto }>(`/productos/${id(productoId)}/reactivar`, {
        metodo: 'POST',
      }),
    listarPlatillos: (filtros: FiltrosPlatillos = {}) =>
      cliente.peticion<Pagina<ResumenPlatillo>>(
        `/platillos${consulta({ tamano: 100, ...filtros })}`,
      ),
    obtenerPlatillo: (platilloId: string) =>
      cliente.peticion<DetallePlatillo>(`/platillos/${id(platilloId)}`),
    crearPlatillo: (datos: DatosPlatillo) =>
      cliente.peticion<DetallePlatillo>('/platillos', { metodo: 'POST', cuerpo: datos }),
    actualizarPlatillo: (platilloId: string, datos: DatosPlatillo) =>
      cliente.peticion<DetallePlatillo>(`/platillos/${id(platilloId)}`, {
        metodo: 'PATCH',
        cuerpo: datos,
      }),
    inactivarPlatillo: (platilloId: string) =>
      cliente.peticion<DetallePlatillo>(`/platillos/${id(platilloId)}/inactivar`, {
        metodo: 'POST',
      }),
    reactivarPlatillo: (platilloId: string) =>
      cliente.peticion<DetallePlatillo>(`/platillos/${id(platilloId)}/reactivar`, {
        metodo: 'POST',
      }),
    guardarIngredientes: (
      platilloId: string,
      porcionesBase: number,
      ingredientes: ItemIngrediente[],
    ) =>
      cliente.peticion<DetallePlatillo & { vistaPrevia: VistaPrevia }>(
        `/platillos/${id(platilloId)}/ingredientes`,
        { metodo: 'PUT', cuerpo: { porcionesBase, ingredientes } },
      ),
    vistaPrevia: (platilloId: string, sumaFactores?: number) =>
      cliente.peticion<VistaPrevia>(
        `/platillos/${id(platilloId)}/vista-previa${consulta({ sumaFactores })}`,
      ),
  };
}

export type ApiCatalogo = ReturnType<typeof crearApiCatalogo>;
