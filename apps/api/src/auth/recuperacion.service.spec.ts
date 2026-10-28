import { ConfigService } from '@nestjs/config';
import { UsuariosRepositorio } from '../usuarios/usuarios.repositorio';
import { RecuperacionRepositorio } from './recuperacion.repositorio';
import { ContrasenasService } from './contrasenas.service';
import {
  RecuperacionService,
  hashRecuperacion,
  MENSAJE_RECUPERACION,
} from './recuperacion.service';

describe('RecuperacionService (HU-04)', () => {
  const ahora = new Date('2026-10-26T15:00:00Z');
  const usuarios = { buscarPorCorreo: jest.fn() };
  const repositorio = { crear: jest.fn(), vigente: jest.fn(), restablecer: jest.fn() };
  const contrasenas = { hash: jest.fn().mockResolvedValue('hash-seguro') };
  const correo = { enviar: jest.fn() };
  const config = { getOrThrow: jest.fn().mockReturnValue('https://menu.test/') };
  const service = new RecuperacionService(
    usuarios as unknown as UsuariosRepositorio,
    repositorio as unknown as RecuperacionRepositorio,
    contrasenas as unknown as ContrasenasService,
    config as unknown as ConfigService,
    correo,
    () => ahora,
  );
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('envía un enlace aleatorio de una hora y solo guarda su hash', async () => {
    usuarios.buscarPorCorreo.mockResolvedValue({
      id: 'u1',
      correo: 'ana@correo.com',
      activo: true,
    });
    expect(await service.solicitar(' ANA@CORREO.COM ')).toEqual({ mensaje: MENSAJE_RECUPERACION });
    expect(usuarios.buscarPorCorreo).toHaveBeenCalledWith('ana@correo.com');
    const mensaje = correo.enviar.mock.calls[0]?.[0];
    const token = mensaje.texto.match(/\/restablecer\/([A-Za-z0-9_-]{43})/)[1];
    expect(repositorio.crear).toHaveBeenCalledWith(
      'u1',
      hashRecuperacion(token),
      new Date('2026-10-26T16:00:00Z'),
    );
    expect(mensaje.html).toContain('Crear nueva contraseña');
  });

  it.each([undefined, { activo: false }])(
    'no envía correo para cuenta ausente o inactiva: %j',
    async (cuenta) => {
      usuarios.buscarPorCorreo.mockResolvedValue(cuenta);
      expect(await service.solicitar('nadie@correo.com')).toEqual({
        mensaje: MENSAJE_RECUPERACION,
      });
      expect(correo.enviar).not.toHaveBeenCalled();
      expect(repositorio.crear).not.toHaveBeenCalled();
    },
  );

  it('rechaza una confirmación distinta sin calcular el hash ni consumir el enlace', async () => {
    await expect(service.restablecer('token', 'ClaveSegura9', 'OtraClave9')).rejects.toMatchObject({
      status: 422,
    });
    expect(contrasenas.hash).not.toHaveBeenCalled();
  });

  it('consume el token con el hash de la contraseña y el reloj inyectado', async () => {
    repositorio.restablecer.mockResolvedValue(true);
    await expect(service.restablecer('token', 'ClaveSegura9', 'ClaveSegura9')).resolves.toEqual({
      mensaje: 'Contraseña actualizada',
    });
    expect(repositorio.restablecer).toHaveBeenCalledWith(
      hashRecuperacion('token'),
      'hash-seguro',
      ahora,
    );
    repositorio.restablecer.mockResolvedValue(false);
    await expect(
      service.restablecer('token', 'ClaveSegura9', 'ClaveSegura9'),
    ).rejects.toMatchObject({ codigo: 'ENLACE_NO_VALIDO' });
  });

  it('valida el enlace sin consumirlo y rechaza uno vencido', async () => {
    repositorio.vigente.mockResolvedValue(true);
    await expect(service.validar('token')).resolves.toBeUndefined();
    repositorio.vigente.mockResolvedValue(false);
    await expect(service.validar('token')).rejects.toMatchObject({ codigo: 'ENLACE_NO_VALIDO' });
    expect(repositorio.restablecer).not.toHaveBeenCalled();
  });
});
