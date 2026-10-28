import { Body, Controller, Get, HttpCode, Post, Put, UseGuards } from '@nestjs/common';
import { MENSAJES_CONFIGURACION } from '@menu/shared';
import { UsuarioActual } from '../auth/decoradores/usuario-actual.decorator';
import { HogarActual } from '../hogar/decoradores/hogar-actual.decorator';
import { HogarGuard } from '../hogar/hogar.guard';
import { ConfiguracionService } from './configuracion.service';
import type {
  RespuestaGuardado,
  RespuestaVistaPrevia,
  VistaConfiguracionHogar,
} from './configuracion.tipos';
import {
  GuardarPresupuestoDto,
  GuardarTiemposDto,
  VistaPreviaDto,
  GuardarSemanaDto,
} from './dto/configuracion.dto';
import { SoloAdmin, SoloAdminGuard } from './solo-admin.guard';

/**
 * /hogar/configuracion — tiempos de comida, presupuesto y distribución (M02 · HU-05, HU-06,
 * HU-07, api-contrato §2.2). El hogar sale siempre de `HogarGuard` (RNF-06); las escrituras y la
 * vista previa son solo del administrador (RN-10).
 */
@Controller('hogar/configuracion')
@UseGuards(HogarGuard, SoloAdminGuard)
export class ConfiguracionController {
  constructor(private readonly configuracion: ConfiguracionService) {}

  @Post('semana/vista-previa')
  @HttpCode(200)
  @SoloAdmin(MENSAJES_CONFIGURACION.soloAdminConfiguracion)
  vistaPreviaSemana(@HogarActual('hogarId') hogarId: string, @Body() dto: GuardarSemanaDto) {
    return this.configuracion.vistaPreviaSemana(hogarId, dto);
  }

  @Put('semana')
  @SoloAdmin(MENSAJES_CONFIGURACION.soloAdminConfiguracion)
  guardarSemana(
    @HogarActual('hogarId') hogarId: string,
    @UsuarioActual('id') usuarioId: string,
    @Body() dto: GuardarSemanaDto,
  ) {
    return this.configuracion.guardarSemana(hogarId, usuarioId, dto);
  }

  @Get()
  obtener(@HogarActual('hogarId') hogarId: string): Promise<VistaConfiguracionHogar> {
    return this.configuracion.obtener(hogarId);
  }

  @Post('vista-previa')
  @HttpCode(200)
  @SoloAdmin(MENSAJES_CONFIGURACION.soloAdminTiempos)
  vistaPrevia(
    @HogarActual('hogarId') hogarId: string,
    @Body() dto: VistaPreviaDto,
  ): Promise<RespuestaVistaPrevia> {
    return this.configuracion.vistaPrevia(hogarId, dto);
  }

  @Put('tiempos')
  @SoloAdmin(MENSAJES_CONFIGURACION.soloAdminTiempos)
  guardarTiempos(
    @HogarActual('hogarId') hogarId: string,
    @UsuarioActual('id') usuarioId: string,
    @Body() dto: GuardarTiemposDto,
  ): Promise<RespuestaGuardado> {
    return this.configuracion.guardarTiempos(hogarId, usuarioId, dto);
  }

  @Put('presupuesto')
  @SoloAdmin(MENSAJES_CONFIGURACION.soloAdminConfiguracion)
  guardarPresupuesto(
    @HogarActual('hogarId') hogarId: string,
    @UsuarioActual('id') usuarioId: string,
    @Body() dto: GuardarPresupuestoDto,
  ): Promise<RespuestaGuardado> {
    return this.configuracion.guardarPresupuesto(hogarId, usuarioId, dto);
  }
}
