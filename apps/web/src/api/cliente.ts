/**
 * Cliente HTTP mínimo sobre `fetch` (ADR-004):
 * - token de acceso solo en memoria;
 * - refresh en cookie HttpOnly (PWA) o en memoria del cliente nativo (`X-Cliente: android`);
 * - ante un 401 renueva una sola vez (una renovación a la vez, también entre pestañas) y
 *   reintenta la petición original;
 * - errores como `ProblemaApi` (RFC 7807).
 */
import { ProblemaApi } from './problema';
import type { Sesion } from './tipos';

export type MetodoHttp = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface OpcionesPeticion {
  metodo?: MetodoHttp;
  cuerpo?: unknown;
  /** Envía el token de acceso y renueva ante 401 (por defecto true). */
  autenticar?: boolean;
}

export interface OpcionesCliente {
  /** Base de la API, p. ej. `/api/v1` (mismo origen vía Caddy) o `https://dominio/api/v1`. */
  base: string;
  /** App nativa (Capacitor): el refresh viaja en el cuerpo. */
  nativo?: boolean;
  fetch?: typeof fetch;
  /** Serializa la renovación entre pestañas (Web Locks API) si está disponible. */
  locks?: Pick<LockManager, 'request'>;
}

type Oyente = (sesion: Sesion | null) => void;

const RUTA_REFRESH = '/auth/refresh';
const NOMBRE_CANDADO = 'menu-familiar-refresh';

export class ClienteHttp {
  private accessToken: string | null = null;
  private refreshNativo: string | null = null;
  private renovacion: Promise<Sesion | null> | null = null;
  private readonly oyentes = new Set<Oyente>();
  private readonly fetchFn: typeof fetch;

  constructor(private readonly opciones: OpcionesCliente) {
    this.fetchFn = opciones.fetch ?? ((...args) => globalThis.fetch(...args));
  }

  /** Suscribe a cambios de sesión (renovación o cierre). Devuelve la función para anular. */
  alCambiarSesion(oyente: Oyente): () => void {
    this.oyentes.add(oyente);
    return () => this.oyentes.delete(oyente);
  }

  /** Guarda los tokens de una sesión nueva (login, registro o refresh). */
  establecerSesion(sesion: Sesion): void {
    this.accessToken = sesion.accessToken;
    if (this.opciones.nativo && sesion.refreshToken) this.refreshNativo = sesion.refreshToken;
  }

  /** Olvida los tokens en memoria (la cookie la borra la API). */
  limpiarSesion(): void {
    this.accessToken = null;
    this.refreshNativo = null;
  }

  get tieneSesion(): boolean {
    return this.accessToken !== null;
  }

  /** Refresh actual del cliente nativo (para cerrar sesión). */
  get refreshToken(): string | null {
    return this.refreshNativo;
  }

  async peticion<T>(ruta: string, opciones: OpcionesPeticion = {}): Promise<T> {
    const autenticar = opciones.autenticar ?? true;
    let respuesta = await this.enviar(ruta, opciones, autenticar);
    if (respuesta.status === 401 && autenticar) {
      const renovada = await this.renovar();
      if (!renovada) {
        throw await ProblemaApi.desde(respuesta);
      }
      respuesta = await this.enviar(ruta, opciones, autenticar);
    }
    if (!respuesta.ok) throw await ProblemaApi.desde(respuesta);
    if (respuesta.status === 204) return undefined as T;
    return (await respuesta.json()) as T;
  }

  /**
   * Renueva el token de acceso con el refresh. Devuelve la sesión nueva o `null` si la sesión
   * terminó. Varias llamadas simultáneas comparten una sola solicitud.
   */
  renovar(): Promise<Sesion | null> {
    this.renovacion ??= this.conCandado(() => this.solicitarRenovacion()).finally(() => {
      this.renovacion = null;
    });
    return this.renovacion;
  }

  private async solicitarRenovacion(): Promise<Sesion | null> {
    let respuesta: Response;
    try {
      const cuerpo = this.opciones.nativo ? { refreshToken: this.refreshNativo ?? undefined } : {};
      respuesta = await this.enviar(RUTA_REFRESH, { metodo: 'POST', cuerpo }, false);
    } catch {
      return null;
    }
    if (!respuesta.ok) {
      this.limpiarSesion();
      this.notificar(null);
      return null;
    }
    const sesion = (await respuesta.json()) as Sesion;
    this.establecerSesion(sesion);
    this.notificar(sesion);
    return sesion;
  }

  private conCandado<T>(fn: () => Promise<T>): Promise<T> {
    const locks = this.opciones.locks;
    return locks ? (locks.request(NOMBRE_CANDADO, fn) as Promise<T>) : fn();
  }

  private notificar(sesion: Sesion | null): void {
    for (const oyente of this.oyentes) oyente(sesion);
  }

  private async enviar(
    ruta: string,
    opciones: OpcionesPeticion,
    autenticar: boolean,
  ): Promise<Response> {
    const cabeceras: Record<string, string> = { Accept: 'application/json' };
    if (opciones.cuerpo !== undefined) cabeceras['Content-Type'] = 'application/json';
    if (autenticar && this.accessToken) cabeceras.Authorization = `Bearer ${this.accessToken}`;
    if (this.opciones.nativo) cabeceras['X-Cliente'] = 'android';
    try {
      return await this.fetchFn(`${this.opciones.base}${ruta}`, {
        method: opciones.metodo ?? 'GET',
        headers: cabeceras,
        body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo),
        credentials: 'include',
      });
    } catch {
      throw ProblemaApi.sinConexion();
    }
  }
}
