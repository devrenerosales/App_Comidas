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
  Query,
  UseGuards,
} from '@nestjs/common';
import { MENSAJES_COMENSALES } from '@menu/shared';
import { Problema } from '../comun/problema';
import { HogarActual } from '../hogar/decoradores/hogar-actual.decorator';
import { HogarGuard } from '../hogar/hogar.guard';
import { AdminComensalesGuard } from './admin-comensales.guard';
import { ComensalesService } from './comensales.service';
import type { ListaComensales, RespuestaComensal } from './comensales.tipos';
import { CrearComensalDto, EditarComensalDto } from './dto/comensal.dto';

/** Un id mal formado se trata como inexistente (404), igual que uno de otro hogar (RNF-06). */
const idDeRuta = new ParseUUIDPipe({
  version: '4',
  exceptionFactory: () => new Problema(404, 'NO_ENCONTRADO', MENSAJES_COMENSALES.noEncontrado),
});

/** `?incluirInactivos=true|1`. */
export function leerBandera(valor: string | undefined): boolean {
  return valor === 'true' || valor === '1';
}

/**
 * /hogar/comensales (CU-01.3 · RF-03 · HU-03). El hogar sale siempre de `HogarGuard` (RNF-06);
 * cualquier miembro consulta y solo el administrador modifica (RN-10, CA-03.4).
 */
@Controller('hogar/comensales')
@UseGuards(HogarGuard)
export class ComensalesController {
  constructor(private readonly comensales: ComensalesService) {}

  @Get()
  listar(
    @HogarActual('hogarId') hogarId: string,
    @Query('incluirInactivos') incluirInactivos?: string,
  ): Promise<ListaComensales> {
    return this.comensales.listar(hogarId, leerBandera(incluirInactivos));
  }

  @Post()
  @UseGuards(AdminComensalesGuard)
  crear(
    @HogarActual('hogarId') hogarId: string,
    @Body() dto: CrearComensalDto,
  ): Promise<RespuestaComensal> {
    return this.comensales.crear(hogarId, dto);
  }

  @Patch(':id')
  @UseGuards(AdminComensalesGuard)
  editar(
    @HogarActual('hogarId') hogarId: string,
    @Param('id', idDeRuta) id: string,
    @Body() dto: EditarComensalDto,
  ): Promise<RespuestaComensal> {
    return this.comensales.editar(hogarId, id, dto);
  }

  /** Quitar = inactivar (baja lógica, CU-01.3 2b). */
  @Delete(':id')
  @UseGuards(AdminComensalesGuard)
  inactivar(
    @HogarActual('hogarId') hogarId: string,
    @Param('id', idDeRuta) id: string,
  ): Promise<RespuestaComensal> {
    return this.comensales.inactivar(hogarId, id);
  }

  @Post(':id/reactivar')
  @HttpCode(200)
  @UseGuards(AdminComensalesGuard)
  reactivar(
    @HogarActual('hogarId') hogarId: string,
    @Param('id', idDeRuta) id: string,
  ): Promise<RespuestaComensal> {
    return this.comensales.reactivar(hogarId, id);
  }
}
