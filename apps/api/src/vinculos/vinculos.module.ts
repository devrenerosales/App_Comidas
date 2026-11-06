import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HogarModule } from '../hogar/hogar.module';
import { VinculosController } from './vinculos.controller';
import { VinculosRepositorio } from './vinculos.repositorio';
import { VinculosService } from './vinculos.service';

/** M08 · CU-08.2 — vínculos de un producto con su equivalente por supermercado (HU-35). */
@Module({
  imports: [AuthModule, HogarModule],
  controllers: [VinculosController],
  providers: [VinculosRepositorio, VinculosService],
  exports: [VinculosRepositorio, VinculosService],
})
export class VinculosModule {}
