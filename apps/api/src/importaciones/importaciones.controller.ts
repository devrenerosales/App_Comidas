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
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
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
import {
  generarPlantilla,
  leerArchivo,
  leerListasCsv,
  validarFilas,
  validarListas,
} from './importaciones.parser';
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
    const buffer = await generarPlantilla(consulta.formato, consulta.hoja);
    respuesta.setHeader(
      'Content-Type',
      consulta.formato === 'csv'
        ? 'text/csv; charset=utf-8'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    respuesta.setHeader(
      'Content-Disposition',
      `attachment; filename="plantilla-${consulta.hoja === 'listas' ? 'listas' : 'menus'}.${consulta.formato}"`,
    );
    respuesta.setHeader('Cache-Control', 'no-store');
    respuesta.send(buffer);
  }
  @Post()
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'archivo', maxCount: 1 },
        { name: 'listas', maxCount: 1 },
      ],
      { limits: { fileSize: LIMITE_ARCHIVO, files: 2, fields: 1 } },
    ),
  )
  async cargar(
    @HogarActual('hogarId') hogarId: string,
    @UsuarioActual('id') usuarioId: string,
    @UploadedFiles() archivos: Record<string, ArchivoImportacion[]> | undefined,
    @Body() datos: ArchivoDto,
  ) {
    const archivo = archivos?.['archivo']?.[0];
    const listasCsv = archivos?.['listas']?.[0];
    if (!archivo) throw new Problema(400, 'ARCHIVO_REQUERIDO', 'Selecciona un archivo');
    const cuaderno = datos.origen === 'CUADERNO';
    if (listasCsv && !cuaderno)
      throw new Problema(
        422,
        'LISTAS_REQUIEREN_CUADERNO',
        'Las listas solo se cargan en la carga inicial del cuaderno',
      );
    const { formato, entradas, entradasListas } = await leerArchivo(archivo, {
      conListas: cuaderno,
    });
    if (listasCsv && entradasListas)
      throw new Problema(
        422,
        'LISTAS_DUPLICADAS',
        'El Excel ya trae la hoja Listas: no envíes también un CSV de listas',
      );
    const hoy = fechaLocal(this.reloj());
    const crudas = entradasListas ?? (listasCsv ? leerListasCsv(listasCsv) : null);
    return this.repositorio.crear(
      hogarId,
      usuarioId,
      archivo,
      formato,
      validarFilas(entradas, hoy),
      { origen: datos.origen, listas: crudas ? validarListas(crudas, hoy) : [] },
    );
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
