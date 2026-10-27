import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Rol } from '@menu/shared';
import { UsuarioActual } from '../auth/decoradores/usuario-actual.decorator';
import { HogarActual } from '../hogar/decoradores/hogar-actual.decorator';
import { Roles } from '../hogar/decoradores/roles.decorator';
import { HogarGuard } from '../hogar/hogar.guard';
import { RolesGuard } from '../hogar/roles.guard';
import { CapturarSemanaDto, ConsultaHistorialDto } from './historial.dto';
import { HistorialService } from './historial.service';

@Controller('historial/semanas')
@UseGuards(HogarGuard, RolesGuard)
export class HistorialController {
  constructor(private readonly historial: HistorialService) {}
  @Get()
  listar(@HogarActual('hogarId') hogarId: string, @Query() consulta: ConsultaHistorialDto) {
    return this.historial.listar(hogarId, consulta);
  }
  @Post()
  @Roles(Rol.ADMIN)
  capturar(
    @HogarActual('hogarId') hogarId: string,
    @UsuarioActual('id') usuarioId: string,
    @Body() datos: CapturarSemanaDto,
  ) {
    return this.historial.capturar(hogarId, usuarioId, datos);
  }
}
