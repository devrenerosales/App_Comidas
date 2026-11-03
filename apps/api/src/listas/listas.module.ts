import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HogarModule } from '../hogar/hogar.module';
import { ListasController } from './listas.controller';
import { ListasRepositorio } from './listas.repositorio';
import { ListasService } from './listas.service';

/** M07 · CU-07.1 — lista de compras consolidada del menú aprobado (HU-28). */
@Module({
  imports: [AuthModule, HogarModule],
  controllers: [ListasController],
  providers: [ListasRepositorio, ListasService],
})
export class ListasModule {}
