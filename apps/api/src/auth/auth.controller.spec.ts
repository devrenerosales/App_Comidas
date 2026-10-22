import type { Request, Response } from 'express';
import { Problema } from '../comun/problema';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import type { Sesion } from './auth.tipos';

const SESION: Sesion = {
  usuario: { id: 'u1', nombre: 'Rene', correo: 'rene@correo.com', esAdminSistema: false },
  accessToken: 'acceso',
  refreshToken: 'refresh',
  expiraEn: '2026-10-22T15:15:00.000Z',
  hogar: null,
};

function respuesta() {
  return { cookie: jest.fn(), clearCookie: jest.fn(), setHeader: jest.fn() };
}

function solicitud(headers: Record<string, string> = {}): Request {
  return { headers } as unknown as Request;
}

describe('AuthController', () => {
  const auth = {
    registrar: jest.fn().mockResolvedValue(SESION),
    iniciarSesion: jest.fn().mockResolvedValue(SESION),
    renovar: jest.fn().mockResolvedValue(SESION),
    cerrarSesion: jest.fn().mockResolvedValue(undefined),
  };
  const controlador = new AuthController(auth as unknown as AuthService);

  it('PWA: el refresh va en la cookie y no en el cuerpo; respuesta sin caché', async () => {
    const res = respuesta();
    const cuerpo = await controlador.registrar(
      { nombre: 'Rene', correo: 'rene@correo.com', contrasena: 'Almuerzo2026' },
      solicitud({ 'user-agent': 'Firefox' }),
      res as unknown as Response,
    );
    expect(cuerpo).not.toHaveProperty('refreshToken');
    expect(cuerpo.accessToken).toBe('acceso');
    expect(res.cookie).toHaveBeenCalledWith('mf_refresh', 'refresh', expect.any(Object));
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(auth.registrar).toHaveBeenCalledWith(expect.any(Object), { dispositivo: 'Firefox' });
  });

  it('Android: el refresh va en el cuerpo y no se crea cookie', async () => {
    const res = respuesta();
    const cuerpo = await controlador.iniciarSesion(
      { correo: 'rene@correo.com', contrasena: 'x', dispositivo: 'Pixel' },
      solicitud({ 'x-cliente': 'android' }),
      res as unknown as Response,
    );
    expect(cuerpo.refreshToken).toBe('refresh');
    expect(res.cookie).not.toHaveBeenCalled();
    expect(auth.iniciarSesion).toHaveBeenCalledWith(expect.any(Object), { dispositivo: 'Pixel' });
  });

  it('refresh: toma el token de la cookie y rota la cookie', async () => {
    const res = respuesta();
    await controlador.renovar(
      {},
      solicitud({ cookie: 'mf_refresh=viejo' }),
      res as unknown as Response,
    );
    expect(auth.renovar).toHaveBeenCalledWith('viejo', { dispositivo: null });
    expect(res.cookie).toHaveBeenCalledWith('mf_refresh', 'refresh', expect.any(Object));
  });

  it('refresh fallido: borra la cookie y propaga el 401', async () => {
    const res = respuesta();
    auth.renovar.mockRejectedValueOnce(new Problema(401, 'SESION_INVALIDA', 'x'));
    await expect(
      controlador.renovar({ refreshToken: 'r' }, solicitud(), res as unknown as Response),
    ).rejects.toBeInstanceOf(Problema);
    expect(res.clearCookie).toHaveBeenCalled();
  });

  it('logout: revoca con el usuario del token y borra la cookie', async () => {
    const res = respuesta();
    await controlador.cerrarSesion(
      'u1',
      { refreshToken: 'r' },
      solicitud(),
      res as unknown as Response,
    );
    expect(auth.cerrarSesion).toHaveBeenCalledWith('u1', 'r');
    expect(res.clearCookie).toHaveBeenCalled();
  });
});
