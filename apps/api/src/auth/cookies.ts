import type { CookieOptions, Request, Response } from 'express';
import {
  CABECERA_CLIENTE,
  CLIENTES_NATIVOS,
  COOKIE_REFRESH,
  MS_REFRESH,
  RUTA_COOKIE_REFRESH,
} from './auth.constants';

/** Opciones de la cookie del refresh en la PWA (ADR-004). */
export const OPCIONES_COOKIE_REFRESH: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  path: RUTA_COOKIE_REFRESH,
};

/** Lee una cookie del encabezado `Cookie` sin depender de cookie-parser. */
export function leerCookie(req: Pick<Request, 'headers'>, nombre: string): string | undefined {
  for (const parte of (req.headers.cookie ?? '').split(';')) {
    const indice = parte.indexOf('=');
    if (indice < 0) continue;
    if (parte.slice(0, indice).trim() !== nombre) continue;
    try {
      return decodeURIComponent(parte.slice(indice + 1).trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/** `true` si el cliente es la app nativa (Android/Capacitor): refresh en el cuerpo. */
export function esClienteNativo(req: Pick<Request, 'headers'>): boolean {
  const valor = req.headers[CABECERA_CLIENTE];
  return typeof valor === 'string' && CLIENTES_NATIVOS.includes(valor.trim().toLowerCase());
}

export function guardarCookieRefresh(res: Response, token: string): void {
  res.cookie(COOKIE_REFRESH, token, { ...OPCIONES_COOKIE_REFRESH, maxAge: MS_REFRESH });
}

export function borrarCookieRefresh(res: Response): void {
  res.clearCookie(COOKIE_REFRESH, OPCIONES_COOKIE_REFRESH);
}

/** Refresh enviado por el cliente: cuerpo (Android) o cookie (PWA). */
export function refreshDeLaSolicitud(
  req: Pick<Request, 'headers'>,
  delCuerpo: string | undefined,
): string | undefined {
  return delCuerpo || leerCookie(req, COOKIE_REFRESH);
}
