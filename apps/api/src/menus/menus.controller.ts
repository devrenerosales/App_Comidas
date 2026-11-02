import { Body, Controller, HttpCode, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { HogarActual } from '../hogar/decoradores/hogar-actual.decorator';
import { HogarGuard } from '../hogar/hogar.guard';
import { RolesGuard } from '../hogar/roles.guard';
import { GenerarMenuDto } from './dto/menus.dto';
import { MenusService } from './menus.service';
import type { VistaMenu } from './menus.vista';

/** /menus — menú semanal del hogar. Cualquier miembro genera el Borrador (CU-05.1, HU-19). */
@Controller('menus')
@UseGuards(HogarGuard, RolesGuard)
export class MenusController {
  constructor(private readonly menus: MenusService) {}

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
}
