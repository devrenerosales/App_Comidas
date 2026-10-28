import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes } from 'node:crypto';
import type { Invitacion } from '@menu/db';
import {
  DIAS_VIGENCIA_INVITACION,
  enmascararCorreo,
  EstadoInvitacion,
  estadoInvitacion,
  MedioInvitacion,
  MENSAJES_HOGAR,
  normalizarCorreo,
  Rol,
} from '@menu/shared';
import { RELOJ, type Reloj } from '../auth/auth.constants';
import { Problema } from '../comun/problema';
import { SERVICIO_CORREO, type ServicioCorreo } from '../correo/correo.tipos';
import { correoInvitacion } from '../correo/plantillas/invitacion';
import { UsuariosRepositorio } from '../usuarios/usuarios.repositorio';
import { HogarRepositorio } from './hogar.repositorio';
import { HogarService } from './hogar.service';
import type {
  HogarDelUsuario,
  InvitacionCreada,
  RespuestaUnionHogar,
  VistaInvitacion,
  VistaPublicaInvitacion,
} from './hogar.tipos';
import { InvitacionesRepositorio, type FilaInvitacion } from './invitaciones.repositorio';

export const MS_VIGENCIA_INVITACION = DIAS_VIGENCIA_INVITACION * 24 * 60 * 60 * 1000;

/** Largo máximo aceptado para un token recibido (el emitido tiene 43 caracteres). */
const LARGO_MAXIMO_TOKEN = 128;

export interface DatosInvitar {
  medio: MedioInvitacion;
  correo?: string;
}

/** Vista de una invitación para el administrador (nunca incluye el token ni su hash). */
export function vistaInvitacion(
  inv: Invitacion & { usadaPorNombre?: string | null },
  ahora: Date,
): VistaInvitacion {
  return {
    id: inv.id,
    medio: inv.medio as MedioInvitacion,
    correo: inv.correo,
    estado: estadoInvitacion(inv, ahora),
    venceEn: inv.venceEn.toISOString(),
    creadaEn: inv.createdAt.toISOString(),
    correoEnviado: inv.correoEnviado,
    usadaEn: inv.usadaEn?.toISOString() ?? null,
    usadaPor: inv.usadaPorNombre ?? null,
  };
}

/**
 * Invitaciones al hogar (CU-01.2 pasos 3–7, flujos 5c y 6a, excepciones E1 y E2).
 * El token es de 32 bytes aleatorios en base64url; en la base solo se guarda su HMAC-SHA256
 * (con `JWT_REFRESH_SECRET`, igual que el refresh de ADR-004), así una copia de la base no
 * sirve para unirse a un hogar.
 */
@Injectable()
export class InvitacionesService {
  private readonly logger = new Logger(InvitacionesService.name);
  private readonly secreto: string;
  private readonly appUrl: string;

  constructor(
    private readonly invitaciones: InvitacionesRepositorio,
    private readonly hogares: HogarRepositorio,
    private readonly usuarios: UsuariosRepositorio,
    private readonly hogarService: HogarService,
    @Inject(SERVICIO_CORREO) private readonly correo: ServicioCorreo,
    @Inject(RELOJ) private readonly reloj: Reloj,
    config: ConfigService,
  ) {
    this.secreto = config.getOrThrow<string>('JWT_REFRESH_SECRET');
    this.appUrl = config.get<string>('APP_URL', 'http://localhost:5173').replace(/\/+$/, '');
  }

  /** Hash con el que se guarda y se busca el token. */
  hashToken(token: string): string {
    return createHmac('sha256', this.secreto).update(`invitacion:${token}`).digest('hex');
  }

  enlaceDe(token: string): string {
    return `${this.appUrl}/invitacion/${token}`;
  }

  /**
   * POST /hogar/invitaciones (ADMIN). Por correo: rechaza si ya es miembro (5c), reemplaza
   * invitaciones vigentes al mismo correo y envía el correo; si el envío falla la invitación
   * queda creada con `correoEnviado: false` y el enlace para copiar (E2). Por enlace: solo
   * devuelve el enlace para compartir (5b).
   */
  async invitar(
    usuarioId: string,
    contexto: HogarDelUsuario,
    datos: DatosInvitar,
  ): Promise<InvitacionCreada> {
    const ahora = this.reloj();
    const correo =
      datos.medio === MedioInvitacion.CORREO && datos.correo
        ? normalizarCorreo(datos.correo)
        : null;
    if (datos.medio === MedioInvitacion.CORREO) {
      if (!correo) {
        throw new Problema(422, 'CORREO_INVALIDO', 'Ingresa el correo de la persona a invitar', {
          errores: [{ campo: 'correo', mensaje: 'Ingresa el correo de la persona a invitar' }],
        });
      }
      if (await this.hogares.tieneMiembroConCorreo(contexto.hogarId, correo)) {
        throw new Problema(409, 'YA_ES_MIEMBRO', MENSAJES_HOGAR.yaEsMiembro);
      }
      await this.invitaciones.revocarVigentesDeCorreo(contexto.hogarId, correo, ahora);
    }

    const token = randomBytes(32).toString('base64url');
    const creada = await this.invitaciones.crear({
      hogarId: contexto.hogarId,
      creadaPorId: usuarioId,
      medio: datos.medio,
      correo,
      tokenHash: this.hashToken(token),
      createdAt: ahora,
      venceEn: new Date(ahora.getTime() + MS_VIGENCIA_INVITACION),
    });
    const enlace = this.enlaceDe(token);
    let correoEnviado = false;
    if (correo)
      correoEnviado = await this.enviarCorreo(creada, contexto.hogarId, usuarioId, enlace);
    return { ...vistaInvitacion({ ...creada, correoEnviado }, ahora), enlace };
  }

