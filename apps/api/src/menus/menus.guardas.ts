import type { MenuSemanal } from '@menu/db';
import { Problema } from '../comun/problema';

/** Solo el Borrador se puede cambiar; aprobado o histórico es de solo lectura. */
export function exigirBorrador(menu: Pick<MenuSemanal, 'estado'>): void {
  if (menu.estado === 'APROBADO') {
    throw new Problema(409, 'MENU_APROBADO', 'El menú ya está aprobado y no se puede cambiar.');
  }
  if (menu.estado === 'HISTORICO') {
    throw new Problema(
      409,
      'SEMANA_HISTORICA',
      'Esta semana está en el historial y no se puede cambiar.',
    );
  }
}
