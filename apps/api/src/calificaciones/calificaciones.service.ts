import { Inject, Injectable } from '@nestjs/common';
import { Problema } from '../comun/problema';
import { fechaLocal } from '../configuracion/semanas';
import { RELOJ_CALIFICACIONES } from './calificaciones.constants';
import { CalificacionesRepositorio, type PromedioPlatillo } from './calificaciones.repositorio';

export interface RespuestaCalificacion {
  valor: number;
  platillo: PromedioPlatillo;
}

const MENSAJE_RANGO = 'La calificación debe estar entre 1 y 5';

/** M03 · CU-11.1 — calificar el platillo servido en un espacio del menú (HU-14). */
@Injectable()
export class CalificacionesService {
  constructor(
    private readonly repo: CalificacionesRepositorio,
    @Inject(RELOJ_CALIFICACIONES) private readonly reloj: () => Date,
  ) {}

  async calificar(
    hogarId: string,
    usuarioId: string,
    menuId: string,
    detalleId: string,
    valor: number,
  ): Promise<RespuestaCalificacion> {
    if (!Number.isInteger(valor) || valor < 1 || valor > 5) {
      throw new Problema(422, 'CALIFICACION_FUERA_DE_RANGO', MENSAJE_RANGO);
    }
    const detalle = await this.repo.buscarDetalle(hogarId, menuId, detalleId);
    if (!detalle) throw new Problema(404, 'NO_ENCONTRADO', 'La comida no existe.');
    if (detalle.estadoMenu === 'BORRADOR') {
      throw new Problema(409, 'MENU_NO_APROBADO', 'El menú todavía no está aprobado.');
    }
    if (!detalle.platilloId) {
      throw new Problema(422, 'SIN_PLATILLO', 'Esta comida no tiene un platillo para calificar.');
    }
    if (detalle.fecha > fechaLocal(this.reloj())) {
      throw new Problema(422, 'FECHA_FUTURA', 'Solo puedes calificar comidas de hoy o anteriores.');
    }
    const platillo = await this.repo.guardar(detalle.id, detalle.platilloId, usuarioId, valor);
    return { valor, platillo };
  }
}
