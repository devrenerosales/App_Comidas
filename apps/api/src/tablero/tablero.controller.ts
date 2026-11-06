import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { HogarActual } from '../hogar/decoradores/hogar-actual.decorator';
import { HogarGuard } from '../hogar/hogar.guard';
import { RolesGuard } from '../hogar/roles.guard';
import { TableroService, type VistaTablero } from './tablero.service';

/** /tablero — resumen del Inicio para cualquier miembro del hogar. */
@Controller('tablero')
@UseGuards(HogarGuard, RolesGuard)
export class TableroController {
  constructor(private readonly tablero: TableroService) {}

  /** `?semanas=n` (1 a 26, por defecto 8) limita el historial de presupuesto. */
  @Get()
  obtener(
    @HogarActual('hogarId') hogarId: string,
    @Query('semanas') semanas?: string,
  ): Promise<VistaTablero> {
    return this.tablero.obtener(hogarId, semanas);
  }
}
