import {
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Rol } from '@menu/shared';
import { UsuarioActual } from '../auth/decoradores/usuario-actual.decorator';
import { Problema } from '../comun/problema';
import { HogarActual } from '../hogar/decoradores/hogar-actual.decorator';
import { Roles } from '../hogar/decoradores/roles.decorator';
import { HogarGuard } from '../hogar/hogar.guard';
import { RolesGuard } from '../hogar/roles.guard';
import { AvisosService, type VistaAviso } from './avisos.service';

/** Un id mal formado se trata como inexistente (404). */
const idAviso = new ParseUUIDPipe({
  version: '4',
  exceptionFactory: () => new Problema(404, 'NO_ENCONTRADO', 'El aviso no existe.'),
});

/** /avisos — avisos de precios para el administrador del hogar (HU-38). */
@Controller('avisos')
@UseGuards(HogarGuard, RolesGuard)
@Roles(Rol.ADMIN)
export class AvisosController {
  constructor(private readonly avisos: AvisosService) {}

  /** `?noLeidos=true` deja solo los pendientes de leer. */
  @Get()
  listar(
    @HogarActual('hogarId') hogarId: string,
    @Query('noLeidos') noLeidos?: string,
  ): Promise<VistaAviso[]> {
    return this.avisos.listar(hogarId, noLeidos === 'true');
  }

  @Post(':id/leido')
  @HttpCode(204)
  marcarLeido(
    @HogarActual('hogarId') hogarId: string,
    @UsuarioActual('id') usuarioId: string,
    @Param('id', idAviso) id: string,
  ): Promise<void> {
    return this.avisos.marcarLeido(hogarId, usuarioId, id);
  }
}
