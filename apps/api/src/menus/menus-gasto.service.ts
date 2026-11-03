import { Inject, Injectable } from '@nestjs/common';
import { validarGasto, deCentavos } from '@menu/shared';
import { Problema } from '../comun/problema';
import type { RegistrarGastoDto } from './dto/menus.dto';
import { RELOJ_MENUS } from './menus.constants';
import { MenusRepositorio } from './menus.repositorio';
import { gastoDelMenu, type GastoRegistrado } from './menus.vista';

const noEncontrado = () => new Problema(404, 'NO_ENCONTRADO', 'El menú no existe.');

/** M06 · CU-06.4 — registrar el gasto real de la semana (HU-27). */
@Injectable()
export class MenusGastoService {
  constructor(
    private readonly repo: MenusRepositorio,
    @Inject(RELOJ_MENUS) private readonly reloj: () => Date,
  ) {}

  /**
   * Guarda el monto total de la semana con quién y cuándo; si ya había uno, queda el último
   * valor (2a). Solo un menú Aprobado admite gasto (E2).
   */
  async registrar(
    hogarId: string,
    usuarioId: string,
    menuId: string,
    dto: RegistrarGastoDto,
  ): Promise<GastoRegistrado> {
    const completo = await this.repo.cargar(hogarId, menuId);
    if (!completo) throw noEncontrado();
    if (completo.menu.estado === 'HISTORICO') {
      throw new Problema(
        409,
        'SEMANA_HISTORICA',
        'Esta semana está en el historial; corrige su gasto desde el historial.',
      );
    }
    if (completo.menu.estado !== 'APROBADO') {
      throw new Problema(409, 'MENU_NO_APROBADO', 'Aprueba el menú para registrar el gasto real');
    }
    const monto = validarGasto(
      typeof dto.monto === 'string' || typeof dto.monto === 'number' ? dto.monto : null,
    );
    if (!monto.ok) throw new Problema(422, 'MONTO_INVALIDO', monto.mensaje);

    const guardado = await this.repo.registrarGasto(hogarId, menuId, {
      usuarioId,
      monto: deCentavos(Math.round(monto.valor * 100)),
      nota: dto.nota?.trim() ? dto.nota.trim() : null,
      registradoEn: this.reloj(),
    });
    if (!guardado) {
      throw new Problema(
        409,
        'MENU_NO_APROBADO',
        'El menú cambió mientras registrabas el gasto. Vuelve a abrirlo e inténtalo de nuevo.',
      );
    }
    const actual = await this.repo.cargar(hogarId, menuId);
    return gastoDelMenu(actual ?? completo) as GastoRegistrado;
  }
}
