import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  asc,
  configuracion,
  eq,
  inArray,
  menuSemanal,
  menuDetalle,
  sql,
  tiempoComidaConfig,
  type Configuracion,
  type Db,
  type TiempoComidaConfig,
} from '@menu/db';
import { ORDEN_TIEMPOS, type TiempoComida } from '@menu/shared';
import { DB } from '../database/database.constants';
import { Problema } from '../comun/problema';
import { calendarioSemana, type CalendarioSemana, type DiaSemana } from './semanas';

/** Otro administrador guardó antes: la versión esperada ya no es la vigente (CU-02.3 E1). */
export class VersionDesactualizadaError extends Error {
  constructor() {
    super('La versión de la configuración cambió');
  }
}

export interface ConfiguracionLeida {
  configuracion: Configuracion;
  /** Las tres filas en orden desayuno → almuerzo → cena. */
  tiempos: TiempoComidaConfig[];
}

export interface FilaMenuFuturo {
  id: string;
  fechaInicio: string;
  fechaFin: string;
  estado: 'BORRADOR' | 'APROBADO';
}

/** Fila nueva de `tiempo_comida_config` (inactivas con porcentaje 0). */
export interface TiempoAGuardar {
  tiempo: TiempoComida;
  activo: boolean;
  porcentaje: string;
}

export interface CambiosConfiguracion {
  presupuestoSemanal?: string;
  tiempos?: TiempoAGuardar[];
}

export interface ResultadoGuardado extends ConfiguracionLeida {
  borradoresDesactualizados: { id: string; fechaInicio: string; fechaFin: string }[];
}

const ordenTiempo = (t: { tiempo: string }) => ORDEN_TIEMPOS.indexOf(t.tiempo as TiempoComida);

/** Acceso a `configuracion`, `tiempo_comida_config` y a los menús futuros del hogar (Drizzle). */
@Injectable()
export class ConfiguracionRepositorio {
  constructor(@Inject(DB) private readonly db: Db) {}

  guardarSemana(
    hogarId: string,
    usuarioId: string,
    version: number,
    diaInicioSemana: DiaSemana,
    diaPlanificacion: DiaSemana,
    hoy: string,
  ): Promise<ConfiguracionLeida & CalendarioSemana> {
    return this.db.transaction(async (tx) => {
      const [actual] = await tx
        .select()
        .from(configuracion)
        .where(eq(configuracion.hogarId, hogarId))
        .for('update');
      if (!actual || actual.version !== version) throw new VersionDesactualizadaError();
      const menus = await tx
        .select()
        .from(menuSemanal)
        .where(and(eq(menuSemanal.hogarId, hogarId), sql`${menuSemanal.fechaFin} >= ${hoy}::date`));
      const calendario = calendarioSemana(
        hoy,
        diaInicioSemana,
        diaPlanificacion,
        menus.filter((m) => m.estado === 'APROBADO'),
      );
      const cambiaInicio = actual.diaInicioSemana !== diaInicioSemana;
      const cambia = cambiaInicio || actual.diaPlanificacion !== diaPlanificacion;
      const transicion = calendario.semanaTransicion;
      // Un borrador de transición aún vacío puede ajustarse sin perder contenido.
      // Esto permite cambiar de nuevo el inicio antes de planificar esa semana.
      const rango = transicion ?? calendario.proximaSemana;
      const anterior = menus.find(
        (m) => m.estado === 'BORRADOR' && m.esTransicion && m.fechaInicio === rango.desde,
      );
      if (cambiaInicio && anterior) {
        const [detalle] = await tx
          .select({ id: menuDetalle.id })
          .from(menuDetalle)
          .where(eq(menuDetalle.menuId, anterior.id))
          .limit(1);
        if (!detalle) {
          const ajuste = {
            fechaFin: rango.hasta,
            esTransicion: Boolean(transicion),
            configuracionVersion: actual.version + 1,
            desactualizado: false,
          };
          await tx.update(menuSemanal).set(ajuste).where(eq(menuSemanal.id, anterior.id));
          Object.assign(anterior, ajuste);
        }
      }
      if (cambiaInicio && transicion) {
        const coincidentes = menus.filter(
          (m) => m.fechaInicio <= transicion.hasta && m.fechaFin >= transicion.desde,
        );
        if (
          coincidentes.some(
            (m) =>
              !(
                m.esTransicion &&
                m.estado === 'BORRADOR' &&
                m.fechaInicio === transicion.desde &&
                m.fechaFin === transicion.hasta
              ),
          )
        ) {
          throw new Problema(
            409,
            'SEMANA_EN_CONFLICTO',
            'Hay un menú en las fechas de transición. Revísalo antes de cambiar el inicio de semana.',
          );
        }
        if (!coincidentes.length)
          await tx.insert(menuSemanal).values({
            hogarId,
            fechaInicio: transicion.desde,
            fechaFin: transicion.hasta,
            esTransicion: true,
            estado: 'BORRADOR',
            origen: 'CAPTURA_MANUAL',
            configuracionVersion: actual.version + 1,
          });
      }
      const [guardada] = cambia
        ? await tx
            .update(configuracion)
            .set({
              diaInicioSemana,
              diaPlanificacion,
              version: sql`${configuracion.version} + 1`,
              actualizadoPorId: usuarioId,
            })
            .where(eq(configuracion.id, actual.id))
            .returning()
        : [actual];
      if (cambiaInicio)
        await tx
          .update(menuSemanal)
          .set({ desactualizado: true })
          .where(
            and(
              eq(menuSemanal.hogarId, hogarId),
              eq(menuSemanal.estado, 'BORRADOR'),
              sql`${menuSemanal.fechaFin} >= ${hoy}::date`,
              sql`${menuSemanal.configuracionVersion} IS DISTINCT FROM ${guardada!.version}`,
            ),
          );
      const tiempos = await tx
        .select()
        .from(tiempoComidaConfig)
        .where(eq(tiempoComidaConfig.configuracionId, actual.id));
      return {
        configuracion: guardada!,
        tiempos: tiempos.sort((a, b) => ordenTiempo(a) - ordenTiempo(b)),
        ...calendario,
      };
    });
  }

