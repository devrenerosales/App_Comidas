import type { Response } from 'express';
import {
  borrarCookieRefresh,
  esClienteNativo,
  guardarCookieRefresh,
  leerCookie,
  refreshDeLaSolicitud,
} from './cookies';

describe('cookies del refresh (ADR-004)', () => {
  it('lee una cookie entre varias y decodifica su valor', () => {
    const req = { headers: { cookie: 'a=1; mf_refresh=abc%2Fd; otra' } };
    expect(leerCookie(req, 'mf_refresh')).toBe('abc/d');
    expect(leerCookie(req, 'b')).toBeUndefined();
    expect(leerCookie({ headers: {} }, 'a')).toBeUndefined();
    expect(
      leerCookie({ headers: { cookie: 'mf_refresh=%E0%A4%A' } }, 'mf_refresh'),
    ).toBeUndefined();
  });

  it('detecta el cliente nativo por la cabecera X-Cliente', () => {
    expect(esClienteNativo({ headers: { 'x-cliente': ' Android ' } })).toBe(true);
    expect(esClienteNativo({ headers: { 'x-cliente': 'web' } })).toBe(false);
    expect(esClienteNativo({ headers: {} })).toBe(false);
  });

  it('el refresh del cuerpo tiene prioridad sobre la cookie', () => {
    const req = { headers: { cookie: 'mf_refresh=cookie' } };
    expect(refreshDeLaSolicitud(req, 'cuerpo')).toBe('cuerpo');
    expect(refreshDeLaSolicitud(req, undefined)).toBe('cookie');
    expect(refreshDeLaSolicitud(req, '')).toBe('cookie');
  });

  it('guarda y borra la cookie HttpOnly, Secure, SameSite=Strict en /api/v1/auth', () => {
    const res = { cookie: jest.fn(), clearCookie: jest.fn() } as unknown as Response;
    guardarCookieRefresh(res, 'valor');
    const opciones = {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/api/v1/auth',
    };
    expect(res.cookie).toHaveBeenCalledWith('mf_refresh', 'valor', {
      ...opciones,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    borrarCookieRefresh(res);
    expect(res.clearCookie).toHaveBeenCalledWith('mf_refresh', opciones);
  });
});
