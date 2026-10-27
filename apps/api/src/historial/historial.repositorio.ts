import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  desc,
  eq,
  hogar,
  inArray,
  menuDetalle,
  menuSemanal,
  menuTiempo,
  platillo,
  sql,
  type Db,
} from '@menu/db';
import { diasSemanaHistorica } from '@menu/shared';
import { DB } from '../database/database.constants';
import { Problema } from '../comun/problema';
import type { CapturarSemanaDto, ConsultaHistorialDto } from './historial.dto';
import {
  valoresHistoricos,
  cabeceraHistorica,
  paginaHistorial,
  filasComidasHistoricas,
  filasTiemposHistoricos,
} from './historial.vista';
export type TransaccionHistorial = Parameters<Parameters<Db['transaction']>[0]>[0];

@Injectable()
export class HistorialRepositorio {
  constructor(@Inject(DB) private readonly db: Db) {}

  guardar(hogarId: string, usuarioId: string, datos: CapturarSemanaDto, ahora: Date) {
    return this.db.transaction((tx) =>
      this.guardarEnTransaccion(tx, hogarId, usuarioId, datos, ahora),
    );
  }

  async guardarEnTransaccion(
    tx: TransaccionHistorial,
    hogarId: string,
    usuarioId: string,
    datos: CapturarSemanaDto,
    ahora: Date,
    importacionId?: string,
  ) {
    // Serializa también la primera captura, cuando todavía no existe la fila de semana.
    const [familia] = await tx
      .select({ id: hogar.id })
      .from(hogar)
      .where(eq(hogar.id, hogarId))
      .for('update');
    if (!familia) throw new Problema(404, 'NO_ENCONTRADO', 'El hogar no existe');
    const ids = [...new Set(datos.detalles.map((d) => d.platilloId))];
    const propios = await tx
      .select({ id: platillo.id })
      .from(platillo)
      .where(and(eq(platillo.hogarId, hogarId), inArray(platillo.id, ids)));
    if (propios.length !== ids.length)
      throw new Problema(422, 'PLATILLO_NO_VALIDO', 'Elige platillos del catálogo de tu hogar');
    const existentes = await tx
      .select()
      .from(menuSemanal)
      .where(
        and(
          eq(menuSemanal.hogarId, hogarId),
          sql`${menuSemanal.fechaInicio} <= ${diasSemanaHistorica(datos.fechaInicio)[6]}::date`,
          sql`${menuSemanal.fechaFin} >= ${datos.fechaInicio}::date`,
        ),
      )
      .for('update');
    if (existentes.some((s) => s.fechaInicio !== datos.fechaInicio))
      throw new Problema(
        409,
        'SEMANA_SOLAPADA',
        'Hay otra semana registrada que coincide con estas fechas. Revisa el historial',
      );
    const anterior = existentes.find((s) => s.fechaInicio === datos.fechaInicio);
    if (anterior && anterior.estado !== 'HISTORICO')
      throw new Problema(
        409,
        'SEMANA_PROTEGIDA',
        'Esta semana tiene un menú que no es histórico y no se puede reemplazar desde aquí',
      );
    if (anterior && !datos.reemplazar)
      throw new Problema(
        409,
        'SEMANA_EXISTENTE',
        'Esta semana ya está registrada. ¿Quieres reemplazarla?',
        {
          semana: {
            id: anterior.id,
            version: anterior.version,
            fechaInicio: anterior.fechaInicio,
            gastoReal: anterior.gastoReal,
          },
        },
      );
    if (datos.reemplazar && (!anterior || datos.version !== anterior.version))
      throw new Problema(
        409,
        'VERSION_DESACTUALIZADA',
        'La semana cambió. Revisa el historial antes de reemplazarla',
      );
    const valores = {
      ...valoresHistoricos(datos, usuarioId, ahora),
      ...(importacionId ? { importacionId, origen: 'IMPORTACION' as const } : {}),
    };
    const [semana] = anterior
      ? await tx
          .update(menuSemanal)
          .set({ ...valores, version: anterior.version + 1 })
          .where(eq(menuSemanal.id, anterior.id))
          .returning()
      : await tx
          .insert(menuSemanal)
          .values({ hogarId, fechaInicio: datos.fechaInicio, ...valores })
          .returning();
    if (anterior) {
      await tx.delete(menuDetalle).where(eq(menuDetalle.menuId, anterior.id));
      await tx.delete(menuTiempo).where(eq(menuTiempo.menuId, anterior.id));
    }
    // El gasto histórico es semanal: no inventa una distribución ni costos estimados.
    await tx.insert(menuTiempo).values(filasTiemposHistoricos(semana!.id, datos.detalles));
    await tx
      .insert(menuDetalle)
      .values(filasComidasHistoricas(semana!.id, usuarioId, ahora, datos.detalles));
    return cabeceraHistorica(semana!);
  }

  async listar(hogarId: string, consulta: ConsultaHistorialDto) {
    const condicion = and(
      eq(menuSemanal.hogarId, hogarId),
      eq(menuSemanal.estado, 'HISTORICO'),
      consulta.desde ? sql`${menuSemanal.fechaInicio} >= ${consulta.desde}::date` : undefined,
      consulta.hasta ? sql`${menuSemanal.fechaInicio} <= ${consulta.hasta}::date` : undefined,
    );
    const [conteo] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(menuSemanal)
      .where(condicion);
    const semanas = await this.db
      .select({
        id: menuSemanal.id,
        fechaInicio: menuSemanal.fechaInicio,
        fechaFin: menuSemanal.fechaFin,
        estado: menuSemanal.estado,
        origen: menuSemanal.origen,
        gastoReal: menuSemanal.gastoReal,
        notas: menuSemanal.notas,
        version: menuSemanal.version,
      })
      .from(menuSemanal)
      .where(condicion)
      .orderBy(desc(menuSemanal.fechaInicio))
      .limit(consulta.tamano)
      .offset((consulta.pagina - 1) * consulta.tamano);
    const detalles = semanas.length
      ? await this.db
          .select({
            menuId: menuDetalle.menuId,
            fecha: menuDetalle.fecha,
            tiempo: menuDetalle.tiempo,
            platilloId: menuDetalle.platilloId,
            nombre: platillo.nombre,
            notas: menuDetalle.notas,
          })
          .from(menuDetalle)
          .leftJoin(platillo, eq(platillo.id, menuDetalle.platilloId))
          .where(
            inArray(
              menuDetalle.menuId,
              semanas.map((s) => s.id),
            ),
          )
      : [];
    return paginaHistorial(semanas, detalles, consulta, conteo?.total ?? 0);
  }
}
