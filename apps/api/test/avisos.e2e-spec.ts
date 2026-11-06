/**
 * HU-38 Avisos de precios para el administrador — integración contra PostgreSQL real
 * (TEST_DATABASE_URL). Cubre `GET /avisos` y `POST /avisos/{id}/leido`: solo el administrador,
 * solo los avisos de su hogar (RNF-06) y el filtro de no leídos.
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { aviso, sql } from '@menu/db';
import { crearAppConBd, describeConBd, usarBaseDePruebas } from './utils/base-datos';

const API = '/api/v1';

describeConBd('HU-38 Avisos de precios (integración)', () => {
  const bd = usarBaseDePruebas({ suite: 'avisos', sembrar: true, truncarEntrePruebas: true });
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

  const crearAviso = async (
    hogarId: string,
    mensaje: string,
    tipo: 'CORRIDA_PARCIAL' | 'CORRIDA_FALLIDA' | 'SITIO_BLOQUEADO' = 'CORRIDA_PARCIAL',
    createdAt = new Date(),
  ) => {
    const [a] = await bd.db
      .insert(aviso)
      .values({ hogarId, tipo, titulo: 'Paiz', mensaje, createdAt })
      .returning();
    return a!.id;
  };

  beforeAll(async () => {
    app = await crearAppConBd(bd.base);
  });
  afterAll(async () => {
    await app?.close();
  });

  it('CA-38.2 el administrador ve los avisos de su hogar, los más recientes primero', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    await crearAviso(
      hogarId,
      'Walmart: 3 productos sin actualizar',
      'CORRIDA_PARCIAL',
      new Date('2026-10-24T21:00:00Z'),
    );
    await crearAviso(
      hogarId,
      'Paiz: 50 productos sin actualizar',
      'CORRIDA_FALLIDA',
      new Date('2026-10-25T21:00:00Z'),
    );

    const res = await http().get(`${API}/avisos`).set(con(token)).expect(200);

    expect(res.body.map((a: { mensaje: string }) => a.mensaje)).toEqual([
      'Paiz: 50 productos sin actualizar',
      'Walmart: 3 productos sin actualizar',
    ]);
    expect(res.body[0]).toMatchObject({
      tipo: 'CORRIDA_FALLIDA',
      titulo: 'Paiz',
      leido: false,
      createdAt: '2026-10-25T21:00:00.000Z',
    });
  });

  it('marcar un aviso como leído lo saca de "no leídos" y no lo borra', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const id = await crearAviso(hogarId, 'Paiz: 50 productos sin actualizar');
    await crearAviso(hogarId, 'Walmart: 2 productos sin actualizar');

    await http().post(`${API}/avisos/${id}/leido`).set(con(token)).expect(204);
    // Marcarlo otra vez es inofensivo.
    await http().post(`${API}/avisos/${id}/leido`).set(con(token)).expect(204);

    const pendientes = await http().get(`${API}/avisos?noLeidos=true`).set(con(token)).expect(200);
    expect(pendientes.body.map((a: { mensaje: string }) => a.mensaje)).toEqual([
      'Walmart: 2 productos sin actualizar',
    ]);
    const todos = await http().get(`${API}/avisos`).set(con(token)).expect(200);
    expect(todos.body).toHaveLength(2);
    expect(todos.body.find((a: { id: string }) => a.id === id).leido).toBe(true);
  });

  it('un administrador no ve ni marca los avisos de otro hogar', async () => {
    const { token } = await hogarDe('Rene');
    const otro = await hogarDe('Ana');
    const idAjeno = await crearAviso(
      otro.hogarId,
      'Paiz bloqueado: registra precios manualmente',
      'SITIO_BLOQUEADO',
    );

    const lista = await http().get(`${API}/avisos`).set(con(token)).expect(200);
    expect(lista.body).toEqual([]);
    await http().post(`${API}/avisos/${idAjeno}/leido`).set(con(token)).expect(404);
    const [fila] = await bd.db.select().from(aviso);
    expect(fila!.leidoEn).toBeNull();
  });

  it('un aviso inexistente o un id mal formado es 404', async () => {
    const { token } = await hogarDe('Rene');
    await http()
      .post(`${API}/avisos/00000000-0000-4000-8000-000000000000/leido`)
      .set(con(token))
      .expect(404);
    await http().post(`${API}/avisos/no-es-uuid/leido`).set(con(token)).expect(404);
  });

  it('un miembro que no es administrador recibe 403 y sin sesión 401', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const id = await crearAviso(hogarId, 'Paiz: 50 productos sin actualizar');
    await http().get(`${API}/avisos`).expect(401);
    await bd.db.execute(sql`update miembro_hogar set rol = 'MIEMBRO'`);
    await http().get(`${API}/avisos`).set(con(token)).expect(403);
    await http().post(`${API}/avisos/${id}/leido`).set(con(token)).expect(403);
  });
});
