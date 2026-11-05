import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { Problema } from '../comun/problema';
import { HogarActual } from '../hogar/decoradores/hogar-actual.decorator';
import { HogarGuard } from '../hogar/hogar.guard';
import { RolesGuard } from '../hogar/roles.guard';
import { ResumenPreciosService, type VistaResumenPrecio } from './resumen-precios.service';

/** Un id de producto mal formado se trata como inexistente (404). */
const idProducto = new ParseUUIDPipe({
  version: '4',
  exceptionFactory: () => new Problema(404, 'NO_ENCONTRADO', 'El producto no existe.'),
});

/** GET /productos/{id}/resumen-precio — mediana y mínimo del producto para el hogar (HU-36). */
@Controller('productos')
@UseGuards(HogarGuard, RolesGuard)
export class ResumenPreciosController {
  constructor(private readonly resumen: ResumenPreciosService) {}

  @Get(':id/resumen-precio')
  obtener(
    @HogarActual('hogarId') hogarId: string,
    @Param('id', idProducto) productoId: string,
  ): Promise<VistaResumenPrecio> {
    return this.resumen.obtener(hogarId, productoId);
  }
}
