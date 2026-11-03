import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MENSAJE_CANTIDAD_INVALIDA,
  cantidadValida,
  type CambioLista,
  type DatosCambioLista,
  type OperacionLista,
} from '@menu/shared';
import { ProblemaApi, mensajeDeError } from '../api';
import { useApiListas } from '../api/contexto-listas';
import type { ListaCompras } from '../api/listas';
import { guardarLocal, leerLocal, listaVisible, type EstadoLocal } from './lista-local';

export const MENSAJE_NOMBRE_OBLIGATORIO = 'Escribe el nombre del producto';

/** Identificador de un cambio o ítem nuevo, generado en el dispositivo para que funcione sin conexión. */
export function nuevoId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === 'x' ? r : (r % 4) + 8).toString(16);
  });
}

const enLinea = () => typeof navigator === 'undefined' || navigator.onLine !== false;

/** Un fallo de red, del servidor o de sesión no descarta la cola: se reintenta más tarde. */
const esFalloTemporal = (e: unknown) =>
  e instanceof ProblemaApi && (e.status === 0 || e.status === 401 || e.status >= 500);

interface Opciones {
  ahora?: () => Date;
  nuevoId?: () => string;
}

export interface ListaSincronizada {
  /** La lista con los cambios pendientes ya aplicados; null mientras no hay ninguna copia. */
  lista: ListaCompras | null;
  /** Cambios hechos en este dispositivo que el servidor todavía no confirmó. */
  pendientes: number;
  sinConexion: boolean;
  cargando: boolean;
  error: string | null;
  /** Aviso de cambios que el servidor no aceptó (CU-07.3 E2). */
  aviso: string | null;
  reintentar: () => void;
  /** Devuelve el mensaje de error si el producto o la cantidad no son válidos (CA-30.4). */
  agregar: (nombre: string, cantidad: string) => string | null;
  marcar: (itemId: string, estado: 'COMPRADO' | 'YA_LO_TENGO' | 'PENDIENTE') => void;
  quitar: (itemId: string) => void;
}

/**
 * CU-07.3: la lista de compras de un menú aprobado, editable también sin conexión. Se muestra desde
 * la copia del dispositivo, cada cambio se aplica ahí y se encola con su hora, y la cola se envía a la
 * API en cuanto hay conexión (al abrir, al reconectar o al hacer un cambio) sin acción del usuario.
 */
