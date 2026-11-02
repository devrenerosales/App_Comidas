import { Inject, Injectable } from '@nestjs/common';
import {
  NOMBRE_TIEMPO,
  advertenciasDePlan,
  resumenMotivo,
  type AdvertenciaPlan,
  type EspacioPlan,
  type EspacioRevisado,
  type OrigenAsignacion,
  type TiempoComida,
} from '@menu/shared';
import { Problema } from '../comun/problema';
import type { EditarDetalleDto, FijarDetalleDto, MoverDetalleDto } from './dto/menus.dto';
import { RELOJ_MENUS } from './menus.constants';
import { exigirBorrador } from './menus.guardas';
import {
  MenusRepositorio,
  type CambioDetalle,
  type DetalleConPlatillo,
  type MenuCompleto,
} from './menus.repositorio';
import { vistaMenu, type VistaMenu } from './menus.vista';

const noEncontrado = () => new Problema(404, 'NO_ENCONTRADO', 'El menú no existe.');
const sinComida = () => new Problema(404, 'NO_ENCONTRADO', 'La comida no existe.');

const REGLAS_CONFIRMADAS = {
  RN02_PROTEINA_CONSECUTIVA: 'RN02_CONFIRMADA',
  RN03_PLATILLO_REPETIDO: 'RN03_CONFIRMADA',
} as const;

/** Respuesta de `GET /menus/{menuId}/detalles/{detalleId}/motivo` (api-contrato §2.5, HU-22). */
export interface MotivoSugerencia {
  detalleId: string;
  fecha: string;
  tiempo: TiempoComida;
  platillo: { id: string; nombre: string };
  origen: OrigenAsignacion;
  puntaje: string | null;
  factores: { preferencia: string; novedad: string; ahorro: string; afinidad: string } | null;
  /** Pesos con que se generó el menú; null si el espacio no tiene factores. */
  pesos: { preferencia: string; novedad: string; ahorro: string; afinidad: string } | null;
  costo: { estimado: string | null; incompleto: boolean };
  reglasAplicadas: string[];
  resumen: string;
}

/** Lo que cada espacio tendrá después del cambio (null = espacio sin platillo). */
type Contenido = {
  platilloId: string;
  nombre: string;
  proteina: NonNullable<DetalleConPlatillo['platilloProteina']>;
} | null;

/** M06 · CU-06.1 — leer, editar, mover y fijar espacios del menú Borrador (HU-24). */
@Injectable()
export class MenusEdicionService {
  constructor(
    private readonly repo: MenusRepositorio,
    @Inject(RELOJ_MENUS) private readonly reloj: () => Date,
  ) {}

  async obtener(hogarId: string, menuId: string): Promise<VistaMenu> {
    const completo = await this.repo.cargar(hogarId, menuId);
    if (!completo) throw noEncontrado();
    return vistaMenu(completo);
  }

  /** CU-06.1 paso 1: el menú cuya semana contiene la fecha, sea cual sea su estado. */
  async obtenerPorSemana(hogarId: string, fecha: string): Promise<VistaMenu> {
    const completo = await this.repo.cargarPorFecha(hogarId, fecha);
    if (!completo) throw new Problema(404, 'SIN_MENU', 'Esta semana todavía no tiene menú.');
    return vistaMenu(completo);
  }

  /** CU-05.4: por qué se sugirió el platillo de un espacio (factores, pesos usados, costo y reglas). */
  async motivo(hogarId: string, menuId: string, detalleId: string): Promise<MotivoSugerencia> {
    const completo = await this.repo.cargar(hogarId, menuId);
    if (!completo) throw noEncontrado();
    const d = this.espacio(completo, detalleId);
    if (!d.platilloId || !d.platilloNombre) {
      throw new Problema(422, 'SIN_PLATILLO', 'Este espacio no tiene un platillo sugerido.');
    }
    const { menu } = completo;
    const conFactores =
      d.factorPreferencia && d.factorNovedad && d.factorAhorro && d.factorAfinidad;
    const factores = conFactores
      ? {
          preferencia: d.factorPreferencia!,
          novedad: d.factorNovedad!,
          ahorro: d.factorAhorro!,
          afinidad: d.factorAfinidad!,
        }
      : null;
    const pesos =
      factores && menu.pesoPreferencia && menu.pesoNovedad && menu.pesoAhorro && menu.pesoAfinidad
        ? {
            preferencia: menu.pesoPreferencia,
            novedad: menu.pesoNovedad,
            ahorro: menu.pesoAhorro,
            afinidad: menu.pesoAfinidad,
          }
        : null;
    const numeros = <T extends Record<string, string>>(o: T | null) =>
      o && {
        preferencia: Number(o.preferencia),
        novedad: Number(o.novedad),
        ahorro: Number(o.ahorro),
        afinidad: Number(o.afinidad),
      };
    return {
      detalleId: d.id,
      fecha: d.fecha,
      tiempo: d.tiempo,
      platillo: { id: d.platilloId, nombre: d.platilloNombre },
      origen: d.origen,
      puntaje: d.puntaje,
      factores,
      pesos,
      costo: { estimado: d.costoEstimado, incompleto: d.costoIncompleto },
      reglasAplicadas: d.reglasAplicadas,
      resumen: resumenMotivo({
        origen: d.origen,
        factores: numeros(factores),
        pesos: numeros(pesos),
        costoIncompleto: d.costoIncompleto,
        nota: d.notas,
      }),
    };
  }

