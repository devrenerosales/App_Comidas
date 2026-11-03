/**
 * Edición y sincronización de la lista de compras (M07 · CU-07.3, HU-30): funciones puras que usan
 * la API (al recibir un lote de cambios) y la app (al aplicarlos en el dispositivo mientras no hay
 * conexión), de modo que los dos resuelvan igual. Cada cambio lleva la hora del dispositivo y gana
 * el más reciente por ítem ("última escritura gana"); un ítem eliminado que recibe después una marca
 * de comprado se restaura como comprado.
 */
import { redondear } from './catalogo';
import { validarPrecio } from './precio-compra';

export type OperacionLista =
  | 'AGREGAR'
  | 'ACTUALIZAR'
  | 'MARCAR_COMPRADO'
  | 'MARCAR_YA_LO_TENGO'
  | 'DESMARCAR_COMPRADO'
  | 'REGISTRAR_PRECIO'
  | 'ELIMINAR';

export type EstadoItemLista = 'PENDIENTE' | 'COMPRADO' | 'YA_LO_TENGO';

/** Cantidad máxima que admite la columna `numeric(10,3)`. */
export const CANTIDAD_MAXIMA_ITEM = 9_999_999.999;
export const LARGO_MAXIMO_TEXTO_LIBRE = 80;
/** Cambios que admite un solo lote de sincronización. */
export const CAMBIOS_MAXIMOS_POR_LOTE = 500;

/** CA-30.4: texto cuando la cantidad no es un número mayor que 0. */
export const MENSAJE_CANTIDAD_INVALIDA = 'La cantidad debe ser mayor que 0';

export interface DatosCambioLista {
  productoId?: string | null;
  textoLibre?: string | null;
  cantidadComprar?: number | string | null;
  /** Total pagado por el ítem en quetzales (CU-07.7); solo con comprado. */
  precioReal?: number | string | null;
  /** Contenido comprado en la unidad de la presentación del catálogo (CU-07.7 2b). */
  contenidoComprado?: number | string | null;
}

export interface CambioLista {
  /** Identificador del cambio, generado en el dispositivo; hace idempotente el envío. */
  id: string;
  itemId: string;
  operacion: OperacionLista;
  datos?: DatosCambioLista | null;
  /** Hora del dispositivo en ISO 8601. */
  marcaTiempo: string;
}

/** Lo que se necesita saber de un ítem para resolver un cambio. */
export interface EstadoItemSync {
  estado: EstadoItemLista;
  cantidadComprar: number;
  eliminado: boolean;
  /** Hora del último cambio aplicado, en milisegundos. */
  modificadoEn: number;
}

/** Cambios que el resultado aplica al ítem; en un ítem nuevo trae todos los campos. */
export interface ParcheItem {
  productoId?: string;
  textoLibre?: string;
  estado?: EstadoItemLista;
  cantidadComprar?: number;
  eliminado?: boolean;
  /** Momento en que pasó a comprado o "Ya lo tengo"; null al desmarcar. */
  compradoEn?: number | null;
  /** Precio pagado; null lo borra (al corregir) y lo borran los cambios a pendiente o "Ya lo tengo". */
  precioReal?: number | null;
  contenidoComprado?: number | null;
  modificadoEn: number;
}

export type ResultadoCambio =
  | { resultado: 'APLICADO'; parche: ParcheItem }
  /** Otro cambio más reciente ya ganó (o no había nada que hacer): se descarta sin error. */
  | { resultado: 'OBSOLETO'; motivo: string }
  /** El cambio no es válido y se descarta de la cola (CU-07.3 E1 y E2). */
  | { resultado: 'RECHAZADO'; motivo: string };

const rechazo = (motivo: string): ResultadoCambio => ({ resultado: 'RECHAZADO', motivo });
const obsoleto = (motivo: string): ResultadoCambio => ({ resultado: 'OBSOLETO', motivo });

/** Cantidad válida a 3 decimales, o null si no es un número mayor que 0 que quepa en la columna. */
export function cantidadValida(valor: number | string | null | undefined): number | null {
  if (valor === null || valor === undefined || valor === '') return null;
  const n = redondear(Number(valor), 3);
  return Number.isFinite(n) && n > 0 && n <= CANTIDAD_MAXIMA_ITEM ? n : null;
}

const OBSOLETO_ITEM_ELIMINADO = obsoleto('ITEM_ELIMINADO');

type PrecioDeCambio =
  | { ok: true; campos: Pick<ParcheItem, 'precioReal' | 'contenidoComprado'> }
  | { ok: false; resultado: ResultadoCambio };

/**
 * Precio y contenido comprado de un cambio (CU-07.7). Sin precio no hay campos que cambiar; con
 * precio, el contenido es opcional (por defecto lo comprado según la lista).
 */
