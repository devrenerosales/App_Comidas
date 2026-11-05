import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { UsuarioActual } from '../auth/decoradores/usuario-actual.decorator';
import { HogarActual } from '../hogar/decoradores/hogar-actual.decorator';
import { HogarGuard } from '../hogar/hogar.guard';
import { RolesGuard } from '../hogar/roles.guard';
import { CrearPrecioDto } from './dto/precios.dto';
import { PreciosService, type PrecioRegistrado } from './precios.service';

/**
 * /precios — registrar un precio a mano (CU-08.1, HU-34). El precio es del hogar que lo
 * registra (D-05) y cualquier miembro puede hacerlo; el hogar sale de `HogarGuard` (RNF-06).
 */
@Controller('precios')
@UseGuards(HogarGuard, RolesGuard)
export class PreciosController {
  constructor(private readonly precios: PreciosService) {}

  @Post()
  registrar(
    @HogarActual('hogarId') hogarId: string,
    @UsuarioActual('id') usuarioId: string,
    @Body() dto: CrearPrecioDto,
  ): Promise<PrecioRegistrado> {
    return this.precios.registrar(hogarId, usuarioId, dto);
  }
}
