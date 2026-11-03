import type { Diferencia, ProteinaPrincipal, TiempoComida } from '@menu/shared';
import { ORDEN_TIEMPOS, compararGasto } from '@menu/shared';
import type { MenuCompleto } from './menus.repositorio';

/** Aviso por un espacio que quedó vacío (CU-05.1 E3). */
export interface AvisoMenu {
  codigo: 'SIN_SUGERENCIA';
  fecha: string;
  tiempo: TiempoComida;
  mensaje: string;
}

/** Hasta 3 platillos más baratos para un día cuando el tiempo sigue excedido (CU-05.3 E1). */
export interface AlternativasDelDia {
  fecha: string;
  platillos: { id: string; nombre: string; costo: string }[];
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
  /** Solo en la respuesta de generar y solo si el tiempo sigue excedido. */
  alternativas?: AlternativasDelDia[];
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

/** Gasto real de la semana con su comparación (CU-06.4, api-contrato §3.3). */
export interface GastoRegistrado {
  gastoReal: string;
  nota: string | null;
  /** Gasto − costo estimado; null si el menú no tiene costo estimado. */
  diferenciaVsEstimado: Diferencia | null;
  /** Gasto − presupuesto semanal; null si el hogar no tiene presupuesto. */
  diferenciaVsPresupuesto: Diferencia | null;
  /** Null si el gasto llegó de una importación del cuaderno. */
  registradoPor: { id: string; nombre: string } | null;
  registradoEn: string | null;
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
  aprobadoPor: { id: string; nombre: string } | null;
  aprobadoEn: string | null;
  /** Lista de compras de la semana; solo existe cuando el menú está aprobado. */
  listaId: string | null;
  /** Gasto real registrado; null mientras no haya (CU-06.4). */
  gasto: GastoRegistrado | null;
  /** Suma de los precios reales anotados en la lista, para prellenar el gasto (CU-06.4 2b). */
  gastoSugerido: string | null;
  tiempos: TiempoDeMenu[];
  detalles: DetalleDeMenu[];
  avisos: AvisoMenu[];
}

/** Gasto real del menú con sus diferencias frente al estimado y al presupuesto (CA-27.1). */
export function gastoDelMenu({ menu, gastoRegistradoPor }: MenuCompleto): GastoRegistrado | null {
  if (!menu.gastoReal) return null;
  const { frenteAlEstimado, frenteAlPresupuesto } = compararGasto(
    menu.gastoReal,
    menu.costoEstimado,
    menu.presupuestoSemanal,
  );
  return {
    gastoReal: menu.gastoReal,
    nota: menu.notaGasto,
    diferenciaVsEstimado: frenteAlEstimado,
    diferenciaVsPresupuesto: frenteAlPresupuesto,
    registradoPor: gastoRegistradoPor ?? null,
    registradoEn: menu.gastoRegistradoEn ? menu.gastoRegistradoEn.toISOString() : null,
  };
}

const MENSAJE_SIN_SUGERENCIA = 'Ningún platillo cumple RN-02 y RN-03 para este día';

/**
 * Sin costo conocido → incompleto; si el costo conocido ya pasa del presupuesto → excede aunque
 * falten precios; con algún platillo sin costo no se puede afirmar que está dentro (D-18).
 */
function estadoDelTiempo(
  costo: string | null,
  exceso: string,
  conPlatilloIncompleto: boolean,
): EstadoTiempoMenu {
  if (costo === null) return 'COSTO_INCOMPLETO';
  if (Number(exceso) > 0) return 'EXCEDE';
  return conPlatilloIncompleto ? 'COSTO_INCOMPLETO' : 'DENTRO_DEL_PRESUPUESTO';
}

/** Convierte lo guardado en la respuesta del contrato; ordena por fecha y tiempo de comida. */
export function vistaMenu(completo: MenuCompleto): VistaMenu {
  const { menu, tiempos, detalles, aprobadoPor, listaId, gastoSugerido } = completo;
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
    aprobadoPor: aprobadoPor ?? null,
    aprobadoEn: menu.aprobadoEn ? menu.aprobadoEn.toISOString() : null,
    listaId: listaId ?? null,
    gasto: gastoDelMenu(completo),
    gastoSugerido: gastoSugerido ?? null,
    tiempos: [...tiempos]
      .sort((a, b) => ORDEN_TIEMPOS.indexOf(a.tiempo) - ORDEN_TIEMPOS.indexOf(b.tiempo))
      .map((t) => ({
        tiempo: t.tiempo,
        porcentaje: t.porcentaje,
        presupuesto: t.presupuesto,
        costoEstimado: t.costoEstimado,
        exceso: t.exceso,
        intentosAjuste: t.intentosAjuste,
        estado: estadoDelTiempo(
          t.costoEstimado,
          t.exceso,
          detalles.some((d) => d.tiempo === t.tiempo && d.platilloId !== null && d.costoIncompleto),
        ),
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
