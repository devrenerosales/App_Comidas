import type { ProteinaPrincipal, TiempoComida } from '@menu/shared';

export const LIMITE_ARCHIVO = 5 * 1024 * 1024;
export const LIMITE_FILAS = 5000;
/** Similitud mínima (pg_trgm, 0 a 1) para proponer "Asociar a" en lugar de "Crear nuevo" (CU-04.3). */
export const UMBRAL_SIMILITUD = 0.8;
export const COLUMNAS_MENUS = [
  'fecha',
  'dia',
  'tiempo_comida',
  'platillo',
  'proteina_principal',
  'gasto_semana_gtq',
  'notas',
] as const;
export const COLUMNAS_LISTAS = [
  'fecha',
  'lista',
  'tipo',
  'producto',
  'cantidad',
  'unidad_compra',
  'presentacion',
  'precio_gtq',
  'supermercado',
] as const;
export interface ErrorFila {
  columna: string;
  motivo: string;
}
export interface FilaMenu {
  numeroFila: number;
  fecha: string;
  semanaInicio: string | null;
  tiempo: TiempoComida;
  platillo: string;
  nombreNormalizado: string;
  proteinaPrincipal: ProteinaPrincipal | null;
  gasto: string | null;
  notas: string;
  errores: ErrorFila[];
}
export interface FilaLista {
  numeroFila: number;
  fecha: string;
  lista: string;
  tipo: 'DESPENSA' | 'COMPRAS';
  producto: string;
  nombreNormalizado: string;
  cantidad: string;
  unidadCompra: string;
  /** Contenido del empaque ("2 lb"); null usa 1 unidad al crear el producto. */
  presentacion: { cantidad: string; unidad: string } | null;
  precio: string | null;
  supermercado: string;
  errores: ErrorFila[];
}
export interface ArchivoImportacion {
  originalname: string;
  buffer: Buffer;
  size: number;
}
export interface InstantaneaSemana {
  id: string;
  version: number;
  estado: string;
  gastoReal: string | null;
  fechaInicio: string;
  fechaFin: string;
  protegida: boolean;
}
export interface ResumenLista {
  lista: string;
  tipo: 'DESPENSA' | 'COMPRAS';
  productos: number;
  /** Suma de precio_gtq; null si ninguna fila lo trae. */
  total: string | null;
  /** Productos que no están en el catálogo y se crearían al confirmar. */
  nuevos: number;
}
export interface GastoSemanal {
  semanas: number;
  minimo: string;
  maximo: string;
  promedio: string;
}
export interface MetadatosVista {
  revision: string;
  versiones: Record<string, InstantaneaSemana>;
}
export interface ReporteImportacion {
  semanasCreadas: number;
  reemplazadas: number;
  omitidas: number;
  platillosCreados: number;
  aliasCreados: number;
  despensaCargada: number;
  productosCreados: number;
  /** Gasto de las semanas importadas que lo traen; null si ninguna (CA-18.1). */
  gastoSemanal: GastoSemanal | null;
  listas: ResumenLista[];
}
