import { IsNumber } from 'class-validator';

/** PUT /menus/{menuId}/detalles/{detalleId}/calificacion. El rango lo valida el servicio (422). */
export class CalificarDto {
  @IsNumber({}, { message: 'La calificación debe estar entre 1 y 5' })
  valor!: number;
}
