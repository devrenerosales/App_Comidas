import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HogarModule } from '../hogar/hogar.module';
import { RELOJ_CALIFICACIONES } from './calificaciones.constants';
import { CalificacionesController } from './calificaciones.controller';
import { CalificacionesRepositorio } from './calificaciones.repositorio';
import { CalificacionesService } from './calificaciones.service';

/** M03 · CU-11.1 — calificar platillos ya servidos (HU-14). */
@Module({
  imports: [AuthModule, HogarModule],
  controllers: [CalificacionesController],
  providers: [
    CalificacionesRepositorio,
    CalificacionesService,
    { provide: RELOJ_CALIFICACIONES, useValue: () => new Date() },
  ],
})
export class CalificacionesModule {}
