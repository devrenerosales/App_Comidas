import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HogarModule } from '../hogar/hogar.module';
import { RolesGuard } from '../hogar/roles.guard';
import { HistorialController } from './historial.controller';
import { HistorialRepositorio } from './historial.repositorio';
import { HistorialService, RELOJ_HISTORIAL } from './historial.service';

@Module({
  imports: [AuthModule, HogarModule],
  controllers: [HistorialController],
  providers: [
    HistorialRepositorio,
    HistorialService,
    RolesGuard,
    { provide: RELOJ_HISTORIAL, useValue: () => new Date() },
  ],
  exports: [HistorialRepositorio],
})
export class HistorialModule {}
