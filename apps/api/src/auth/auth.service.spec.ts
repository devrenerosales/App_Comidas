import type { Usuario } from '@menu/db';
import { Problema } from '../comun/problema';
import { CorreoDuplicadoError, UsuariosRepositorio } from '../usuarios/usuarios.repositorio';
import { AuthService } from './auth.service';
import { ContrasenasService } from './contrasenas.service';
import { RefreshTokensRepositorio } from './refresh-tokens.repositorio';
import { TokensService } from './tokens.service';

const AHORA = new Date('2026-10-22T15:00:00.000Z');

function usuarioDe(extra: Partial<Usuario> = {}): Usuario {
  return {
    id: 'u1',
    nombre: 'Rene',
    correo: 'rene@correo.com',
    hashContrasena: 'hash',
    intentosFallidos: 0,
    primerIntentoFallidoEn: null,
    bloqueadoHasta: null,
    sesionesInvalidasAntesDe: null,
    esAdminSistema: false,
    activo: true,
    createdAt: AHORA,
    updatedAt: AHORA,
    ...extra,
  };
}

function crear() {
  const usuarios = {
    buscarPorCorreo: jest.fn().mockResolvedValue(undefined),
    buscarPorId: jest.fn().mockResolvedValue(usuarioDe()),
    crear: jest.fn().mockImplementation(async (d) => usuarioDe(d)),
    registrarIntentoFallido: jest.fn().mockResolvedValue(undefined),
    reiniciarIntentos: jest.fn().mockResolvedValue(undefined),
    hogarDe: jest.fn().mockResolvedValue(null),
  };
  const refresh = {
    crear: jest.fn().mockResolvedValue(undefined),
    rotar: jest.fn(),
    revocarFamilia: jest.fn().mockResolvedValue(undefined),
    familiaDe: jest.fn().mockResolvedValue(null),
  };
  const contrasenas = {
    hash: jest.fn().mockResolvedValue('$argon2id$hash'),
    verificar: jest.fn().mockResolvedValue(true),
    verificarFicticio: jest.fn().mockResolvedValue(false),
  };
  const tokens = {
    firmarAcceso: jest.fn().mockReturnValue({
      token: 'acceso',
      expiraEn: new Date(AHORA.getTime() + 900_000),
    }),
    generarRefresh: jest
      .fn()
      .mockReturnValue({ token: 'refresh-nuevo', hash: 'h-nuevo', venceEn: new Date(0) }),
    hashRefresh: jest.fn((t: string) => `h(${t})`),
    nuevaFamilia: jest.fn().mockReturnValue('familia-1'),
  };
  const servicio = new AuthService(
    usuarios as unknown as UsuariosRepositorio,
    refresh as unknown as RefreshTokensRepositorio,
    contrasenas as unknown as ContrasenasService,
    tokens as unknown as TokensService,
    () => AHORA,
  );
  return { servicio, usuarios, refresh, contrasenas, tokens };
}

async function problemaDe(promesa: Promise<unknown>): Promise<Problema> {
  try {
    await promesa;
  } catch (error) {
    if (error instanceof Problema) return error;
    throw error;
  }
  throw new Error('Se esperaba un Problema');
}

