import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UsuarioActual } from '../auth/decoradores/usuario-actual.decorator';
import { Problema } from '../comun/problema';
import { HogarActual } from '../hogar/decoradores/hogar-actual.decorator';
import { HogarGuard } from '../hogar/hogar.guard';
import { RolesGuard } from '../hogar/roles.guard';
import { ActualizarVinculoDto, CrearVinculoDto } from './dto/vinculos.dto';
import { VinculosService } from './vinculos.service';
import type { VistaSupermercado, VistaVinculo } from './vinculos.tipos';

/** Un id mal formado se trata como inexistente (404). */
const idProducto = new ParseUUIDPipe({
  version: '4',
  exceptionFactory: () => new Problema(404, 'NO_ENCONTRADO', 'El producto no existe.'),
});
const idVinculo = new ParseUUIDPipe({
  version: '4',
  exceptionFactory: () => new Problema(404, 'NO_ENCONTRADO', 'El vínculo no existe.'),
});

/**
 * Vínculos producto ↔ supermercado (CU-08.2, HU-35). Son comunes a todos los hogares (D-05) y
 * cualquier miembro los crea y edita, igual que los productos del catálogo.
 */
@Controller()
@UseGuards(HogarGuard, RolesGuard)
export class VinculosController {
  constructor(private readonly vinculos: VinculosService) {}

  @Get('supermercados')
  supermercados(): Promise<VistaSupermercado[]> {
    return this.vinculos.supermercados();
  }

  @Get('productos/:id/vinculos')
  listar(
    @HogarActual('hogarId') hogarId: string,
    @Param('id', idProducto) productoId: string,
  ): Promise<VistaVinculo[]> {
    return this.vinculos.listar(hogarId, productoId);
  }

  /** `?reemplazar=true` confirma el reemplazo del vínculo activo (CA-35.3). */
  @Post('productos/:id/vinculos')
  crear(
    @HogarActual('hogarId') hogarId: string,
    @UsuarioActual('id') usuarioId: string,
    @Param('id', idProducto) productoId: string,
    @Query('reemplazar') reemplazar: string | undefined,
    @Body() dto: CrearVinculoDto,
  ): Promise<VistaVinculo> {
    return this.vinculos.crear(hogarId, usuarioId, productoId, dto, reemplazar === 'true');
  }

  @Patch('vinculos/:id')
  actualizar(
    @HogarActual('hogarId') hogarId: string,
    @Param('id', idVinculo) id: string,
    @Body() dto: ActualizarVinculoDto,
  ): Promise<VistaVinculo> {
    return this.vinculos.actualizar(hogarId, id, dto);
  }
}
