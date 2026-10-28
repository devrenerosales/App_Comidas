import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { Rol } from '@menu/shared';
import { UsuarioActual } from '../auth/decoradores/usuario-actual.decorator';
import { Problema } from '../comun/problema';
import { HogarActual } from './decoradores/hogar-actual.decorator';
import { Roles } from './decoradores/roles.decorator';
import { InvitarDto, NombreHogarDto } from './dto/hogar.dto';
import { HogarGuard } from './hogar.guard';
import { HogarService } from './hogar.service';
import type {
  HogarDelUsuario,
  InvitacionCreada,
  RespuestaUnionHogar,
  VistaHogar,
  VistaInvitacion,
} from './hogar.tipos';
import { InvitacionesService } from './invitaciones.service';
import { RolesGuard } from './roles.guard';

/** Un id mal formado se trata como inexistente (404), igual que uno de otro hogar (RNF-06). */
const idDeRuta = new ParseUUIDPipe({
  version: '4',
  exceptionFactory: () => new Problema(404, 'NO_ENCONTRADO', 'La invitación no existe.'),
});

/** POST /hogares — crear hogar (usuario autenticado sin hogar, CU-01.2 pasos 1–2). */
@Controller('hogares')
export class HogaresController {
  constructor(private readonly hogar: HogarService) {}

  @Post()
  crear(
    @UsuarioActual('id') usuarioId: string,
    @Body() dto: NombreHogarDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RespuestaUnionHogar> {
    res.setHeader('Cache-Control', 'no-store');
    return this.hogar.crear(usuarioId, dto.nombre);
  }
}

/**
 * /hogar — el hogar del usuario del token (api-contrato §1.1: nunca `/hogares/{id}`).
 * `HogarGuard` resuelve el hogar en la base y `RolesGuard` aplica RN-10.
 */
@Controller('hogar')
@UseGuards(HogarGuard, RolesGuard)
export class HogarController {
  constructor(
    private readonly hogar: HogarService,
    private readonly invitaciones: InvitacionesService,
  ) {}

  @Get()
  obtener(@HogarActual('hogarId') hogarId: string): Promise<VistaHogar> {
    return this.hogar.obtener(hogarId);
  }

  @Patch()
  @Roles(Rol.ADMIN)
  renombrar(
    @HogarActual('hogarId') hogarId: string,
    @Body() dto: NombreHogarDto,
  ): Promise<{ id: string; nombre: string }> {
    return this.hogar.renombrar(hogarId, dto.nombre);
  }

  @Post('invitaciones')
  @Roles(Rol.ADMIN)
  invitar(
    @UsuarioActual('id') usuarioId: string,
    @HogarActual() contexto: HogarDelUsuario,
    @Body() dto: InvitarDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<InvitacionCreada> {
    res.setHeader('Cache-Control', 'no-store');
    return this.invitaciones.invitar(usuarioId, contexto, dto);
  }

  @Get('invitaciones')
  @Roles(Rol.ADMIN)
  listarInvitaciones(@HogarActual('hogarId') hogarId: string): Promise<VistaInvitacion[]> {
    return this.invitaciones.listar(hogarId);
  }

  @Delete('invitaciones/:id')
  @Roles(Rol.ADMIN)
  @HttpCode(204)
  revocar(
    @HogarActual('hogarId') hogarId: string,
    @Param('id', idDeRuta) id: string,
  ): Promise<void> {
    return this.invitaciones.revocar(hogarId, id);
  }
}
