import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { Problema } from '../comun/problema';
import { HogarActual } from '../hogar/decoradores/hogar-actual.decorator';
import { HogarGuard } from '../hogar/hogar.guard';
import { RolesGuard } from '../hogar/roles.guard';
import { HistoricoPreciosService, type VistaHistoricoPrecios } from './historico-precios.service';

/** Un id de producto mal formado se trata como inexistente (404). */
const idProducto = new ParseUUIDPipe({
  version: '4',
  exceptionFactory: () => new Problema(404, 'NO_ENCONTRADO', 'El producto no existe.'),
});

/** GET /productos/{id}/precios — histórico y variación por supermercado (HU-37). */
@Controller('productos')
@UseGuards(HogarGuard, RolesGuard)
export class HistoricoPreciosController {
  constructor(private readonly historico: HistoricoPreciosService) {}

  @Get(':id/precios')
  obtener(
    @HogarActual('hogarId') hogarId: string,
    @Param('id', idProducto) productoId: string,
    @Query('semanas') semanas?: string,
  ): Promise<VistaHistoricoPrecios> {
    return this.historico.obtener(hogarId, productoId, semanas);
  }
}
