import { Controller, Get, HttpCode, Param, Post, Res, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'express';
import { Publico } from '../auth/decoradores/publico.decorator';
import { UsuarioActual } from '../auth/decoradores/usuario-actual.decorator';
import type { RespuestaUnionHogar, VistaPublicaInvitacion } from './hogar.tipos';
import { InvitacionesService } from './invitaciones.service';

/**
 * /invitaciones/{token} — abrir y aceptar una invitación (CU-01.2 pasos 6–7). Mismo límite por
 * IP que /auth/* para frenar intentos de adivinar tokens.
 */
@Controller('invitaciones')
@UseGuards(ThrottlerGuard)
export class InvitacionesController {
  constructor(private readonly invitaciones: InvitacionesService) {}

  @Publico()
  @Get(':token')
  ver(
    @Param('token') token: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<VistaPublicaInvitacion> {
    res.setHeader('Cache-Control', 'no-store');
    return this.invitaciones.verPublica(token);
  }

  @Post(':token/aceptar')
  @HttpCode(200)
  aceptar(
    @UsuarioActual('id') usuarioId: string,
    @Param('token') token: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RespuestaUnionHogar> {
    res.setHeader('Cache-Control', 'no-store');
    return this.invitaciones.aceptar(usuarioId, token);
  }
}
