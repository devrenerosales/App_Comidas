import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HogarModule } from '../hogar/hogar.module';
import { AdminSistemaGuard } from './admin-sistema.guard';
import { PlatillosController } from './platillos.controller';
import { PlatillosRepositorio } from './platillos.repositorio';
import { PlatillosService } from './platillos.service';
import { CatalogosController, ProductosController } from './productos.controller';
import { ProductosRepositorio } from './productos.repositorio';
import { ProductosService } from './productos.service';

/**
 * M03 — catálogo de productos común (HU-13, D-05), platillos del hogar (HU-11) e ingredientes
 * por porciones base con vista previa RN-07 (HU-12).
 */
@Module({
  imports: [AuthModule, HogarModule],
  controllers: [ProductosController, CatalogosController, PlatillosController],
  providers: [
    ProductosRepositorio,
    ProductosService,
    PlatillosRepositorio,
    PlatillosService,
    AdminSistemaGuard,
  ],
  exports: [ProductosRepositorio, PlatillosRepositorio],
})
export class CatalogoModule {}
