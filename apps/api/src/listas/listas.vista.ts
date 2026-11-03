import { enPresentacion, formatearCantidad, redondear, type ComidaDelMenu } from '@menu/shared';
import type { ItemDeLista, ListaCompleta } from './listas.repositorio';

export interface CantidadConUnidad {
  cantidad: string;
  unidad: string;
}

export interface ItemVista {
  id: string;
  producto: { id: string | null; nombre: string };
  /** Lo que piden las recetas, en la unidad de la receta (800 g); null si no se pudo sumar. */
  cantidadRequerida: CantidadConUnidad | null;
  /** Lo requerido en la unidad de compra (1.764 lb); solo si la unidad de la receta es otra. */
  equivalente: CantidadConUnidad | null;
  /** Presentaciones enteras a comprar. */
  cantidadComprar: string;
  presentacion: { cantidad: string; unidad: string; unidadCompra: string; texto: string } | null;
  origen: ItemDeLista['origen'];
  estado: ItemDeLista['estado'];
  /** CU-07.1 E1: la unidad de la receta no tiene equivalencia con la de compra. */
  sinConversion: boolean;
  /** Comidas (detalles del menú) que originan el ítem. */
  comidas: string[];
}

/** Lista de compras tal como la devuelve `GET /listas/{id}` (api-contrato §2.7). */
export interface VistaLista {
  id: string;
  menuId: string;
  semana: { desde: string; hasta: string };
  version: number;
  /** RN-11 · D-03: el exceso con que se aprobó el menú; null si estaba dentro del presupuesto. */
  excede: { monto: string; texto: string } | null;
  total: number;
  comprados: number;
  /** Algún ítem sin conversión de unidades: la cantidad a comprar es una estimación mínima. */
  sinConversion: number;
  items: ItemVista[];
  /** Comidas del menú; con `items[].comidas` permiten calcular el avance sin conexión (HU-43). */
  comidas: ComidaDelMenu[];
}

const cantidad = (valor: string | number) => formatearCantidad(valor);

function itemVista(i: ItemDeLista): ItemVista {
  const presentacion =
    i.presentacionUnidad && i.presentacionCantidad && i.unidadCompra
      ? {
          cantidad: cantidad(i.presentacionCantidad),
          unidad: i.presentacionUnidad.codigo,
          unidadCompra: i.unidadCompra,
          texto: `${i.unidadCompra} ${cantidad(i.presentacionCantidad)} ${i.presentacionUnidad.codigo}`,
        }
      : null;
  const requerida =
    i.cantidadRequerida !== null && i.unidadRequerida
      ? { cantidad: cantidad(i.cantidadRequerida), unidad: i.unidadRequerida.codigo }
      : null;
  const mismaUnidad = i.unidadRequerida?.id === i.presentacionUnidad?.id;
  let equivalente: CantidadConUnidad | null = null;
  if (
    requerida &&
    presentacion &&
    i.unidadRequerida &&
    i.presentacionUnidad &&
    !i.sinConversion &&
    !mismaUnidad
  ) {
    const enCompra = enPresentacion(
      {
        unidad: i.unidadRequerida,
        presentacion: { cantidad: i.presentacionCantidad!, unidad: i.presentacionUnidad },
        equivalencia: i.equivalencia,
      },
      Number(i.cantidadRequerida),
    );
    if (enCompra !== null) {
      equivalente = {
        cantidad: cantidad(redondear(enCompra, 2)),
        unidad: i.presentacionUnidad.codigo,
      };
    }
  }
  return {
    id: i.id,
    producto: { id: i.productoId, nombre: i.productoNombre ?? i.textoLibre ?? '' },
    cantidadRequerida: requerida,
    equivalente,
    cantidadComprar: cantidad(i.cantidadComprar),
    presentacion,
    origen: i.origen,
    estado: i.estado,
    sinConversion: i.sinConversion,
    comidas: i.comidas,
  };
}

export function vistaLista(lista: ListaCompleta): VistaLista {
  const exceso = lista.excesoAlAprobar ?? '0';
  return {
    id: lista.id,
    menuId: lista.menuId,
    semana: { desde: lista.fechaInicio, hasta: lista.fechaFin },
    version: lista.version,
    excede: Number(exceso) > 0 ? { monto: exceso, texto: `Excede por Q${exceso}` } : null,
    total: lista.items.length,
    comprados: lista.items.filter((i) => i.estado !== 'PENDIENTE').length,
    sinConversion: lista.items.filter((i) => i.sinConversion).length,
    items: lista.items.map(itemVista),
    comidas: lista.comidas,
  };
}
