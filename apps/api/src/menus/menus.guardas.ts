import type { MenuSemanal } from '@menu/db';
import { Problema } from '../comun/problema';

/**
 * Se puede cambiar el Borrador y también el menú Aprobado (los cambios actualizan su lista de
 * compras); el histórico es de solo lectura.
 */
export function exigirEditable(menu: Pick<MenuSemanal, 'estado'>): void {
  if (menu.estado === 'HISTORICO') {
    throw new Problema(
      409,
      'SEMANA_HISTORICA',
      'Esta semana está en el historial y no se puede cambiar.',
    );
  }
}
