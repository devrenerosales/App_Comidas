import {
  and,
  aviso,
  corrida,
  corridaError,
  corridaSitio,
  eq,
  hogar,
  precio,
  productoSupermercado,
  supermercado,
  type Db,
} from '@menu/db';
import { precioDeVinculo } from '@menu/shared';
import type { VinculoConsulta } from './adaptador.js';
import type {
  AvisoCorrida,
  EstadoCorrida,
  EstadoSitio,
  RepositorioCorridas,
  SitioConfigurado,
  TotalesSitio,
} from './corrida.js';

const VIOLACION_UNICA = '23505';

/** Código SQLSTATE de un error de PostgreSQL, que Drizzle envuelve en `cause`. */
function codigoSql(e: unknown): string | undefined {
  const directo = (e as { code?: string } | null)?.code;
  return directo ?? (e as { cause?: { code?: string } } | null)?.cause?.code;
}

/** Corridas, sitios, precios y avisos de la corrida automática, sobre PostgreSQL. */
export class RepositorioCorridasPg implements RepositorioCorridas {
  constructor(private readonly db: Db) {}

  async iniciarCorrida(programadaPara: Date, disparo: 'PROGRAMADA' | 'MANUAL', ahora: Date) {
    try {
      // El índice parcial de `corrida` admite una sola "En curso": un segundo intento falla.
      const [c] = await this.db
        .insert(corrida)
        .values({ disparo, programadaPara, iniciadaEn: ahora, estado: 'EN_CURSO' })
        .returning({ id: corrida.id });
      return { id: c!.id, omitida: false };
    } catch (e) {
      if (codigoSql(e) !== VIOLACION_UNICA) throw e;
      const [c] = await this.db
        .insert(corrida)
        .values({
          disparo,
          programadaPara,
          iniciadaEn: ahora,
          finalizadaEn: ahora,
          estado: 'OMITIDA',
        })
        .returning({ id: corrida.id });
      return { id: c!.id, omitida: true };
    }
  }

  async sitios(): Promise<SitioConfigurado[]> {
    return this.db
      .select({
        id: supermercado.id,
        codigo: supermercado.codigo,
        nombre: supermercado.nombre,
        habilitado: supermercado.habilitado,
        extraccionPermitida: supermercado.extraccionPermitida,
      })
      .from(supermercado)
      .where(and(eq(supermercado.activo, true), eq(supermercado.soportaExtraccion, true)))
      .orderBy(supermercado.nombre);
  }

  async vinculosActivos(supermercadoId: string): Promise<VinculoConsulta[]> {
    return this.db
      .select({
        id: productoSupermercado.id,
        productoId: productoSupermercado.productoId,
        supermercadoId: productoSupermercado.supermercadoId,
        nombreTienda: productoSupermercado.nombreTienda,
        url: productoSupermercado.url,
        sku: productoSupermercado.sku,
        factor: productoSupermercado.factor,
      })
      .from(productoSupermercado)
      .where(
        and(
          eq(productoSupermercado.supermercadoId, supermercadoId),
          eq(productoSupermercado.activo, true),
        ),
      );
  }

  async abrirSitio(
    corridaId: string,
    supermercadoId: string,
    estado: EstadoSitio,
    totalVinculos: number,
    ahora: Date,
  ): Promise<string> {
    const [s] = await this.db
      .insert(corridaSitio)
      .values({ corridaId, supermercadoId, estado, totalVinculos, iniciadaEn: ahora })
      .returning({ id: corridaSitio.id });
    return s!.id;
  }

  async guardarPrecio(
    corridaId: string,
    vinculo: VinculoConsulta,
    valor: string,
    fecha: string,
  ): Promise<void> {
    await this.db.insert(precio).values({
      productoSupermercadoId: vinculo.id,
      origen: 'AUTOMATICO',
      hogarId: null,
      corridaId,
      precio: valor,
      precioNormalizado: precioDeVinculo(valor, vinculo.factor).toFixed(2),
      fechaPrecio: fecha,
    });
  }

  async registrarError(
    corridaSitioId: string,
    productoSupermercadoId: string | null,
    tipo: 'TIEMPO_AGOTADO' | 'HTTP' | 'ESTRUCTURA' | 'PRECIO_INVALIDO' | 'ROBOTS' | 'OTRO',
    mensaje: string,
    intentos: number,
  ): Promise<void> {
    await this.db.insert(corridaError).values({
      corridaSitioId,
      productoSupermercadoId,
      tipo,
      mensaje: mensaje.slice(0, 500),
      intentos,
    });
  }

  async cerrarSitio(corridaSitioId: string, totales: TotalesSitio, ahora: Date): Promise<void> {
    await this.db
      .update(corridaSitio)
      .set({
        estado: totales.estado,
        totalOk: totales.totalOk,
        totalFallidos: totales.totalFallidos,
        detenidoPorEstructura: totales.detenidoPorEstructura,
        finalizadaEn: ahora,
      })
      .where(eq(corridaSitio.id, corridaSitioId));
  }

  async cerrarCorrida(
    corridaId: string,
    estado: EstadoCorrida,
    totales: { consultados: number; actualizados: number; fallidos: number },
    ahora: Date,
  ): Promise<void> {
    await this.db
      .update(corrida)
      .set({
        estado,
        totalConsultados: totales.consultados,
        totalActualizados: totales.actualizados,
        totalFallidos: totales.fallidos,
        finalizadaEn: ahora,
      })
      .where(eq(corrida.id, corridaId));
  }

  async avisar(corridaId: string, a: AvisoCorrida): Promise<void> {
    const hogares = await this.db.select({ id: hogar.id }).from(hogar);
    if (hogares.length === 0) return;
    await this.db.insert(aviso).values(
      hogares.map((h) => ({
        hogarId: h.id,
        tipo: a.tipo,
        titulo: a.titulo,
        mensaje: a.mensaje,
        datos: a.datos,
        corridaId,
      })),
    );
  }
}
