import { deCentavos } from './configuracion';
import { ORDEN_TIEMPOS, type TiempoComida } from './enums';

/** Lo que el resumen de costos necesita del menú (lo comparten la API y la interfaz). */
export interface MenuParaCostos {
  presupuestoSemanal: string | null;
  costoEstimado: string | null;
  costoIncompleto: boolean;
  tiempos: {
    tiempo: TiempoComida;
    presupuesto: string;
    costoEstimado: string | null;
    exceso: string;
    estado: 'DENTRO_DEL_PRESUPUESTO' | 'EXCEDE' | 'COSTO_INCOMPLETO';
  }[];
  detalles: {
    fecha: string;
    tiempo: TiempoComida;
    platillo: object | null;
    costoEstimado: string | null;
    costoIncompleto: boolean;
  }[];
}

export interface CostoDeTiempo {
  tiempo: TiempoComida;
  costo: string | null;
  presupuesto: string;
  exceso: string;
  excede: boolean;
  estado: MenuParaCostos['tiempos'][number]['estado'];
}

export interface CostoDeDia {
  fecha: string;
  /** Suma de lo conocido del día; `null` si ningún espacio tiene costo. */
  costo: string | null;
  incompleto: boolean;
  tiempos: { tiempo: TiempoComida; costo: string | null; incompleto: boolean }[];
}

/** Costo del menú frente al presupuesto: total, por tiempo y por día (CU-06.3, api-contrato §3). */
export interface CostosDelMenu {
  total: string | null;
  /** Presupuesto semanal; `null` si el hogar no lo configuró (E1: solo se muestran los costos). */
  presupuesto: string | null;
  /** Presupuesto − total: positivo es lo disponible y negativo lo que excede. */
  diferencia: string | null;
  excede: boolean;
  /** Lo que se pasa del presupuesto semanal ("0.00" si no excede). */
  exceso: string;
  costoIncompleto: boolean;
  porTiempo: CostoDeTiempo[];
  porDia: CostoDeDia[];
}

/** Los montos guardados son decimales válidos con 2 decimales (columnas `numeric`). */
const centavos = (valor: string): number => Math.round(Number(valor) * 100);
const monto = (valor: string | null): number | null => (valor === null ? null : centavos(valor));

/**
 * Resume los costos guardados del menú. El total se compara con el presupuesto semanal y cada
 * tiempo con el suyo, de modo que un tiempo puede exceder aunque el total no (CA-26.2). Un
 * platillo sin precio en algún ingrediente marca su día como incompleto (CA-26.3).
 */
export function costosDelMenu(menu: MenuParaCostos): CostosDelMenu {
  const total = monto(menu.costoEstimado);
  const presupuesto = monto(menu.presupuestoSemanal);
  const diferencia = total !== null && presupuesto !== null ? presupuesto - total : null;
  const excede = diferencia !== null && diferencia < 0;

  const fechas = [...new Set(menu.detalles.map((d) => d.fecha))].sort();
  return {
    total: total === null ? null : deCentavos(total),
    presupuesto: presupuesto === null ? null : deCentavos(presupuesto),
    diferencia: diferencia === null ? null : deCentavos(diferencia),
    excede,
    exceso: deCentavos(excede ? -(diferencia as number) : 0),
    costoIncompleto: menu.costoIncompleto,
    porTiempo: menu.tiempos.map((t) => ({
      tiempo: t.tiempo,
      costo: t.costoEstimado,
      presupuesto: t.presupuesto,
      exceso: t.exceso,
      excede: centavos(t.exceso) > 0,
      estado: t.estado,
    })),
    porDia: fechas.map((fecha) => {
      const espacios = menu.detalles
        .filter((d) => d.fecha === fecha)
        .sort((a, b) => ORDEN_TIEMPOS.indexOf(a.tiempo) - ORDEN_TIEMPOS.indexOf(b.tiempo));
      const tiempos = espacios.map((d) => ({
        tiempo: d.tiempo,
        costo: d.platillo === null ? null : d.costoEstimado,
        incompleto: d.platillo !== null && (d.costoIncompleto || d.costoEstimado === null),
      }));
      const conocidos = tiempos.filter((t) => t.costo !== null);
      return {
        fecha,
        costo:
          conocidos.length === 0
            ? null
            : deCentavos(conocidos.reduce((suma, t) => suma + centavos(t.costo as string), 0)),
        incompleto: tiempos.some((t) => t.incompleto),
        tiempos,
      };
    }),
  };
}
