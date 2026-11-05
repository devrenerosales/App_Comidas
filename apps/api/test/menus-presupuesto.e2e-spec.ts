/**
 * HU-21 Ajustar al presupuesto — integración contra PostgreSQL real (TEST_DATABASE_URL).
 * Cubre CA-21.1..3 con precios mediana reales (producto con `precio_resumen`), el costo guardado
 * por tiempo, la nota del reemplazo que lee HU-22 y el recálculo de costos al cambiar un espacio.
 * CA-21.4 (presupuesto por tiempo) lo cubre HU-19: cada tiempo guarda su monto.
 *
 * Los montos se calculan con las mismas funciones de `@menu/shared` que usa el servidor, así la
 * prueba no depende de cuántos comensales tenga el hogar de prueba.
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  and,
  configuracion,
  corrida,
  eq,
  listaCompras,
  listaItem,
  menuDetalle,
  menuSemanal,
  menuTiempo,
  platillo,
  platilloIngrediente,
  platilloTiempo,
  precio,
  precioResumen,
  producto,
  productoSupermercado,
  supermercado,
  tiempoComidaConfig,
  unidad,
} from '@menu/db';
import {
  deCentavos,
  escalarCantidad,
  normalizarNombreCatalogo,
  type ProteinaPrincipal,
} from '@menu/shared';
import { crearAppConBd, describeConBd, usarBaseDePruebas } from './utils/base-datos';

const API = '/api/v1';
const SEMANA = '2026-11-01';
const PROTEINAS: ProteinaPrincipal[] = ['POLLO', 'RES', 'CERDO', 'PESCADO', 'HUEVO'];
const PRECIO_LIBRA = 10;
/** Libras (para 4 porciones) de los 7 favoritos y de los 18 platillos más baratos. */
const LIBRAS_CAROS = 5;
const LIBRAS_BARATOS = 1;

