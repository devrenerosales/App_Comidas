import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  CODIGOS_HTTP,
  cuerpoProblema,
  Problema,
  TIPO_CONTENIDO_PROBLEMA,
  type CuerpoProblema,
} from './problema';

const MENSAJES_POR_ESTADO: Readonly<Record<number, string>> = {
  401: 'Inicia sesión para continuar.',
  404: 'El recurso solicitado no existe.',
  429: 'Demasiados intentos. Espera un minuto e intenta de nuevo.',
  500: 'Ocurrió un error inesperado. Intenta de nuevo más tarde.',
};

/** Convierte cualquier excepción en `application/problem+json` (RFC 7807, api-contrato §1.4). */
@Catch()
export class ProblemaFiltro implements ExceptionFilter {
  private readonly logger = new Logger(ProblemaFiltro.name);

  catch(excepcion: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const res = http.getResponse<Response>();
    const req = http.getRequest<Request>();
    const cuerpo = this.aCuerpo(excepcion);
    cuerpo.instance = (req.originalUrl ?? req.url ?? '').split('?')[0];
    res.status(cuerpo.status).type(TIPO_CONTENIDO_PROBLEMA).send(JSON.stringify(cuerpo));
  }

  aCuerpo(excepcion: unknown): CuerpoProblema {
    if (excepcion instanceof Problema) {
      return { ...(excepcion.getResponse() as CuerpoProblema) };
    }
    if (excepcion instanceof HttpException) {
      const status = excepcion.getStatus();
      const codigo = CODIGOS_HTTP[status] ?? `HTTP_${status}`;
      const detalle = MENSAJES_POR_ESTADO[status] ?? this.mensajeDe(excepcion);
      return cuerpoProblema(status, codigo, detalle);
    }
    this.logger.error(
      excepcion instanceof Error ? (excepcion.stack ?? excepcion.message) : excepcion,
    );
    return cuerpoProblema(500, CODIGOS_HTTP[500] as string, MENSAJES_POR_ESTADO[500] as string);
  }

  private mensajeDe(excepcion: HttpException): string {
    const respuesta = excepcion.getResponse();
    if (typeof respuesta === 'string') return respuesta;
    const mensaje = (respuesta as { message?: unknown }).message;
    if (typeof mensaje === 'string') return mensaje;
    return excepcion.message;
  }
}
