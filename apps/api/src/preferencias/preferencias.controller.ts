import { Body, Controller, Get, HttpCode, Post, Put, UseGuards } from '@nestjs/common';
import { HogarActual } from '../hogar/decoradores/hogar-actual.decorator';
import { HogarGuard } from '../hogar/hogar.guard';
import { RolesGuard } from '../hogar/roles.guard';
import { GuardarGustosDto } from './dto/preferencias.dto';
import { PreferenciasService } from './preferencias.service';
import type { VistaGustos } from './preferencias.tipos';

/**
 * /hogar/preferencias/gustos — ingredientes excluidos y platillos favoritos (CU-02.6, HU-10).
 * Son del hogar y los edita cualquier miembro (RN-10 no los restringe); el hogar sale de
 * `HogarGuard`, nunca de la ruta (RNF-06).
 */
@Controller('hogar/preferencias/gustos')
@UseGuards(HogarGuard, RolesGuard)
export class PreferenciasController {
  constructor(private readonly preferencias: PreferenciasService) {}

  @Get()
  obtener(@HogarActual('hogarId') hogarId: string): Promise<VistaGustos> {
    return this.preferencias.obtener(hogarId);
  }

  @Post('vista-previa')
  @HttpCode(200)
  vistaPrevia(
    @HogarActual('hogarId') hogarId: string,
    @Body() dto: GuardarGustosDto,
  ): Promise<VistaGustos> {
    return this.preferencias.vistaPrevia(hogarId, dto);
  }

  @Put()
  guardar(
    @HogarActual('hogarId') hogarId: string,
    @Body() dto: GuardarGustosDto,
  ): Promise<VistaGustos> {
    return this.preferencias.guardar(hogarId, dto);
  }
}
