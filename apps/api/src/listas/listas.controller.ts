import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { Problema } from '../comun/problema';
import { HogarActual } from '../hogar/decoradores/hogar-actual.decorator';
import { HogarGuard } from '../hogar/hogar.guard';
import { RolesGuard } from '../hogar/roles.guard';
import { ListasService } from './listas.service';
import type { VistaLista } from './listas.vista';

/** Un id mal formado se trata como inexistente (404), igual que uno de otro hogar (RNF-06). */
const idLista = new ParseUUIDPipe({
  version: '4',
  exceptionFactory: () => new Problema(404, 'NO_ENCONTRADO', 'La lista no existe.'),
});

/** /listas — lista de compras del hogar. Cualquier miembro la consulta. */
@Controller('listas')
@UseGuards(HogarGuard, RolesGuard)
export class ListasController {
  constructor(private readonly listas: ListasService) {}

  @Get(':id')
  obtener(
    @HogarActual('hogarId') hogarId: string,
    @Param('id', idLista) id: string,
  ): Promise<VistaLista> {
    return this.listas.obtener(hogarId, id);
  }
}
