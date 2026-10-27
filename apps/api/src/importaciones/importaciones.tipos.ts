import type { ProteinaPrincipal, TiempoComida } from '@menu/shared';

export const LIMITE_ARCHIVO = 5 * 1024 * 1024;
export const LIMITE_FILAS = 5000;
export const COLUMNAS_MENUS = [
  'fecha',
  'dia',
  'tiempo_comida',
  'platillo',
  'proteina_principal',
  'gasto_semana_gtq',
  'notas',
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
}
