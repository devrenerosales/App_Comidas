import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { Rol } from '@menu/shared';
import { ServicioCorreoMemoria } from '../correo/memoria-correo.service';
import type { UsuariosRepositorio } from '../usuarios/usuarios.repositorio';
import type { HogarRepositorio } from './hogar.repositorio';
import type { HogarService } from './hogar.service';
import type { InvitacionesRepositorio } from './invitaciones.repositorio';
import {
  InvitacionesService,
  MS_VIGENCIA_INVITACION,
  vistaInvitacion,
} from './invitaciones.service';

const AHORA = new Date('2026-10-22T15:00:00.000Z');
const DIA = 24 * 60 * 60 * 1000;
const ADMIN = { hogarId: 'h1', rol: Rol.ADMIN };

function invitacionFila(extra: Record<string, unknown> = {}) {
  return {
    id: 'i1',
    hogarId: 'h1',
    creadaPorId: 'u1',
    medio: 'CORREO',
    correo: 'ana@correo.com',
    tokenHash: 'h'.repeat(64),
    venceEn: new Date(AHORA.getTime() + 7 * DIA),
    usadaEn: null,
    usadaPorId: null,
    revocadaEn: null,
    correoEnviado: false,
    createdAt: AHORA,
    updatedAt: AHORA,
    ...extra,
  };
}

