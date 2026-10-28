import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  and,
  asc,
  sql,
  eq,
  hogar,
  importacion,
  importacionFila,
  importacionPlatillo,
  importacionSemana,
  menuSemanal,
  platillo,
  platilloAlias,
  type Db,
} from '@menu/db';
import { diasSemanaHistorica, validarCapturaHistorica } from '@menu/shared';
import { DB } from '../database/database.constants';
import { Problema } from '../comun/problema';
import {
  HistorialRepositorio,
  type TransaccionHistorial,
} from '../historial/historial.repositorio';
import { fechaLocal } from '../configuracion/semanas';
import type {
  ArchivoImportacion,
  FilaMenu,
  MetadatosVista,
  ReporteImportacion,
} from './importaciones.tipos';
import type {
  DecisionesDto,
  DecisionesPlatillosDto,
  FilasDto,
  PlatillosConsultaDto,
} from './importaciones.dto';
import { planificarSemanas, resolverNombres } from './importaciones.vista';
import {
  aplicarDecisiones,
  buscarSugerencias,
  completarSugerencias,
  esAutomatica,
  materializarPlatillos,
  propuestaDe,
  textoPendientes,
} from './importaciones.platillos';

type Cabecera = typeof importacion.$inferSelect;
const abierta = (c: Cabecera) => ['CON_ERRORES', 'VISTA_PREVIA'].includes(c.estado);
const metadatos = (c: Cabecera) => c.reporte as MetadatosVista;
@Injectable()
export class ImportacionesRepositorio {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly historial: HistorialRepositorio,
  ) {}

  async crear(
    hogarId: string,
    usuarioId: string,
    archivo: ArchivoImportacion,
    formato: 'CSV' | 'XLSX',
    filas: FilaMenu[],
  ) {
    const id = await this.db.transaction(async (tx) => {
      await this.bloquearHogar(tx, hogarId);
      const canonicos = await tx
        .select({ id: platillo.id, nombreNormalizado: platillo.nombreNormalizado })
        .from(platillo)
        .where(eq(platillo.hogarId, hogarId));
      const aliases = await tx
        .select()
        .from(platilloAlias)
        .where(eq(platilloAlias.hogarId, hogarId));
      const existentes = await tx
        .select()
        .from(menuSemanal)
        .where(eq(menuSemanal.hogarId, hogarId));
      const plan = planificarSemanas(filas, existentes);
      const reporte: MetadatosVista = {
        revision: randomUUID(),
        versiones: Object.fromEntries(
          plan.flatMap((s) => (s.instantanea ? [[s.semanaInicio, s.instantanea]] : [])),
        ),
      };
      const errores = filas.filter((f) => f.errores.length).length;
      const [cabecera] = await tx
        .insert(importacion)
        .values({
          hogarId,
          usuarioId,
          nombreArchivo:
            [...archivo.originalname]
              .filter((c) => c.charCodeAt(0) >= 32)
              .join('')
              .slice(0, 200) || 'archivo',
          formato,
          tamanoBytes: archivo.buffer.length,
          estado: errores ? 'CON_ERRORES' : 'VISTA_PREVIA',
          totalFilas: filas.length,
          filasConError: errores,
          reporte,
        })
        .returning();
      const importacionId = cabecera!.id;
      // Lotes acotados para no exceder el número de parámetros del protocolo PostgreSQL.
      for (let i = 0; i < filas.length; i += 300)
        await tx.insert(importacionFila).values(
          filas.slice(i, i + 300).map((f) => ({
            importacionId,
            hoja: 'MENUS' as const,
            numeroFila: f.numeroFila,
            datos: f,
            errores: f.errores,
            valida: !f.errores.length,
            semanaInicio: f.semanaInicio,
          })),
        );
      const base = resolverNombres(filas, canonicos, aliases);
      const sugerencias = await buscarSugerencias(
        tx,
        hogarId,
        base.filter((n) => !n.platilloId).map((n) => n.nombreNormalizado),
      );
      const nombres = completarSugerencias(base, sugerencias);
      for (let i = 0; i < nombres.length; i += 300)
        await tx
          .insert(importacionPlatillo)
          .values(nombres.slice(i, i + 300).map((n) => ({ ...n, importacionId })));
      for (let i = 0; i < plan.length; i += 300)
        await tx
          .insert(importacionSemana)
          .values(
            plan.slice(i, i + 300).map(({ instantanea: _s, ...s }) => ({ ...s, importacionId })),
          );
      return importacionId;
    });
    return this.obtener(hogarId, id);
  }
  private async cabecera(
    db: Db | TransaccionHistorial,
    hogarId: string,
    id: string,
    bloquear = false,
  ) {
    const consulta = db
      .select()
      .from(importacion)
      .where(and(eq(importacion.id, id), eq(importacion.hogarId, hogarId)));
    const [c] = await (bloquear ? consulta.for('update') : consulta);
    if (!c) throw new Problema(404, 'NO_ENCONTRADO', 'La importación no existe');
    return c;
  }
  async obtener(hogarId: string, id: string) {
    // Snapshot consistente entre cabecera, decisiones y catálogo, incluso durante confirmación.
    return this.db.transaction(async (tx) => {
      await this.bloquearHogar(tx, hogarId);
      const c = await this.cabecera(tx, hogarId, id);
      const semanas = await tx
        .select()
        .from(importacionSemana)
        .where(eq(importacionSemana.importacionId, id))
        .orderBy(asc(importacionSemana.semanaInicio));
      const platos = await tx
        .select({
          nombreOriginal: importacionPlatillo.nombreOriginal,
          decision: importacionPlatillo.decision,
        })
        .from(importacionPlatillo)
        .where(eq(importacionPlatillo.importacionId, id))
        .orderBy(asc(importacionPlatillo.nombreNormalizado));
      const pendientes = platos
        .filter((p) => p.decision === 'PENDIENTE')
        .map((p) => p.nombreOriginal);
      const vista = abierta(c) ? metadatos(c) : null;
      return {
        id: c.id,
        nombreArchivo: c.nombreArchivo,
        estado: c.estado,
        revision: vista?.revision ?? null,
        totalFilas: c.totalFilas,
        filasConError: c.filasConError,
        pendientes,
        semanas: semanas.map((s) => ({
          semanaInicio: s.semanaInicio,
          fechaFin: diasSemanaHistorica(s.semanaInicio)[6]!,
          decision: s.decision,
          gastoSemana: s.gastoSemana,
          existente: vista?.versiones[s.semanaInicio] ?? null,
          puedeReemplazar:
            !!vista?.versiones[s.semanaInicio] && !vista.versiones[s.semanaInicio]!.protegida,
        })),
        puedeConfirmar:
          abierta(c) &&
          !c.filasConError &&
          !pendientes.length &&
          semanas.some((s) => s.decision !== 'OMITIR'),
        reporte: c.estado === 'CONFIRMADA' ? c.reporte : null,
      };
    });
  }
  async filas(hogarId: string, id: string, consulta: FilasDto) {
    await this.cabecera(this.db, hogarId, id);
    const filtro = and(
      eq(importacionFila.importacionId, id),
      consulta.soloErrores === 'true' ? eq(importacionFila.valida, false) : undefined,
    );
    const [conteo] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(importacionFila)
      .where(filtro);
    const total = conteo!.total;
    const datos = await this.db
      .select({
        numeroFila: importacionFila.numeroFila,
        datos: importacionFila.datos,
        errores: importacionFila.errores,
      })
      .from(importacionFila)
      .where(filtro)
      .orderBy(asc(importacionFila.numeroFila))
      .limit(consulta.tamano)
      .offset((consulta.pagina - 1) * consulta.tamano);
    return {
      datos,
      paginacion: {
        pagina: consulta.pagina,
        tamano: consulta.tamano,
        total,
        totalPaginas: Math.ceil(total / consulta.tamano),
      },
    };
  }
  private async bloquearHogar(tx: TransaccionHistorial, hogarId: string) {
    const [c] = await tx
      .select({ id: hogar.id })
      .from(hogar)
      .where(eq(hogar.id, hogarId))
      .for('update');
    if (!c) throw new Problema(404, 'NO_ENCONTRADO', 'El hogar no existe');
  }
  private comprobar(c: Cabecera, revision: string) {
    if (!abierta(c))
      throw new Problema(409, 'IMPORTACION_CERRADA', 'La importación ya está cerrada');
    if (metadatos(c).revision !== revision)
      throw new Problema(
        409,
        'VISTA_DESACTUALIZADA',
        'La vista previa cambió. Vuelve a cargarla antes de continuar',
      );
  }
  async decidir(hogarId: string, id: string, datos: DecisionesDto) {
    await this.db.transaction(async (tx) => {
      await this.bloquearHogar(tx, hogarId);
      const c = await this.cabecera(tx, hogarId, id, true);
      this.comprobar(c, datos.revision);
      const semanas = await tx
        .select()
        .from(importacionSemana)
        .where(eq(importacionSemana.importacionId, id));
      const vistos = new Set<string>();
      for (const d of datos.decisiones) {
        if (
          vistos.has(d.semanaInicio) ||
          !semanas.some((s) => s.semanaInicio === d.semanaInicio && s.yaExiste)
        )
          throw new Problema(
            422,
            'DECISION_INVALIDA',
            'Selecciona una semana existente de esta importación',
          );
        vistos.add(d.semanaInicio);
        if (d.decision === 'REEMPLAZAR' && metadatos(c).versiones[d.semanaInicio]?.protegida)
          throw new Problema(
            409,
            'SEMANA_PROTEGIDA',
            'Solo se pueden reemplazar semanas históricas completas',
          );
        await tx
          .update(importacionSemana)
          .set({ decision: d.decision })
          .where(
            and(
              eq(importacionSemana.importacionId, id),
              eq(importacionSemana.semanaInicio, d.semanaInicio),
            ),
          );
      }
      await tx
        .update(importacion)
        .set({ reporte: { ...metadatos(c), revision: randomUUID() }, updatedAt: new Date() })
        .where(eq(importacion.id, id));
    });
    return this.obtener(hogarId, id);
  }
  async platillos(hogarId: string, id: string, consulta: PlatillosConsultaDto) {
    await this.cabecera(this.db, hogarId, id);
    const nombres = await this.db
      .select()
      .from(importacionPlatillo)
      .where(eq(importacionPlatillo.importacionId, id))
      .orderBy(asc(importacionPlatillo.nombreNormalizado));
    const catalogo = new Map(
      (
        await this.db
          .select({ id: platillo.id, nombre: platillo.nombre })
          .from(platillo)
          .where(eq(platillo.hogarId, hogarId))
      ).map((p) => [p.id, p.nombre]),
    );
    const pendientes = nombres.filter((n) => n.decision === 'PENDIENTE');
    const filtrados =
      consulta.estado === 'todos'
        ? nombres
        : consulta.estado === 'revisar'
          ? nombres.filter((n) => !esAutomatica(n))
          : pendientes;
    const total = filtrados.length;
    const nombreDe = (platilloId: string | null) =>
      platilloId ? (catalogo.get(platilloId) ?? null) : null;
    return {
      datos: filtrados
        .slice((consulta.pagina - 1) * consulta.tamano, consulta.pagina * consulta.tamano)
        .map((n) => {
          const p = propuestaDe(n);
          return {
            nombreOriginal: n.nombreOriginal,
            nombreNormalizado: n.nombreNormalizado,
            proteinaPrincipal: n.proteinaPrincipal,
            decision: n.decision,
            automatica: esAutomatica(n),
            propuesta: { ...p, platillo: nombreDe(p.platilloId) },
            platilloId: n.platilloId,
            platillo: nombreDe(n.platilloId),
            nombreFinal: n.nombreFinal,
          };
        }),
      resumen: { total: nombres.length, pendientes: pendientes.length },
      paginacion: {
        pagina: consulta.pagina,
        tamano: consulta.tamano,
        total,
        totalPaginas: Math.ceil(total / consulta.tamano),
      },
    };
  }
  async decidirPlatillos(hogarId: string, id: string, datos: DecisionesPlatillosDto) {
    await this.db.transaction(async (tx) => {
      await this.bloquearHogar(tx, hogarId);
      const c = await this.cabecera(tx, hogarId, id, true);
      this.comprobar(c, datos.revision);
      const nombres = await tx
        .select()
        .from(importacionPlatillo)
        .where(eq(importacionPlatillo.importacionId, id));
      const catalogo = await tx
        .select({ id: platillo.id, activo: platillo.activo, nombre: platillo.nombreNormalizado })
        .from(platillo)
        .where(eq(platillo.hogarId, hogarId));
      const aliases = await tx
        .select({ nombre: platilloAlias.aliasNormalizado })
        .from(platilloAlias)
        .where(eq(platilloAlias.hogarId, hogarId));
      const cambios = aplicarDecisiones(nombres, datos, {
        activos: new Set(catalogo.filter((p) => p.activo).map((p) => p.id)),
        ocupados: new Set([...catalogo, ...aliases].map((p) => p.nombre)),
      });
      for (const [nombreNormalizado, cambio] of cambios)
        await tx
          .update(importacionPlatillo)
          .set(cambio)
          .where(
            and(
              eq(importacionPlatillo.importacionId, id),
              eq(importacionPlatillo.nombreNormalizado, nombreNormalizado),
            ),
          );
      await tx
        .update(importacion)
        .set({ reporte: { ...metadatos(c), revision: randomUUID() }, updatedAt: new Date() })
        .where(eq(importacion.id, id));
    });
    return this.obtener(hogarId, id);
  }
  async cancelar(hogarId: string, id: string, revision: string) {
    await this.db.transaction(async (tx) => {
      await this.bloquearHogar(tx, hogarId);
      const c = await this.cabecera(tx, hogarId, id, true);
      if (c.estado === 'CANCELADA') return;
      this.comprobar(c, revision);
      await tx.delete(importacionFila).where(eq(importacionFila.importacionId, id));
      await tx.delete(importacionPlatillo).where(eq(importacionPlatillo.importacionId, id));
      await tx.delete(importacionSemana).where(eq(importacionSemana.importacionId, id));
      await tx
        .update(importacion)
        .set({ estado: 'CANCELADA', reporte: null, updatedAt: new Date() })
        .where(eq(importacion.id, id));
    });
    return this.obtener(hogarId, id);
  }
  confirmar(hogarId: string, usuarioId: string, id: string, revision: string, ahora: Date) {
    return this.db.transaction(async (tx) => {
      await this.bloquearHogar(tx, hogarId);
      const c = await this.cabecera(tx, hogarId, id, true);
      if (c.estado === 'CONFIRMADA') return c.reporte as ReporteImportacion;
      this.comprobar(c, revision);
      if (c.filasConError)
        throw new Problema(
          422,
          'FILAS_CON_ERROR',
          'Corrige los errores y vuelve a cargar el archivo',
        );
      const nombres = await tx
        .select()
        .from(importacionPlatillo)
        .where(eq(importacionPlatillo.importacionId, id));
      const sinResolver = nombres.filter((n) => n.decision === 'PENDIENTE').length;
      if (sinResolver)
        throw new Problema(422, 'PLATILLOS_PENDIENTES', textoPendientes(sinResolver));
      const filas = (
        await tx.select().from(importacionFila).where(eq(importacionFila.importacionId, id))
      ).map((f) => f.datos as FilaMenu);
      const semanas = await tx
        .select()
        .from(importacionSemana)
        .where(eq(importacionSemana.importacionId, id))
        .orderBy(asc(importacionSemana.semanaInicio));
      const reporte: ReporteImportacion = {
        semanasCreadas: 0,
        reemplazadas: 0,
        omitidas: 0,
        platillosCreados: 0,
        aliasCreados: 0,
        despensaCargada: 0,
      };
      if (semanas.every((s) => s.decision === 'OMITIR'))
        throw new Problema(422, 'SIN_SEMANAS', 'Selecciona al menos una semana para importar');
      const importadas = new Set(
        semanas.filter((s) => s.decision !== 'OMITIR').map((s) => s.semanaInicio),
      );
      const resueltos = await materializarPlatillos(
        tx,
        hogarId,
        id,
        nombres,
        filas.filter((f) => f.semanaInicio && importadas.has(f.semanaInicio)),
      );
      reporte.platillosCreados = resueltos.platillosCreados;
      reporte.aliasCreados = resueltos.aliasCreados;
      for (const s of semanas) {
        if (s.decision === 'OMITIR') {
          reporte.omitidas++;
          continue;
        }
        const anterior = metadatos(c).versiones[s.semanaInicio];
        if (s.decision === 'REEMPLAZAR') {
          const [actual] = await tx
            .select()
            .from(menuSemanal)
            .where(
              and(eq(menuSemanal.hogarId, hogarId), eq(menuSemanal.fechaInicio, s.semanaInicio)),
            )
            .for('update');
          if (!actual || actual.id !== anterior?.id || actual.version !== anterior.version)
            throw new Problema(
              409,
              'SEMANA_MODIFICADA',
              'Una semana cambió desde la vista previa. Cancela y vuelve a cargar el archivo',
            );
        }
        const datos = {
          fechaInicio: s.semanaInicio,
          gastoReal: s.gastoSemana,
          reemplazar: s.decision === 'REEMPLAZAR',
          version: anterior?.version,
          detalles: filas
            .filter((f) => f.semanaInicio === s.semanaInicio)
            .map((f) => ({
              fecha: f.fecha,
              tiempo: f.tiempo,
              platilloId: resueltos.ids.get(f.nombreNormalizado)!,
              notas: f.notas,
            })),
        };
        const falla = validarCapturaHistorica(datos, fechaLocal(ahora));
        if (falla) throw new Problema(422, falla.codigo, falla.mensaje);
        await this.historial.guardarEnTransaccion(tx, hogarId, usuarioId, datos, ahora, id);
        if (s.decision === 'CREAR') reporte.semanasCreadas++;
        else reporte.reemplazadas++;
      }
      await tx
        .update(importacion)
        .set({ estado: 'CONFIRMADA', reporte, confirmadaEn: ahora, updatedAt: ahora })
        .where(eq(importacion.id, id));
      return reporte;
    });
  }
}