describeConBd('HU-21 Ajustar al presupuesto (integración)', () => {
  const bd = usarBaseDePruebas({
    suite: 'menus-presupuesto',
    sembrar: true,
    truncarEntrePruebas: true,
  });
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const con = (token: string) => ({ Authorization: `Bearer ${token}` });
  let n = 0;

  const hogarDe = async (nombre: string): Promise<{ token: string; hogarId: string }> => {
    n += 1;
    const registro = await http()
      .post(`${API}/auth/registro`)
      .send({
        nombre,
        correo: `${nombre.toLowerCase()}${n}@correo.com`,
        contrasena: 'Almuerzo2026',
      })
      .expect(201);
    const hogar = await http()
      .post(`${API}/hogares`)
      .set(con(registro.body.accessToken))
      .send({ nombre: `Familia ${nombre}` })
      .expect(201);
    const token = hogar.body.accessToken as string;
    // Σ de factores = 2.50 (RN-07): sin comensales activos los costos no se escalan.
    for (const [comensal, factorPorcion] of [
      ['Rene', 1],
      ['Ana', 1.5],
    ] as const) {
      await http()
        .post(`${API}/hogar/comensales`)
        .set(con(token))
        .send({ nombre: comensal, factorPorcion })
        .expect(201);
    }
    return { token, hogarId: hogar.body.hogar.id as string };
  };

  /** Presupuesto semanal con solo el almuerzo activo al 100 %. */
  const configurar = async (hogarId: string, presupuesto: string) => {
    const [config] = await bd.db
      .update(configuracion)
      .set({ presupuestoSemanal: presupuesto })
      .where(eq(configuracion.hogarId, hogarId))
      .returning();
    for (const tiempo of ['DESAYUNO', 'ALMUERZO', 'CENA'] as const) {
      await bd.db
        .update(tiempoComidaConfig)
        .set({
          activo: tiempo === 'ALMUERZO',
          porcentaje: tiempo === 'ALMUERZO' ? '100.00' : '0.00',
        })
        .where(
          and(
            eq(tiempoComidaConfig.configuracionId, config!.id),
            eq(tiempoComidaConfig.tiempo, tiempo),
          ),
        );
    }
  };

  /** Σ de factores de porción de los comensales activos (RN-07). */
  const sumaFactores = async (token: string) => {
    const res = await http().get(`${API}/hogar/comensales`).set(con(token)).expect(200);
    return Number(res.body.totales.sumaFactores);
  };

  /** Costo de un platillo de `libras` libras de pechuga (Q10 la libra) con la Σ del hogar. */
  const costoDe = (libras: number, suma: number) =>
    Math.round(PRECIO_LIBRA * escalarCantidad(libras, 4, suma) * 100) / 100;
  const q = (valor: number) => deCentavos(Math.round(valor * 100));

  /**
   * 25 platillos de almuerzo con la misma pechuga de ingrediente: los 7 primeros son favoritos y
   * caros (el motor los elige), los otros 18 son baratos y sirven de reemplazo.
   */
  const crearCatalogo = async (hogarId: string) => {
    const [pechuga] = await bd.db
      .select({ id: producto.id })
      .from(producto)
      .where(eq(producto.nombre, 'Pechuga de pollo'))
      .limit(1);
    const [libra] = await bd.db
      .select({ id: unidad.id })
      .from(unidad)
      .where(eq(unidad.codigo, 'lb'));
    const [tienda] = await bd.db.select({ id: supermercado.id }).from(supermercado).limit(1);
    // Un precio real de la pechuga: el resumen (mediana y mínimo) lo calcula la API al generar el
    // menú (HU-36), igual que en producción.
    const [vinculo] = await bd.db
      .insert(productoSupermercado)
      .values({
        productoId: pechuga!.id,
        supermercadoId: tienda!.id,
        nombreTienda: 'Pechuga de pollo',
        presentacionCantidad: '1',
        presentacionUnidadId: libra!.id,
        factor: '1',
      })
      .returning();
    const [carrera] = await bd.db
      .insert(corrida)
      .values({ programadaPara: new Date() })
      .returning();
    await bd.db.insert(precio).values({
      productoSupermercadoId: vinculo!.id,
      origen: 'AUTOMATICO',
      corridaId: carrera!.id,
      precio: PRECIO_LIBRA.toFixed(2),
      precioNormalizado: PRECIO_LIBRA.toFixed(2),
      fechaPrecio: new Date(Date.now() - 86_400_000).toISOString().slice(0, 10),
    });
    const filas = Array.from({ length: 25 }, (_, i) => {
      const nombre = `Almuerzo ${String(i + 1).padStart(3, '0')}`;
      return {
        hogarId,
        nombre,
        nombreNormalizado: normalizarNombreCatalogo(nombre),
        proteinaPrincipal: PROTEINAS[i % PROTEINAS.length]!,
        favorito: i < 7,
      };
    });
    const creados = await bd.db.insert(platillo).values(filas).returning();
    await bd.db
      .insert(platilloTiempo)
      .values(creados.map((c) => ({ platilloId: c.id, tiempo: 'ALMUERZO' as const })));
    await bd.db.insert(platilloIngrediente).values(
      creados.map((c, i) => ({
        platilloId: c.id,
        productoId: pechuga!.id,
        cantidad: String(i < 7 ? LIBRAS_CAROS : LIBRAS_BARATOS),
        unidadId: libra!.id,
      })),
    );
    return creados;
  };

  const generar = (token: string, cuerpo: object = { semana: SEMANA }) =>
    http().post(`${API}/menus/generar`).set(con(token)).send(cuerpo);

  type Detalle = { id: string; origen: string; costoEstimado: string | null };

  beforeAll(async () => {
    app = await crearAppConBd(bd.base);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('CA-21.1 un menú que cumple no hace reemplazos y queda dentro del presupuesto', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const suma = await sumaFactores(token);
    const total = 7 * costoDe(LIBRAS_CAROS, suma);
    await configurar(hogarId, q(total * 1.2));
    await crearCatalogo(hogarId);

    const res = await generar(token).expect(201);

    expect(res.body.tiempos[0]).toMatchObject({
      tiempo: 'ALMUERZO',
      costoEstimado: q(total),
      exceso: '0.00',
      intentosAjuste: 0,
      estado: 'DENTRO_DEL_PRESUPUESTO',
    });
    expect(res.body).toMatchObject({ costoEstimado: q(total), costoIncompleto: false });
    expect(
      (res.body.detalles as Detalle[]).filter((d) => d.origen === 'REEMPLAZO_PRESUPUESTO'),
    ).toEqual([]);
    expect(res.body.tiempos[0].alternativas).toBeUndefined();
  });

  it('CA-21.2 un menú excedido se corrige reemplazando los más caros y guarda la nota para HU-22', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const suma = await sumaFactores(token);
    const caro = costoDe(LIBRAS_CAROS, suma);
    const barato = costoDe(LIBRAS_BARATOS, suma);
    // Con un reemplazo todavía excede; con dos cumple.
    const dosReemplazos = 5 * caro + 2 * barato;
    const unReemplazo = 6 * caro + barato;
    const presupuesto = Math.floor(((dosReemplazos + unReemplazo) / 2) * 100) / 100;
    await configurar(hogarId, presupuesto.toFixed(2));
    await crearCatalogo(hogarId);

    const res = await generar(token).expect(201);

    expect(res.body.tiempos[0]).toMatchObject({
      costoEstimado: q(dosReemplazos),
      exceso: '0.00',
      intentosAjuste: 2,
      estado: 'DENTRO_DEL_PRESUPUESTO',
    });
    const reemplazados = (res.body.detalles as Detalle[]).filter(
      (d) => d.origen === 'REEMPLAZO_PRESUPUESTO',
    );
    expect(reemplazados).toHaveLength(2);
    for (const d of reemplazados) expect(d.costoEstimado).toBe(q(barato));

    const motivo = await http()
      .get(`${API}/menus/${res.body.id}/detalles/${reemplazados[0]!.id}/motivo`)
      .set(con(token))
      .expect(200);
    expect(motivo.body).toMatchObject({
      origen: 'REEMPLAZO_PRESUPUESTO',
      reglasAplicadas: ['REEMPLAZO_PRESUPUESTO'],
      costo: { estimado: q(barato), incompleto: false },
      resumen: `Reemplazo por presupuesto: Q${q(caro - barato)} más barato`,
    });
  });

  it('CA-21.3 si no alcanza tras 3 intentos guarda el borrador con el exceso y alternativas más baratas', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const suma = await sumaFactores(token);
    const caro = costoDe(LIBRAS_CAROS, suma);
    const barato = costoDe(LIBRAS_BARATOS, suma);
    const presupuesto = 3 * barato;
    await configurar(hogarId, presupuesto.toFixed(2));
    await crearCatalogo(hogarId);

    const res = await generar(token).expect(201);

    const costo = 4 * caro + 3 * barato;
    expect(res.body).toMatchObject({ estado: 'BORRADOR', costoEstimado: q(costo) });
    expect(res.body.tiempos[0]).toMatchObject({
      costoEstimado: q(costo),
      exceso: q(costo - presupuesto),
      intentosAjuste: 3,
      estado: 'EXCEDE',
    });
    const alternativas = res.body.tiempos[0].alternativas as {
      fecha: string;
      platillos: { id: string; nombre: string; costo: string }[];
    }[];
    expect(alternativas.length).toBeGreaterThan(0);
    for (const a of alternativas) {
      expect(a.platillos.length).toBeGreaterThan(0);
      expect(a.platillos.length).toBeLessThanOrEqual(3);
      for (const p of a.platillos) expect(p.costo).toBe(q(barato));
    }
    // El intento queda guardado en el tiempo del menú.
    const [guardado] = await bd.db
      .select()
      .from(menuTiempo)
      .where(eq(menuTiempo.menuId, res.body.id));
    expect(guardado).toMatchObject({ intentosAjuste: 3, exceso: q(costo - presupuesto) });
  });

  it('cambiar un platillo recalcula el costo y el exceso del tiempo', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const suma = await sumaFactores(token);
    const caro = costoDe(LIBRAS_CAROS, suma);
    const barato = costoDe(LIBRAS_BARATOS, suma);
    const dosReemplazos = 5 * caro + 2 * barato;
    const unReemplazo = 6 * caro + barato;
    const presupuesto = Math.floor(((dosReemplazos + unReemplazo) / 2) * 100) / 100;
    await configurar(hogarId, presupuesto.toFixed(2));
    const creados = await crearCatalogo(hogarId);
    const menu = await generar(token).expect(201);
    const reemplazado = (menu.body.detalles as Detalle[]).find(
      (d) => d.origen === 'REEMPLAZO_PRESUPUESTO',
    )!;
    const enUso = new Set(
      (await bd.db.select().from(menuDetalle).where(eq(menuDetalle.menuId, menu.body.id))).map(
        (d) => d.platilloId,
      ),
    );
    const favoritoLibre = creados.slice(0, 7).find((c) => !enUso.has(c.id))!;

    const res = await http()
      .patch(`${API}/menus/${menu.body.id}/detalles/${reemplazado.id}`)
      .set(con(token))
      .send({ platilloId: favoritoLibre.id, confirmar: true })
      .expect(200);

    // Un barato se cambia por un caro: queda en 6 caros y 1 barato, que ya excede.
    expect(res.body.tiempos[0]).toMatchObject({
      costoEstimado: q(unReemplazo),
      exceso: q(unReemplazo - presupuesto),
      estado: 'EXCEDE',
    });
    expect(res.body.costoEstimado).toBe(q(unReemplazo));
    const cambiado = (res.body.detalles as Detalle[]).find((d) => d.id === reemplazado.id)!;
    expect(cambiado).toMatchObject({ origen: 'USUARIO', costoEstimado: q(caro) });
  });

  it('HU-26 GET /menus/:id/costos resume por día, por tiempo y total y se recalcula al editar', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const suma = await sumaFactores(token);
    const caro = costoDe(LIBRAS_CAROS, suma);
    const barato = costoDe(LIBRAS_BARATOS, suma);
    const dosReemplazos = 5 * caro + 2 * barato;
    const unReemplazo = 6 * caro + barato;
    const presupuesto = Math.floor(((dosReemplazos + unReemplazo) / 2) * 100) / 100;
    await configurar(hogarId, presupuesto.toFixed(2));
    const creados = await crearCatalogo(hogarId);
    const menu = await generar(token).expect(201);

    const antes = await http()
      .get(`${API}/menus/${menu.body.id}/costos`)
      .set(con(token))
      .expect(200);
    expect(antes.body).toMatchObject({
      total: q(dosReemplazos),
      presupuesto: presupuesto.toFixed(2),
      diferencia: q(presupuesto - dosReemplazos),
      excede: false,
      exceso: '0.00',
      costoIncompleto: false,
    });
    expect(antes.body.porTiempo).toEqual([
      {
        tiempo: 'ALMUERZO',
        costo: q(dosReemplazos),
        presupuesto: presupuesto.toFixed(2),
        exceso: '0.00',
        excede: false,
        estado: 'DENTRO_DEL_PRESUPUESTO',
      },
    ]);
    expect(antes.body.porDia).toHaveLength(7);
    for (const dia of antes.body.porDia as { costo: string; incompleto: boolean }[]) {
      expect(dia.incompleto).toBe(false);
      expect([q(caro), q(barato)]).toContain(dia.costo);
    }

    // CA-26.4: cambiar un barato por un caro sube el total y lo deja excedido.
    const reemplazado = (menu.body.detalles as Detalle[]).find(
      (d) => d.origen === 'REEMPLAZO_PRESUPUESTO',
    )!;
    const enUso = new Set(
      (await bd.db.select().from(menuDetalle).where(eq(menuDetalle.menuId, menu.body.id))).map(
        (d) => d.platilloId,
      ),
    );
    const favoritoLibre = creados.slice(0, 7).find((c) => !enUso.has(c.id))!;
    await http()
      .patch(`${API}/menus/${menu.body.id}/detalles/${reemplazado.id}`)
      .set(con(token))
      .send({ platilloId: favoritoLibre.id, confirmar: true })
      .expect(200);

    const despues = await http()
      .get(`${API}/menus/${menu.body.id}/costos`)
      .set(con(token))
      .expect(200);
    expect(despues.body).toMatchObject({
      total: q(unReemplazo),
      diferencia: q(presupuesto - unReemplazo),
      excede: true,
      exceso: q(unReemplazo - presupuesto),
    });
  });

  it('HU-26 un menú ajeno o un id mal formado es 404 en costos', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    await configurar(hogarId, '245.00');
    await crearCatalogo(hogarId);
    const menu = await generar(token).expect(201);
    const otro = await hogarDe('Ana');

    await http().get(`${API}/menus/${menu.body.id}/costos`).set(con(otro.token)).expect(404);
    await http().get(`${API}/menus/no-es-uuid/costos`).set(con(token)).expect(404);
  });

  /**
   * CA-44.4: el precio de mercado de la pechuga está desactualizado (RN-08) y el hogar la compró
   * a Q20 la libra en las últimas semanas (RN-12).
   */
  const conPromedioDeCompra = async (hogarId: string) => {
    // El precio de mercado tiene más de 14 días: el resumen que calcula la API sale desactualizado.
    await bd.db
      .update(precio)
      .set({ fechaPrecio: new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10) });
    await bd.db
      .update(precioResumen)
      .set({ desactualizado: true })
      .where(eq(precioResumen.hogarId, hogarId));
    const [pechuga] = await bd.db
      .select({ id: producto.id })
      .from(producto)
      .where(eq(producto.nombre, 'Pechuga de pollo'));
    const [anterior] = await bd.db
      .insert(menuSemanal)
      .values({
        hogarId,
        fechaInicio: '2026-01-04',
        fechaFin: '2026-01-10',
        estado: 'HISTORICO',
        presupuestoSemanal: '100.00',
      })
      .returning();
    const [lista] = await bd.db
      .insert(listaCompras)
      .values({ hogarId, menuId: anterior!.id })
      .returning();
    const hace = new Date(Date.now() - 10 * 86_400_000);
    await bd.db.insert(listaItem).values({
      id: crypto.randomUUID(),
      listaId: lista!.id,
      productoId: pechuga!.id,
      origen: 'MENU',
      cantidadComprar: '1',
      estado: 'COMPRADO',
      compradoEn: hace,
      precioReal: '20.00',
      precioNormalizado: '20.00',
      modificadoEnDispositivo: hace,
    });
  };

  it('CA-44.4 sin precio de mercado vigente el costo usa el promedio de compra del hogar', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const suma = await sumaFactores(token);
    await configurar(hogarId, '1000.00');
    await crearCatalogo(hogarId);
    await conPromedioDeCompra(hogarId);

    const res = await generar(token).expect(201);

    // Los 7 favoritos de 5 lb se costean a Q20 la libra en lugar de los Q10 de mercado.
    const caro = Math.round(20 * escalarCantidad(LIBRAS_CAROS, 4, suma) * 100) / 100;
    expect(res.body.tiempos[0]).toMatchObject({ costoEstimado: q(7 * caro), exceso: '0.00' });
    expect(res.body.costoIncompleto).toBe(false);
  });

  it('con el precio de mercado desactualizado y sin promedio de compra usa el último precio conocido', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const suma = await sumaFactores(token);
    await configurar(hogarId, '1000.00');
    await crearCatalogo(hogarId);
    await bd.db
      .update(precioResumen)
      .set({ desactualizado: true })
      .where(eq(precioResumen.hogarId, hogarId));

    const res = await generar(token).expect(201);

    expect(res.body.tiempos[0].costoEstimado).toBe(q(7 * costoDe(LIBRAS_CAROS, suma)));
  });

  it('un platillo sin ingredientes con precio deja el costo incompleto y no se ajusta', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    await configurar(hogarId, '245.00');
    const filas = Array.from({ length: 25 }, (_, i) => {
      const nombre = `Sin precio ${String(i + 1).padStart(3, '0')}`;
      return {
        hogarId,
        nombre,
        nombreNormalizado: normalizarNombreCatalogo(nombre),
        proteinaPrincipal: PROTEINAS[i % PROTEINAS.length]!,
      };
    });
    const creados = await bd.db.insert(platillo).values(filas).returning();
    await bd.db
      .insert(platilloTiempo)
      .values(creados.map((c) => ({ platilloId: c.id, tiempo: 'ALMUERZO' as const })));

    const res = await generar(token).expect(201);

    expect(res.body).toMatchObject({ costoEstimado: null, costoIncompleto: true });
    expect(res.body.tiempos[0]).toMatchObject({
      costoEstimado: null,
      exceso: '0.00',
      intentosAjuste: 0,
      estado: 'COSTO_INCOMPLETO',
    });
    expect(res.body.tiempos[0].alternativas).toBeUndefined();
  });
});
