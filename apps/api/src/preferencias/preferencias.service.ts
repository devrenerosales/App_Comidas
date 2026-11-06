import { Injectable } from '@nestjs/common';
import { Problema } from '../comun/problema';
import type { GuardarGustosDto } from './dto/preferencias.dto';
import { PreferenciasRepositorio } from './preferencias.repositorio';
import type {
  AdvertenciaFavoritoExcluido,
  ElementoGusto,
  PlatilloExcluido,
  VistaGustos,
} from './preferencias.tipos';

const unicos = (ids: string[]): string[] => [...new Set(ids)];

/** CA-10.3: "Chile relleno contiene un ingrediente excluido: Chile pimiento". */
export function mensajeFavoritoExcluido(nombre: string, ingredientes: string[]): string {
  const plural = ingredientes.length > 1;
  return `${nombre} contiene ${plural ? 'ingredientes excluidos' : 'un ingrediente excluido'}: ${ingredientes.join(', ')}`;
}

/** M02 · CU-02.6 — restricciones y gustos del hogar (HU-10). */
@Injectable()
export class PreferenciasService {
  constructor(private readonly repo: PreferenciasRepositorio) {}

  async obtener(hogarId: string): Promise<VistaGustos> {
    const [excluidos, favoritos] = await Promise.all([
      this.repo.excluidos(hogarId),
      this.repo.favoritos(hogarId),
    ]);
    return this.vista(hogarId, excluidos, favoritos);
  }

  /** Cuánto cambiaría el menú con estas listas, sin guardar (CU-02.6 pasos 3 y 4a). */
  async vistaPrevia(hogarId: string, dto: GuardarGustosDto): Promise<VistaGustos> {
    const { excluidos, favoritos } = await this.resolver(hogarId, dto, false);
    return this.vista(hogarId, excluidos, favoritos);
  }

  async guardar(hogarId: string, dto: GuardarGustosDto): Promise<VistaGustos> {
    const { excluidos, favoritos } = await this.resolver(hogarId, dto, true);
    await this.repo.guardar(
      hogarId,
      excluidos.map((e) => e.id),
      favoritos.map((f) => f.id),
    );
    return this.vista(hogarId, excluidos, favoritos);
  }

  /**
   * Valida y resuelve las listas pedidas: un id inexistente o de otro hogar es 404 y un elemento
   * inactivo que se agrega ahora es 422 `INACTIVO` (E1). Los que ya estaban guardados se conservan
   * aunque después se inactiven.
   */
  private async resolver(
    hogarId: string,
    dto: GuardarGustosDto,
    estricto: boolean,
  ): Promise<{ excluidos: ElementoGusto[]; favoritos: ElementoGusto[] }> {
    const idsProductos = unicos(dto.ingredientesExcluidos);
    const idsPlatillos = unicos(dto.favoritos);
    const [productos, platillos, excluidosActuales, favoritosActuales] = await Promise.all([
      this.repo.productos(idsProductos),
      this.repo.platillos(hogarId, idsPlatillos),
      this.repo.excluidos(hogarId),
      this.repo.favoritos(hogarId),
    ]);
    const excluidos = this.ordenar(idsProductos, productos, 'El ingrediente no existe.');
    const favoritos = this.ordenar(idsPlatillos, platillos, 'El platillo no existe.');
    if (estricto) {
      this.exigirActivos(excluidos, excluidosActuales, 'El ingrediente');
      this.exigirActivos(favoritos, favoritosActuales, 'El platillo');
    }
    return { excluidos, favoritos };
  }

  private ordenar(ids: string[], encontrados: ElementoGusto[], mensaje: string): ElementoGusto[] {
    const porId = new Map(encontrados.map((e) => [e.id, e]));
    const lista = ids.map((id) => porId.get(id));
    if (lista.some((e) => e === undefined)) throw new Problema(404, 'NO_ENCONTRADO', mensaje);
    return (lista as ElementoGusto[]).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }

  private exigirActivos(pedidos: ElementoGusto[], actuales: ElementoGusto[], sujeto: string): void {
    const yaEstaban = new Set(actuales.map((a) => a.id));
    const inactivo = pedidos.find((p) => !p.activo && !yaEstaban.has(p.id));
    if (inactivo) {
      throw new Problema(
        422,
        'INACTIVO',
        `${sujeto} "${inactivo.nombre}" está inactivo y no se puede agregar.`,
      );
    }
  }

  private async vista(
    hogarId: string,
    excluidos: ElementoGusto[],
    favoritos: ElementoGusto[],
  ): Promise<VistaGustos> {
    const filas = await this.repo.platillosConProductos(
      hogarId,
      excluidos.map((e) => e.id),
    );
    const porPlatillo = new Map<string, PlatilloExcluido>();
    for (const f of filas) {
      const previo = porPlatillo.get(f.platilloId);
      if (previo) previo.ingredientes.push(f.productoNombre);
      else {
        porPlatillo.set(f.platilloId, {
          id: f.platilloId,
          nombre: f.platilloNombre,
          ingredientes: [f.productoNombre],
        });
      }
    }
    const advertencias: AdvertenciaFavoritoExcluido[] = [];
    for (const favorito of favoritos) {
      const afectado = porPlatillo.get(favorito.id);
      if (!afectado) continue;
      advertencias.push({
        codigo: 'FAVORITO_CON_EXCLUIDO',
        platillo: { id: favorito.id, nombre: favorito.nombre },
        ingredientes: afectado.ingredientes,
        mensaje: mensajeFavoritoExcluido(favorito.nombre, afectado.ingredientes),
      });
    }
    return {
      ingredientesExcluidos: excluidos,
      favoritos,
      impacto: { platillosExcluidos: [...porPlatillo.values()] },
      advertencias,
    };
  }
}
