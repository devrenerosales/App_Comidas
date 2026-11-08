import { Inject, Injectable } from '@nestjs/common';
import {
  NOMBRE_TIEMPO,
  aCentavos,
  deCentavos,
  despensaToca,
  nombreDiaSemana,
  type ItemDeLista,
} from '@menu/shared';
import { Problema } from '../comun/problema';
import type { AprobarMenuDto } from './dto/menus.dto';
import { RELOJ_MENUS } from './menus.constants';
import { MenusRepositorio, type MenuCompleto } from './menus.repositorio';
import { itemsDelMenu } from './menus.lista';
import { vistaMenu, type VistaMenu } from './menus.vista';

/** Respuesta de `POST /menus/{id}/aprobar` (api-contrato §3.2). */
export interface RespuestaAprobacion {
  menu: VistaMenu;
  excede: { monto: string; texto: string } | null;
  lista: {
    id: string;
    version: number;
    totalItems: number;
    itemsMenu: number;
    itemsDespensa: number;
    /** Ítems cuya unidad de receta no se pudo convertir a la de compra (CU-07.1 E1). */
    sinConversion: number;
    url: string;
  };
}

const HORA_GUATEMALA = new Intl.DateTimeFormat('es-GT', {
  timeZone: 'America/Guatemala',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** M06 · CU-06.2 — aprobar el menú Borrador y crear la lista de compras (HU-25). */
@Injectable()
export class MenusAprobacionService {
  constructor(
    private readonly repo: MenusRepositorio,
    @Inject(RELOJ_MENUS) private readonly reloj: () => Date,
  ) {}

  async aprobar(
    hogarId: string,
    usuarioId: string,
    menuId: string,
    dto: AprobarMenuDto,
  ): Promise<RespuestaAprobacion> {
    const completo = await this.repo.cargar(hogarId, menuId);
    if (!completo) throw new Problema(404, 'NO_ENCONTRADO', 'El menú no existe.');
    this.exigirBorrador(completo);
    this.exigirSinVacios(completo);
    if (completo.menu.version !== dto.version) throw this.desactualizado();

    const { items, despensaIncluida } = await this.consolidar(hogarId, completo);
    const lista = await this.repo.aprobar(hogarId, menuId, dto.version, {
      usuarioId,
      aprobadoEn: this.reloj(),
      excesoAlAprobar: this.exceso(completo),
      fechaSemana: completo.menu.fechaInicio,
      items,
      despensaIncluida,
    });
    if (!lista) {
      // Otro miembro lo cambió entre la lectura y la escritura: se informa con lo más reciente.
      const actual = await this.repo.cargar(hogarId, menuId);
      if (actual) this.exigirBorrador(actual);
      throw this.desactualizado();
    }
    const menu = vistaMenu((await this.repo.cargar(hogarId, menuId)) as MenuCompleto);
    return {
      menu,
      excede: menu.excede,
      lista: {
        id: lista.id,
        version: lista.version,
        totalItems: items.length,
        itemsMenu: items.filter((i) => i.origen !== 'DESPENSA').length,
        itemsDespensa: items.filter((i) => i.origen !== 'MENU').length,
        sinConversion: items.filter((i) => i.sinConversion).length,
        url: `/api/v1/listas/${lista.id}`,
      },
    };
  }

  /**
   * CU-07.1: ingredientes de cada comida escalados con la Σ de factores congelada del menú (D-04),
   * convertidos a la unidad de compra y sumados por producto. Un platillo sin ingredientes no aporta.
   * CU-07.2: se suman los productos de despensa que tocan en la semana del menú.
   */
  private async consolidar(
    hogarId: string,
    { menu, detalles }: MenuCompleto,
  ): Promise<{ items: ItemDeLista[]; despensaIncluida: string[] }> {
    const ids = [...new Set(detalles.flatMap((d) => (d.platilloId ? [d.platilloId] : [])))];
    const platillos = await this.repo.ingredientesParaLista(ids);
    const queTocan = (await this.repo.despensaDelHogar(hogarId)).filter((d) =>
      despensaToca(d.ultimaInclusionSemana, menu.fechaInicio, d.frecuencia),
    );
    return {
      items: itemsDelMenu(detalles, platillos, Number(menu.sumaFactoresPorcion ?? 0), queTocan),
      despensaIncluida: queTocan.map((d) => d.id),
    };
  }

  /** E3: si ya está aprobado se informa quién y cuándo; el histórico no se aprueba. */
  private exigirBorrador({ menu, aprobadoPor }: MenuCompleto): void {
    if (menu.estado === 'APROBADO') {
      const hora = menu.aprobadoEn ? HORA_GUATEMALA.format(menu.aprobadoEn) : null;
      const quien = aprobadoPor?.nombre ?? 'Otro miembro';
      throw new Problema(
        409,
        'MENU_YA_APROBADO',
        hora ? `${quien} aprobó este menú a las ${hora}` : `${quien} ya aprobó este menú`,
        { menuId: menu.id },
      );
    }
    if (menu.estado === 'HISTORICO') {
      throw new Problema(
        409,
        'SEMANA_HISTORICA',
        'Esta semana está en el historial y no se puede aprobar.',
      );
    }
  }

  /** E1: no se aprueba con espacios sin platillo; se señalan cuáles. */
  private exigirSinVacios({ detalles }: MenuCompleto): void {
    const espacios = detalles
      .filter((d) => d.platilloId === null)
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .map((d) => ({ fecha: d.fecha, tiempo: d.tiempo }));
    if (espacios.length === 0) return;
    const nombres = espacios.map(
      (e) => `${nombreDiaSemana(e.fecha)} ${NOMBRE_TIEMPO[e.tiempo].toLowerCase()}`,
    );
    throw new Problema(422, 'ESPACIOS_VACIOS', `Asigna un platillo a: ${nombres.join(', ')}`, {
      espacios,
    });
  }

  /** Exceso total al aprobar (RN-11, D-03): suma de los excesos por tiempo; 0 si no hay. */
  private exceso({ tiempos }: MenuCompleto): string {
    const centavos = tiempos.reduce((suma, t) => suma + (aCentavos(t.exceso) ?? 0), 0);
    return deCentavos(centavos);
  }

  private desactualizado(): Problema {
    return new Problema(
      409,
      'VERSION_DESACTUALIZADA',
      'El menú cambió mientras lo revisabas. Vuelve a abrirlo e inténtalo de nuevo.',
    );
  }
}