  /** CU-06.1 2a: elige a mano un platillo; queda fijado y con origen del usuario. */
  async editar(
    hogarId: string,
    usuarioId: string,
    menuId: string,
    detalleId: string,
    dto: EditarDetalleDto,
  ): Promise<VistaMenu> {
    const completo = await this.editable(hogarId, menuId);
    const detalle = this.espacio(completo, detalleId);
    const elegido = await this.repo.platillo(hogarId, dto.platilloId);
    if (!elegido) throw new Problema(404, 'NO_ENCONTRADO', 'El platillo no existe.');
    if (!elegido.activo) {
      throw new Problema(422, 'INACTIVO', `El platillo "${elegido.nombre}" está inactivo.`);
    }
    this.exigirAplicable(elegido.nombre, elegido.tiempos, detalle.tiempo);
    const contenido = new Map<string, Contenido>([
      [detalle.id, { platilloId: elegido.id, nombre: elegido.nombre, proteina: elegido.proteina }],
    ]);
    const advertencias = this.advertencias(completo, contenido, [detalle], dto.confirmar);
    await this.repo.aplicarCambios(menuId, [
      {
        id: detalle.id,
        cambio: this.delUsuario(usuarioId, contenido.get(detalle.id)!, advertencias),
      },
    ]);
    return this.obtener(hogarId, menuId);
  }

  /**
   * CU-06.1 2b: mueve el platillo de `origen` a `destino`; si el destino está ocupado se
   * intercambian. Ambos espacios que reciben un platillo quedan fijados.
   */
  async mover(
    hogarId: string,
    usuarioId: string,
    menuId: string,
    dto: MoverDetalleDto,
  ): Promise<VistaMenu> {
    const completo = await this.editable(hogarId, menuId);
    const origen = this.espacio(completo, dto.origenDetalleId);
    const destino = this.espacio(completo, dto.destinoDetalleId);
    if (origen.id === destino.id) {
      throw new Problema(422, 'MOVIMIENTO_INVALIDO', 'Elige un espacio distinto como destino.');
    }
    if (!origen.platilloId) {
      throw new Problema(422, 'SIN_PLATILLO', 'Este espacio no tiene un platillo para mover.');
    }
    const ids = [origen.platilloId, ...(destino.platilloId ? [destino.platilloId] : [])];
    const tiempos = await this.repo.tiemposDe(ids);
    this.exigirAplicable(
      origen.platilloNombre!,
      tiempos.get(origen.platilloId) ?? [],
      destino.tiempo,
    );
    if (destino.platilloId) {
      this.exigirAplicable(
        destino.platilloNombre!,
        tiempos.get(destino.platilloId) ?? [],
        origen.tiempo,
      );
    }
    const contenido = new Map<string, Contenido>([
      [destino.id, this.contenidoDe(origen)],
      [origen.id, destino.platilloId ? this.contenidoDe(destino) : null],
    ]);
    const advertencias = this.advertencias(completo, contenido, [origen, destino], dto.confirmar);
    const cambios = [origen, destino].map((d) => {
      const nuevo = contenido.get(d.id)!;
      return {
        id: d.id,
        cambio: nuevo ? this.delUsuario(usuarioId, nuevo, advertencias) : this.vacio(usuarioId),
      };
    });
    await this.repo.aplicarCambios(menuId, cambios);
    return this.obtener(hogarId, menuId);
  }