  /** Configuración del hogar con sus tres tiempos, o `null` si no existe. */
  async leer(hogarId: string): Promise<ConfiguracionLeida | null> {
    const [config] = await this.db
      .select()
      .from(configuracion)
      .where(eq(configuracion.hogarId, hogarId))
      .limit(1);
    if (!config) return null;
    const tiempos = await this.db
      .select()
      .from(tiempoComidaConfig)
      .where(eq(tiempoComidaConfig.configuracionId, config.id));
    return {
      configuracion: config,
      tiempos: tiempos.sort((a, b) => ordenTiempo(a) - ordenTiempo(b)),
    };
  }

  /**
   * Menús en Borrador o Aprobados que terminan en `desde` o después (semanas en curso o futuras),
   * ordenados por fecha de inicio. Los históricos no se consideran.
   */
  async menusFuturos(hogarId: string, desde: string): Promise<FilaMenuFuturo[]> {
    const filas = await this.db
      .select({
        id: menuSemanal.id,
        fechaInicio: menuSemanal.fechaInicio,
        fechaFin: menuSemanal.fechaFin,
        estado: menuSemanal.estado,
      })
      .from(menuSemanal)
      .where(
        and(
          eq(menuSemanal.hogarId, hogarId),
          inArray(menuSemanal.estado, ['BORRADOR', 'APROBADO']),
          sql`${menuSemanal.fechaFin} >= ${desde}::date`,
        ),
      )
      .orderBy(asc(menuSemanal.fechaInicio));
    return filas as FilaMenuFuturo[];
  }

  /**
   * Guarda presupuesto y/o tiempos en una transacción con control de versión optimista: solo
   * actualiza si `version` sigue siendo `versionEsperada` (si no, `VersionDesactualizadaError`).
   * Incrementa la versión y, si `desactualizarDesde` viene, marca "Desactualizado" los borradores
   * que terminan en esa fecha o después (CU-02.3 5b); los aprobados no se tocan (D-04).
   */
  guardar(
    hogarId: string,
    versionEsperada: number,
    cambios: CambiosConfiguracion,
    usuarioId: string,
    desactualizarDesde: string | null,
  ): Promise<ResultadoGuardado> {
    return this.db.transaction(async (tx) => {
      const [config] = await tx
        .update(configuracion)
        .set({
          ...(cambios.presupuestoSemanal ? { presupuestoSemanal: cambios.presupuestoSemanal } : {}),
          version: sql`${configuracion.version} + 1`,
          actualizadoPorId: usuarioId,
        })
        .where(and(eq(configuracion.hogarId, hogarId), eq(configuracion.version, versionEsperada)))
        .returning();
      if (!config) throw new VersionDesactualizadaError();

      for (const t of cambios.tiempos ?? []) {
        await tx
          .update(tiempoComidaConfig)
          .set({ activo: t.activo, porcentaje: t.porcentaje })
          .where(
            and(
              eq(tiempoComidaConfig.configuracionId, config.id),
              eq(tiempoComidaConfig.tiempo, t.tiempo),
            ),
          );
      }
      const tiempos = await tx
        .select()
        .from(tiempoComidaConfig)
        .where(eq(tiempoComidaConfig.configuracionId, config.id));

      const borradoresDesactualizados = desactualizarDesde
        ? await tx
            .update(menuSemanal)
            .set({ desactualizado: true })
            .where(
              and(
                eq(menuSemanal.hogarId, hogarId),
                eq(menuSemanal.estado, 'BORRADOR'),
                sql`${menuSemanal.fechaFin} >= ${desactualizarDesde}::date`,
              ),
            )
            .returning({
              id: menuSemanal.id,
              fechaInicio: menuSemanal.fechaInicio,
              fechaFin: menuSemanal.fechaFin,
            })
        : [];

      return {
        configuracion: config,
        tiempos: tiempos.sort((a, b) => ordenTiempo(a) - ordenTiempo(b)),
        borradoresDesactualizados: borradoresDesactualizados.sort((a, b) =>
          a.fechaInicio.localeCompare(b.fechaInicio),
        ),
      };
    });
  }
}
