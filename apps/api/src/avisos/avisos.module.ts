import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HogarModule } from '../hogar/hogar.module';
import { RELOJ_AVISOS } from './avisos.constants';
import { AvisosController } from './avisos.controller';
import { AvisosRepositorio } from './avisos.repositorio';
import { AvisosService } from './avisos.service';

/** M08 · RF-38 — avisos de precios para el administrador (HU-38). */
@Module({
  imports: [AuthModule, HogarModule],
  controllers: [AvisosController],
  providers: [
    AvisosRepositorio,
    AvisosService,
    { provide: RELOJ_AVISOS, useValue: () => new Date() },
  ],
})
export class AvisosModule {}
