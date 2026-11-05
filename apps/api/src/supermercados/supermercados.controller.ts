import { Body, Controller, Get, Param, ParseUUIDPipe, Put, UseGuards } from '@nestjs/common';
import { Problema } from '../comun/problema';
import { HogarActual } from '../hogar/decoradores/hogar-actual.decorator';
import { HogarGuard } from '../hogar/hogar.guard';
import { RolesGuard } from '../hogar/roles.guard';
import { GuardarMarcaDto, GuardarSupermercadosDto } from './dto/supermercados.dto';
import { SupermercadosService } from './supermercados.service';
import type {
  MarcaElegida,
  SupermercadoPreferido,
  VistaMarcasProducto,
} from './supermercados.tipos';

/** Un id de producto mal formado se trata como inexistente (404). */
const idProducto = new ParseUUIDPipe({
  version: '4',
  exceptionFactory: () => new Problema(404, 'NO_ENCONTRADO', 'El producto no existe.'),
});

/**
 * /hogar/preferencias/supermercados y /marcas — supermercados y marcas preferidas (CU-02.5,
 * HU-09). Son del hogar y los edita cualquier miembro (RN-10 no los restringe); el hogar sale de
 * `HogarGuard`, nunca de la ruta (RNF-06).
 */
@Controller('hogar/preferencias')
@UseGuards(HogarGuard, RolesGuard)
export class SupermercadosController {
  constructor(private readonly supermercados: SupermercadosService) {}

  @Get('supermercados')
  listar(@HogarActual('hogarId') hogarId: string): Promise<SupermercadoPreferido[]> {
    return this.supermercados.supermercados(hogarId);
  }

  @Put('supermercados')
  guardar(
    @HogarActual('hogarId') hogarId: string,
    @Body() dto: GuardarSupermercadosDto,
  ): Promise<SupermercadoPreferido[]> {
    return this.supermercados.guardarSupermercados(hogarId, dto);
  }

  @Get('marcas')
  marcas(@HogarActual('hogarId') hogarId: string): Promise<MarcaElegida[]> {
    return this.supermercados.marcasElegidas(hogarId);
  }

  @Get('marcas/:productoId')
  marcasDeProducto(
    @HogarActual('hogarId') hogarId: string,
    @Param('productoId', idProducto) productoId: string,
  ): Promise<VistaMarcasProducto> {
    return this.supermercados.marcasDeProducto(hogarId, productoId);
  }

  @Put('marcas/:productoId')
  guardarMarca(
    @HogarActual('hogarId') hogarId: string,
    @Param('productoId', idProducto) productoId: string,
    @Body() dto: GuardarMarcaDto,
  ): Promise<VistaMarcasProducto> {
    return this.supermercados.guardarMarca(hogarId, productoId, dto);
  }
}