export function useListaSincronizada(
  listaId: string | null,
  { ahora = () => new Date(), nuevoId: generarId = nuevoId }: Opciones = {},
): ListaSincronizada {
  const listas = useApiListas();
  const [estado, setEstado] = useState<EstadoLocal | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [conectado, setConectado] = useState(enLinea);
  const [fallaRed, setFallaRed] = useState(false);
  const [intento, setIntento] = useState(0);
  const ref = useRef<EstadoLocal | null>(null);
  const enVuelo = useRef(false);

  const fijar = useCallback(
    (siguiente: EstadoLocal | null) => {
      ref.current = siguiente;
      setEstado(siguiente);
      if (siguiente && listaId) guardarLocal(listaId, siguiente);
    },
    [listaId],
  );

  /** Envía la cola por lotes hasta vaciarla o hasta que falle la conexión. */
  const enviar = useCallback(async () => {
    if (!listaId || enVuelo.current) return;
    enVuelo.current = true;
    try {
      while (ref.current && ref.current.cola.length > 0 && enLinea()) {
        const lote = ref.current.cola;
        const ids = new Set(lote.map((c) => c.id));
        try {
          const respuesta = await listas.sincronizar(listaId, lote, ref.current.base.version);
          const rechazados = respuesta.resultados.filter((r) => r.resultado === 'RECHAZADO').length;
          fijar({
            base: respuesta.lista,
            cola: (ref.current?.cola ?? []).filter((c) => !ids.has(c.id)),
          });
          setFallaRed(false);
          if (rechazados > 0) {
            setAviso(
              rechazados === 1
                ? 'Un cambio no se pudo aplicar y se descartó.'
                : `${rechazados} cambios no se pudieron aplicar y se descartaron.`,
            );
          }
        } catch (e) {
          if (esFalloTemporal(e)) {
            setFallaRed(true);
            break;
          }
          // E2: el servidor rechazó el lote (p. ej. la lista ya no existe): se descarta y se avisa.
          fijar({
            base: ref.current!.base,
            cola: ref.current!.cola.filter((c) => !ids.has(c.id)),
          });
          setAviso(mensajeDeError(e));
          break;
        }
      }
    } finally {
      enVuelo.current = false;
    }
  }, [listaId, listas, fijar]);

  /** Abre la lista: copia local al instante y, con conexión, la versión del servidor. */
  useEffect(() => {
    if (!listaId) {
      ref.current = null;
      setEstado(null);
      return;
    }
    let activo = true;
    const local = leerLocal(listaId);
    ref.current = local;
    setEstado(local);
    setError(null);
    setAviso(null);
    if (!enLinea()) return;
    setCargando(true);
    (async () => {
      if (local && local.cola.length > 0) {
        await enviar();
        return;
      }
      try {
        const lista = await listas.obtener(listaId);
        if (activo) fijar({ base: lista, cola: ref.current?.cola ?? [] });
      } catch (e) {
        if (!activo) return;
        if (esFalloTemporal(e)) setFallaRed(true);
        if (!local) setError(mensajeDeError(e));
      }
    })().finally(() => {
      if (activo) setCargando(false);
    });
    return () => {
      activo = false;
    };
  }, [listaId, listas, enviar, fijar, intento]);

  /** Al recuperar la conexión se envía lo pendiente sin que el usuario haga nada. */
  useEffect(() => {
    const alConectar = () => {
      setConectado(true);
      setFallaRed(false);
      // Vuelve a abrir la lista: envía lo pendiente y trae lo que cambiaron otros dispositivos.
      setIntento((n) => n + 1);
    };
    const alDesconectar = () => setConectado(false);
    window.addEventListener('online', alConectar);
    window.addEventListener('offline', alDesconectar);
    return () => {
      window.removeEventListener('online', alConectar);
      window.removeEventListener('offline', alDesconectar);
    };
  }, []);

  const registrar = (operacion: OperacionLista, itemId: string, datos?: DatosCambioLista) => {
    if (!ref.current) return;
    const cambio: CambioLista = {
      id: generarId(),
      itemId,
      operacion,
      ...(datos ? { datos } : {}),
      marcaTiempo: ahora().toISOString(),
    };
    fijar({ base: ref.current.base, cola: [...ref.current.cola, cambio] });
    void enviar();
  };

  return {
    lista: estado ? listaVisible(estado) : null,
    pendientes: estado?.cola.length ?? 0,
    sinConexion: !conectado || fallaRed,
    cargando,
    error,
    aviso,
    reintentar: () => setIntento((n) => n + 1),
    agregar: (nombre, cantidad) => {
      const texto = nombre.trim();
      if (texto === '') return MENSAJE_NOMBRE_OBLIGATORIO;
      const valida = cantidadValida(cantidad);
      if (valida === null) return MENSAJE_CANTIDAD_INVALIDA;
      registrar('AGREGAR', generarId(), { textoLibre: texto, cantidadComprar: valida });
      return null;
    },
    marcar: (itemId, nuevo) =>
      registrar(
        nuevo === 'COMPRADO'
          ? 'MARCAR_COMPRADO'
          : nuevo === 'YA_LO_TENGO'
            ? 'MARCAR_YA_LO_TENGO'
            : 'DESMARCAR_COMPRADO',
        itemId,
      ),
    quitar: (itemId) => registrar('ELIMINAR', itemId),
  };
}