describe('InvitacionesService', () => {
  const repo = {
    crear: jest.fn(),
    marcarCorreoEnviado: jest.fn(),
    revocarVigentesDeCorreo: jest.fn(),
    listar: jest.fn(),
    buscarPorHash: jest.fn(),
    revocar: jest.fn(),
    aceptar: jest.fn(),
  };
  const hogares = { tieneMiembroConCorreo: jest.fn(), buscar: jest.fn() };
  const usuarios = { buscarPorId: jest.fn() };
  const hogarService = { union: jest.fn() };
  const correo = new ServicioCorreoMemoria(false);
  const config = {
    getOrThrow: () => 'secreto-de-refresh-de-32-caracteres!!',
    get: () => 'https://menu.duckdns.org/',
  } as unknown as ConfigService;
  const servicio = new InvitacionesService(
    repo as unknown as InvitacionesRepositorio,
    hogares as unknown as HogarRepositorio,
    usuarios as unknown as UsuariosRepositorio,
    hogarService as unknown as HogarService,
    correo,
    () => AHORA,
    config,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    correo.limpiar();
    hogares.tieneMiembroConCorreo.mockResolvedValue(false);
    hogares.buscar.mockResolvedValue({ id: 'h1', nombre: 'Familia Rosales' });
    usuarios.buscarPorId.mockResolvedValue({
      id: 'u1',
      nombre: 'Rene',
      correo: 'rene@correo.com',
      activo: true,
    });
    repo.crear.mockImplementation(async (datos) => invitacionFila({ ...datos, id: 'i1' }));
  });

  it('el hash es HMAC-SHA256 hex, estable y distinto del token', () => {
    const hash = servicio.hashToken('abc');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(servicio.hashToken('abc')).toBe(hash);
    expect(servicio.hashToken('abd')).not.toBe(hash);
    expect(servicio.enlaceDe('tok')).toBe('https://menu.duckdns.org/invitacion/tok');
  });

  it('CA-02.1 por correo: token aleatorio, vence en 7 días, guarda solo el hash y envía el correo', async () => {
    const res = await servicio.invitar('u1', ADMIN, { medio: 'CORREO', correo: ' ANA@correo.com' });
    const datos = repo.crear.mock.calls[0][0];
    const token = res.enlace.split('/invitacion/')[1] as string;
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(datos).toMatchObject({
      hogarId: 'h1',
      creadaPorId: 'u1',
      medio: 'CORREO',
      correo: 'ana@correo.com',
      tokenHash: servicio.hashToken(token),
      createdAt: AHORA,
      venceEn: new Date(AHORA.getTime() + MS_VIGENCIA_INVITACION),
    });
    expect(repo.revocarVigentesDeCorreo).toHaveBeenCalledWith('h1', 'ana@correo.com', AHORA);
    expect(repo.marcarCorreoEnviado).toHaveBeenCalledWith('i1');
    expect(res).toMatchObject({ correoEnviado: true, estado: 'VIGENTE' });
    expect(correo.ultimo('ana@correo.com')?.texto).toContain(res.enlace);
    // Dos invitaciones nunca comparten token.
    const otra = await servicio.invitar('u1', ADMIN, { medio: 'ENLACE' });
    expect(otra.enlace).not.toBe(res.enlace);
  });

  it('CU-01.2 5c: ya es miembro → 409 y no crea nada', async () => {
    hogares.tieneMiembroConCorreo.mockResolvedValue(true);
    await expect(
      servicio.invitar('u1', ADMIN, { medio: 'CORREO', correo: 'ana@correo.com' }),
    ).rejects.toMatchObject({ status: 409, codigo: 'YA_ES_MIEMBRO', detalle: 'Ya es miembro' });
    expect(repo.crear).not.toHaveBeenCalled();
  });

  it('por correo sin correo → 422 CORREO_INVALIDO', async () => {
    await expect(servicio.invitar('u1', ADMIN, { medio: 'CORREO' })).rejects.toMatchObject({
      status: 422,
      codigo: 'CORREO_INVALIDO',
    });
  });

  it('CA-02.2 por enlace: no envía correo ni guarda correo', async () => {
    const res = await servicio.invitar('u1', ADMIN, { medio: 'ENLACE', correo: 'x@y.com' });
    expect(repo.crear.mock.calls[0][0]).toMatchObject({ medio: 'ENLACE', correo: null });
    expect(correo.enviados).toHaveLength(0);
    expect(repo.revocarVigentesDeCorreo).not.toHaveBeenCalled();
    expect(res.correoEnviado).toBe(false);
  });

  it('CU-01.2 E2: si el correo falla queda creada con correoEnviado false (y registra el aviso)', async () => {
    const aviso = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    correo.fallarSiguiente = true;
    hogares.buscar.mockResolvedValue(undefined);
    usuarios.buscarPorId.mockResolvedValue(undefined);
    const res = await servicio.invitar('u1', ADMIN, { medio: 'CORREO', correo: 'ana@correo.com' });
    expect(res.correoEnviado).toBe(false);
    expect(res.enlace).toContain('/invitacion/');
    expect(repo.marcarCorreoEnviado).not.toHaveBeenCalled();
    expect(aviso).toHaveBeenCalledWith(expect.stringContaining('i1'));
    aviso.mockRestore();
  });

  it('listar y vistaInvitacion calculan el estado y nunca exponen el hash', async () => {
    repo.listar.mockResolvedValue([
      invitacionFila({ usadaEn: AHORA, usadaPorNombre: 'Ana' }),
      invitacionFila({ id: 'i2', venceEn: new Date(AHORA.getTime() - 1) }),
    ]);
    const lista = await servicio.listar('h1');
    expect(lista.map((i) => i.estado)).toEqual(['USADA', 'VENCIDA']);
    expect(lista[0]).toMatchObject({ usadaPor: 'Ana', usadaEn: AHORA.toISOString() });
    expect(JSON.stringify(lista)).not.toContain('h'.repeat(64));
    expect(vistaInvitacion(invitacionFila() as never, AHORA).usadaPor).toBeNull();
  });

  it('revocar: 204, 404 si no es del hogar, 409 si ya se usó', async () => {
    repo.revocar.mockResolvedValueOnce('revocada');
    await expect(servicio.revocar('h1', 'i1')).resolves.toBeUndefined();
    expect(repo.revocar).toHaveBeenCalledWith('h1', 'i1', AHORA);
    repo.revocar.mockResolvedValueOnce('no_existe');
    await expect(servicio.revocar('h1', 'i1')).rejects.toMatchObject({ status: 404 });
    repo.revocar.mockResolvedValueOnce('usada');
    await expect(servicio.revocar('h1', 'i1')).rejects.toMatchObject({
      codigo: 'INVITACION_USADA',
    });
  });

  it('verPublica: datos mínimos con el correo enmascarado', async () => {
    repo.buscarPorHash.mockResolvedValue({
      ...invitacionFila(),
      hogarNombre: 'Familia Rosales',
      creadaPorNombre: 'Rene',
    });
    await expect(servicio.verPublica('tok')).resolves.toEqual({
      hogarNombre: 'Familia Rosales',
      invitadoPor: 'Rene',
      medio: 'CORREO',
      correo: 'a**@correo.com',
      venceEn: new Date(AHORA.getTime() + 7 * DIA).toISOString(),
    });
    expect(repo.buscarPorHash).toHaveBeenCalledWith(servicio.hashToken('tok'));
  });

  it('CA-02.3 verPublica: vencida, inexistente o token vacío → 410', async () => {
    repo.buscarPorHash.mockResolvedValueOnce({
      ...invitacionFila({
        venceEn: new Date(AHORA.getTime() - DIA),
        createdAt: new Date(AHORA.getTime() - 8 * DIA),
      }),
      hogarNombre: 'Familia Rosales',
      creadaPorNombre: 'Rene',
    });
    await expect(servicio.verPublica('tok')).rejects.toMatchObject({
      status: 410,
      detalle: 'Invitación no válida, pide una nueva',
    });
    repo.buscarPorHash.mockResolvedValueOnce(undefined);
    await expect(servicio.verPublica('tok')).rejects.toMatchObject({ status: 410 });
    await expect(servicio.verPublica('')).rejects.toMatchObject({ status: 410 });
  });

  describe('aceptar', () => {
    beforeEach(() => {
      usuarios.buscarPorId.mockResolvedValue({
        id: 'u2',
        nombre: 'Ana',
        correo: 'ana@correo.com',
        activo: true,
      });
      hogarService.union.mockReturnValue({ rol: 'MIEMBRO' });
    });

    it('CA-02.2 une como MIEMBRO con un token nuevo', async () => {
      repo.aceptar.mockResolvedValue({
        tipo: 'aceptada',
        hogarId: 'h1',
        hogarNombre: 'Familia Rosales',
      });
      await expect(servicio.aceptar('u2', 'tok')).resolves.toEqual({ rol: 'MIEMBRO' });
      expect(repo.aceptar).toHaveBeenCalledWith(
        servicio.hashToken('tok'),
        { id: 'u2', correo: 'ana@correo.com' },
        AHORA,
      );
      expect(hogarService.union).toHaveBeenCalledWith('u2', 'h1', 'Familia Rosales', Rol.MIEMBRO);
    });

    it('CA-02.3 no válida → 410', async () => {
      repo.aceptar.mockResolvedValue({ tipo: 'no_valida' });
      await expect(servicio.aceptar('u2', 'tok')).rejects.toMatchObject({
        status: 410,
        codigo: 'INVITACION_NO_VALIDA',
      });
      await expect(servicio.aceptar('u2', 'x'.repeat(129))).rejects.toMatchObject({ status: 410 });
    });

    it('CA-02.4 ya tiene hogar → 409 "Tu cuenta ya pertenece a un hogar"', async () => {
      repo.aceptar.mockResolvedValue({ tipo: 'ya_tiene_hogar' });
      await expect(servicio.aceptar('u2', 'tok')).rejects.toMatchObject({
        status: 409,
        detalle: 'Tu cuenta ya pertenece a un hogar',
      });
    });

    it('invitación por correo para otra cuenta → 403', async () => {
      repo.aceptar.mockResolvedValue({ tipo: 'otro_correo' });
      await expect(servicio.aceptar('u2', 'tok')).rejects.toMatchObject({
        status: 403,
        codigo: 'INVITACION_DE_OTRO_CORREO',
      });
    });

    it('usuario inexistente o inactivo → 401', async () => {
      usuarios.buscarPorId.mockResolvedValueOnce(undefined);
      await expect(servicio.aceptar('u2', 'tok')).rejects.toMatchObject({ status: 401 });
      usuarios.buscarPorId.mockResolvedValueOnce({ id: 'u2', activo: false });
      await expect(servicio.aceptar('u2', 'tok')).rejects.toMatchObject({ status: 401 });
      expect(repo.aceptar).not.toHaveBeenCalled();
    });
  });
});