  /** CU-06.1 2c: alterna el candado de un espacio con platillo. */
  async fijar(
    hogarId: string,
    usuarioId: string,
    menuId: string,
    detalleId: string,
    dto: FijarDetalleDto,
  ): Promise<VistaMenu> {
    const completo = await this.editable(hogarId, menuId);
    const detalle = this.espacio(completo, detalleId);
    if (!detalle.platilloId) {
      throw new Problema(422, 'SIN_PLATILLO', 'Un espacio sin platillo no se puede fijar.');
    }
    await this.repo.aplicarCambios(menuId, [
      {
        id: detalle.id,
        cambio: { fijado: dto.fijado, modificadoPorId: usuarioId, modificadoEn: this.reloj() },
      },
    ]);
    return this.obtener(hogarId, menuId);
  }

  /** E2: solo el Borrador se puede cambiar; aprobado o histórico es de solo lectura. */
  private async editable(hogarId: string, menuId: string): Promise<MenuCompleto> {
    const completo = await this.repo.cargar(hogarId, menuId);
    if (!completo) throw noEncontrado();
    exigirBorrador(completo.menu);
    return completo;
  }

  private espacio(completo: MenuCompleto, detalleId: string): DetalleConPlatillo {
    const detalle = completo.detalles.find((d) => d.id === detalleId);
    if (!detalle) throw sinComida();
    return detalle;
  }

  /** E1: el platillo debe aplicar al tiempo de comida del espacio. */
  private exigirAplicable(nombre: string, aplica: readonly TiempoComida[], tiempo: TiempoComida) {
    if (!aplica.includes(tiempo)) {
      throw new Problema(
        422,
        'TIEMPO_NO_APLICABLE',
        `${nombre} no aplica a ${NOMBRE_TIEMPO[tiempo]}`,
      );
    }
  }

  private contenidoDe(d: DetalleConPlatillo): NonNullable<Contenido> {
    return { platilloId: d.platilloId!, nombre: d.platilloNombre!, proteina: d.platilloProteina! };
  }

  /** RN-02 y RN-03 del menú tal como quedaría; sin `confirmar` se pide confirmación (3a). */
  private advertencias(
    completo: MenuCompleto,
    contenido: Map<string, Contenido>,
    cambiados: readonly DetalleConPlatillo[],
    confirmar: boolean | undefined,
  ): AdvertenciaPlan[] {
    const plan: EspacioPlan[] = completo.detalles.map((d) => {
      const c = contenido.has(d.id)
        ? contenido.get(d.id)!
        : d.platilloId
          ? this.contenidoDe(d)
          : null;
      return {
        fecha: d.fecha,
        tiempo: d.tiempo,
        platilloId: c?.platilloId ?? null,
        nombre: c?.nombre ?? null,
        proteina: c?.proteina ?? null,
      };
    });
    const revisar: EspacioRevisado[] = cambiados.map((d) => ({ fecha: d.fecha, tiempo: d.tiempo }));
    const advertencias = advertenciasDePlan(plan, revisar);
    if (advertencias.length > 0 && !confirmar) {
      throw new Problema(
        409,
        'CONFIRMACION_REQUERIDA',
        'El cambio incumple una regla del menú. Confírmalo para guardarlo.',
        { advertencias },
      );
    }
    return advertencias;
  }

  /** Espacio elegido por el usuario: fijado, sin puntaje y con las reglas que confirmó. */
  private delUsuario(
    usuarioId: string,
    nuevo: NonNullable<Contenido>,
    advertencias: readonly AdvertenciaPlan[],
  ): CambioDetalle {
    return {
      platilloId: nuevo.platilloId,
      fijado: true,
      origen: 'USUARIO',
      puntaje: null,
      factorPreferencia: null,
      factorNovedad: null,
      factorAhorro: null,
      factorAfinidad: null,
      costoEstimado: null,
      // Sin precios (S5) el costo de un platillo es siempre incompleto (D-18).
      costoIncompleto: true,
      reglasAplicadas: [...new Set(advertencias.map((a) => REGLAS_CONFIRMADAS[a.codigo]))],
      modificadoPorId: usuarioId,
      modificadoEn: this.reloj(),
    };
  }

  /** Espacio que quedó sin platillo tras mover a un destino vacío. */
  private vacio(usuarioId: string): CambioDetalle {
    return {
      platilloId: null,
      fijado: false,
      origen: 'USUARIO',
      puntaje: null,
      factorPreferencia: null,
      factorNovedad: null,
      factorAhorro: null,
      factorAfinidad: null,
      costoEstimado: null,
      costoIncompleto: false,
      reglasAplicadas: [],
      modificadoPorId: usuarioId,
      modificadoEn: this.reloj(),
    };
  }
}
