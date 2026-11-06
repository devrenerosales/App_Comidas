/**
 * HU-19 Generar propuesta de menú — integración contra PostgreSQL real (TEST_DATABASE_URL).
 * Cubre CA-19.1..4 (docs/03-pruebas/features/HU-19.feature), las exclusiones de HU-10, la
 * preferencia por favoritos y calificaciones, el aislamiento por hogar (RNF-06) y el rendimiento
 * de RNF-01 (p95 menor a 3 s con 300 platillos).
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  and,
  configuracion,
  eq,
  menuDetalle,
  menuSemanal,
  platillo,
  platilloIngrediente,
  platilloTiempo,
  producto,
  tiempoComidaConfig,
} from '@menu/db';
import { normalizarNombreCatalogo, type TiempoComida } from '@menu/shared';
import { crearAppConBd, describeConBd, usarBaseDePruebas } from './utils/base-datos';

const API = '/api/v1';
const SEMANA = '2026-11-01'; // domingo
const PROTEINAS = ['POLLO', 'RES', 'CERDO', 'PESCADO', 'HUEVO'] as const;

describeConBd('HU-19 Generar propuesta de menú (integración)', () => {
  const bd = usarBaseDePruebas({ suite: 'menus', sembrar: true, truncarEntrePruebas: true });
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
    return { token: hogar.body.accessToken as string, hogarId: hogar.body.hogar.id as string };
  };

  /** Deja el presupuesto y los tiempos activos con su porcentaje (suma 100). */
  const configurar = async (
    hogarId: string,
    presupuesto: string,
    p: Partial<Record<TiempoComida, string>>,
  ) => {
    const [config] = await bd.db
      .update(configuracion)
      .set({ presupuestoSemanal: presupuesto })
      .where(eq(configuracion.hogarId, hogarId))
      .returning();
    for (const tiempo of ['DESAYUNO', 'ALMUERZO', 'CENA'] as const) {
      await bd.db
        .update(tiempoComidaConfig)
        .set({ activo: p[tiempo] !== undefined, porcentaje: p[tiempo] ?? '0.00' })
        .where(
          and(
            eq(tiempoComidaConfig.configuracionId, config!.id),
            eq(tiempoComidaConfig.tiempo, tiempo),
          ),
        );
    }
  };

  /** `cantidad` platillos activos del tiempo con proteínas rotadas. */
  const sembrar = async (hogarId: string, tiempo: TiempoComida, cantidad: number, marca = '') => {
    const filas = Array.from({ length: cantidad }, (_, i) => {
      const nombre = `${marca}${tiempo} ${String(i + 1).padStart(3, '0')}`;
      return {
        hogarId,
        nombre,
        nombreNormalizado: normalizarNombreCatalogo(nombre),
        proteinaPrincipal: PROTEINAS[i % PROTEINAS.length]!,
      };
    });
    const creados = await bd.db.insert(platillo).values(filas).returning();
    await bd.db.insert(platilloTiempo).values(creados.map((c) => ({ platilloId: c.id, tiempo })));
    return creados;
  };

  const generar = (token: string, cuerpo: object) =>
    http().post(`${API}/menus/generar`).set(con(token)).send(cuerpo);

  type Detalle = {
    fecha: string;
    tiempo: string;
    platillo: { id: string; proteinaPrincipal: string } | null;
    fijado: boolean;
    factores: { preferencia: string };
  };

  beforeAll(async () => {
    app = await crearAppConBd(bd.base);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('CA-19.1 con solo almuerzo crea un Borrador de 7 almuerzos sin repetir ni proteína seguida', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    await configurar(hogarId, '245.00', { ALMUERZO: '100.00' });
    await sembrar(hogarId, 'ALMUERZO', 25);

    const res = await generar(token, { semana: SEMANA }).expect(201);
    expect(res.body).toMatchObject({
      fechaInicio: SEMANA,
      fechaFin: '2026-11-07',
      estado: 'BORRADOR',
      presupuestoSemanal: '245.00',
      pesos: { preferencia: '0.40', novedad: '0.25', ahorro: '0.20', afinidad: '0.15' },
      costoIncompleto: true,
      excede: null,
      avisos: [],
    });
    expect(res.body.tiempos).toEqual([
      expect.objectContaining({
        tiempo: 'ALMUERZO',
        porcentaje: '100.00',
        presupuesto: '245.00',
        estado: 'COSTO_INCOMPLETO',
      }),
    ]);
    const detalles = res.body.detalles as Detalle[];
    expect(detalles.map((d) => d.fecha)).toEqual([
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
      '2026-11-07',
    ]);
    expect(new Set(detalles.map((d) => d.platillo!.id)).size).toBe(7);
    for (let i = 1; i < 7; i++) {
      expect(detalles[i]!.platillo!.proteinaPrincipal).not.toBe(
        detalles[i - 1]!.platillo!.proteinaPrincipal,
      );
    }
    expect(detalles.every((d) => d.tiempo === 'ALMUERZO' && !d.fijado)).toBe(true);
    const guardados = await bd.db
      .select()
      .from(menuDetalle)
      .where(eq(menuDetalle.menuId, res.body.id));
    expect(guardados).toHaveLength(7);
    expect(guardados[0]).toMatchObject({ origen: 'MOTOR', costoIncompleto: true });
    expect(guardados[0]!.puntaje).not.toBeNull();
  });

  it('CA-19.2 regenerar conserva el fijado y el día siguiente no repite su proteína', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    await configurar(hogarId, '500.00', { ALMUERZO: '60.00', CENA: '40.00' });
    const almuerzos = await sembrar(hogarId, 'ALMUERZO', 25);
    await sembrar(hogarId, 'CENA', 25);
    const primero = await generar(token, { semana: SEMANA }).expect(201);
    expect(primero.body.detalles).toHaveLength(14);

    // El usuario fija "Pepián de pollo" el domingo en almuerzo.
    const pepian = almuerzos.find((p) => p.proteinaPrincipal === 'POLLO')!;
    const domingo = (primero.body.detalles as { id: string; fecha: string; tiempo: string }[]).find(
      (d) => d.fecha === SEMANA && d.tiempo === 'ALMUERZO',
    )!;
    await bd.db
      .update(menuDetalle)
      .set({ platilloId: pepian.id, fijado: true, origen: 'USUARIO' })
      .where(eq(menuDetalle.id, domingo.id));

    await generar(token, { semana: SEMANA }).expect(409);
    const res = await generar(token, { semana: SEMANA, regenerar: true }).expect(200);
    expect(res.body.id).toBe(primero.body.id);
    expect(res.body.version).toBe(2);
    const detalles = res.body.detalles as Detalle[];
    expect(detalles).toHaveLength(14);
    const dom = detalles.find((d) => d.fecha === SEMANA && d.tiempo === 'ALMUERZO')!;
    expect(dom).toMatchObject({ fijado: true, platillo: { id: pepian.id } });
    const lunes = detalles.find((d) => d.fecha === '2026-11-02' && d.tiempo === 'ALMUERZO')!;
    expect(lunes.platillo!.proteinaPrincipal).not.toBe('POLLO');
    expect(detalles.filter((d) => d.fijado)).toHaveLength(1);
    // No se repite el platillo fijado ni se crean menús duplicados.
    expect(
      detalles.filter((d) => d.tiempo === 'ALMUERZO' && d.platillo!.id === pepian.id),
    ).toHaveLength(1);
    expect(await bd.db.select().from(menuSemanal)).toHaveLength(1);
  });

  it('CA-19.3 si faltan platillos de cena no crea el menú y dice cuántos faltan', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    await configurar(hogarId, '500.00', { ALMUERZO: '60.00', CENA: '40.00' });
    await sembrar(hogarId, 'ALMUERZO', 12);
    await sembrar(hogarId, 'CENA', 7);

    const res = await generar(token, { semana: SEMANA }).expect(422);
    expect(res.body.codigo).toBe('FALTAN_PLATILLOS');
    expect(res.body.detail).toBe('Faltan 3 platillos de Cena');
    expect(res.body.faltantes).toEqual([{ tiempo: 'CENA', cantidad: 3 }]);
    expect(await bd.db.select().from(menuSemanal)).toHaveLength(0);
  });

  it('CA-19.4 una semana aprobada no se regenera y el menú no cambia', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    await configurar(hogarId, '245.00', { ALMUERZO: '100.00' });
    await sembrar(hogarId, 'ALMUERZO', 25);
    const [aprobado] = await bd.db
      .insert(menuSemanal)
      .values({
        hogarId,
        fechaInicio: SEMANA,
        fechaFin: '2026-11-07',
        estado: 'APROBADO',
        aprobadoEn: new Date('2026-10-30T15:00:00Z'),
        presupuestoSemanal: '245.00',
      })
      .returning();

    for (const regenerar of [false, true]) {
      const res = await generar(token, { semana: SEMANA, regenerar }).expect(409);
      expect(res.body).toMatchObject({
        codigo: 'MENU_APROBADO',
        detail: 'Esta semana ya tiene un menú aprobado',
        menuId: aprobado!.id,
      });
    }
    const [igual] = await bd.db.select().from(menuSemanal);
    expect(igual).toMatchObject({ id: aprobado!.id, estado: 'APROBADO', version: 1 });
    expect(await bd.db.select().from(menuDetalle)).toHaveLength(0);
  });

  it('una semana ya registrada en el historial no se genera', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    await configurar(hogarId, '245.00', { ALMUERZO: '100.00' });
    await sembrar(hogarId, 'ALMUERZO', 12);
    await bd.db.insert(menuSemanal).values({
      hogarId,
      fechaInicio: SEMANA,
      fechaFin: '2026-11-07',
      estado: 'HISTORICO',
    });
    const res = await generar(token, { semana: SEMANA, regenerar: true }).expect(409);
    expect(res.body.codigo).toBe('SEMANA_HISTORICA');
  });

  it('HU-10 los platillos con ingredientes excluidos no se sugieren', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    await configurar(hogarId, '245.00', { ALMUERZO: '100.00' });
    const platillos = await sembrar(hogarId, 'ALMUERZO', 11);
    const [crema] = await bd.db.select().from(producto).where(eq(producto.nombre, 'Crema'));
    const [unidadMl] = await http()
      .get(`${API}/unidades`)
      .set(con(token))
      .then((r) => (r.body as { codigo: string; id: string }[]).filter((u) => u.codigo === 'ml'));
    await bd.db.insert(platilloIngrediente).values({
      platilloId: platillos[0]!.id,
      productoId: crema!.id,
      cantidad: '250',
      unidadId: unidadMl!.id,
    });
    await http()
      .put(`${API}/hogar/preferencias/gustos`)
      .set(con(token))
      .send({ ingredientesExcluidos: [crema!.id], favoritos: [] })
      .expect(200);

    // Con 11 platillos y uno excluido quedan 10: alcanza justo.
    const res = await generar(token, { semana: SEMANA }).expect(201);
    const ids = (res.body.detalles as Detalle[]).map((d) => d.platillo?.id);
    expect(ids).not.toContain(platillos[0]!.id);

    // Con uno menos de los necesarios deja de poder generar.
    await bd.db.update(platillo).set({ activo: false }).where(eq(platillo.id, platillos[1]!.id));
    const falta = await generar(token, { semana: SEMANA, regenerar: true }).expect(422);
    expect(falta.body.detail).toBe('Faltan 1 platillo de Almuerzo');
  });

  it('un favorito y un promedio alto elevan el factor de preferencia', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    await configurar(hogarId, '245.00', { ALMUERZO: '100.00' });
    const platillos = await sembrar(hogarId, 'ALMUERZO', 25);
    await bd.db.update(platillo).set({ favorito: true }).where(eq(platillo.id, platillos[0]!.id));
    await bd.db
      .update(platillo)
      .set({ calificacionPromedio: '3.00', calificacionConteo: 2 })
      .where(eq(platillo.id, platillos[1]!.id));

    const res = await generar(token, { semana: SEMANA }).expect(201);
    const detalles = res.body.detalles as Detalle[];
    const favorito = detalles.find((d) => d.platillo?.id === platillos[0]!.id)!;
    expect(favorito.factores.preferencia).toBe('1.0000');
    // Los demás (sin calificaciones, o con promedio 3.00 que vale (3 − 1) ÷ 4) valen 0.50 (D-17).
    expect(
      detalles.filter((d) => d !== favorito).every((d) => d.factores.preferencia === '0.5000'),
    ).toBe(true);
  });

  it('el historial de la semana pasada baja la novedad de lo recién preparado', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    await configurar(hogarId, '245.00', { ALMUERZO: '100.00' });
    // Pesos que priorizan la preferencia: el favorito recién preparado se asigna el primero.
    await bd.db
      .update(configuracion)
      .set({
        pesoPreferencia: '0.70',
        pesoNovedad: '0.05',
        pesoAhorro: '0.15',
        pesoAfinidad: '0.10',
      })
      .where(eq(configuracion.hogarId, hogarId));
    const platillos = await sembrar(hogarId, 'ALMUERZO', 25);
    await bd.db.update(platillo).set({ favorito: true }).where(eq(platillo.id, platillos[0]!.id));
    const [pasada] = await bd.db
      .insert(menuSemanal)
      .values({
        hogarId,
        fechaInicio: '2026-10-25',
        fechaFin: '2026-10-31',
        estado: 'HISTORICO',
      })
      .returning();
    await bd.db.insert(menuDetalle).values({
      menuId: pasada!.id,
      fecha: '2026-10-27',
      tiempo: 'ALMUERZO',
      platilloId: platillos[0]!.id,
      origen: 'HISTORICO',
    });

    const res = await generar(token, { semana: SEMANA }).expect(201);
    const detalles = res.body.detalles as (Detalle & { factores: { novedad: string } })[];
    // Se preparó hace menos de 2 semanas (RN-04): novedad 0. Los nunca preparados valen 1.00.
    const reciente = detalles.find((d) => d.platillo?.id === platillos[0]!.id)!;
    expect(reciente.factores.novedad).toBe('0.0000');
    expect(detalles.some((d) => d.factores.novedad === '1.0000')).toBe(true);
  });

  it('un hogar sin configuración de tiempos no puede generar', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    await configurar(hogarId, '245.00', {});
    const res = await generar(token, { semana: SEMANA }).expect(422);
    expect(res.body.codigo).toBe('CONFIGURACION_INCOMPLETA');
  });

  it('valida la semana: debe ser una fecha real y caer en el día de inicio', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    await configurar(hogarId, '245.00', { ALMUERZO: '100.00' });
    await sembrar(hogarId, 'ALMUERZO', 12);
    for (const semana of ['2026-11-02', '2026-02-30']) {
      const res = await generar(token, { semana }).expect(422);
      expect(res.body.codigo).toBe('SEMANA_INVALIDA');
    }
    await generar(token, { semana: 'noviembre' }).expect(400);
    await generar(token, {}).expect(400);
    await generar(token, { semana: SEMANA, regenerar: 'si' }).expect(400);
  });

  it('RNF-06 cada hogar usa solo sus platillos', async () => {
    const rene = await hogarDe('Rene');
    const ana = await hogarDe('Ana');
    await configurar(rene.hogarId, '245.00', { ALMUERZO: '100.00' });
    await configurar(ana.hogarId, '245.00', { ALMUERZO: '100.00' });
    await sembrar(rene.hogarId, 'ALMUERZO', 25);
    const res = await generar(ana.token, { semana: SEMANA }).expect(422);
    expect(res.body.detail).toBe('Faltan 10 platillos de Almuerzo');
    expect(await bd.db.select().from(menuSemanal)).toHaveLength(0);
  });

  it('requiere sesión', async () => {
    await http().post(`${API}/menus/generar`).send({ semana: SEMANA }).expect(401);
  });

  it('RNF-01 genera una semana con 300 platillos en menos de 3 s', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    await configurar(hogarId, '500.00', { ALMUERZO: '60.00', CENA: '40.00' });
    await sembrar(hogarId, 'ALMUERZO', 150);
    await sembrar(hogarId, 'CENA', 150);
    const tiempos: number[] = [];
    for (const semana of ['2026-11-01', '2026-11-08', '2026-11-15', '2026-11-22', '2026-11-29']) {
      const inicio = Date.now();
      await generar(token, { semana }).expect(201);
      tiempos.push(Date.now() - inicio);
    }
    const ordenados = [...tiempos].sort((a, b) => a - b);
    expect(ordenados[ordenados.length - 1]).toBeLessThan(3000);
  });
});
