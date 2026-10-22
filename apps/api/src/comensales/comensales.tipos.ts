import type { TipoComensal } from '@menu/shared';

/** Comensal tal como lo devuelve la API (api-contrato §2.1). */
export interface VistaComensal {
  id: string;
  nombre: string;
  tipo: TipoComensal;
  /** Texto decimal de 2 decimales, p. ej. `"0.50"` (api-contrato §1.2). */
  factorPorcion: string;
  activo: boolean;
}

/** Totales del hogar sobre los comensales **activos**. */
export interface TotalesComensales {
  activos: number;
  adultos: number;
  ninos: number;
  /** Total de porciones = Σ factores de activos (RN-07, D-02), p. ej. `"3.50"`. */
  sumaFactores: string;
}

/** GET /hogar/comensales. */
export interface ListaComensales {
  comensales: VistaComensal[];
  totales: TotalesComensales;
}

/** Respuesta de crear, editar, inactivar y reactivar: el comensal y los totales recalculados. */
export interface RespuestaComensal {
  comensal: VistaComensal;
  totales: TotalesComensales;
}

/** Datos ya validados para crear un comensal. */
export interface DatosComensal {
  nombre: string;
  tipo: TipoComensal;
  factorPorcion: string;
}

/** Cambios ya validados de PATCH /hogar/comensales/{id}. */
export type CambiosComensal = Partial<DatosComensal>;
