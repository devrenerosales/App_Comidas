import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { UsuarioActual } from '../auth/decoradores/usuario-actual.decorator';
import { Problema } from '../comun/problema';
import { HogarActual } from '../hogar/decoradores/hogar-actual.decorator';
import { HogarGuard } from '../hogar/hogar.guard';
import { RolesGuard } from '../hogar/roles.guard';
import {
  AprobarMenuDto,
  EditarDetalleDto,
  FijarDetalleDto,
  GenerarMenuDto,
  MoverDetalleDto,
} from './dto/menus.dto';
import { MenusAprobacionService, type RespuestaAprobacion } from './menus-aprobacion.service';
import { MenusEdicionService } from './menus-edicion.service';
import { MenusService } from './menus.service';
import type { VistaMenu } from './menus.vista';

/** Un id mal formado se trata como inexistente (404), igual que uno de otro hogar (RNF-06). */
const idMenu = new ParseUUIDPipe({
  version: '4',
  exceptionFactory: () => new Problema(404, 'NO_ENCONTRADO', 'El menú no existe.'),
});
const idComida = new ParseUUIDPipe({
  version: '4',
  exceptionFactory: () => new Problema(404, 'NO_ENCONTRADO', 'La comida no existe.'),
});

/**
 * /menus — menú semanal del hogar. Cualquier miembro genera y ajusta el Borrador
 * (CU-05.1 y CU-06.1, HU-19 y HU-24); aprobarlo es CU-06.2 (HU-25).
 */
@Controller('menus')
@UseGuards(HogarGuard, RolesGuard)
export class MenusController {
  constructor(
    private readonly menus: MenusService,
    private readonly edicion: MenusEdicionService,
    private readonly aprobacion: MenusAprobacionService,
  ) {}

  /** 201 con el menú nuevo; 200 si se regeneró un Borrador conservando los fijados. */
  @Post('generar')
  @HttpCode(201)
  async generar(
    @HogarActual('hogarId') hogarId: string,
    @Body() dto: GenerarMenuDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<VistaMenu> {
    const { creado, menu } = await this.menus.generar(hogarId, dto);
    if (!creado) res.status(200);
    return menu;
  }

  /** El menú cuya semana contiene la fecha (declarado antes que `:id`). */
  @Get('semana/:fecha')
  porSemana(
    @HogarActual('hogarId') hogarId: string,
    @Param('fecha') fecha: string,
  ): Promise<VistaMenu> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      throw new Problema(404, 'SIN_MENU', 'Esta semana todavía no tiene menú.');
    }
    return this.edicion.obtenerPorSemana(hogarId, fecha);
  }

  @Get(':id')
  obtener(
    @HogarActual('hogarId') hogarId: string,
    @Param('id', idMenu) id: string,
  ): Promise<VistaMenu> {
    return this.edicion.obtener(hogarId, id);
  }

  @Patch(':id/detalles/:detalleId')
  editar(
    @HogarActual('hogarId') hogarId: string,
    @UsuarioActual('id') usuarioId: string,
    @Param('id', idMenu) id: string,
    @Param('detalleId', idComida) detalleId: string,
    @Body() dto: EditarDetalleDto,
  ): Promise<VistaMenu> {
    return this.edicion.editar(hogarId, usuarioId, id, detalleId, dto);
  }

  @Post(':id/mover')
  @HttpCode(200)
  mover(
    @HogarActual('hogarId') hogarId: string,
    @UsuarioActual('id') usuarioId: string,
    @Param('id', idMenu) id: string,
    @Body() dto: MoverDetalleDto,
  ): Promise<VistaMenu> {
    return this.edicion.mover(hogarId, usuarioId, id, dto);
  }

  @Put(':id/detalles/:detalleId/fijado')
  fijar(
    @HogarActual('hogarId') hogarId: string,
    @UsuarioActual('id') usuarioId: string,
    @Param('id', idMenu) id: string,
    @Param('detalleId', idComida) detalleId: string,
    @Body() dto: FijarDetalleDto,
  ): Promise<VistaMenu> {
    return this.edicion.fijar(hogarId, usuarioId, id, detalleId, dto);
  }

  /** CU-06.2: aprueba el Borrador (con exceso también, D-03) y crea la lista de compras. */
  @Post(':id/aprobar')
  @HttpCode(200)
  aprobar(
    @HogarActual('hogarId') hogarId: string,
    @UsuarioActual('id') usuarioId: string,
    @Param('id', idMenu) id: string,
    @Body() dto: AprobarMenuDto,
  ): Promise<RespuestaAprobacion> {
    return this.aprobacion.aprobar(hogarId, usuarioId, id, dto);
  }
}
