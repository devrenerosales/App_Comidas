/** Endpoints de la despensa del hogar (M07 · CU-07.2, HU-29, api-contrato §2.7). */
import type { FrecuenciaDespensa } from '@menu/shared';
import type { ClienteHttp } from './cliente';

/** Un producto recurrente del hogar y cuándo vuelve a tocar en la lista. */
export interface ProductoDespensa {
  id: string;
  producto: { id: string; nombre: string; etiqueta: string };
  /** Presentaciones de compra, con 3 decimales ("2.000"). */
  cantidad: string;
  frecuencia: FrecuenciaDespensa;
  ultimaInclusionSemana: string | null;
  /** Semana en que volverá a tocar; null si toca en la primera lista. */
  proximaInclusion: string | null;
  /** Toca en la lista de la próxima semana a planificar. */
  tocaEstaSemana: boolean;
  notas: string | null;
}

export interface DatosDespensa {
  productoId: string;
  cantidad: string;
  frecuencia: FrecuenciaDespensa;
  notas?: string;
}

export type CambiosDespensa = Partial<Omit<DatosDespensa, 'productoId'>>;

const id = (valor: string) => encodeURIComponent(valor);

export function crearApiDespensa(cliente: Pick<ClienteHttp, 'peticion'>) {
  return {
    listar: () => cliente.peticion<ProductoDespensa[]>('/despensa'),
    agregar: (datos: DatosDespensa) =>
      cliente.peticion<ProductoDespensa>('/despensa', { metodo: 'POST', cuerpo: datos }),
    actualizar: (despensaId: string, cambios: CambiosDespensa) =>
      cliente.peticion<ProductoDespensa>(`/despensa/${id(despensaId)}`, {
        metodo: 'PATCH',
        cuerpo: cambios,
      }),
    /** Baja lógica: el producto deja de entrar a las listas. */
    quitar: (despensaId: string) =>
      cliente.peticion<void>(`/despensa/${id(despensaId)}`, { metodo: 'DELETE' }),
  };
}

export type ApiDespensa = ReturnType<typeof crearApiDespensa>;
