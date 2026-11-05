import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HogarModule } from '../hogar/hogar.module';
import { VinculosModule } from '../vinculos/vinculos.module';
import { RELOJ_PRECIOS } from './precios.constants';
import { PreciosController } from './precios.controller';
import { PreciosRepositorio } from './precios.repositorio';
import { PreciosService } from './precios.service';
import { ResumenPreciosController } from './resumen-precios.controller';
import { ResumenPreciosRepositorio } from './resumen-precios.repositorio';
import { ResumenPreciosService } from './resumen-precios.service';

/** M08 · CU-08.1 — registrar precios a mano (HU-34). El ticket con OCR llega en otra entrega. */
@Module({
  imports: [AuthModule, HogarModule, VinculosModule],
  controllers: [PreciosController, ResumenPreciosController],
  providers: [
    PreciosRepositorio,
    PreciosService,
    ResumenPreciosRepositorio,
    ResumenPreciosService,
    { provide: RELOJ_PRECIOS, useValue: () => new Date() },
  ],
  exports: [ResumenPreciosService],
})
export class PreciosModule {}
