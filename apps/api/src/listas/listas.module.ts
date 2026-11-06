import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HogarModule } from '../hogar/hogar.module';
import { PreciosModule } from '../precios/precios.module';
import { RELOJ_LISTAS } from './listas.constants';
import { ListasController } from './listas.controller';
import { ListasRepositorio } from './listas.repositorio';
import { ListasService } from './listas.service';

/** M07 · CU-07.1 — lista de compras consolidada del menú aprobado (HU-28). */
@Module({
  imports: [AuthModule, HogarModule, PreciosModule],
  controllers: [ListasController],
  providers: [
    ListasRepositorio,
    ListasService,
    { provide: RELOJ_LISTAS, useValue: () => new Date() },
  ],
})
export class ListasModule {}
