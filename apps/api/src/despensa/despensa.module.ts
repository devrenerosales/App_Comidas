import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ConfiguracionModule } from '../configuracion/configuracion.module';
import { HogarModule } from '../hogar/hogar.module';
import { DespensaController } from './despensa.controller';
import { DespensaRepositorio } from './despensa.repositorio';
import { DespensaService } from './despensa.service';

/** M07 · CU-07.2 — despensa del hogar según frecuencia (HU-29). */
@Module({
  imports: [AuthModule, HogarModule, ConfiguracionModule],
  controllers: [DespensaController],
  providers: [DespensaRepositorio, DespensaService],
})
export class DespensaModule {}
