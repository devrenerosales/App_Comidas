import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Problema } from '../comun/problema';
import { HogarActual } from '../hogar/decoradores/hogar-actual.decorator';
import { HogarGuard } from '../hogar/hogar.guard';
import { RolesGuard } from '../hogar/roles.guard';
import { AdminSistemaGuard } from './admin-sistema.guard';
import type {
  Pagina,
  ProductoConAfectados,
  VistaCategoria,
  VistaProducto,
  VistaUnidad,
} from './catalogo.tipos';
import { ActualizarProductoDto, ConsultaProductosDto, CrearProductoDto } from './dto/catalogo.dto';
import { ProductosService } from './productos.service';

/** Un id mal formado se trata como inexistente (404). */
export const idProducto = new ParseUUIDPipe({
  version: '4',
  exceptionFactory: () => new Problema(404, 'NO_ENCONTRADO', 'El producto no existe.'),
});

/**
 * /productos — catálogo común a todos los hogares (D-05, CU-03.3). Cualquier miembro de un
 * hogar consulta y crea productos; editar, inactivar y reactivar es del administrador del
 * sistema porque el cambio afecta a todos los hogares.
 */
@Controller('productos')
@UseGuards(HogarGuard, RolesGuard)
export class ProductosController {
  constructor(private readonly productos: ProductosService) {}

  @Get()
  listar(@Query() consulta: ConsultaProductosDto): Promise<Pagina<VistaProducto>> {
    return this.productos.listar(consulta);
  }

  @Get(':id')
  obtener(@Param('id', idProducto) id: string): Promise<VistaProducto> {
    return this.productos.obtener(id);
  }

  @Post()
  crear(@Body() dto: CrearProductoDto): Promise<VistaProducto> {
    return this.productos.crear(dto);
  }

  @Patch(':id')
  @UseGuards(AdminSistemaGuard)
  actualizar(
    @Param('id', idProducto) id: string,
    @Body() dto: ActualizarProductoDto,
  ): Promise<VistaProducto> {
    return this.productos.actualizar(id, dto);
  }

  @Post(':id/inactivar')
  @HttpCode(200)
  @UseGuards(AdminSistemaGuard)
  inactivar(
    @Param('id', idProducto) id: string,
    @HogarActual('hogarId') hogarId: string,
  ): Promise<ProductoConAfectados> {
    return this.productos.inactivar(id, hogarId);
  }

  @Post(':id/reactivar')
  @HttpCode(200)
  @UseGuards(AdminSistemaGuard)
  reactivar(
    @Param('id', idProducto) id: string,
    @HogarActual('hogarId') hogarId: string,
  ): Promise<ProductoConAfectados> {
    return this.productos.reactivar(id, hogarId);
  }
}

/** /unidades y /categorias — catálogos semilla (§8.2, §8.3), sin paginar. */
@Controller()
@UseGuards(HogarGuard, RolesGuard)
export class CatalogosController {
  constructor(private readonly productos: ProductosService) {}

  @Get('unidades')
  unidades(): Promise<VistaUnidad[]> {
    return this.productos.unidades();
  }

  @Get('categorias')
  categorias(): Promise<VistaCategoria[]> {
    return this.productos.categorias();
  }
}
