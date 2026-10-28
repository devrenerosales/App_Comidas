import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { Rol } from '@menu/shared';
import { Problema } from '../comun/problema';
import { MS_REFRESH, SEGUNDOS_TOKEN_ACCESO } from './auth.constants';
import type { ClaimsAcceso } from './auth.tipos';

export interface TokenAccesoFirmado {
  token: string;
  expiraEn: Date;
}

export interface RefreshGenerado {
  /** Valor opaco que recibe el cliente (32 bytes en base64url). */
  token: string;
  /** HMAC-SHA256 en hex (64 caracteres) que se guarda en `refresh_token.token_hash`. */
  hash: string;
  venceEn: Date;
}

const ROLES = new Set<string>(Object.values(Rol));

/** Emisión y validación de tokens (ADR-004). */
@Injectable()
export class TokensService {
  private readonly secretoRefresh: string;

  constructor(
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.secretoRefresh = config.getOrThrow<string>('JWT_REFRESH_SECRET');
  }

  /** Firma el JWT de acceso (HS256, 15 min) con `sub`, `hogarId` y `rol`. */
  firmarAcceso(claims: ClaimsAcceso, ahora: Date = new Date()): TokenAccesoFirmado {
    const iat = Math.floor(ahora.getTime() / 1000);
    const exp = iat + SEGUNDOS_TOKEN_ACCESO;
    const token = this.jwt.sign({ ...claims, emitidoEn: ahora.getTime(), iat, exp });
    return { token, expiraEn: new Date(exp * 1000) };
  }

  /** Verifica firma, algoritmo y vigencia; lanza 401 `TOKEN_EXPIRADO` o `TOKEN_INVALIDO`. */
  verificarAcceso(token: string): ClaimsAcceso & { emitidoEn: number } {
    let carga: Record<string, unknown>;
    try {
      carga = this.jwt.verify<Record<string, unknown>>(token, { algorithms: ['HS256'] });
    } catch (error) {
      if ((error as Error).name === 'TokenExpiredError') {
        throw new Problema(401, 'TOKEN_EXPIRADO', 'Tu sesión expiró. Vuelve a intentarlo.');
      }
      throw new Problema(401, 'TOKEN_INVALIDO', 'Inicia sesión para continuar.');
    }
    const { sub, hogarId, rol } = carga;
    const valido =
      typeof sub === 'string' &&
      typeof carga.iat === 'number' &&
      Number.isFinite(carga.iat) &&
      (carga.emitidoEn === undefined ||
        (typeof carga.emitidoEn === 'number' && Number.isFinite(carga.emitidoEn))) &&
      (hogarId === null || typeof hogarId === 'string') &&
      (rol === null || (typeof rol === 'string' && ROLES.has(rol)));
    if (!valido) {
      throw new Problema(401, 'TOKEN_INVALIDO', 'Inicia sesión para continuar.');
    }
    return {
      sub,
      hogarId: hogarId as string | null,
      rol: rol as Rol | null,
      emitidoEn:
        typeof carga.emitidoEn === 'number' ? carga.emitidoEn : (carga.iat as number) * 1000,
    };
  }

  /** Genera un refresh opaco de 32 bytes y su hash. */
  generarRefresh(ahora: Date = new Date()): RefreshGenerado {
    const token = randomBytes(32).toString('base64url');
    return {
      token,
      hash: this.hashRefresh(token),
      venceEn: new Date(ahora.getTime() + MS_REFRESH),
    };
  }

  /**
   * Hash del refresh: HMAC-SHA256 con `JWT_REFRESH_SECRET`. Una copia de la base sin el
   * secreto no permite validar tokens robados (nota de implementación de ADR-004).
   */
  hashRefresh(token: string): string {
    return createHmac('sha256', this.secretoRefresh).update(token).digest('hex');
  }

  /** Identificador de una nueva familia de rotación. */
  nuevaFamilia(): string {
    return randomUUID();
  }
}
