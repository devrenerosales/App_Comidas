import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HogarModule } from '../hogar/hogar.module';
import { PreferenciasController } from './preferencias.controller';
import { PreferenciasRepositorio } from './preferencias.repositorio';
import { PreferenciasService } from './preferencias.service';

/** M02 · CU-02.6 — restricciones y gustos del hogar; expone el filtro de exclusiones al motor. */
@Module({
  imports: [AuthModule, HogarModule],
  controllers: [PreferenciasController],
  providers: [PreferenciasRepositorio, PreferenciasService],
  exports: [PreferenciasRepositorio],
})
export class PreferenciasModule {}
