/**
 * Tablero del Inicio — integración contra PostgreSQL real (TEST_DATABASE_URL).
 * `GET /tablero`: gasto y consumo de la semana en curso e historial de presupuesto, por hogar.
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { menuDetalle, menuSemanal, menuTiempo, platillo } from '@menu/db';
import { RELOJ_TABLERO } from '../src/tablero/tablero.constants';
import { crearAppConBd, describeConBd, usarBaseDePruebas } from './utils/base-datos';

const API = '/api/v1';
/** Miércoles 2026-11-04, 09:00 en Guatemala. */
const HOY = new Date('2026-11-04T15:00:00Z');

describeConBd('Tablero del Inicio (integración)', () => {
  const bd = usarBaseDePruebas({ suite: 'tablero', sembrar: true, truncarEntrePruebas: true });
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

  const semana = async (
    hogarId: string,
    fechaInicio: string,
    fechaFin: string,
    extra: Partial<typeof menuSemanal.$inferInsert> = {},
  ) => {
    const [menu] = await bd.db
      .insert(menuSemanal)
      .values({
        hogarId,
        fechaInicio,
        fechaFin,
        estado: 'APROBADO',
        aprobadoEn: new Date(),
        presupuestoSemanal: '250.00',
        ...extra,
      })
      .returning();
    return menu!.id;
  };

  const comidas = async (
    hogarId: string,
    menuId: string,
    filas: {
      fecha: string;
      tiempo: 'ALMUERZO' | 'CENA';
      costo: string | null;
      sinPlatillo?: true;
    }[],
  ) => {
    const [plato] = await bd.db
      .insert(platillo)
      .values({ hogarId, nombre: `Plato ${menuId}`, nombreNormalizado: `plato ${menuId}` })
      .returning();
    for (const f of filas) {
      await bd.db.insert(menuDetalle).values({
        menuId,
        fecha: f.fecha,
        tiempo: f.tiempo,
        platilloId: f.sinPlatillo ? null : plato!.id,
        costoEstimado: f.costo,
      });
    }
  };

  beforeAll(async () => {
    app = await crearAppConBd(bd.base, (b) =>
      b.overrideProvider(RELOJ_TABLERO).useValue(() => HOY),
    );
  });
  afterAll(async () => {
    await app?.close();
  });

  it('muestra el gasto y las comidas ya transcurridas de la semana en curso', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const menuId = await semana(hogarId, '2026-11-01', '2026-11-07', { gastoReal: '180.50' });
    await comidas(hogarId, menuId, [
      { fecha: '2026-11-01', tiempo: 'ALMUERZO', costo: '20.00' },
      { fecha: '2026-11-04', tiempo: 'CENA', costo: '15.50' },
      { fecha: '2026-11-05', tiempo: 'ALMUERZO', costo: '30.00' },
      { fecha: '2026-11-06', tiempo: 'CENA', costo: null, sinPlatillo: true },
    ]);

    await bd.db.insert(menuTiempo).values([
      {
        menuId,
        tiempo: 'CENA',
        porcentaje: '40.00',
        presupuesto: '100.00',
        costoEstimado: '90.00',
      },
      {
        menuId,
        tiempo: 'DESAYUNO',
        porcentaje: '20.00',
        presupuesto: '50.00',
        costoEstimado: '20.00',
      },
    ]);

    const res = await http().get(`${API}/tablero`).set(con(token)).expect(200);

    expect(res.body.semanaActual.comidasDeHoy).toEqual([
      { tiempo: 'CENA', platillo: `Plato ${menuId}`, costoEstimado: '15.50' },
    ]);
    expect(res.body.semanaActual.tiempos).toEqual([
      { tiempo: 'DESAYUNO', presupuesto: '50.00', costoEstimado: '20.00' },
      { tiempo: 'CENA', presupuesto: '100.00', costoEstimado: '90.00' },
    ]);
    expect(res.body.hoy).toBe('2026-11-04');
    expect(res.body.semanaActual).toMatchObject({
      presupuesto: '250.00',
      gastoReal: '180.50',
      comidasPlanificadas: 3,
      comidasHastaHoy: 2,
      costoEstimadoHastaHoy: '35.50',
    });
  });

  it('sin menú en la semana en curso, semanaActual es null', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    await semana(hogarId, '2026-10-25', '2026-10-31', { gastoReal: '200.00' });

    const res = await http().get(`${API}/tablero`).set(con(token)).expect(200);

    expect(res.body.semanaActual).toBeNull();
    expect(res.body.historial).toHaveLength(1);
  });

  it('un borrador en la semana en curso no cuenta como semana actual', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    await semana(hogarId, '2026-11-01', '2026-11-07', {
      estado: 'BORRADOR',
      aprobadoEn: null,
      gastoReal: null,
    });

    const res = await http().get(`${API}/tablero`).set(con(token)).expect(200);

    expect(res.body.semanaActual).toBeNull();
  });

  it('el historial va de la más reciente a la más antigua, sin borradores y respeta ?semanas', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    await semana(hogarId, '2026-10-11', '2026-10-17', {
      estado: 'HISTORICO',
      presupuestoSemanal: null,
    });
    await semana(hogarId, '2026-10-18', '2026-10-24', { gastoReal: '215.75' });
    await semana(hogarId, '2026-10-25', '2026-10-31');
    await semana(hogarId, '2026-11-08', '2026-11-14', {
      estado: 'BORRADOR',
      aprobadoEn: null,
    });

    const todas = await http().get(`${API}/tablero`).set(con(token)).expect(200);
    expect(todas.body.historial.map((s: { fechaInicio: string }) => s.fechaInicio)).toEqual([
      '2026-10-25',
      '2026-10-18',
      '2026-10-11',
    ]);
    expect(todas.body.historial[2].presupuesto).toBeNull();

    const dos = await http().get(`${API}/tablero?semanas=2`).set(con(token)).expect(200);
    expect(dos.body.historial).toHaveLength(2);
  });

  it('cada hogar ve solo lo suyo', async () => {
    const a = await hogarDe('Ana');
    const b = await hogarDe('Beto');
    await semana(a.hogarId, '2026-11-01', '2026-11-07', { gastoReal: '99.00' });

    const res = await http().get(`${API}/tablero`).set(con(b.token)).expect(200);

    expect(res.body.semanaActual).toBeNull();
    expect(res.body.historial).toEqual([]);
  });

  it('401 sin sesión', async () => {
    await http().get(`${API}/tablero`).expect(401);
  });
});
