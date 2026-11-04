import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Problema } from '../comun/problema';
import { HogarActual } from '../hogar/decoradores/hogar-actual.decorator';
import { HogarGuard } from '../hogar/hogar.guard';
import { RolesGuard } from '../hogar/roles.guard';
import { ActualizarDespensaDto, CrearDespensaDto } from './dto/despensa.dto';
import { DespensaService } from './despensa.service';
import type { VistaDespensa } from './despensa.vista';

/** Un id mal formado se trata como inexistente (404), igual que uno de otro hogar (RNF-06). */
const idDespensa = new ParseUUIDPipe({
  version: '4',
  exceptionFactory: () => new Problema(404, 'NO_ENCONTRADO', 'El producto no está en la despensa.'),
});

/** /despensa — productos recurrentes del hogar. Cualquier miembro los mantiene (CU-07.2). */
@Controller('despensa')
@UseGuards(HogarGuard, RolesGuard)
export class DespensaController {
  constructor(private readonly despensa: DespensaService) {}

  @Get()
  listar(@HogarActual('hogarId') hogarId: string): Promise<VistaDespensa[]> {
    return this.despensa.listar(hogarId);
  }

  @Post()
  @HttpCode(201)
  crear(
    @HogarActual('hogarId') hogarId: string,
    @Body() dto: CrearDespensaDto,
  ): Promise<VistaDespensa> {
    return this.despensa.crear(hogarId, dto);
  }

  @Patch(':id')
  actualizar(
    @HogarActual('hogarId') hogarId: string,
    @Param('id', idDespensa) id: string,
    @Body() dto: ActualizarDespensaDto,
  ): Promise<VistaDespensa> {
    return this.despensa.actualizar(hogarId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async quitar(
    @HogarActual('hogarId') hogarId: string,
    @Param('id', idDespensa) id: string,
  ): Promise<void> {
    await this.despensa.quitar(hogarId, id);
  }
}
