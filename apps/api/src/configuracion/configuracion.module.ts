import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HogarModule } from '../hogar/hogar.module';
import { RELOJ_CONFIGURACION } from './configuracion.constants';
import { ConfiguracionController } from './configuracion.controller';
import { ConfiguracionRepositorio } from './configuracion.repositorio';
import { ConfiguracionService } from './configuracion.service';
import { SoloAdminGuard } from './solo-admin.guard';

/** M02 · CU-02.1, CU-02.2, CU-02.3 — tiempos de comida, presupuesto y vista previa. */
@Module({
  imports: [AuthModule, HogarModule],
  controllers: [ConfiguracionController],
  providers: [
    ConfiguracionRepositorio,
    ConfiguracionService,
    SoloAdminGuard,
    { provide: RELOJ_CONFIGURACION, useValue: () => new Date() },
  ],
})
export class ConfiguracionModule {}
