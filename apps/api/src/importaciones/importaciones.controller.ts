import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { Rol } from '@menu/shared';
import { UsuarioActual } from '../auth/decoradores/usuario-actual.decorator';
import type { Reloj } from '../auth/auth.constants';
import { HogarActual } from '../hogar/decoradores/hogar-actual.decorator';
import { Roles } from '../hogar/decoradores/roles.decorator';
import { HogarGuard } from '../hogar/hogar.guard';
import { RolesGuard } from '../hogar/roles.guard';
import { fechaLocal } from '../configuracion/semanas';
import { Problema } from '../comun/problema';
import { ImportacionesRepositorio } from './importaciones.repositorio';
import {
  ArchivoDto,
  DecisionesDto,
  DecisionesPlatillosDto,
  FilasDto,
  PlantillaDto,
  PlatillosConsultaDto,
  RevisionDto,
} from './importaciones.dto';
import { generarPlantilla, leerArchivo, validarFilas } from './importaciones.parser';
import { LIMITE_ARCHIVO, type ArchivoImportacion } from './importaciones.tipos';
export const RELOJ_IMPORTACIONES = Symbol('RELOJ_IMPORTACIONES');

@Controller('importaciones')
@UseGuards(HogarGuard, RolesGuard)
@Roles(Rol.ADMIN)
export class ImportacionesController {
  constructor(
    private readonly repositorio: ImportacionesRepositorio,
    @Inject(RELOJ_IMPORTACIONES) private readonly reloj: Reloj,
  ) {}
  @Get('plantilla')
  async plantilla(@Query() consulta: PlantillaDto, @Res() respuesta: Response) {
    const buffer = await generarPlantilla(consulta.formato);
    respuesta.setHeader(
      'Content-Type',
      consulta.formato === 'csv'
        ? 'text/csv; charset=utf-8'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    respuesta.setHeader(
      'Content-Disposition',
      `attachment; filename="plantilla-menus.${consulta.formato}"`,
    );
    respuesta.setHeader('Cache-Control', 'no-store');
    respuesta.send(buffer);
  }
  @Post()
  @UseInterceptors(
    FileInterceptor('archivo', { limits: { fileSize: LIMITE_ARCHIVO, files: 1, fields: 1 } }),
  )
  async cargar(
    @HogarActual('hogarId') hogarId: string,
    @UsuarioActual('id') usuarioId: string,
    @UploadedFile() archivo: ArchivoImportacion | undefined,
    @Body() _datos: ArchivoDto,
  ) {
    if (!archivo) throw new Problema(400, 'ARCHIVO_REQUERIDO', 'Selecciona un archivo');
    const { formato, entradas } = await leerArchivo(archivo);
    const filas = validarFilas(entradas, fechaLocal(this.reloj()));
    return this.repositorio.crear(hogarId, usuarioId, archivo, formato, filas);
  }
  @Get(':id')
  obtener(
    @HogarActual('hogarId') hogarId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.repositorio.obtener(hogarId, id);
  }
  @Get(':id/filas')
  filas(
    @HogarActual('hogarId') hogarId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query() consulta: FilasDto,
  ) {
    return this.repositorio.filas(hogarId, id, consulta);
  }
  @Get(':id/platillos')
  platillos(
    @HogarActual('hogarId') hogarId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query() consulta: PlatillosConsultaDto,
  ) {
    return this.repositorio.platillos(hogarId, id, consulta);
  }
  @Put(':id/platillos')
  decidirPlatillos(
    @HogarActual('hogarId') hogarId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() datos: DecisionesPlatillosDto,
  ) {
    return this.repositorio.decidirPlatillos(hogarId, id, datos);
  }
  @Put(':id/semanas')
  decidir(
    @HogarActual('hogarId') hogarId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() datos: DecisionesDto,
  ) {
    return this.repositorio.decidir(hogarId, id, datos);
  }
  @Post(':id/confirmar')
  confirmar(
    @HogarActual('hogarId') hogarId: string,
    @UsuarioActual('id') usuarioId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() datos: RevisionDto,
  ) {
    return this.repositorio.confirmar(hogarId, usuarioId, id, datos.revision, this.reloj());
  }
  @Post(':id/cancelar')
  cancelar(
    @HogarActual('hogarId') hogarId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() datos: RevisionDto,
  ) {
    return this.repositorio.cancelar(hogarId, id, datos.revision);
  }
}
