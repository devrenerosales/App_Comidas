import type { ProteinaPrincipal, TiempoComida } from '@menu/shared';
import { ORDEN_TIEMPOS } from '@menu/shared';
import type { MenuCompleto } from './menus.repositorio';

/** Aviso por un espacio que quedó vacío (CU-05.1 E3). */
export interface AvisoMenu {
  codigo: 'SIN_SUGERENCIA';
  fecha: string;
  tiempo: TiempoComida;
  mensaje: string;
}

export type EstadoTiempoMenu = 'DENTRO_DEL_PRESUPUESTO' | 'EXCEDE' | 'COSTO_INCOMPLETO';

export interface TiempoDeMenu {
  tiempo: TiempoComida;
  porcentaje: string;
  presupuesto: string;
  costoEstimado: string | null;
  exceso: string;
  intentosAjuste: number;
  estado: EstadoTiempoMenu;
}

export interface DetalleDeMenu {
  id: string;
  fecha: string;
  tiempo: TiempoComida;
  platillo: { id: string; nombre: string; proteinaPrincipal: ProteinaPrincipal } | null;
  fijado: boolean;
  origen: string;
  puntaje: string | null;
  factores: { preferencia: string; novedad: string; ahorro: string; afinidad: string } | null;
  costoEstimado: string | null;
  costoIncompleto: boolean;
  reglasAplicadas: string[];
}

/** Menú semanal tal como lo devuelven `POST /menus/generar` y sus lecturas (api-contrato §3.1). */
export interface VistaMenu {
  id: string;
  fechaInicio: string;
  fechaFin: string;
  estado: 'BORRADOR' | 'APROBADO' | 'HISTORICO';
  desactualizado: boolean;
  version: number;
  presupuestoSemanal: string | null;
  sumaFactoresPorcion: string | null;
  pesos: { preferencia: string; novedad: string; ahorro: string; afinidad: string } | null;
  costoEstimado: string | null;
  costoIncompleto: boolean;
  excede: { monto: string; texto: string } | null;
  tiempos: TiempoDeMenu[];
  detalles: DetalleDeMenu[];
  avisos: AvisoMenu[];
}

const MENSAJE_SIN_SUGERENCIA = 'Ningún platillo cumple RN-02 y RN-03 para este día';

function estadoDelTiempo(costo: string | null, exceso: string): EstadoTiempoMenu {
  if (costo === null) return 'COSTO_INCOMPLETO';
  return Number(exceso) > 0 ? 'EXCEDE' : 'DENTRO_DEL_PRESUPUESTO';
}

/** Convierte lo guardado en la respuesta del contrato; ordena por fecha y tiempo de comida. */
export function vistaMenu({ menu, tiempos, detalles }: MenuCompleto): VistaMenu {
  const ordenados = [...detalles].sort(
    (a, b) =>
      a.fecha.localeCompare(b.fecha) ||
      ORDEN_TIEMPOS.indexOf(a.tiempo) - ORDEN_TIEMPOS.indexOf(b.tiempo),
  );
  const exceso = menu.excesoAlAprobar ?? '0';
  const pesos =
    menu.pesoPreferencia && menu.pesoNovedad && menu.pesoAhorro && menu.pesoAfinidad
      ? {
          preferencia: menu.pesoPreferencia,
          novedad: menu.pesoNovedad,
          ahorro: menu.pesoAhorro,
          afinidad: menu.pesoAfinidad,
        }
      : null;
  return {
    id: menu.id,
    fechaInicio: menu.fechaInicio,
    fechaFin: menu.fechaFin,
    estado: menu.estado,
    desactualizado: menu.desactualizado,
    version: menu.version,
    presupuestoSemanal: menu.presupuestoSemanal,
    sumaFactoresPorcion: menu.sumaFactoresPorcion,
    pesos,
    costoEstimado: menu.costoEstimado,
    costoIncompleto: menu.costoIncompleto,
    excede: Number(exceso) > 0 ? { monto: exceso, texto: `Excede por Q${exceso}` } : null,
    tiempos: [...tiempos]
      .sort((a, b) => ORDEN_TIEMPOS.indexOf(a.tiempo) - ORDEN_TIEMPOS.indexOf(b.tiempo))
      .map((t) => ({
        tiempo: t.tiempo,
        porcentaje: t.porcentaje,
        presupuesto: t.presupuesto,
        costoEstimado: t.costoEstimado,
        exceso: t.exceso,
        intentosAjuste: t.intentosAjuste,
        estado: estadoDelTiempo(t.costoEstimado, t.exceso),
      })),
    detalles: ordenados.map((d) => ({
      id: d.id,
      fecha: d.fecha,
      tiempo: d.tiempo,
      platillo:
        d.platilloId && d.platilloNombre && d.platilloProteina
          ? { id: d.platilloId, nombre: d.platilloNombre, proteinaPrincipal: d.platilloProteina }
          : null,
      fijado: d.fijado,
      origen: d.origen,
      puntaje: d.puntaje,
      factores:
        d.factorPreferencia && d.factorNovedad && d.factorAhorro && d.factorAfinidad
          ? {
              preferencia: d.factorPreferencia,
              novedad: d.factorNovedad,
              ahorro: d.factorAhorro,
              afinidad: d.factorAfinidad,
            }
          : null,
      costoEstimado: d.costoEstimado,
      costoIncompleto: d.costoIncompleto,
      reglasAplicadas: d.reglasAplicadas,
    })),
    avisos: ordenados
      .filter((d) => d.platilloId === null)
      .map((d) => ({
        codigo: 'SIN_SUGERENCIA' as const,
        fecha: d.fecha,
        tiempo: d.tiempo,
        mensaje: MENSAJE_SIN_SUGERENCIA,
      })),
  };
}
