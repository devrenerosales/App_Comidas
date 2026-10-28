import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  eq,
  importacionPlatillo,
  menuDetalle,
  menuSemanal,
  platillo,
  platilloAlias,
  platilloTiempo,
} from '@menu/db';
import { diasSemanaHistorica } from '@menu/shared';
import { RELOJ_IMPORTACIONES } from '../src/importaciones/importaciones.controller';
import { crearAppConBd, describeConBd, usarBaseDePruebas } from './utils/base-datos';
const API = '/api/v1/importaciones';
const SEMANA = '2025-04-06';
describeConBd('HU-17 Resolver platillos nuevos al importar', () => {
  const bd = usarBaseDePruebas({
    suite: 'importaciones-platillos',
    sembrar: false,
    truncarEntrePruebas: true,
  });
  let app: INestApplication;
  let token: string;
  let hogarId: string;
  const http = () => request(app.getHttpServer());
  const crearHogar = async (correo = 'ana@correo.com') => {
    const cuenta = await http()
      .post('/api/v1/auth/registro')
      .send({ nombre: 'Familia', correo, contrasena: 'Almuerzo2026' })
      .expect(201);
    const res = await http()
      .post('/api/v1/hogares')
      .set('Authorization', `Bearer ${cuenta.body.accessToken}`)
      .send({ nombre: correo })
      .expect(201);
    return { token: res.body.accessToken as string, hogarId: res.body.hogar.id as string };
  };
  const catalogo = async (nombre: string, normalizado: string, propietario = hogarId) => {
    const [p] = await bd.db
      .insert(platillo)
      .values({ hogarId: propietario, nombre, nombreNormalizado: normalizado })
      .returning();
    return p!.id;
  };
  /** Un día por platillo en la semana domingo–sábado del 2025-04-06, todos en almuerzo. */
  const csv = (...filas: [platillo: string, proteina?: string][]) =>
    'fecha,tiempo_comida,platillo,proteina_principal\n' +
    filas
      .map(
        ([nombre, proteina], i) =>
          `${diasSemanaHistorica(SEMANA)[i]},almuerzo,${nombre},${proteina ?? ''}`,
      )
      .join('\n');
  const cargar = (contenido: string, acceso = token) =>
    http()
      .post(API)
      .set('Authorization', `Bearer ${acceso}`)
      .field('origen', 'ARCHIVO')
      .attach('archivo', Buffer.from(contenido), 'menus.csv');
  const consultar = (id: string, acceso = token) =>
    http().get(`${API}/${id}`).set('Authorization', `Bearer ${acceso}`);
  const platillos = (id: string, estado = 'todos', acceso = token) =>
    http().get(`${API}/${id}/platillos?estado=${estado}`).set('Authorization', `Bearer ${acceso}`);
  const decidir = (id: string, revision: string, cuerpo: object, acceso = token) =>
    http()
      .put(`${API}/${id}/platillos`)
      .set('Authorization', `Bearer ${acceso}`)
      .send({ revision, ...cuerpo });
  const confirmar = (id: string, revision: string, acceso = token) =>
    http()
      .post(`${API}/${id}/confirmar`)
      .set('Authorization', `Bearer ${acceso}`)
      .send({ revision });
  beforeAll(async () => {
    app = await crearAppConBd(bd.base, (b) =>
      b.overrideProvider(RELOJ_IMPORTACIONES).useValue(() => new Date('2026-10-26T15:00:00Z')),
    );
  });
  beforeEach(async () => {
    ({ token, hogarId } = await crearHogar());
  });
  afterAll(async () => {
    await app?.close();
  });

  it('CA-17.1 asocia sin preguntar un nombre que coincide tras normalizar', async () => {
    const id = await catalogo('Pepián de pollo', 'pepian de pollo');
    const r = await cargar(csv(['pepian  de Pollo'])).expect(201);
    expect(r.body).toMatchObject({ pendientes: [], puedeConfirmar: true });
    const lista = await platillos(r.body.id).expect(200);
    expect(lista.body.datos).toEqual([
      expect.objectContaining({ decision: 'ASOCIAR', automatica: true, platilloId: id }),
    ]);
    expect((await platillos(r.body.id, 'pendientes').expect(200)).body.datos).toEqual([]);
    expect((await platillos(r.body.id, 'revisar').expect(200)).body.datos).toEqual([]);
    const final = await confirmar(r.body.id, r.body.revision).expect(201);
    expect(final.body).toMatchObject({ platillosCreados: 0, aliasCreados: 0 });
    expect(await bd.db.select().from(platillo)).toHaveLength(1);
    expect(await bd.db.select().from(platilloAlias)).toHaveLength(0);
  });

  it('CA-17.2 propone asociar a un parecido, lo guarda como alias y lo recuerda después', async () => {
    const id = await catalogo('Pepián de pollo', 'pepian de pollo');
    const r = await cargar(csv(['Pepian de pollos'])).expect(201);
    expect(r.body).toMatchObject({ pendientes: ['Pepian de pollos'], puedeConfirmar: false });
    const lista = await platillos(r.body.id, 'pendientes').expect(200);
    expect(lista.body.resumen).toEqual({ total: 1, pendientes: 1 });
    expect(lista.body.datos[0]).toMatchObject({
      decision: 'PENDIENTE',
      propuesta: { accion: 'ASOCIAR', platilloId: id, platillo: 'Pepián de pollo' },
    });
    expect(lista.body.datos[0].propuesta.similitud).toBeGreaterThanOrEqual(0.8);
    const resuelta = await decidir(r.body.id, r.body.revision, { aceptarPropuestas: true }).expect(
      200,
    );
    expect(resuelta.body).toMatchObject({ pendientes: [], puedeConfirmar: true });
    expect(resuelta.body.revision).not.toBe(r.body.revision);
    const final = await confirmar(r.body.id, resuelta.body.revision).expect(201);
    expect(final.body).toMatchObject({ platillosCreados: 0, aliasCreados: 1 });
    const comidas = await bd.db.select().from(menuDetalle);
    expect(comidas).toHaveLength(1);
    expect(comidas[0]!.platilloId).toBe(id);
    expect(await bd.db.select().from(platilloAlias)).toEqual([
      expect.objectContaining({
        platilloId: id,
        alias: 'Pepian de pollos',
        aliasNormalizado: 'pepian de pollos',
        origen: 'IMPORTACION',
      }),
    ]);
    // Una importación posterior reconoce el alias sin preguntar.
    await bd.db.delete(menuDetalle);
    await bd.db.delete(menuSemanal);
    const otra = await cargar(csv(['Pepian de pollos'])).expect(201);
    expect(otra.body).toMatchObject({ pendientes: [], puedeConfirmar: true });
  });

  it('CA-17.3 propone crear sin parecido y crea el platillo incompleto con su proteína y tiempo', async () => {
    await catalogo('Sopa', 'sopa');
    const r = await cargar(csv(['Hilachas', 'res'])).expect(201);
    const lista = await platillos(r.body.id, 'pendientes').expect(200);
    expect(lista.body.datos[0]).toMatchObject({
      nombreOriginal: 'Hilachas',
      propuesta: { accion: 'CREAR', platilloId: null },
    });
    const resuelta = await decidir(r.body.id, r.body.revision, { aceptarPropuestas: true }).expect(
      200,
    );
    expect(await bd.db.select().from(platillo)).toHaveLength(1);
    const final = await confirmar(r.body.id, resuelta.body.revision).expect(201);
    expect(final.body).toMatchObject({ platillosCreados: 1, aliasCreados: 0 });
    const [nuevo] = await bd.db
      .select()
      .from(platillo)
      .where(eq(platillo.nombreNormalizado, 'hilachas'));
    expect(nuevo).toMatchObject({
      hogarId,
      nombre: 'Hilachas',
      proteinaPrincipal: 'RES',
      incompleto: true,
      activo: true,
    });
    expect(
      await bd.db.select().from(platilloTiempo).where(eq(platilloTiempo.platilloId, nuevo!.id)),
    ).toEqual([{ platilloId: nuevo!.id, tiempo: 'ALMUERZO' }]);
    expect((await bd.db.select().from(menuDetalle))[0]!.platilloId).toBe(nuevo!.id);
  });

  it('CA-17.4 no importa con nombres sin resolver y dice cuántos faltan', async () => {
    const r = await cargar(csv(['Hilachas'], ['Rellenitos'])).expect(201);
    expect(r.body.pendientes).toEqual(['Hilachas', 'Rellenitos']);
    const rechazo = await confirmar(r.body.id, r.body.revision).expect(422);
    expect(rechazo.body).toMatchObject({
      codigo: 'PLATILLOS_PENDIENTES',
      detail: 'Faltan 2 platillos por resolver',
    });
    expect(await bd.db.select().from(menuSemanal)).toHaveLength(0);
    expect(await bd.db.select().from(platillo)).toHaveLength(0);
  });

  it('permite corregir el nombre al crear y recuerda el escrito en el archivo como alias', async () => {
    const r = await cargar(csv(['Hilachs'])).expect(201);
    const resuelta = await decidir(r.body.id, r.body.revision, {
      decisiones: [{ nombreNormalizado: 'hilachs', decision: 'CREAR', nombreFinal: 'Hilachas' }],
    }).expect(200);
    const final = await confirmar(r.body.id, resuelta.body.revision).expect(201);
    expect(final.body).toMatchObject({ platillosCreados: 1, aliasCreados: 1 });
    const [nuevo] = await bd.db.select().from(platillo);
    expect(nuevo).toMatchObject({ nombre: 'Hilachas', nombreNormalizado: 'hilachas' });
    expect(await bd.db.select().from(platilloAlias)).toEqual([
      expect.objectContaining({ platilloId: nuevo!.id, aliasNormalizado: 'hilachs' }),
    ]);
  });

  it('permite elegir otro platillo del catálogo para asociar', async () => {
    await catalogo('Sopa', 'sopa');
    const caldo = await catalogo('Caldo de res', 'caldo de res');
    const r = await cargar(csv(['Consomé'])).expect(201);
    const resuelta = await decidir(r.body.id, r.body.revision, {
      decisiones: [{ nombreNormalizado: 'consome', decision: 'ASOCIAR', platilloId: caldo }],
    }).expect(200);
    expect(resuelta.body.puedeConfirmar).toBe(true);
    expect((await confirmar(r.body.id, resuelta.body.revision).expect(201)).body).toMatchObject({
      aliasCreados: 1,
    });
    expect((await bd.db.select().from(menuDetalle))[0]!.platilloId).toBe(caldo);
  });

  it('rechaza nombres en uso, platillos ajenos o inactivos, vistas viejas y cambios a lo automático', async () => {
    await catalogo('Sopa', 'sopa');
    const inactivo = await catalogo('Caldo viejo', 'caldo viejo');
    await bd.db.update(platillo).set({ activo: false }).where(eq(platillo.id, inactivo));
    const otro = await crearHogar('otra@correo.com');
    const ajeno = await catalogo('Ajeno', 'ajeno', otro.hogarId);
    const r = await cargar(csv(['Hilachas'], ['sopa'])).expect(201);
    const base = { nombreNormalizado: 'hilachas' };
    const caso = (decision: object) =>
      decidir(r.body.id, r.body.revision, { decisiones: [{ ...base, ...decision }] });
    expect((await caso({ decision: 'CREAR', nombreFinal: 'SOPA' }).expect(409)).body.codigo).toBe(
      'NOMBRE_EN_USO',
    );
    await caso({ decision: 'ASOCIAR', platilloId: ajeno }).expect(422);
    await caso({ decision: 'ASOCIAR', platilloId: inactivo }).expect(422);
    await caso({ decision: 'ASOCIAR' }).expect(422);
    await decidir(r.body.id, r.body.revision, {
      decisiones: [{ nombreNormalizado: 'sopa', decision: 'CREAR' }],
    }).expect(422);
    await decidir(r.body.id, r.body.revision, {}).expect(422);
    await decidir(r.body.id, '8f0c8d46-60b6-4d4e-9a1b-5b6a6a6f2c11', {
      aceptarPropuestas: true,
    }).expect(409);
    // Nada de lo anterior modificó la importación.
    const filas = await bd.db.select().from(importacionPlatillo);
    expect(filas.filter((f) => f.decision === 'PENDIENTE')).toHaveLength(1);
  });

  it('no crea platillos de semanas omitidas y falla si el catálogo cambió antes de confirmar', async () => {
    const r = await cargar(csv(['Hilachas'])).expect(201);
    const resuelta = await decidir(r.body.id, r.body.revision, { aceptarPropuestas: true }).expect(
      200,
    );
    await catalogo('Hilachas', 'hilachas');
    const choque = await confirmar(r.body.id, resuelta.body.revision).expect(409);
    expect(choque.body.codigo).toBe('CATALOGO_MODIFICADO');
    expect(await bd.db.select().from(platillo)).toHaveLength(1);
    expect(await bd.db.select().from(menuSemanal)).toHaveLength(0);
    expect((await consultar(r.body.id).expect(200)).body.estado).toBe('VISTA_PREVIA');
  });

  it('aísla por hogar y exige rol de administrador', async () => {
    const r = await cargar(csv(['Hilachas'])).expect(201);
    const otro = await crearHogar('otra@correo.com');
    await platillos(r.body.id, 'todos', otro.token).expect(404);
    await decidir(r.body.id, r.body.revision, { aceptarPropuestas: true }, otro.token).expect(404);
    await http().get(`${API}/${r.body.id}/platillos`).expect(401);
    await platillos('invalido').expect(400);
  });
});
