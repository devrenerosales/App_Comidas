import { describe, expect, it, vi } from 'vitest';
import { crearApiAuth } from './auth';
import type { ClienteHttp } from './cliente';
import { ProblemaApi } from './problema';

const SESION = {
  usuario: { id: 'u1', nombre: 'Rene', correo: 'rene@correo.com', esAdminSistema: false },
  accessToken: 'a',
  expiraEn: 'x',
  hogar: null,
};

function clienteFalso(extra: Partial<Record<string, unknown>> = {}) {
  return {
    peticion: vi.fn().mockResolvedValue(SESION),
    establecerSesion: vi.fn(),
    limpiarSesion: vi.fn(),
    renovar: vi.fn().mockResolvedValue(null),
    tieneSesion: true,
    refreshToken: null,
    ...extra,
  };
}

describe('apiAuth', () => {
  it('registrar y login llaman al contrato sin token y guardan la sesión', async () => {
    const cliente = clienteFalso();
    const api = crearApiAuth(cliente as unknown as ClienteHttp);
    await api.registrar({ nombre: 'Rene', correo: 'rene@correo.com', contrasena: 'Almuerzo2026' });
    expect(cliente.peticion).toHaveBeenCalledWith('/auth/registro', {
      metodo: 'POST',
      cuerpo: { nombre: 'Rene', correo: 'rene@correo.com', contrasena: 'Almuerzo2026' },
      autenticar: false,
    });
    await api.iniciarSesion('rene@correo.com', 'Almuerzo2026');
    expect(cliente.peticion).toHaveBeenLastCalledWith('/auth/login', {
      metodo: 'POST',
      cuerpo: { correo: 'rene@correo.com', contrasena: 'Almuerzo2026' },
      autenticar: false,
    });
    expect(cliente.establecerSesion).toHaveBeenCalledTimes(2);
  });

  it('restaurar renueva y perfil consulta /usuarios/yo', async () => {
    const cliente = clienteFalso();
    const api = crearApiAuth(cliente as unknown as ClienteHttp);
    await api.restaurar();
    expect(cliente.renovar).toHaveBeenCalled();
    await api.perfil();
    expect(cliente.peticion).toHaveBeenCalledWith('/usuarios/yo');
  });

  it('cerrar sesión llama a /auth/logout y limpia aunque falle', async () => {
    const cliente = clienteFalso({
      peticion: vi.fn().mockRejectedValue(ProblemaApi.sinConexion()),
    });
    const api = crearApiAuth(cliente as unknown as ClienteHttp);
    await api.cerrarSesion();
    expect(cliente.peticion).toHaveBeenCalledWith('/auth/logout', { metodo: 'POST', cuerpo: {} });
    expect(cliente.limpiarSesion).toHaveBeenCalled();
  });

  it('Android: el logout envía el refresh en el cuerpo; sin sesión no llama a la API', async () => {
    const nativo = clienteFalso({
      refreshToken: 'r1',
      peticion: vi.fn().mockResolvedValue(undefined),
    });
    await crearApiAuth(nativo as unknown as ClienteHttp).cerrarSesion();
    expect(nativo.peticion).toHaveBeenCalledWith('/auth/logout', {
      metodo: 'POST',
      cuerpo: { refreshToken: 'r1' },
    });
    const sinSesion = clienteFalso({ tieneSesion: false });
    await crearApiAuth(sinSesion as unknown as ClienteHttp).cerrarSesion();
    expect(sinSesion.peticion).not.toHaveBeenCalled();
    expect(sinSesion.limpiarSesion).toHaveBeenCalled();
  });
});
