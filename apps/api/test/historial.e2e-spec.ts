import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import {
  eq,
  listaCompras,
  menuDetalle,
  menuSemanal,
  menuTiempo,
  miembroHogar,
  platillo,
} from '@menu/db';
import { diasSemanaHistorica } from '@menu/shared';
import { RELOJ_HISTORIAL } from '../src/historial/historial.service';
import { crearAppConBd, describeConBd, usarBaseDePruebas } from './utils/base-datos';

const API = '/api/v1/historial/semanas';
const NOMBRES = [
  'Pepián de pollo',
  'Pollo en crema',
  'Tortitas de carne',
  'Spaghetti con carne',
  'Caldo de res',
  'Pescado frito',
  'Chile relleno',
];
const HOY = new Date('2026-10-22T15:00:00Z');
describeConBd('HU-15 Captura de semanas históricas', () => {
  const bd = usarBaseDePruebas({ suite: 'historial', sembrar: false, truncarEntrePruebas: true });
  let app: INestApplication;
  let token: string;
  let hogarId: string;
  let platos: { id: string; nombre: string }[];
  const http = () => request(app.getHttpServer());
  const capturar = (datos: object, acceso = token) =>
    http().post(API).set('Authorization', `Bearer ${acceso}`).send(datos);
  const listado = (consulta = '', acceso = token) =>
    http().get(`${API}${consulta}`).set('Authorization', `Bearer ${acceso}`);
  const datos = (inicio = '2025-04-06') => ({
    fechaInicio: inicio,
    gastoReal: '248.50',
    notas: 'Semana del cuaderno',
    detalles: diasSemanaHistorica(inicio).map((fecha, i) => ({
      fecha,
      tiempo: 'ALMUERZO',
      platilloId: platos[i]!.id,
    })),
  });
  const crearHogar = async (correo: string) => {
    const cuenta = await http()
      .post('/api/v1/auth/registro')
      .send({ nombre: 'Familia', correo, contrasena: 'Almuerzo2026' })
      .expect(201);
    const hogar = await http()
      .post('/api/v1/hogares')
      .set('Authorization', `Bearer ${cuenta.body.accessToken}`)
      .send({ nombre: correo })
      .expect(201);
    return { token: hogar.body.accessToken as string, hogarId: hogar.body.hogar.id as string };
  };
  beforeAll(async () => {
    app = await crearAppConBd(bd.base, (b) =>
      b.overrideProvider(RELOJ_HISTORIAL).useValue(() => HOY),
    );
  });
  beforeEach(async () => {
    ({ token, hogarId } = await crearHogar('ana@correo.com'));
    platos = await bd.db
      .insert(platillo)
      .values(NOMBRES.map((nombre, i) => ({ hogarId, nombre, nombreNormalizado: `plato-${i}` })))
      .returning({ id: platillo.id, nombre: platillo.nombre });
  });
  afterAll(async () => {
    await app?.close();
  });

  it('CA-15.1 registra siete almuerzos y Q248.50 como Histórico, sin lista de compras', async () => {
    const res = await capturar(datos()).expect(201);
    expect(res.body).toMatchObject({
      estado: 'HISTORICO',
      origen: 'CAPTURA_MANUAL',
      fechaInicio: '2025-04-06',
      fechaFin: '2025-04-12',
      gastoReal: '248.50',
      version: 1,
    });
    expect(await bd.db.select().from(menuDetalle)).toHaveLength(7);
    expect(await bd.db.select().from(menuTiempo)).toHaveLength(1);
    expect(await bd.db.select().from(listaCompras)).toHaveLength(0);
    const consulta = await listado().expect(200);
    expect(consulta.body.paginacion.total).toBe(1);
    expect(consulta.body.datos[0].detalles.map((d: { nombre: string }) => d.nombre)).toEqual(
      NOMBRES,
    );
  });

  it('CA-15.2 exige confirmación y reemplaza una sola semana con control de versión', async () => {
    const original = await capturar({ ...datos('2025-04-13'), gastoReal: '224.00' }).expect(201);
    const nuevos = {
      ...datos('2025-04-13'),
      gastoReal: '231.00',
      detalles: datos('2025-04-13').detalles.slice(0, 1),
    };
    const conflicto = await capturar(nuevos).expect(409);
    expect(conflicto.body.codigo).toBe('SEMANA_EXISTENTE');
    expect(conflicto.body.semana.version).toBe(1);
    const res = await capturar({ ...nuevos, reemplazar: true, version: 1 }).expect(201);
    expect(res.body).toMatchObject({ id: original.body.id, gastoReal: '231.00', version: 2 });
    expect(await bd.db.select().from(menuSemanal)).toHaveLength(1);
    expect(await bd.db.select().from(menuDetalle)).toHaveLength(1);
    await capturar({ ...nuevos, reemplazar: true, version: 1 }).expect(409);
    expect((await listado()).body.datos[0].gastoReal).toBe('231.00');
  });

  it('CA-15.3 y CA-15.4 rechazan semanas no terminadas y gastos negativos', async () => {
    let res = await capturar(datos('2026-10-18')).expect(422);
    expect(res.body.detail).toBe('Solo se pueden capturar semanas terminadas');
    res = await capturar({ ...datos(), gastoReal: '-50' }).expect(422);
    expect(res.body.detail).toBe('El gasto debe ser un monto positivo en quetzales');
    expect(await bd.db.select().from(menuSemanal)).toHaveLength(0);
  });

  it('admite días vacíos, tres tiempos y gasto opcional aunque el hogar solo tenga almuerzo activo', async () => {
    const detalles = ['DESAYUNO', 'ALMUERZO', 'CENA'].map((tiempo) => ({
      fecha: '2025-04-06',
      tiempo,
      platilloId: platos[0]!.id,
    }));
    await capturar({ fechaInicio: '2025-04-06', detalles }).expect(201);
    expect((await listado()).body.datos[0]).toMatchObject({ gastoReal: null });
    expect(await bd.db.select().from(menuTiempo)).toHaveLength(3);
    expect(await bd.db.select().from(menuDetalle)).toHaveLength(3);
  });

  it('valida fechas, espacios duplicados y platillos antes de escribir', async () => {
    const d = datos();
    await capturar({ ...d, detalles: [] }).expect(422);
    await capturar({ ...d, fechaInicio: '2025-04-07' }).expect(422);
    await capturar({ ...d, detalles: [d.detalles[0], d.detalles[0]] }).expect(422);
    await capturar({ ...d, detalles: [{ ...d.detalles[0], fecha: '2025-04-13' }] }).expect(422);
    await capturar({ ...d, detalles: [{ ...d.detalles[0], platilloId: randomUUID() }] }).expect(
      422,
    );
    expect(await bd.db.select().from(menuSemanal)).toHaveLength(0);
  });

  it('aísla hogares y permite consultar, pero no capturar, a un miembro', async () => {
    await capturar(datos()).expect(201);
    const otra = await crearHogar('otra@correo.com');
    expect((await listado('', otra.token)).body.datos).toEqual([]);
    await capturar(datos(), otra.token).expect(422);
    await capturar({ ...datos(), hogarId }, otra.token).expect(400);
    const cuenta = await http()
      .post('/api/v1/auth/registro')
      .send({ nombre: 'Luis', correo: 'luis@correo.com', contrasena: 'Tamales2026' })
      .expect(201);
    await bd.db
      .insert(miembroHogar)
      .values({ hogarId, usuarioId: cuenta.body.usuario.id, rol: 'MIEMBRO' });
    await listado('', cuenta.body.accessToken).expect(200);
    await capturar(datos('2025-04-13'), cuenta.body.accessToken).expect(403);
  });

  it('dos capturas simultáneas crean una única semana y piden confirmar la otra', async () => {
    const res = await Promise.all([capturar(datos()), capturar(datos())]);
    expect(res.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await bd.db.select().from(menuSemanal)).toHaveLength(1);
  });

  it('dos reemplazos simultáneos no sobrescriben la versión ganadora', async () => {
    await capturar(datos()).expect(201);
    const res = await Promise.all([
      capturar({ ...datos(), reemplazar: true, version: 1, gastoReal: '231.00' }),
      capturar({ ...datos(), reemplazar: true, version: 1, gastoReal: '240.00' }),
    ]);
    expect(res.map((r) => r.status).sort()).toEqual([201, 409]);
    expect((await listado()).body.datos[0].version).toBe(2);
  });

  it('no convierte un menú aprobado en Histórico desde la captura manual', async () => {
    const [original] = await bd.db
      .insert(menuSemanal)
      .values({
        hogarId,
        fechaInicio: '2025-04-06',
        fechaFin: '2025-04-12',
        estado: 'APROBADO',
        aprobadoEn: HOY,
        presupuestoSemanal: '250.00',
      })
      .returning();
    const res = await capturar({ ...datos(), reemplazar: true, version: 1 }).expect(409);
    expect(res.body.codigo).toBe('SEMANA_PROTEGIDA');
    expect(
      (await bd.db.select().from(menuSemanal).where(eq(menuSemanal.id, original!.id)))[0],
    ).toEqual(original);
  });

  it('filtra, ordena y pagina el historial; rechaza rangos inválidos', async () => {
    await capturar(datos()).expect(201);
    await capturar(datos('2025-04-13')).expect(201);
    let res = await listado('?tamano=1&pagina=1').expect(200);
    expect(res.body.paginacion).toMatchObject({ total: 2, totalPaginas: 2 });
    expect(res.body.datos[0].fechaInicio).toBe('2025-04-13');
    res = await listado('?desde=2025-04-06&hasta=2025-04-12').expect(200);
    expect(res.body.datos).toHaveLength(1);
    await listado('?desde=2025-02-31').expect(422);
    await listado('?desde=2025-05-01&hasta=2025-04-01').expect(422);
    await listado('?pagina=0').expect(400);
  });

  it('no solapa un menú registrado con otro día de inicio', async () => {
    await bd.db
      .insert(menuSemanal)
      .values({ hogarId, fechaInicio: '2025-04-07', fechaFin: '2025-04-13', estado: 'HISTORICO' });
    const res = await capturar(datos()).expect(409);
    expect(res.body.codigo).toBe('SEMANA_SOLAPADA');
    expect(await bd.db.select().from(menuSemanal)).toHaveLength(1);
  });
});
