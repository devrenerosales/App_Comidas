import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { eq, configuracion, menuSemanal, miembroHogar } from '@menu/db';
import { RELOJ_CONFIGURACION } from '../src/configuracion/configuracion.constants';
import { crearAppConBd, describeConBd, usarBaseDePruebas } from './utils/base-datos';

const BASE = '/api/v1/hogar/configuracion';
const HOY = new Date('2026-10-22T15:00:00Z');
const CAMBIO = { version: 1, diaInicioSemana: 'LUNES', diaPlanificacion: 'SABADO' };

describeConBd('HU-08 Inicio de semana y planificación', () => {
  const bd = usarBaseDePruebas({ suite: 'semana', sembrar: false, truncarEntrePruebas: true });
  let app: INestApplication;
  let token: string;
  let hogarId: string;
  const http = () => request(app.getHttpServer());
  const guardar = (datos = CAMBIO, acceso = token) =>
    http().put(`${BASE}/semana`).set('Authorization', `Bearer ${acceso}`).send(datos);
  const leer = () => http().get(BASE).set('Authorization', `Bearer ${token}`);
  const aprobado = async (desde = '2026-10-18', hasta = '2026-10-24') => {
    const [fila] = await bd.db
      .insert(menuSemanal)
      .values({
        hogarId,
        fechaInicio: desde,
        fechaFin: hasta,
        estado: 'APROBADO',
        presupuestoSemanal: '250.00',
        aprobadoEn: HOY,
      })
      .returning();
    return fila!;
  };
  beforeAll(async () => {
    app = await crearAppConBd(bd.base, (b) =>
      b.overrideProvider(RELOJ_CONFIGURACION).useValue(() => HOY),
    );
  });
  beforeEach(async () => {
    const registro = await http()
      .post('/api/v1/auth/registro')
      .send({ nombre: 'Ana', correo: 'ana@correo.com', contrasena: 'Almuerzo2026' })
      .expect(201);
    const hogar = await http()
      .post('/api/v1/hogares')
      .set('Authorization', `Bearer ${registro.body.accessToken}`)
      .send({ nombre: 'Familia Rosales' })
      .expect(201);
    token = hogar.body.accessToken;
    hogarId = hogar.body.hogar.id;
  });
  afterAll(async () => {
    await app?.close();
  });

  it('CA-08.1 valores por defecto y próxima semana domingo a sábado', async () => {
    const res = await leer().expect(200);
    expect(res.body).toMatchObject({
      diaInicioSemana: 'DOMINGO',
      diaPlanificacion: 'DOMINGO',
      proximaSemana: { desde: '2026-10-25', hasta: '2026-10-31' },
      semanaTransicion: null,
    });
  });

  it('CA-08.2 vista previa sin escrituras; guarda transición de un día y conserva aprobado', async () => {
    const original = await aprobado();
    const previa = await http()
      .post(`${BASE}/semana/vista-previa`)
      .set('Authorization', `Bearer ${token}`)
      .send(CAMBIO)
      .expect(200);
    expect(previa.body).toMatchObject({
      semanaTransicion: { desde: '2026-10-25', hasta: '2026-10-25' },
      proximaSemana: { desde: '2026-10-26', hasta: '2026-11-01' },
    });
    expect(await bd.db.select().from(menuSemanal)).toHaveLength(1);
    const res = await guardar().expect(200);
    expect(res.body.version).toBe(2);
    expect(res.body.semanaTransicion).toEqual(previa.body.semanaTransicion);
    const filas = await bd.db.select().from(menuSemanal);
    expect(filas.find((m) => m.id === original.id)).toEqual(original);
    expect(filas.find((m) => m.esTransicion)).toMatchObject({
      fechaInicio: '2026-10-25',
      fechaFin: '2026-10-25',
      estado: 'BORRADOR',
      configuracionVersion: 2,
      desactualizado: false,
    });
    expect((await leer()).body.proximaSemana).toEqual(res.body.proximaSemana);
    await guardar({ ...CAMBIO, version: 2 }).expect(200);
    expect(await bd.db.select().from(menuSemanal)).toHaveLength(2);
  });

  it('CA-08.3 elige sábado y conserva la hora para el futuro recordatorio', async () => {
    const res = await guardar({ ...CAMBIO, diaInicioSemana: 'DOMINGO' }).expect(200);
    expect(res.body).toMatchObject({
      diaPlanificacion: 'SABADO',
      proximaPlanificacion: '2026-10-24',
      horaPlanificacion: 8,
      semanaTransicion: null,
    });
    expect(await bd.db.select().from(menuSemanal)).toHaveLength(0);
  });

  it('CA-08.4 un miembro puede leer pero no guardar ni pedir vista previa', async () => {
    const cuenta = await http()
      .post('/api/v1/auth/registro')
      .send({ nombre: 'Luis', correo: 'luis@correo.com', contrasena: 'Tamales2026' })
      .expect(201);
    await bd.db
      .insert(miembroHogar)
      .values({ hogarId, usuarioId: cuenta.body.usuario.id, rol: 'MIEMBRO' });
    const res = await guardar(CAMBIO, cuenta.body.accessToken).expect(403);
    expect(res.body.detail).toBe('Solo el administrador puede cambiar esta configuración');
    await http()
      .post(`${BASE}/semana/vista-previa`)
      .set('Authorization', `Bearer ${cuenta.body.accessToken}`)
      .send(CAMBIO)
      .expect(403);
    await http().get(BASE).set('Authorization', `Bearer ${cuenta.body.accessToken}`).expect(200);
  });

  it('rechaza días inválidos, campos ajenos y versiones obsoletas sin guardar', async () => {
    await guardar({ ...CAMBIO, diaInicioSemana: 'OTRO' }).expect(422);
    await http()
      .put(`${BASE}/semana`)
      .set('Authorization', `Bearer ${token}`)
      .send({ ...CAMBIO, hogarId })
      .expect(400);
    await guardar({ ...CAMBIO, version: 99 }).expect(409);
    expect((await leer()).body.version).toBe(1);
  });

  it('dos administradores con la misma versión: uno guarda y el otro recibe 409', async () => {
    const respuestas = await Promise.all([
      guardar(),
      guardar({ ...CAMBIO, diaInicioSemana: 'MARTES' }),
    ]);
    expect(respuestas.map((r) => r.status).sort()).toEqual([200, 409]);
    const [c] = await bd.db.select().from(configuracion).where(eq(configuracion.hogarId, hogarId));
    expect(c?.version).toBe(2);
  });

  it('no sobrescribe un borrador que ocupa la transición y revierte la configuración', async () => {
    await aprobado();
    const [borrador] = await bd.db
      .insert(menuSemanal)
      .values({ hogarId, fechaInicio: '2026-10-25', fechaFin: '2026-10-31' })
      .returning();
    const res = await guardar().expect(409);
    expect(res.body.codigo).toBe('SEMANA_EN_CONFLICTO');
    expect((await leer()).body.version).toBe(1);
    expect(
      (await bd.db.select().from(menuSemanal).where(eq(menuSemanal.id, borrador!.id)))[0],
    ).toEqual(borrador);
  });

  it('permite corregir de nuevo el inicio ajustando una transición vacía sin duplicarla', async () => {
    await aprobado();
    await guardar().expect(200);
    await guardar({ ...CAMBIO, version: 2, diaInicioSemana: 'MARTES' }).expect(200);
    let filas = await bd.db.select().from(menuSemanal);
    expect(filas).toHaveLength(2);
    expect(filas.find((m) => m.esTransicion)?.fechaFin).toBe('2026-10-26');
    await guardar({ ...CAMBIO, version: 3, diaInicioSemana: 'DOMINGO' }).expect(200);
    filas = await bd.db.select().from(menuSemanal);
    expect(filas).toHaveLength(2);
    expect(filas.find((m) => m.estado === 'BORRADOR')).toMatchObject({
      fechaInicio: '2026-10-25',
      fechaFin: '2026-10-31',
      esTransicion: false,
    });
  });
});
