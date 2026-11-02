import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CatalogoModule } from '../catalogo/catalogo.module';
import { ConfiguracionModule } from '../configuracion/configuracion.module';
import { HogarModule } from '../hogar/hogar.module';
import { PreferenciasModule } from '../preferencias/preferencias.module';
import { RELOJ_MENUS } from './menus.constants';
import { MenusController } from './menus.controller';
import { MenusAprobacionService } from './menus-aprobacion.service';
import { MenusEdicionService } from './menus-edicion.service';
import { MenusRepositorio } from './menus.repositorio';
import { MenusService } from './menus.service';

/** M05 · CU-05.1 — generación del menú semanal con el motor de sugerencias (HU-19). */
@Module({
  imports: [AuthModule, HogarModule, ConfiguracionModule, CatalogoModule, PreferenciasModule],
  controllers: [MenusController],
  providers: [
    MenusRepositorio,
    MenusService,
    MenusEdicionService,
    MenusAprobacionService,
    { provide: RELOJ_MENUS, useValue: () => new Date() },
  ],
})
export class MenusModule {}
