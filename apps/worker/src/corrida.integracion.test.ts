/**
 * HU-33 — integración contra PostgreSQL real (TEST_DATABASE_URL; sin ella se omite). Comprueba
 * que la corrida, con un sitio simulado, deja en la base lo que describen CA-33.1 a CA-33.5 y que
 * el recálculo actualiza el mínimo y la mediana de los hogares.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  aviso,
  corrida,
  corridaError,
  corridaSitio,
  crearBaseTemporal,
  eq,
  hogar,
  hogarSupermercado,
  precio,
  precioResumen,
  producto,
  productoSupermercado,
  supermercado,
  truncarTablas,
  unidad,
  type BaseTemporal,
} from '@menu/db';
import { ErrorExtraccion, type AdaptadorSitio, type VinculoConsulta } from './adaptador.js';
import { ejecutarCorrida, type DependenciasCorrida } from './corrida.js';
import { RepositorioRecalculoPg, recalcularCorrida } from './recalculo.js';
import { fechaLocal } from './red.js';
import { RepositorioCorridasPg } from './repositorio-corridas.js';

const URL_BD = process.env.TEST_DATABASE_URL;
const conBd = URL_BD ? describe : describe.skip;

const SABADO = new Date('2026-10-25T03:00:00Z'); // sáb 24/10/2026 21:00 en Guatemala

conBd('HU-33 Corrida automática (integración)', () => {
  let base: BaseTemporal;

  beforeAll(async () => {
    base = await crearBaseTemporal(URL_BD!, { prefijo: 'menu_worker_corrida', sembrar: true });
  }, 60_000);
  afterAll(async () => {
    await base?.eliminar();
  });
  beforeEach(async () => {
    await truncarTablas(base.db);
  });

  const db = () => base.db;

  const idDe = async (codigo: string) => {
    const [s] = await db()
      .select({ id: supermercado.id })
      .from(supermercado)
      .where(eq(supermercado.codigo, codigo));
    return s!.id;
  };

  /** Habilita el sitio como lo haría el administrador del sistema tras revisar los términos. */
  const permitir = (codigo: string, extra: { habilitado?: boolean; permitida?: boolean } = {}) =>
    db()
      .update(supermercado)
      .set({ habilitado: extra.habilitado ?? true, extraccionPermitida: extra.permitida ?? true })
      .where(eq(supermercado.codigo, codigo));

  let nVinculo = 0;
  /** Vínculo activo de un producto del catálogo con un supermercado; `factor` normaliza el precio. */
  const vincular = async (nombreProducto: string, codigoSuper: string, factor = '1') => {
    nVinculo += 1;
    const [p] = await db()
      .select({ id: producto.id })
      .from(producto)
      .where(eq(producto.nombre, nombreProducto));
    const [lb] = await db().select({ id: unidad.id }).from(unidad).where(eq(unidad.codigo, 'lb'));
    const [v] = await db()
      .insert(productoSupermercado)
      .values({
        productoId: p!.id,
        supermercadoId: await idDe(codigoSuper),
        nombreTienda: `${nombreProducto} ${nVinculo}`,
        presentacionCantidad: '1',
        presentacionUnidadId: lb!.id,
        factor,
        url: `https://${codigoSuper.toLowerCase()}.test/producto/${nVinculo}`,
      })
      .returning();
    return v!.id;
  };

  const simulado = (
    codigo: string,
    precioDe: (v: VinculoConsulta) => string = () => '10.00',
  ): AdaptadorSitio & { llamadas: string[] } => {
    const llamadas: string[] = [];
    return {
      codigo,
      agente: 'MenuFamiliarBot/1.0',
      origen: `https://${codigo.toLowerCase()}.test`,
      llamadas,
      rutaProducto: (v) => `/producto/${v.id}`,
      async consultar(v) {
        llamadas.push(v.id);
        return precioDe(v);
      },
    };
  };

  const dependencias = (
    adaptadores: AdaptadorSitio[],
    extra: Partial<DependenciasCorrida> = {},
  ) => {
    const recalculos: string[] = [];
    const deps: DependenciasCorrida = {
      repo: new RepositorioCorridasPg(db()),
      adaptadores: new Map(adaptadores.map((a) => [a.codigo, a])),
      sitioEncendido: () => true,
      obtenerRobots: async () => ({ estado: 'OK', texto: 'User-agent: *\nDisallow:\n' }),
      limitador: { esperarTurno: async () => 0 },
      reloj: () => SABADO,
      fechaLocal: (ahora) => fechaLocal(ahora),
      encolarRecalculo: async (id) => {
        recalculos.push(id);
      },
      ...extra,
    };
    return { deps, recalculos };
  };

  it('CA-33.1 guarda los precios automáticos del día, normalizados, y cierra la corrida', async () => {
    await permitir('WALMART');
    await permitir('PAIZ');
    const arroz = await vincular('Arroz', 'WALMART');
    const frijol = await vincular('Frijol negro', 'WALMART', '2');
    const tomate = await vincular('Tomate', 'PAIZ');
    const { deps, recalculos } = dependencias([
      simulado('WALMART', (v) => (v.id === frijol ? '25.00' : '12.50')),
      simulado('PAIZ', () => '6.25'),
    ]);

    const r = await ejecutarCorrida(deps, { programadaPara: SABADO });

    expect(r.estado).toBe('COMPLETADA');
    const [c] = await db().select().from(corrida);
    expect(c).toMatchObject({
      estado: 'COMPLETADA',
      disparo: 'PROGRAMADA',
      totalConsultados: 3,
      totalActualizados: 3,
      totalFallidos: 0,
    });
    expect(c!.finalizadaEn).toBeInstanceOf(Date);
    const precios = await db().select().from(precio);
    expect(precios).toHaveLength(3);
    expect(precios.every((p) => p.origen === 'AUTOMATICO' && p.hogarId === null)).toBe(true);
    expect(precios.every((p) => p.corridaId === c!.id && p.fechaPrecio === '2026-10-24')).toBe(
      true,
    );
    const por = (id: string) => precios.find((p) => p.productoSupermercadoId === id)!;
    expect(por(arroz)).toMatchObject({ precio: '12.50', precioNormalizado: '12.50' });
    expect(por(frijol)).toMatchObject({ precio: '25.00', precioNormalizado: '12.50' });
    expect(por(tomate)).toMatchObject({ precio: '6.25', precioNormalizado: '6.25' });
    const sitios = await db().select().from(corridaSitio);
    expect(
      sitios.map((s) => [s.estado, s.totalVinculos, s.totalOk, s.totalFallidos]).sort(),
    ).toEqual([
      ['COMPLETADA', 1, 1, 0],
      ['COMPLETADA', 2, 2, 0],
    ]);
    expect(recalculos).toEqual([c!.id]);
  });

  it('el hogar y los sitios de otra fase no reciben consultas: Super Fresh no tiene extractor', async () => {
    await permitir('WALMART');
    await vincular('Arroz', 'WALMART');
    await vincular('Arroz', 'SUPER_FRESH');
    const { deps } = dependencias([simulado('WALMART')]);
    await ejecutarCorrida(deps);
    const sitios = await db().select().from(corridaSitio);
    // Solo los supermercados con extractor entran en la corrida; Super Fresh es manual o ticket.
    expect(sitios.map((x) => x.supermercadoId)).not.toContain(await idDe('SUPER_FRESH'));
    const walmartId = await idDe('WALMART');
    expect(sitios.find((x) => x.supermercadoId === walmartId)?.estado).toBe('COMPLETADA');
    expect(await db().select().from(precio)).toHaveLength(1);
  });

  it('CA-33.3 con la ruta prohibida registra Bloqueado, deja un error y avisa a los hogares', async () => {
    await permitir('PAIZ');
    await vincular('Arroz', 'PAIZ');
    const [h1] = await db().insert(hogar).values({ nombre: 'Familia Uno' }).returning();
    const [h2] = await db().insert(hogar).values({ nombre: 'Familia Dos' }).returning();
    const paiz = simulado('PAIZ');
    const { deps, recalculos } = dependencias([paiz], {
      obtenerRobots: async () => ({ estado: 'OK', texto: 'User-agent: *\nDisallow: /producto/\n' }),
    });

    const r = await ejecutarCorrida(deps);

    expect(paiz.llamadas).toEqual([]);
    expect(r.estado).toBe('FALLIDA');
    expect(await db().select().from(precio)).toEqual([]);
    const [sitio] = await db()
      .select()
      .from(corridaSitio)
      .where(eq(corridaSitio.supermercadoId, await idDe('PAIZ')));
    expect(sitio).toMatchObject({ estado: 'BLOQUEADO', totalVinculos: 1 });
    const [error] = await db().select().from(corridaError);
    expect(error).toMatchObject({ tipo: 'ROBOTS', mensaje: 'Bloqueado por robots.txt' });
    const avisos = await db().select().from(aviso);
    expect(avisos.map((a) => a.hogarId).sort()).toEqual([h1!.id, h2!.id].sort());
    expect(avisos[0]).toMatchObject({
      tipo: 'SITIO_BLOQUEADO',
      mensaje: 'Paiz bloqueado: registra precios manualmente',
    });
    expect(recalculos).toEqual([]);
  });

  it('CA-38.1 y CA-38.4 si falla la consulta se conserva el último precio válido con su fecha', async () => {
    await permitir('PAIZ');
    const arroz = await vincular('Arroz', 'PAIZ');
    const aceite = await vincular('Aceite', 'PAIZ');
    const [h] = await db().insert(hogar).values({ nombre: 'Familia Uno' }).returning();
    // Precios anteriores: Arroz Q13.00 del 18/10 y Aceite Q26.50 del 04/10 (ya desactualizado).
    await db()
      .insert(corrida)
      .values({ programadaPara: new Date('2026-10-18T03:00:00Z'), estado: 'COMPLETADA' });
    const [anterior] = await db().select().from(corrida);
    await db()
      .insert(precio)
      .values([
        {
          productoSupermercadoId: arroz,
          origen: 'AUTOMATICO',
          corridaId: anterior!.id,
          precio: '13.00',
          precioNormalizado: '13.00',
          fechaPrecio: '2026-10-18',
        },
        {
          productoSupermercadoId: aceite,
          origen: 'AUTOMATICO',
          corridaId: anterior!.id,
          precio: '26.50',
          precioNormalizado: '26.50',
          fechaPrecio: '2026-10-04',
        },
      ]);
    const paiz = simulado('PAIZ', () => {
      throw new ErrorExtraccion('TIEMPO_AGOTADO', 'Tiempo agotado');
    });
    const { deps } = dependencias([paiz]);

    const r = await ejecutarCorrida(deps);

    expect(r.estado).toBe('FALLIDA');
    // Nada nuevo: los dos precios anteriores siguen intactos, con su fecha original.
    const precios = await db().select().from(precio);
    expect(precios.map((p) => [p.precioNormalizado, p.fechaPrecio]).sort()).toEqual([
      ['13.00', '2026-10-18'],
      ['26.50', '2026-10-04'],
    ]);
    const errores = await db().select().from(corridaError);
    expect(errores.map((e) => [e.tipo, e.intentos])).toEqual([
      ['TIEMPO_AGOTADO', 3],
      ['TIEMPO_AGOTADO', 3],
    ]);
    const [a] = await db().select().from(aviso);
    expect(a).toMatchObject({
      hogarId: h!.id,
      tipo: 'CORRIDA_FALLIDA',
      mensaje: 'Paiz: 2 productos sin actualizar',
    });
    expect(a!.corridaId).toBe(r.corridaId);
  });

  it('D-07 con los permisos por defecto (apagados) no se consulta ningún sitio', async () => {
    await vincular('Arroz', 'WALMART');
    const walmart = simulado('WALMART');
    const paiz = simulado('PAIZ');
    const { deps } = dependencias([walmart, paiz]);
    await ejecutarCorrida(deps);
    expect(walmart.llamadas.concat(paiz.llamadas)).toEqual([]);
    const sitios = await db().select().from(corridaSitio);
    // Walmart está habilitado en la semilla pero sin permiso de extracción: queda bloqueado.
    expect(sitios.map((s) => s.estado)).toEqual(['BLOQUEADO', 'BLOQUEADO']);
    expect(await db().select().from(precio)).toEqual([]);
  });

  it('CA-33.4 un sitio no habilitado se registra como "Sitio no habilitado"', async () => {
    // La Torre tiene extractor previsto pero está en fase 2: deshabilitada.
    await db()
      .update(supermercado)
      .set({ soportaExtraccion: true, habilitado: false })
      .where(eq(supermercado.codigo, 'LA_TORRE'));
    await vincular('Arroz', 'LA_TORRE');
    const torre = simulado('LA_TORRE');
    const { deps } = dependencias([torre]);
    await ejecutarCorrida(deps);
    expect(torre.llamadas).toEqual([]);
    const [sitio] = await db()
      .select()
      .from(corridaSitio)
      .where(eq(corridaSitio.supermercadoId, await idDe('LA_TORRE')));
    expect(sitio).toMatchObject({ estado: 'NO_HABILITADO', totalVinculos: 1 });
  });

  it('CA-33.5 con otra corrida en curso la nueva se registra "Omitida"', async () => {
    await permitir('WALMART');
    await vincular('Arroz', 'WALMART');
    await db().insert(corrida).values({ programadaPara: SABADO, estado: 'EN_CURSO' });
    const walmart = simulado('WALMART');
    const { deps, recalculos } = dependencias([walmart]);

    const r = await ejecutarCorrida(deps, { disparo: 'MANUAL' });

    expect(r.estado).toBe('OMITIDA');
    expect(walmart.llamadas).toEqual([]);
    const todas = await db().select().from(corrida);
    expect(todas.map((c) => c.estado).sort()).toEqual(['EN_CURSO', 'OMITIDA']);
    expect(todas.find((c) => c.estado === 'OMITIDA')).toMatchObject({ disparo: 'MANUAL' });
    expect(recalculos).toEqual([]);
  });

  it('dos disparos simultáneos: uno corre y el otro queda "Omitido"', async () => {
    await permitir('WALMART');
    await vincular('Arroz', 'WALMART');
    const { deps } = dependencias([simulado('WALMART')]);
    const [a, b] = await Promise.all([ejecutarCorrida(deps), ejecutarCorrida(deps)]);
    expect([a.estado, b.estado].sort()).toEqual(['COMPLETADA', 'OMITIDA']);
  });

  describe('recálculo (CU-09.2)', () => {
    it('actualiza el mínimo y la mediana de los hogares que ya tienen el resumen', async () => {
      await permitir('WALMART');
      await permitir('PAIZ');
      const [h] = await db().insert(hogar).values({ nombre: 'Familia Uno' }).returning();
      const [otro] = await db().insert(hogar).values({ nombre: 'Familia Dos' }).returning();
      await vincular('Arroz', 'WALMART');
      const paiz = await vincular('Arroz', 'PAIZ');
      const [arroz] = await db()
        .select({ id: producto.id })
        .from(producto)
        .where(eq(producto.nombre, 'Arroz'));
      const walmartId = await idDe('WALMART');
      // El hogar ya tenía un resumen viejo; el otro hogar nunca lo calculó.
      await db().insert(precioResumen).values({
        productoId: arroz!.id,
        hogarId: h!.id,
        precioMediana: '99.00',
        precioMinimo: '99.00',
        supermercadoMinimoId: walmartId,
        fechaPrecioMinimo: '2026-09-01',
        cantidadPrecios: 1,
        desactualizado: true,
        fechaPrecioMasAntiguo: '2026-09-01',
      });
      // Un precio manual de otro hogar no debe contar en el resumen del primero.
      await db().insert(precio).values({
        productoSupermercadoId: paiz,
        origen: 'MANUAL',
        hogarId: otro!.id,
        precio: '1.00',
        precioNormalizado: '1.00',
        fechaPrecio: '2026-10-24',
      });
      const { deps } = dependencias([
        simulado('WALMART', () => '12.50'),
        simulado('PAIZ', () => '13.00'),
      ]);
      const r = await ejecutarCorrida(deps);

      const escritos = await recalcularCorrida(
        new RepositorioRecalculoPg(db()),
        r.corridaId,
        SABADO,
        '2026-10-24',
      );

      expect(escritos).toBe(1);
      const filas = await db().select().from(precioResumen);
      expect(filas).toHaveLength(1);
      expect(filas[0]).toMatchObject({
        hogarId: h!.id,
        precioMediana: '12.75',
        precioMinimo: '12.50',
        supermercadoMinimoId: walmartId,
        cantidadPrecios: 2,
        desactualizado: false,
      });
    });

    it('respeta los supermercados preferidos del hogar', async () => {
      await permitir('WALMART');
      await permitir('PAIZ');
      const [h] = await db().insert(hogar).values({ nombre: 'Familia Uno' }).returning();
      await vincular('Arroz', 'WALMART');
      await vincular('Arroz', 'PAIZ');
      const [arroz] = await db()
        .select({ id: producto.id })
        .from(producto)
        .where(eq(producto.nombre, 'Arroz'));
      const paizId = await idDe('PAIZ');
      const walmartId = await idDe('WALMART');
      await db().insert(precioResumen).values({
        productoId: arroz!.id,
        hogarId: h!.id,
        precioMediana: '1.00',
        precioMinimo: '1.00',
        supermercadoMinimoId: walmartId,
        fechaPrecioMinimo: '2026-09-01',
        cantidadPrecios: 1,
        fechaPrecioMasAntiguo: '2026-09-01',
      });
      await db()
        .insert(hogarSupermercado)
        .values([
          { hogarId: h!.id, supermercadoId: paizId, preferido: true },
          { hogarId: h!.id, supermercadoId: walmartId, preferido: false },
        ]);
      const { deps } = dependencias([
        simulado('WALMART', () => '12.50'),
        simulado('PAIZ', () => '13.00'),
      ]);
      const r = await ejecutarCorrida(deps);

      await recalcularCorrida(new RepositorioRecalculoPg(db()), r.corridaId, SABADO, '2026-10-24');

      const [fila] = await db().select().from(precioResumen);
      expect(fila).toMatchObject({ precioMinimo: '13.00', supermercadoMinimoId: paizId });
    });
  });
});
