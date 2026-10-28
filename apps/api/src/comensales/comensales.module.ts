import { Module } from '@nestjs/common';
import { HogarModule } from '../hogar/hogar.module';
import { AdminComensalesGuard } from './admin-comensales.guard';
import { ComensalesController } from './comensales.controller';
import { ComensalesRepositorio } from './comensales.repositorio';
import { ComensalesService } from './comensales.service';

/**
 * M01 · CU-01.3 — comensales con factor de porción (HU-03, D-02). Exporta `ComensalesService`
 * para que el escalado de cantidades (HU-12, HU-28) lea el total de porciones (RN-07).
 */
@Module({
  imports: [HogarModule],
  controllers: [ComensalesController],
  providers: [ComensalesRepositorio, ComensalesService, AdminComensalesGuard],
  exports: [ComensalesService],
})
export class ComensalesModule {}
