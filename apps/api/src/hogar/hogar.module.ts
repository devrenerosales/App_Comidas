import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HogarController, HogaresController } from './hogar.controller';
import { HogarGuard } from './hogar.guard';
import { HogarRepositorio } from './hogar.repositorio';
import { HogarService } from './hogar.service';
import { InvitacionesController } from './invitaciones.controller';
import { InvitacionesRepositorio } from './invitaciones.repositorio';
import { InvitacionesService } from './invitaciones.service';
import { RolesGuard } from './roles.guard';

/**
 * M01 · CU-01.2 — hogar e invitaciones (HU-02). Exporta `HogarGuard`, `RolesGuard` y el
 * repositorio para que los módulos del hogar (comensales, configuración…) los reutilicen.
 */
@Module({
  imports: [AuthModule],
  controllers: [HogaresController, HogarController, InvitacionesController],
  providers: [
    HogarRepositorio,
    InvitacionesRepositorio,
    HogarService,
    InvitacionesService,
    HogarGuard,
    RolesGuard,
  ],
  exports: [HogarRepositorio, HogarGuard, RolesGuard],
})
export class HogarModule {}
