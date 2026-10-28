import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  eq,
  menuSemanal,
  menuDetalle,
  importacionFila,
  miembroHogar,
  platillo,
  platilloAlias,
} from '@menu/db';
import { diasSemanaHistorica } from '@menu/shared';
import { RELOJ_IMPORTACIONES } from '../src/importaciones/importaciones.controller';
import { crearAppConBd, describeConBd, usarBaseDePruebas } from './utils/base-datos';
const API = '/api/v1/importaciones';
describeConBd('HU-16 Importaciones de menús', () => {
  const bd = usarBaseDePruebas({
    suite: 'importaciones',
    sembrar: false,
    truncarEntrePruebas: true,
  });
  let app: INestApplication;
  let token: string;
  let hogarId: string;
  let platilloId: string;
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
  const csv = () =>
    'fecha,tiempo_comida,platillo,gasto_semana_gtq,notas\n' +
    ['2025-04-06', '2025-04-13', '2025-04-20']
      .flatMap((s, i) =>
        diasSemanaHistorica(s).map(
          (f) => `${f},almuerzo,Sopa,${['224', '241.75', '265'][i]},Nota importada`,
        ),
      )
      .join('\n');
  const cargar = (contenido = csv(), acceso = token) =>
    http()
      .post(API)
      .set('Authorization', `Bearer ${acceso}`)
      .field('origen', 'ARCHIVO')
      .attach('archivo', Buffer.from(contenido), 'menus.csv');
  const consultar = (id: string, acceso = token) =>
    http().get(`${API}/${id}`).set('Authorization', `Bearer ${acceso}`);
  const confirmar = (id: string, revision: string, acceso = token) =>
    http()
      .post(`${API}/${id}/confirmar`)
      .set('Authorization', `Bearer ${acceso}`)
      .send({ revision });
  const decidir = (id: string, revision: string, semanaInicio = '2025-04-13') =>
    http()
      .put(`${API}/${id}/semanas`)
      .set('Authorization', `Bearer ${token}`)
      .send({ revision, decisiones: [{ semanaInicio, decision: 'REEMPLAZAR' }] });
  const existente = async (inicio = '2025-04-13') => {
    const res = await http()
      .post('/api/v1/historial/semanas')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fechaInicio: inicio,
        gastoReal: '224.00',
        detalles: [{ fecha: inicio, tiempo: 'ALMUERZO', platilloId }],
      })
      .expect(201);
    return res.body as { id: string; version: number };
  };
  beforeAll(async () => {
    app = await crearAppConBd(bd.base, (b) =>
      b.overrideProvider(RELOJ_IMPORTACIONES).useValue(() => new Date('2026-10-26T15:00:00Z')),
    );
  });
  beforeEach(async () => {
    ({ token, hogarId } = await crearHogar());
    const [p] = await bd.db
      .insert(platillo)
      .values({ hogarId, nombre: 'Sopa', nombreNormalizado: 'sopa' })
      .returning();
    platilloId = p!.id;
  });
  afterAll(async () => {
    await app?.close();
  });

  it('CA-16.1 prepara sin guardar y confirma 21 comidas, tres gastos y origen importación; repetir no duplica', async () => {
    const r = await cargar().expect(201);
    expect(r.body).toMatchObject({ totalFilas: 21, filasConError: 0, puedeConfirmar: true });
    expect(await bd.db.select().from(menuSemanal)).toHaveLength(0);
    const final = await confirmar(r.body.id, r.body.revision).expect(201);
    expect(final.body).toMatchObject({ semanasCreadas: 3, reemplazadas: 0, omitidas: 0 });
    const menus = await bd.db.select().from(menuSemanal).orderBy(menuSemanal.fechaInicio);
    expect(menus.map((s) => s.gastoReal)).toEqual(['224.00', '241.75', '265.00']);
    expect(
      menus.every(
        (s) =>
          s.estado === 'HISTORICO' && s.origen === 'IMPORTACION' && s.importacionId === r.body.id,
      ),
    ).toBe(true);
    const comidas = await bd.db.select().from(menuDetalle);
    expect(comidas).toHaveLength(21);
    expect(comidas.every((c) => c.notas === 'Nota importada')).toBe(true);
    expect((await confirmar(r.body.id, r.body.revision).expect(201)).body).toEqual(final.body);
    expect((await consultar(r.body.id).expect(200)).body).toMatchObject({
      estado: 'CONFIRMADA',
      puedeConfirmar: false,
      reporte: final.body,
    });
  });
  it('CA-16.2 omite la existente y conserva monto y comidas originales', async () => {
    const original = await existente();
    const r = await cargar().expect(201);
    expect(r.body.semanas[1]).toMatchObject({
      decision: 'OMITIR',
      existente: { id: original.id, gastoReal: '224.00' },
      puedeReemplazar: true,
    });
    expect((await confirmar(r.body.id, r.body.revision).expect(201)).body).toMatchObject({
      semanasCreadas: 2,
      omitidas: 1,
    });
    const [s] = await bd.db.select().from(menuSemanal).where(eq(menuSemanal.id, original.id));
    expect(s).toMatchObject({ gastoReal: '224.00', version: 1, origen: 'CAPTURA_MANUAL' });
    expect(
      await bd.db.select().from(menuDetalle).where(eq(menuDetalle.menuId, original.id)),
    ).toHaveLength(1);
  });
  it('dos confirmaciones simultáneas guardan cada semana una sola vez', async () => {
    const r = await cargar().expect(201);
    const [a, b] = await Promise.all([
      confirmar(r.body.id, r.body.revision),
      confirmar(r.body.id, r.body.revision),
    ]);
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(a.body).toEqual(b.body);
    expect(await bd.db.select().from(menuSemanal)).toHaveLength(3);
    expect(await bd.db.select().from(menuDetalle)).toHaveLength(21);
    await http()
      .post(`${API}/${r.body.id}/cancelar`)
      .set('Authorization', `Bearer ${token}`)
      .send({ revision: r.body.revision })
      .expect(409);
  });
  it('reemplaza solo después de decidir con revisión vigente', async () => {
    const original = await existente();
    const r = await cargar().expect(201);
    const d = await decidir(r.body.id, r.body.revision).expect(200);
    await confirmar(r.body.id, r.body.revision).expect(409);
    await decidir(r.body.id, r.body.revision).expect(409);
    expect((await confirmar(r.body.id, d.body.revision).expect(201)).body).toMatchObject({
      semanasCreadas: 2,
      reemplazadas: 1,
    });
    const [s] = await bd.db.select().from(menuSemanal).where(eq(menuSemanal.id, original.id));
    expect(s).toMatchObject({ gastoReal: '241.75', version: 2, origen: 'IMPORTACION' });
    expect(
      await bd.db.select().from(menuDetalle).where(eq(menuDetalle.menuId, original.id)),
    ).toHaveLength(7);
  });
  it('CA-16.3 reporta fila y columna, bloquea todo y pagina errores', async () => {
    const lineas = csv().split('\n');
    lineas[7] = lineas[7]!.replace('almuerzo', 'almuerso');
    lineas[11] = lineas[11]!.replace('2025-04-16', '2025-02-30');
    const r = await cargar(lineas.join('\n')).expect(201);
    expect(r.body).toMatchObject({
      estado: 'CON_ERRORES',
      filasConError: 2,
      puedeConfirmar: false,
    });
    const e = await http()
      .get(`${API}/${r.body.id}/filas?soloErrores=true&tamano=1&pagina=2`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(e.body.paginacion).toMatchObject({ total: 2, totalPaginas: 2 });
    expect(e.body.datos[0]).toMatchObject({
      numeroFila: 12,
      errores: [{ columna: 'fecha', motivo: 'fecha inválida' }],
    });
    await confirmar(r.body.id, r.body.revision).expect(422);
    expect(await bd.db.select().from(menuSemanal)).toHaveLength(0);
  });
  it('CA-16.4 falta platillo y CA-16.5 gastos inconsistentes', async () => {
    const error = await cargar('fecha,tiempo_comida\n2025-04-06,almuerzo').expect(422);
    expect(error.body.detail).toContain('Falta la columna obligatoria: platillo');
    const r = await cargar(
      'fecha,tiempo_comida,platillo,gasto_semana_gtq\n2025-04-06,almuerzo,Sopa,224\n2025-04-07,almuerzo,Sopa,241',
    ).expect(201);
    expect(r.body.filasConError).toBe(2);
    await confirmar(r.body.id, r.body.revision).expect(422);
  });
  it('cancela descartando filas, permite repetir y no confirma una cancelación', async () => {
    const r = await cargar().expect(201);
    const cancelar = () =>
      http()
        .post(`${API}/${r.body.id}/cancelar`)
        .set('Authorization', `Bearer ${token}`)
        .send({ revision: r.body.revision });
    expect((await cancelar().expect(201)).body.estado).toBe('CANCELADA');
    await cancelar().expect(201);
    await confirmar(r.body.id, r.body.revision).expect(409);
    expect(await bd.db.select().from(importacionFila)).toHaveLength(0);
    expect(await bd.db.select().from(menuSemanal)).toHaveLength(0);
  });
  it('si cambia la semana existente revierte también las semanas nuevas anteriores', async () => {
    const original = await existente();
    const r = await cargar().expect(201);
    const d = await decidir(r.body.id, r.body.revision).expect(200);
    await bd.db.update(menuSemanal).set({ version: 2 }).where(eq(menuSemanal.id, original.id));
    await confirmar(r.body.id, d.body.revision).expect(409);
    expect(await bd.db.select().from(menuSemanal)).toHaveLength(1);
    expect((await consultar(r.body.id).expect(200)).body.estado).toBe('VISTA_PREVIA');
  });
  it('si apareció una semana después de la vista previa no sobrescribe ni crea parcialmente', async () => {
    const r = await cargar().expect(201);
    await existente();
    await confirmar(r.body.id, r.body.revision).expect(409);
    expect(await bd.db.select().from(menuSemanal)).toHaveLength(1);
  });
  it('protege semanas no históricas y rechaza decisiones ajenas al archivo', async () => {
    const original = await existente();
    await bd.db
      .update(menuSemanal)
      .set({
        estado: 'BORRADOR',
        gastoReal: null,
        gastoRegistradoPorId: null,
        gastoRegistradoEn: null,
      })
      .where(eq(menuSemanal.id, original.id));
    const r = await cargar().expect(201);
    expect(r.body.semanas[1].puedeReemplazar).toBe(false);
    await decidir(r.body.id, r.body.revision).expect(409);
    await decidir(r.body.id, r.body.revision, '2025-01-01').expect(422);
  });
  it('deja desconocidos pendientes y resuelve aliases exactos del hogar', async () => {
    const r = await cargar(csv().replaceAll('Sopa', 'Caldito')).expect(201);
    expect(r.body.pendientes).toEqual(['Caldito']);
    await confirmar(r.body.id, r.body.revision).expect(422);
    await bd.db
      .insert(platilloAlias)
      .values({ hogarId, platilloId, alias: 'Caldito', aliasNormalizado: 'caldito' });
    const siguiente = await cargar(csv().replaceAll('Sopa', 'Caldito')).expect(201);
    expect(siguiente.body.puedeConfirmar).toBe(true);
    await confirmar(siguiente.body.id, siguiente.body.revision).expect(201);
  });
  it('aísla hogares y permite importar solo al administrador', async () => {
    const r = await cargar().expect(201);
    const otro = await crearHogar('otra@correo.com');
    await consultar(r.body.id, otro.token).expect(404);
    await confirmar(r.body.id, r.body.revision, otro.token).expect(404);
    const ajeno = await cargar(csv().replaceAll('Sopa', 'Ajeno'), otro.token).expect(201);
    expect(ajeno.body.pendientes).toEqual(['Ajeno']);
    await bd.db
      .update(miembroHogar)
      .set({ rol: 'MIEMBRO' })
      .where(eq(miembroHogar.hogarId, hogarId));
    await cargar().expect(403);
    await consultar(r.body.id).expect(403);
  });
  it('descarga plantillas autenticadas y rechaza solicitudes incompletas', async () => {
    const plantilla = await http()
      .get(`${API}/plantilla?formato=csv`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(plantilla.headers['content-disposition']).toContain('plantilla-menus.csv');
    expect(plantilla.text).toContain('fecha,dia,tiempo_comida,platillo');
    await http()
      .get(`${API}/plantilla?formato=pdf`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
    await http()
      .post(API)
      .set('Authorization', `Bearer ${token}`)
      .send({ origen: 'ARCHIVO' })
      .expect(400);
    await consultar('invalido').expect(400);
    await http()
      .get(API + '/plantilla?formato=csv')
      .expect(401);
  });
});
