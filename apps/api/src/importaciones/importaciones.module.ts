import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HogarModule } from '../hogar/hogar.module';
import { RolesGuard } from '../hogar/roles.guard';
import { HistorialModule } from '../historial/historial.module';
import { ImportacionesRepositorio } from './importaciones.repositorio';
import { ImportacionesController, RELOJ_IMPORTACIONES } from './importaciones.controller';
@Module({
  imports: [AuthModule, HogarModule, HistorialModule],
  controllers: [ImportacionesController],
  providers: [
    ImportacionesRepositorio,
    RolesGuard,
    { provide: RELOJ_IMPORTACIONES, useValue: () => new Date() },
  ],
})
export class ImportacionesModule {}
