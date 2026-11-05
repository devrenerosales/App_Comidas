import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HogarModule } from '../hogar/hogar.module';
import { SupermercadosController } from './supermercados.controller';
import { SupermercadosRepositorio } from './supermercados.repositorio';
import { SupermercadosService } from './supermercados.service';

/** M02 · CU-02.5 — supermercados y marcas preferidas del hogar (HU-09). */
@Module({
  imports: [AuthModule, HogarModule],
  controllers: [SupermercadosController],
  providers: [SupermercadosRepositorio, SupermercadosService],
  exports: [SupermercadosRepositorio],
})
export class SupermercadosModule {}
