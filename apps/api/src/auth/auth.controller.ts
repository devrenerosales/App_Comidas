import { Body, Controller, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import type { ContextoCliente, Sesion } from './auth.tipos';
import {
  borrarCookieRefresh,
  esClienteNativo,
  guardarCookieRefresh,
  refreshDeLaSolicitud,
} from './cookies';
import { Publico } from './decoradores/publico.decorator';
import { UsuarioActual } from './decoradores/usuario-actual.decorator';
import { LoginDto, RefreshDto, RegistroDto } from './dto/auth.dto';

/** Respuesta de sesión: en la PWA el refresh va solo en la cookie HttpOnly. */
export type RespuestaSesion = Omit<Sesion, 'refreshToken'> & { refreshToken?: string };

/**
 * /api/v1/auth — RF-01 · HU-01 (api-contrato §2.1). Límite de 10 solicitudes/min por IP.
 */
@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Publico()
  @Post('registro')
  async registrar(
    @Body() dto: RegistroDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RespuestaSesion> {
    const sesion = await this.auth.registrar(dto, this.cliente(req));
    return this.responder(req, res, sesion);
  }

  @Publico()
  @Post('login')
  @HttpCode(200)
  async iniciarSesion(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RespuestaSesion> {
    const sesion = await this.auth.iniciarSesion(dto, this.cliente(req, dto.dispositivo));
    return this.responder(req, res, sesion);
  }

  @Publico()
  @Post('refresh')
  @HttpCode(200)
  async renovar(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RespuestaSesion> {
    try {
      const sesion = await this.auth.renovar(
        refreshDeLaSolicitud(req, dto.refreshToken),
        this.cliente(req),
      );
      return this.responder(req, res, sesion);
    } catch (error) {
      borrarCookieRefresh(res);
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(204)
  async cerrarSesion(
    @UsuarioActual('id') usuarioId: string,
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.cerrarSesion(usuarioId, refreshDeLaSolicitud(req, dto.refreshToken));
    borrarCookieRefresh(res);
  }

  private cliente(req: Request, dispositivo?: string): ContextoCliente {
    return { dispositivo: dispositivo ?? req.headers['user-agent'] ?? null };
  }

  private responder(req: Request, res: Response, sesion: Sesion): RespuestaSesion {
    res.setHeader('Cache-Control', 'no-store');
    if (esClienteNativo(req)) return sesion;
    guardarCookieRefresh(res, sesion.refreshToken);
    const { refreshToken: _enCookie, ...resto } = sesion;
    return resto;
  }
}
