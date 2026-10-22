import { Inject, Injectable } from '@nestjs/common';
import type { Usuario } from '@menu/db';
import { MENSAJES_CUENTA, normalizarCorreo } from '@menu/shared';
import { Problema } from '../comun/problema';
import { CorreoDuplicadoError, UsuariosRepositorio } from '../usuarios/usuarios.repositorio';
import { RELOJ, type Reloj } from './auth.constants';
import type { ContextoCliente, HogarDeSesion, Sesion, UsuarioPublico } from './auth.tipos';
import { estaBloqueada } from './bloqueo';
import { ContrasenasService } from './contrasenas.service';
import { RefreshTokensRepositorio } from './refresh-tokens.repositorio';
import { TokensService } from './tokens.service';

export interface DatosRegistro {
  nombre: string;
  correo: string;
  contrasena: string;
}

export interface DatosLogin {
  correo: string;
  contrasena: string;
}

export interface PerfilUsuario extends UsuarioPublico {
  hogar: HogarDeSesion | null;
}

const LARGO_DISPOSITIVO = 120;

/** Casos de uso de CU-01.1: registro, inicio de sesión, renovación y cierre (ADR-004). */
@Injectable()
export class AuthService {
  constructor(
    private readonly usuarios: UsuariosRepositorio,
    private readonly refreshTokens: RefreshTokensRepositorio,
    private readonly contrasenas: ContrasenasService,
    private readonly tokens: TokensService,
    @Inject(RELOJ) private readonly reloj: Reloj,
  ) {}

  /** CU-01.1 pasos 1–5 y flujo alterno 3a. */
  async registrar(datos: DatosRegistro, cliente: ContextoCliente = {}): Promise<Sesion> {
    const correo = normalizarCorreo(datos.correo);
    if (await this.usuarios.buscarPorCorreo(correo)) throw this.correoRegistrado();
    const hashContrasena = await this.contrasenas.hash(datos.contrasena);
    let nuevo: Usuario;
    try {
      nuevo = await this.usuarios.crear({ nombre: datos.nombre.trim(), correo, hashContrasena });
    } catch (error) {
      if (error instanceof CorreoDuplicadoError) throw this.correoRegistrado();
      throw error;
    }
    return this.emitirSesion(nuevo, null, this.tokens.nuevaFamilia(), cliente);
  }

  /** CU-01.1 pasos 7–9 y flujos alternos 8a (mensaje genérico) y 8b (bloqueo). */
  async iniciarSesion(datos: DatosLogin, cliente: ContextoCliente = {}): Promise<Sesion> {
    const ahora = this.reloj();
    const encontrado = await this.usuarios.buscarPorCorreo(normalizarCorreo(datos.correo));
    if (!encontrado || !encontrado.activo) {
      await this.contrasenas.verificarFicticio(datos.contrasena);
      throw this.credencialesInvalidas();
    }
    if (estaBloqueada(encontrado, ahora)) {
      throw new Problema(423, 'CUENTA_BLOQUEADA', MENSAJES_CUENTA.cuentaBloqueada, {
        bloqueadoHasta: (encontrado.bloqueadoHasta as Date).toISOString(),
      });
    }
    const valida = await this.contrasenas.verificar(encontrado.hashContrasena, datos.contrasena);
    if (!valida) {
      await this.usuarios.registrarIntentoFallido(encontrado.id, ahora);
      throw this.credencialesInvalidas();
    }
    if (encontrado.intentosFallidos > 0 || encontrado.bloqueadoHasta !== null) {
      await this.usuarios.reiniciarIntentos(encontrado.id);
    }
    const hogar = await this.usuarios.hogarDe(encontrado.id);
    return this.emitirSesion(encontrado, hogar, this.tokens.nuevaFamilia(), cliente);
  }

