import { Body, Controller, Param, ParseUUIDPipe, Put, UseGuards } from '@nestjs/common';
import { UsuarioActual } from '../auth/decoradores/usuario-actual.decorator';
import { Problema } from '../comun/problema';
import { HogarActual } from '../hogar/decoradores/hogar-actual.decorator';
import { HogarGuard } from '../hogar/hogar.guard';
import { RolesGuard } from '../hogar/roles.guard';
import { CalificacionesService, type RespuestaCalificacion } from './calificaciones.service';
import { CalificarDto } from './dto/calificaciones.dto';

/** Un id mal formado se trata como inexistente (404), igual que uno de otro hogar (RNF-06). */
const idComida = new ParseUUIDPipe({
  version: '4',
  exceptionFactory: () => new Problema(404, 'NO_ENCONTRADO', 'La comida no existe.'),
});

/** /menus/{menuId}/detalles/{detalleId}/calificacion — cualquier miembro califica (CU-11.1). */
@Controller('menus/:menuId/detalles/:detalleId/calificacion')
@UseGuards(HogarGuard, RolesGuard)
export class CalificacionesController {
  constructor(private readonly calificaciones: CalificacionesService) {}

  @Put()
  calificar(
    @HogarActual('hogarId') hogarId: string,
    @UsuarioActual('id') usuarioId: string,
    @Param('menuId', idComida) menuId: string,
    @Param('detalleId', idComida) detalleId: string,
    @Body() dto: CalificarDto,
  ): Promise<RespuestaCalificacion> {
    return this.calificaciones.calificar(hogarId, usuarioId, menuId, detalleId, dto.valor);
  }
}
