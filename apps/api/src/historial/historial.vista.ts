import type { MenuSemanal } from '@menu/db';
import {
  aCentavos,
  deCentavos,
  diasSemanaHistorica,
  ORDEN_TIEMPOS,
  type TiempoComida,
} from '@menu/shared';
import type { CapturarSemanaDto, ConsultaHistorialDto } from './historial.dto';
import type { DetalleHistorico } from '@menu/shared';

export function filasComidasHistoricas(
  menuId: string,
  usuarioId: string,
  ahora: Date,
  detalles: readonly DetalleHistorico[],
) {
  return detalles.map((d) => ({
    ...d,
    menuId,
    origen: 'HISTORICO' as const,
    modificadoPorId: usuarioId,
    modificadoEn: ahora,
  }));
}
export function filasTiemposHistoricos(menuId: string, detalles: readonly DetalleHistorico[]) {
  return [...new Set(detalles.map((d) => d.tiempo))].map((tiempo) => ({
    menuId,
    tiempo,
    porcentaje: '0.00',
    presupuesto: '0.00',
  }));
}

export type CabeceraHistorica = Pick<
  MenuSemanal,
  'id' | 'fechaInicio' | 'fechaFin' | 'estado' | 'origen' | 'gastoReal' | 'notas' | 'version'
>;
export interface FilaComidaHistorica {
  menuId: string;
  fecha: string;
  tiempo: TiempoComida;
  platilloId: string | null;
  nombre: string | null;
  notas?: string | null;
}
export function valoresHistoricos(datos: CapturarSemanaDto, usuarioId: string, ahora: Date) {
  const gasto = datos.gastoReal == null ? null : deCentavos(aCentavos(datos.gastoReal)!);
  return {
    fechaFin: diasSemanaHistorica(datos.fechaInicio)[6]!,
    estado: 'HISTORICO' as const,
    origen: 'CAPTURA_MANUAL' as const,
    gastoReal: gasto,
    notas: datos.notas?.trim() || null,
    gastoRegistradoPorId: gasto ? usuarioId : null,
    gastoRegistradoEn: gasto ? ahora : null,
    esTransicion: false,
    desactualizado: false,
    importacionId: null,
  };
}
export function cabeceraHistorica(s: CabeceraHistorica): CabeceraHistorica {
  return {
    id: s.id,
    fechaInicio: s.fechaInicio,
    fechaFin: s.fechaFin,
    estado: s.estado,
    origen: s.origen,
    gastoReal: s.gastoReal,
    notas: s.notas,
    version: s.version,
  };
}
export function paginaHistorial(
  semanas: CabeceraHistorica[],
  detalles: FilaComidaHistorica[],
  consulta: ConsultaHistorialDto,
  total: number,
) {
  return {
    datos: semanas.map((s) => ({
      ...cabeceraHistorica(s),
      detalles: detalles
        .filter((d) => d.menuId === s.id)
        .map(({ menuId: _menuId, ...d }) => d)
        .sort(
          (a, b) =>
            a.fecha.localeCompare(b.fecha) ||
            ORDEN_TIEMPOS.indexOf(a.tiempo) - ORDEN_TIEMPOS.indexOf(b.tiempo),
        ),
    })),
    paginacion: {
      pagina: consulta.pagina,
      tamano: consulta.tamano,
      total,
      totalPaginas: Math.ceil(total / consulta.tamano),
    },
  };
}