  /** Rota el refresh; si se reutiliza uno ya rotado revoca toda la familia (ADR-004). */
  async renovar(refreshToken: string | undefined, cliente: ContextoCliente = {}): Promise<Sesion> {
    if (!refreshToken) throw this.sesionInvalida();
    const ahora = this.reloj();
    const nuevo = this.tokens.generarRefresh(ahora);
    const resultado = await this.refreshTokens.rotar(
      this.tokens.hashRefresh(refreshToken),
      { tokenHash: nuevo.hash, venceEn: nuevo.venceEn, dispositivo: this.dispositivo(cliente) },
      ahora,
    );
    if (resultado.tipo === 'reutilizado') {
      throw new Problema(401, 'SESION_REVOCADA', MENSAJES_CUENTA.sesionTerminada);
    }
    if (resultado.tipo === 'invalido') throw this.sesionInvalida();
    const usuario = await this.usuarios.buscarPorId(resultado.usuarioId);
    if (!usuario || !usuario.activo) {
      await this.refreshTokens.revocarFamilia(resultado.familia, ahora);
      throw this.sesionInvalida();
    }
    const hogar = await this.usuarios.hogarDe(usuario.id);
    return this.sesionCon(usuario, hogar, nuevo.token, ahora);
  }

  /** Cierra la sesión del dispositivo: revoca la familia del refresh si es del usuario. */
  async cerrarSesion(usuarioId: string, refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    const familia = await this.refreshTokens.familiaDe(
      this.tokens.hashRefresh(refreshToken),
      usuarioId,
    );
    if (familia) await this.refreshTokens.revocarFamilia(familia, this.reloj());
  }

  /** GET /usuarios/yo: datos del usuario del token (nunca de otro). */
  async perfil(usuarioId: string): Promise<PerfilUsuario> {
    const usuario = await this.usuarios.buscarPorId(usuarioId);
    if (!usuario || !usuario.activo) {
      throw new Problema(401, 'TOKEN_INVALIDO', 'Inicia sesión para continuar.');
    }
    return { ...this.publico(usuario), hogar: await this.usuarios.hogarDe(usuario.id) };
  }

  private async emitirSesion(
    usuario: Usuario,
    hogar: HogarDeSesion | null,
    familia: string,
    cliente: ContextoCliente,
  ): Promise<Sesion> {
    const ahora = this.reloj();
    const refresh = this.tokens.generarRefresh(ahora);
    await this.refreshTokens.crear({
      usuarioId: usuario.id,
      tokenHash: refresh.hash,
      familia,
      dispositivo: this.dispositivo(cliente),
      venceEn: refresh.venceEn,
    });
    return this.sesionCon(usuario, hogar, refresh.token, ahora);
  }

  private sesionCon(
    usuario: Usuario,
    hogar: HogarDeSesion | null,
    refreshToken: string,
    ahora: Date,
  ): Sesion {
    const acceso = this.tokens.firmarAcceso(
      { sub: usuario.id, hogarId: hogar?.id ?? null, rol: hogar?.rol ?? null },
      ahora,
    );
    return {
      usuario: this.publico(usuario),
      accessToken: acceso.token,
      refreshToken,
      expiraEn: acceso.expiraEn.toISOString(),
      hogar,
    };
  }

  private publico(usuario: Usuario): UsuarioPublico {
    return {
      id: usuario.id,
      nombre: usuario.nombre,
      correo: usuario.correo,
      esAdminSistema: usuario.esAdminSistema,
    };
  }

  private dispositivo(cliente: ContextoCliente): string | null {
    const texto = cliente.dispositivo?.trim();
    return texto ? texto.slice(0, LARGO_DISPOSITIVO) : null;
  }

  private correoRegistrado(): Problema {
    return new Problema(409, 'CORREO_REGISTRADO', MENSAJES_CUENTA.correoRegistrado);
  }

  private credencialesInvalidas(): Problema {
    return new Problema(401, 'CREDENCIALES_INVALIDAS', MENSAJES_CUENTA.credencialesInvalidas);
  }

  private sesionInvalida(): Problema {
    return new Problema(401, 'SESION_INVALIDA', MENSAJES_CUENTA.sesionTerminada);
  }
}