function precioDeCambio(datos: DatosCambioLista | null | undefined): PrecioDeCambio {
  const precio = datos?.precioReal;
  if (precio === undefined || precio === null) return { ok: true, campos: {} };
  const validado = validarPrecio(precio);
  if (!validado.ok) return { ok: false, resultado: rechazo('PRECIO_INVALIDO') };
  const contenido = datos?.contenidoComprado;
  if (contenido === undefined || contenido === null) {
    return { ok: true, campos: { precioReal: validado.valor, contenidoComprado: null } };
  }
  const valido = cantidadValida(contenido);
  if (valido === null) return { ok: false, resultado: rechazo('CONTENIDO_INVALIDO') };
  return { ok: true, campos: { precioReal: validado.valor, contenidoComprado: valido } };
}

function agregar(cambio: CambioLista, marca: number): ResultadoCambio {
  const productoId = cambio.datos?.productoId ?? null;
  const texto = cambio.datos?.textoLibre?.trim() ?? '';
  const conTexto = texto !== '';
  if ((productoId !== null) === conTexto || texto.length > LARGO_MAXIMO_TEXTO_LIBRE) {
    return rechazo('PRODUCTO_INVALIDO');
  }
  const cantidad = cantidadValida(cambio.datos?.cantidadComprar);
  if (cantidad === null) return rechazo('CANTIDAD_INVALIDA');
  return {
    resultado: 'APLICADO',
    parche: {
      ...(productoId !== null ? { productoId } : { textoLibre: texto }),
      estado: 'PENDIENTE',
      cantidadComprar: cantidad,
      eliminado: false,
      compradoEn: null,
      modificadoEn: marca,
    },
  };
}

/**
 * CU-07.3 pasos 3 y 5: qué hace un cambio sobre el ítem actual (`undefined` si todavía no existe).
 * Gana la hora más reciente; un empate lo gana el cambio que llega después.
 */
export function resolverCambio(
  actual: EstadoItemSync | undefined,
  cambio: CambioLista,
): ResultadoCambio {
  const marca = Date.parse(cambio.marcaTiempo);
  if (Number.isNaN(marca)) return rechazo('MARCA_TIEMPO_INVALIDA');

  if (!actual) {
    return cambio.operacion === 'AGREGAR' ? agregar(cambio, marca) : rechazo('ITEM_NO_ENCONTRADO');
  }
  if (marca < actual.modificadoEn) return obsoleto('CAMBIO_ANTIGUO');

  switch (cambio.operacion) {
    case 'AGREGAR': {
      // Agregar de nuevo un producto que se había quitado lo restaura como pendiente.
      if (!actual.eliminado) return obsoleto('YA_EXISTE');
      const cantidad = cantidadValida(cambio.datos?.cantidadComprar);
      if (cantidad === null) return rechazo('CANTIDAD_INVALIDA');
      return {
        resultado: 'APLICADO',
        parche: {
          estado: 'PENDIENTE',
          cantidadComprar: cantidad,
          eliminado: false,
          compradoEn: null,
          modificadoEn: marca,
        },
      };
    }
    case 'ELIMINAR':
      return actual.eliminado
        ? obsoleto('YA_ELIMINADO')
        : { resultado: 'APLICADO', parche: { eliminado: true, modificadoEn: marca } };
    case 'MARCAR_YA_LO_TENGO':
      // CA-30.3: marcar un ítem que otro quitó antes lo restaura. "Ya lo tengo" no se cotiza.
      return {
        resultado: 'APLICADO',
        parche: { estado: 'YA_LO_TENGO', eliminado: false, compradoEn: marca, modificadoEn: marca },
      };
    case 'MARCAR_COMPRADO': {
      // CA-30.3: comprar un ítem que otro quitó antes lo restaura como comprado; el precio es opcional.
      const precio = precioDeCambio(cambio.datos);
      if (!precio.ok) return precio.resultado;
      return {
        resultado: 'APLICADO',
        parche: {
          estado: 'COMPRADO',
          eliminado: false,
          compradoEn: marca,
          ...precio.campos,
          modificadoEn: marca,
        },
      };
    }
    case 'DESMARCAR_COMPRADO':
      return actual.eliminado
        ? obsoleto('ITEM_ELIMINADO')
        : {
            resultado: 'APLICADO',
            parche: { estado: 'PENDIENTE', compradoEn: null, modificadoEn: marca },
          };
    case 'ACTUALIZAR': {
      if (actual.eliminado) return obsoleto('ITEM_ELIMINADO');
      const cantidad = cantidadValida(cambio.datos?.cantidadComprar);
      if (cantidad === null) return rechazo('CANTIDAD_INVALIDA');
      return { resultado: 'APLICADO', parche: { cantidadComprar: cantidad, modificadoEn: marca } };
    }
    case 'REGISTRAR_PRECIO': {
      // CU-07.7: el precio solo existe en ítems comprados; sin precio se borra el anterior (2c).
      if (actual.eliminado) return OBSOLETO_ITEM_ELIMINADO;
      if (actual.estado !== 'COMPRADO') return rechazo('ITEM_NO_COMPRADO');
      const precio = precioDeCambio(cambio.datos);
      if (!precio.ok) return precio.resultado;
      const campos =
        precio.campos.precioReal === undefined
          ? { precioReal: null, contenidoComprado: null }
          : precio.campos;
      return { resultado: 'APLICADO', parche: { ...campos, modificadoEn: marca } };
    }
  }
}
