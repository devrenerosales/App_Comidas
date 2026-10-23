import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Problema } from '../comun/problema';
import { HogarActual } from '../hogar/decoradores/hogar-actual.decorator';
import { HogarGuard } from '../hogar/hogar.guard';
import { RolesGuard } from '../hogar/roles.guard';
import type {
  DetallePlatillo,
  Pagina,
  PlatilloConVistaPrevia,
  ResumenPlatillo,
  VistaPrevia,
} from './catalogo.tipos';
import {
  ConsultaPlatillosDto,
  ConsultaVistaPreviaDto,
  DatosPlatilloDto,
  IngredientesDto,
} from './dto/catalogo.dto';
import { PlatillosService } from './platillos.service';

/** Un id mal formado se trata como inexistente (404), igual que uno de otro hogar (RNF-06). */
const idPlatillo = new ParseUUIDPipe({
  version: '4',
  exceptionFactory: () => new Problema(404, 'NO_ENCONTRADO', 'El platillo no existe.'),
});

/**
 * /platillos — platillos del hogar del usuario (CU-03.1, CU-03.2). Cualquier miembro (y el
 * administrador, que hereda) los gestiona; el hogar sale de `HogarGuard`, nunca de la ruta.
 */
@Controller('platillos')
@UseGuards(HogarGuard, RolesGuard)
export class PlatillosController {
  constructor(private readonly platillos: PlatillosService) {}

  @Get()
  listar(
    @HogarActual('hogarId') hogarId: string,
    @Query() consulta: ConsultaPlatillosDto,
  ): Promise<Pagina<ResumenPlatillo>> {
    return this.platillos.listar(hogarId, consulta);
  }

  @Post()
  crear(
    @HogarActual('hogarId') hogarId: string,
    @Body() dto: DatosPlatilloDto,
  ): Promise<DetallePlatillo> {
    return this.platillos.crear(hogarId, dto);
  }

  @Get(':id')
  obtener(
    @HogarActual('hogarId') hogarId: string,
    @Param('id', idPlatillo) id: string,
  ): Promise<DetallePlatillo> {
    return this.platillos.obtener(hogarId, id);
  }

  @Patch(':id')
  actualizar(
    @HogarActual('hogarId') hogarId: string,
    @Param('id', idPlatillo) id: string,
    @Body() dto: DatosPlatilloDto,
  ): Promise<DetallePlatillo> {
    return this.platillos.actualizar(hogarId, id, dto);
  }

  @Post(':id/inactivar')
  @HttpCode(200)
  inactivar(
    @HogarActual('hogarId') hogarId: string,
    @Param('id', idPlatillo) id: string,
  ): Promise<DetallePlatillo> {
    return this.platillos.inactivar(hogarId, id);
  }

  @Post(':id/reactivar')
  @HttpCode(200)
  reactivar(
    @HogarActual('hogarId') hogarId: string,
    @Param('id', idPlatillo) id: string,
  ): Promise<DetallePlatillo> {
    return this.platillos.reactivar(hogarId, id);
  }

  @Put(':id/ingredientes')
  guardarIngredientes(
    @HogarActual('hogarId') hogarId: string,
    @Param('id', idPlatillo) id: string,
    @Body() dto: IngredientesDto,
  ): Promise<PlatilloConVistaPrevia> {
    return this.platillos.guardarIngredientes(hogarId, id, dto);
  }

  @Get(':id/vista-previa')
  vistaPrevia(
    @HogarActual('hogarId') hogarId: string,
    @Param('id', idPlatillo) id: string,
    @Query() consulta: ConsultaVistaPreviaDto,
  ): Promise<VistaPrevia> {
    return this.platillos.vistaPrevia(hogarId, id, consulta.sumaFactores);
  }
}
