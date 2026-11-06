import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HogarModule } from '../hogar/hogar.module';
import { RELOJ_TABLERO } from './tablero.constants';
import { TableroController } from './tablero.controller';
import { TableroRepositorio } from './tablero.repositorio';
import { TableroService } from './tablero.service';

/** Resumen de gasto, consumo e historial de presupuesto para el Inicio. */
@Module({
  imports: [AuthModule, HogarModule],
  controllers: [TableroController],
  providers: [
    TableroRepositorio,
    TableroService,
    { provide: RELOJ_TABLERO, useValue: () => new Date() },
  ],
})
export class TableroModule {}
