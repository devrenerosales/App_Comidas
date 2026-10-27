import { Body, Controller, HttpCode, Post, Res, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'express';
import { Publico } from './decoradores/publico.decorator';
import { RecuperarDto, RestablecerDto, TokenRecuperacionDto } from './dto/auth.dto';
import { RecuperacionService } from './recuperacion.service';
import { borrarCookieRefresh } from './cookies';

@Controller('auth')
@UseGuards(ThrottlerGuard)
export class RecuperacionController {
  constructor(private readonly recuperacion: RecuperacionService) {}

  @Publico()
  @Post('validar-recuperacion')
  @HttpCode(204)
  async validar(@Body() datos: TokenRecuperacionDto, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    await this.recuperacion.validar(datos.token);
  }

  @Publico()
  @Post('recuperar')
  @HttpCode(202)
  solicitar(@Body() datos: RecuperarDto, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    return this.recuperacion.solicitar(datos.correo);
  }

  @Publico()
  @Post('restablecer')
  @HttpCode(200)
  async restablecer(@Body() datos: RestablecerDto, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    const resultado = await this.recuperacion.restablecer(
      datos.token,
      datos.contrasena,
      datos.confirmacion,
    );
    borrarCookieRefresh(res);
    return resultado;
  }
}