  /** GET /hogar/invitaciones (ADMIN): las más recientes del hogar con su estado. */
  async listar(hogarId: string): Promise<VistaInvitacion[]> {
    const ahora = this.reloj();
    const filas: FilaInvitacion[] = await this.invitaciones.listar(hogarId);
    return filas.map((f) => vistaInvitacion(f, ahora));
  }

  /** DELETE /hogar/invitaciones/{id} (ADMIN). 404 si no existe o es de otro hogar (RNF-06). */
  async revocar(hogarId: string, id: string): Promise<void> {
    const resultado = await this.invitaciones.revocar(hogarId, id, this.reloj());
    if (resultado === 'no_existe') {
      throw new Problema(404, 'NO_ENCONTRADO', 'La invitación no existe.');
    }
    if (resultado === 'usada') {
      throw new Problema(
        409,
        'INVITACION_USADA',
        'Esta invitación ya se usó; no se puede revocar.',
      );
    }
  }

  /** GET /invitaciones/{token} (público): datos mínimos para mostrar antes de aceptar. */
  async verPublica(token: string): Promise<VistaPublicaInvitacion> {
    const inv = this.tokenValido(token)
      ? await this.invitaciones.buscarPorHash(this.hashToken(token))
      : undefined;
    if (!inv || estadoInvitacion(inv, this.reloj()) !== EstadoInvitacion.VIGENTE) {
      throw this.noValida();
    }
    return {
      hogarNombre: inv.hogarNombre,
      invitadoPor: inv.creadaPorNombre,
      medio: inv.medio as MedioInvitacion,
      correo: inv.correo ? enmascararCorreo(inv.correo) : null,
      venceEn: inv.venceEn.toISOString(),
    };
  }

  /**
   * POST /invitaciones/{token}/aceptar (usuario autenticado sin hogar). 410 si la invitación
   * venció, ya se usó, se revocó o no existe (E1); 409 si ya pertenece a un hogar (6a); 403 si
   * la invitación por correo es para otra cuenta.
   */
  async aceptar(usuarioId: string, token: string): Promise<RespuestaUnionHogar> {
    if (!this.tokenValido(token)) throw this.noValida();
    const invitado = await this.usuarios.buscarPorId(usuarioId);
    if (!invitado || !invitado.activo) {
      throw new Problema(401, 'TOKEN_INVALIDO', 'Inicia sesión para continuar.');
    }
    const resultado = await this.invitaciones.aceptar(
      this.hashToken(token),
      { id: invitado.id, correo: invitado.correo },
      this.reloj(),
    );
    switch (resultado.tipo) {
      case 'no_valida':
        throw this.noValida();
      case 'ya_tiene_hogar':
        throw new Problema(409, 'YA_TIENE_HOGAR', MENSAJES_HOGAR.yaTieneHogar);
      case 'otro_correo':
        throw new Problema(403, 'INVITACION_DE_OTRO_CORREO', MENSAJES_HOGAR.invitacionDeOtroCorreo);
      default:
        return this.hogarService.union(
          usuarioId,
          resultado.hogarId,
          resultado.hogarNombre,
          Rol.MIEMBRO,
        );
    }
  }

  private async enviarCorreo(
    inv: Invitacion,
    hogarId: string,
    usuarioId: string,
    enlace: string,
  ): Promise<boolean> {
    try {
      const [destino, quien] = await Promise.all([
        this.hogares.buscar(hogarId),
        this.usuarios.buscarPorId(usuarioId),
      ]);
      await this.correo.enviar(
        correoInvitacion({
          para: inv.correo as string,
          hogarNombre: destino?.nombre ?? 'tu hogar',
          invitadoPor: quien?.nombre ?? 'Tu familia',
          enlace,
          venceEn: inv.venceEn,
        }),
      );
      await this.invitaciones.marcarCorreoEnviado(inv.id);
      return true;
    } catch (error) {
      this.logger.warn(
        `No se pudo enviar la invitación ${inv.id}: ${(error as Error).message ?? error}`,
      );
      return false;
    }
  }

  private tokenValido(token: string): boolean {
    return token.length > 0 && token.length <= LARGO_MAXIMO_TOKEN;
  }

  private noValida(): Problema {
    return new Problema(410, 'INVITACION_NO_VALIDA', MENSAJES_HOGAR.invitacionNoValida);
  }
}
