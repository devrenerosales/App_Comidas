import { describe, expect, it, vi } from 'vitest';
import { crearApiHogar } from './hogar';

function clienteFalso(respuesta: unknown = {}) {
  return {
    peticion: vi.fn().mockResolvedValue(respuesta),
    establecerAcceso: vi.fn(),
  };
}

describe('API del hogar (HU-02)', () => {
  it('crearHogar: POST /hogares y usa el token nuevo con hogarId', async () => {
    const cliente = clienteFalso({ accessToken: 'nuevo', hogar: { id: 'h1' } });
    const api = crearApiHogar(cliente);
    await api.crearHogar('Familia Rosales');
    expect(cliente.peticion).toHaveBeenCalledWith('/hogares', {
      metodo: 'POST',
      cuerpo: { nombre: 'Familia Rosales' },
    });
    expect(cliente.establecerAcceso).toHaveBeenCalledWith('nuevo');
  });

  it('aceptarInvitacion: POST /invitaciones/{token}/aceptar y usa el token nuevo', async () => {
    const cliente = clienteFalso({ accessToken: 'miembro' });
    await crearApiHogar(cliente).aceptarInvitacion('a/b');
    expect(cliente.peticion).toHaveBeenCalledWith('/invitaciones/a%2Fb/aceptar', {
      metodo: 'POST',
    });
    expect(cliente.establecerAcceso).toHaveBeenCalledWith('miembro');
  });

  it('verInvitacion es público (sin token)', async () => {
    const cliente = clienteFalso();
    await crearApiHogar(cliente).verInvitacion('tok');
    expect(cliente.peticion).toHaveBeenCalledWith('/invitaciones/tok', { autenticar: false });
  });

  it('rutas del hogar del token (/hogar/…)', async () => {
    const cliente = clienteFalso();
    const api = crearApiHogar(cliente);
    await api.obtenerHogar();
    await api.invitar({ medio: 'CORREO', correo: 'ana@correo.com' });
    await api.listarInvitaciones();
    await api.revocarInvitacion('i1');
    expect(cliente.peticion.mock.calls).toEqual([
      ['/hogar'],
      [
        '/hogar/invitaciones',
        { metodo: 'POST', cuerpo: { medio: 'CORREO', correo: 'ana@correo.com' } },
      ],
      ['/hogar/invitaciones'],
      ['/hogar/invitaciones/i1', { metodo: 'DELETE' }],
    ]);
    expect(cliente.establecerAcceso).not.toHaveBeenCalled();
  });
});
