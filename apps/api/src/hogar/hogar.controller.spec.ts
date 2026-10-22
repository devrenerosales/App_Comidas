import type { Response } from 'express';
import { Rol } from '@menu/shared';
import { HogarController, HogaresController } from './hogar.controller';
import type { HogarService } from './hogar.service';
import { InvitacionesController } from './invitaciones.controller';
import type { InvitacionesService } from './invitaciones.service';

describe('controladores del hogar', () => {
  const res = { setHeader: jest.fn() } as unknown as Response;
  const hogar = {
    crear: jest.fn().mockResolvedValue('creado'),
    obtener: jest.fn().mockResolvedValue('vista'),
    renombrar: jest.fn().mockResolvedValue('renombrado'),
  };
  const invitaciones = {
    invitar: jest.fn().mockResolvedValue('invitacion'),
    listar: jest.fn().mockResolvedValue([]),
    revocar: jest.fn().mockResolvedValue(undefined),
    verPublica: jest.fn().mockResolvedValue('publica'),
    aceptar: jest.fn().mockResolvedValue('union'),
  };
  const contexto = { hogarId: 'h1', rol: Rol.ADMIN };

  beforeEach(() => jest.clearAllMocks());

  it('POST /hogares delega con el usuario del token y no cachea el token nuevo', async () => {
    const ctrl = new HogaresController(hogar as unknown as HogarService);
    await expect(ctrl.crear('u1', { nombre: 'Familia Rosales' }, res)).resolves.toBe('creado');
    expect(hogar.crear).toHaveBeenCalledWith('u1', 'Familia Rosales');
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  });

  it('/hogar usa siempre el hogar resuelto por HogarGuard', async () => {
    const ctrl = new HogarController(
      hogar as unknown as HogarService,
      invitaciones as unknown as InvitacionesService,
    );
    await ctrl.obtener('h1');
    expect(hogar.obtener).toHaveBeenCalledWith('h1');
    await ctrl.renombrar('h1', { nombre: 'Otro' });
    expect(hogar.renombrar).toHaveBeenCalledWith('h1', 'Otro');
    await ctrl.invitar('u1', contexto, { medio: 'ENLACE' }, res);
    expect(invitaciones.invitar).toHaveBeenCalledWith('u1', contexto, { medio: 'ENLACE' });
    await ctrl.listarInvitaciones('h1');
    expect(invitaciones.listar).toHaveBeenCalledWith('h1');
    await ctrl.revocar('h1', 'i1');
    expect(invitaciones.revocar).toHaveBeenCalledWith('h1', 'i1');
  });

  it('/invitaciones/{token}', async () => {
    const ctrl = new InvitacionesController(invitaciones as unknown as InvitacionesService);
    await expect(ctrl.ver('tok', res)).resolves.toBe('publica');
    await expect(ctrl.aceptar('u2', 'tok', res)).resolves.toBe('union');
    expect(invitaciones.aceptar).toHaveBeenCalledWith('u2', 'tok');
    expect(res.setHeader).toHaveBeenCalledTimes(2);
  });
});