describe('AuthService', () => {
  describe('registrar', () => {
    it('CA-01.1 crea el usuario con hash, normaliza el correo e inicia sesión sin hogar', async () => {
      const { servicio, usuarios, refresh, tokens } = crear();
      const sesion = await servicio.registrar(
        { nombre: ' Rene ', correo: ' Rene@Correo.com', contrasena: 'Almuerzo2026' },
        { dispositivo: '  Chrome  ' },
      );
      expect(usuarios.crear).toHaveBeenCalledWith({
        nombre: 'Rene',
        correo: 'rene@correo.com',
        hashContrasena: '$argon2id$hash',
      });
      expect(refresh.crear).toHaveBeenCalledWith(
        expect.objectContaining({
          familia: 'familia-1',
          tokenHash: 'h-nuevo',
          dispositivo: 'Chrome',
        }),
      );
      expect(tokens.firmarAcceso).toHaveBeenCalledWith(
        { sub: 'u1', hogarId: null, rol: null },
        AHORA,
      );
      expect(sesion).toEqual({
        usuario: { id: 'u1', nombre: 'Rene', correo: 'rene@correo.com', esAdminSistema: false },
        accessToken: 'acceso',
        refreshToken: 'refresh-nuevo',
        expiraEn: '2026-10-22T15:15:00.000Z',
        hogar: null,
      });
    });

    it('CA-01.2 correo existente → 409 CORREO_REGISTRADO', async () => {
      const { servicio, usuarios } = crear();
      usuarios.buscarPorCorreo.mockResolvedValue(usuarioDe());
      const p = await problemaDe(
        servicio.registrar({ nombre: 'R', correo: 'rene@correo.com', contrasena: 'Almuerzo2026' }),
      );
      expect(p.getStatus()).toBe(409);
      expect(p.codigo).toBe('CORREO_REGISTRADO');
      expect(p.detalle).toBe('Este correo ya tiene cuenta');
      expect(usuarios.crear).not.toHaveBeenCalled();
    });

    it('CA-01.2 carrera de registros simultáneos (unicidad en BD) → 409', async () => {
      const { servicio, usuarios } = crear();
      usuarios.crear.mockRejectedValue(new CorreoDuplicadoError());
      const p = await problemaDe(
        servicio.registrar({ nombre: 'R', correo: 'rene@correo.com', contrasena: 'Almuerzo2026' }),
      );
      expect(p.codigo).toBe('CORREO_REGISTRADO');
    });

    it('propaga otros errores de base de datos', async () => {
      const { servicio, usuarios } = crear();
      usuarios.crear.mockRejectedValue(new Error('BD caída'));
      await expect(
        servicio.registrar({ nombre: 'R', correo: 'r@c.com', contrasena: 'Almuerzo2026' }),
      ).rejects.toThrow('BD caída');
    });
  });

  describe('iniciarSesion', () => {
    it('CA-01.1 credenciales correctas: emite sesión con el hogar y su rol', async () => {
      const { servicio, usuarios, tokens } = crear();
      usuarios.buscarPorCorreo.mockResolvedValue(usuarioDe());
      usuarios.hogarDe.mockResolvedValue({ id: 'h1', nombre: 'Casa', rol: 'ADMIN' });
      const sesion = await servicio.iniciarSesion({ correo: 'RENE@correo.com', contrasena: 'x' });
      expect(usuarios.buscarPorCorreo).toHaveBeenCalledWith('rene@correo.com');
      expect(usuarios.reiniciarIntentos).not.toHaveBeenCalled();
      expect(tokens.firmarAcceso).toHaveBeenCalledWith(
        { sub: 'u1', hogarId: 'h1', rol: 'ADMIN' },
        AHORA,
      );
      expect(sesion.hogar).toEqual({ id: 'h1', nombre: 'Casa', rol: 'ADMIN' });
    });

    it('reinicia los intentos tras un login correcto con fallos previos', async () => {
      const { servicio, usuarios } = crear();
      usuarios.buscarPorCorreo.mockResolvedValue(usuarioDe({ intentosFallidos: 2 }));
      await servicio.iniciarSesion({ correo: 'rene@correo.com', contrasena: 'x' });
      expect(usuarios.reiniciarIntentos).toHaveBeenCalledWith('u1');
    });

    it('reinicia el bloqueo vencido tras un login correcto', async () => {
      const { servicio, usuarios } = crear();
      usuarios.buscarPorCorreo.mockResolvedValue(
        usuarioDe({ bloqueadoHasta: new Date(AHORA.getTime() - 1) }),
      );
      await servicio.iniciarSesion({ correo: 'rene@correo.com', contrasena: 'x' });
      expect(usuarios.reiniciarIntentos).toHaveBeenCalledWith('u1');
    });

    it('CA-01.3 correo inexistente: mensaje genérico y verificación ficticia (mismo tiempo)', async () => {
      const { servicio, contrasenas } = crear();
      const p = await problemaDe(servicio.iniciarSesion({ correo: 'x@c.com', contrasena: 'y' }));
      expect(p.getStatus()).toBe(401);
      expect(p.codigo).toBe('CREDENCIALES_INVALIDAS');
      expect(p.detalle).toBe('Correo o contraseña incorrectos');
      expect(contrasenas.verificarFicticio).toHaveBeenCalledWith('y');
    });

    it('cuenta inactiva: mismo mensaje genérico', async () => {
      const { servicio, usuarios } = crear();
      usuarios.buscarPorCorreo.mockResolvedValue(usuarioDe({ activo: false }));
      const p = await problemaDe(servicio.iniciarSesion({ correo: 'r@c.com', contrasena: 'y' }));
      expect(p.codigo).toBe('CREDENCIALES_INVALIDAS');
    });

    it('CA-01.3 contraseña incorrecta: registra el intento fallido y responde genérico', async () => {
      const { servicio, usuarios, contrasenas } = crear();
      usuarios.buscarPorCorreo.mockResolvedValue(usuarioDe({ intentosFallidos: 4 }));
      contrasenas.verificar.mockResolvedValue(false);
      const p = await problemaDe(
        servicio.iniciarSesion({ correo: 'rene@correo.com', contrasena: 'incorrecta1' }),
      );
      expect(p.detalle).toBe('Correo o contraseña incorrectos');
      expect(usuarios.registrarIntentoFallido).toHaveBeenCalledWith('u1', AHORA);
    });

    it('CA-01.3 cuenta bloqueada → 423 CUENTA_BLOQUEADA sin verificar la contraseña', async () => {
      const { servicio, usuarios, contrasenas } = crear();
      const hasta = new Date(AHORA.getTime() + 10 * 60_000);
      usuarios.buscarPorCorreo.mockResolvedValue(usuarioDe({ bloqueadoHasta: hasta }));
      const p = await problemaDe(
        servicio.iniciarSesion({ correo: 'rene@correo.com', contrasena: 'Almuerzo2026' }),
      );
      expect(p.getStatus()).toBe(423);
      expect(p.codigo).toBe('CUENTA_BLOQUEADA');
      expect(p.extensiones).toEqual({ bloqueadoHasta: hasta.toISOString() });
      expect(contrasenas.verificar).not.toHaveBeenCalled();
    });
  });

  describe('renovar', () => {
    it('sin refresh → 401 SESION_INVALIDA', async () => {
      const { servicio } = crear();
      expect((await problemaDe(servicio.renovar(undefined))).codigo).toBe('SESION_INVALIDA');
    });

    it('rota y emite un nuevo acceso con el hogar vigente', async () => {
      const { servicio, refresh, usuarios } = crear();
      refresh.rotar.mockResolvedValue({ tipo: 'rotado', usuarioId: 'u1', familia: 'f1' });
      usuarios.hogarDe.mockResolvedValue({ id: 'h1', nombre: 'Casa', rol: 'MIEMBRO' });
      const sesion = await servicio.renovar('viejo', { dispositivo: 'Pixel' });
      expect(refresh.rotar).toHaveBeenCalledWith(
        'h(viejo)',
        { tokenHash: 'h-nuevo', venceEn: new Date(0), dispositivo: 'Pixel' },
        AHORA,
      );
      expect(sesion.refreshToken).toBe('refresh-nuevo');
      expect(sesion.hogar?.rol).toBe('MIEMBRO');
    });

    it('seguridad: reutilización detectada → 401 SESION_REVOCADA', async () => {
      const { servicio, refresh } = crear();
      refresh.rotar.mockResolvedValue({ tipo: 'reutilizado', usuarioId: 'u1', familia: 'f1' });
      expect((await problemaDe(servicio.renovar('viejo'))).codigo).toBe('SESION_REVOCADA');
    });

    it('refresh inválido o vencido → 401 SESION_INVALIDA', async () => {
      const { servicio, refresh } = crear();
      refresh.rotar.mockResolvedValue({ tipo: 'invalido' });
      expect((await problemaDe(servicio.renovar('x'))).codigo).toBe('SESION_INVALIDA');
    });

    it.each([[undefined], [usuarioDe({ activo: false })]])(
      'usuario eliminado o inactivo → revoca la familia y 401',
      async (encontrado) => {
        const { servicio, refresh, usuarios } = crear();
        refresh.rotar.mockResolvedValue({ tipo: 'rotado', usuarioId: 'u1', familia: 'f1' });
        usuarios.buscarPorId.mockResolvedValue(encontrado);
        expect((await problemaDe(servicio.renovar('x'))).codigo).toBe('SESION_INVALIDA');
        expect(refresh.revocarFamilia).toHaveBeenCalledWith('f1', AHORA);
      },
    );
  });

  describe('cerrarSesion', () => {
    it('sin refresh no hace nada', async () => {
      const { servicio, refresh } = crear();
      await servicio.cerrarSesion('u1', undefined);
      expect(refresh.familiaDe).not.toHaveBeenCalled();
    });

    it('revoca la familia del refresh del propio usuario', async () => {
      const { servicio, refresh } = crear();
      refresh.familiaDe.mockResolvedValue('f1');
      await servicio.cerrarSesion('u1', 'r');
      expect(refresh.familiaDe).toHaveBeenCalledWith('h(r)', 'u1');
      expect(refresh.revocarFamilia).toHaveBeenCalledWith('f1', AHORA);
    });

    it('seguridad: un refresh de otro usuario no se revoca', async () => {
      const { servicio, refresh } = crear();
      await servicio.cerrarSesion('u1', 'de-otro');
      expect(refresh.revocarFamilia).not.toHaveBeenCalled();
    });
  });

  describe('perfil', () => {
    it('devuelve los datos públicos del usuario y su hogar', async () => {
      const { servicio, usuarios } = crear();
      const perfil = await servicio.perfil('u1');
      expect(usuarios.buscarPorId).toHaveBeenCalledWith('u1');
      expect(perfil).toEqual({
        id: 'u1',
        nombre: 'Rene',
        correo: 'rene@correo.com',
        esAdminSistema: false,
        hogar: null,
      });
      expect(perfil).not.toHaveProperty('hashContrasena');
    });

    it.each([[undefined], [usuarioDe({ activo: false })]])(
      'usuario inexistente o inactivo → 401',
      async (encontrado) => {
        const { servicio, usuarios } = crear();
        usuarios.buscarPorId.mockResolvedValue(encontrado);
        expect((await problemaDe(servicio.perfil('u1'))).getStatus()).toBe(401);
      },
    );
  });
});
