import { Inject, Injectable } from '@nestjs/common';
import { esFechaCalendario, validarCapturaHistorica } from '@menu/shared';
import type { Reloj } from '../auth/auth.constants';
import { fechaLocal } from '../configuracion/semanas';
import { Problema } from '../comun/problema';
import { HistorialRepositorio } from './historial.repositorio';
import type { CapturarSemanaDto, ConsultaHistorialDto } from './historial.dto';
export const RELOJ_HISTORIAL = Symbol('RELOJ_HISTORIAL');

@Injectable()
export class HistorialService {
  constructor(
    private readonly repositorio: HistorialRepositorio,
    @Inject(RELOJ_HISTORIAL) private readonly reloj: Reloj,
  ) {}
  capturar(hogarId: string, usuarioId: string, datos: CapturarSemanaDto) {
    const ahora = this.reloj();
    const falla = validarCapturaHistorica(datos, fechaLocal(ahora));
    if (falla)
      throw new Problema(422, falla.codigo, falla.mensaje, {
        errores: [{ campo: falla.campo, mensaje: falla.mensaje }],
      });
    return this.repositorio.guardar(hogarId, usuarioId, datos, ahora);
  }
  listar(hogarId: string, consulta: ConsultaHistorialDto) {
    if (
      (consulta.desde && !esFechaCalendario(consulta.desde)) ||
      (consulta.hasta && !esFechaCalendario(consulta.hasta)) ||
      (consulta.desde && consulta.hasta && consulta.desde > consulta.hasta)
    )
      throw new Problema(422, 'FECHAS_INVALIDAS', 'Indica un rango de fechas válido');
    return this.repositorio.listar(hogarId, consulta);
  }
}
