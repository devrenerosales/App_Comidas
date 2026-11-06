/**
 * HU-27 Registrar gasto real — integración contra PostgreSQL real (TEST_DATABASE_URL).
 * Cubre CA-27.1..4, el prellenado con los precios de la lista (CU-06.4 2b) y el aislamiento por
 * hogar (RNF-06).
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { eq, listaCompras, listaItem, menuSemanal } from '@menu/db';
import { crearAppConBd, describeConBd, usarBaseDePruebas } from './utils/base-datos';

const API = '/api/v1';
const SEMANA = '2026-11-01';

describeConBd('HU-27 Registrar gasto real (integración)', () => {
  const bd = usarBaseDePruebas({
    suite: 'menus-gasto',
    sembrar: true,
    truncarEntrePruebas: true,
  });
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const con = (token: string) => ({ Authorization: `Bearer ${token}` });
  let n = 0;

  const hogarDe = async (
    nombre: string,
  ): Promise<{ token: string; hogarId: string; usuarioId: string }> => {
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
    return {
      token: hogar.body.accessToken as string,
      hogarId: hogar.body.hogar.id as string,
      usuarioId: registro.body.usuario.id as string,
    };
  };

  /** Menú de la semana con costo estimado Q229.50 y presupuesto Q245.00 (CA-27.1). */
  const crearMenu = async (
    hogarId: string,
    estado: 'BORRADOR' | 'APROBADO' = 'APROBADO',
    semana = SEMANA,
    fin = '2026-11-07',
  ) => {
    const [menu] = await bd.db
      .insert(menuSemanal)
      .values({
        hogarId,
        fechaInicio: semana,
        fechaFin: fin,
        estado,
        presupuestoSemanal: '245.00',
        costoEstimado: '229.50',
        ...(estado === 'APROBADO' ? { aprobadoEn: new Date() } : {}),
      })
      .returning();
    return menu!.id;
  };

  const conLista = async (menuId: string, hogarId: string, precios: (string | null)[]) => {
    const [lista] = await bd.db.insert(listaCompras).values({ hogarId, menuId }).returning();
    await bd.db.insert(listaItem).values(
      precios.map((precio, i) => ({
        id: crypto.randomUUID(),
        listaId: lista!.id,
        textoLibre: `Producto ${i}`,
        origen: 'MANUAL' as const,
        cantidadComprar: '1',
        estado: 'COMPRADO' as const,
        compradoEn: new Date(),
        precioReal: precio,
        modificadoEnDispositivo: new Date(),
      })),
    );
  };

  const registrar = (token: string, menuId: string, cuerpo: object) =>
    http().put(`${API}/menus/${menuId}/gasto-real`).set(con(token)).send(cuerpo);

  const leer = (token: string, menuId: string) =>
    http().get(`${API}/menus/${menuId}`).set(con(token)).expect(200);

  beforeAll(async () => {
    app = await crearAppConBd(bd.base);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('CA-27.1 guarda el gasto con mi usuario y la fecha y compara con lo estimado y el presupuesto', async () => {
    const { token, hogarId, usuarioId } = await hogarDe('Rene');
    const menuId = await crearMenu(hogarId);

    const res = await registrar(token, menuId, { monto: '238.75', nota: 'Paiz y mercado' }).expect(
      200,
    );

    expect(res.body).toMatchObject({
      gastoReal: '238.75',
      nota: 'Paiz y mercado',
      diferenciaVsEstimado: { monto: '9.25', texto: 'Q9.25 más que lo estimado' },
      diferenciaVsPresupuesto: { monto: '-6.25', texto: 'Q6.25 por debajo del presupuesto' },
      registradoPor: { id: usuarioId, nombre: 'Rene' },
    });
    expect(new Date(res.body.registradoEn).getTime()).toBeGreaterThan(Date.now() - 60_000);
    const [fila] = await bd.db.select().from(menuSemanal).where(eq(menuSemanal.id, menuId));
    expect(fila).toMatchObject({ gastoReal: '238.75', gastoRegistradoPorId: usuarioId });
    // El menú también lo trae para mostrarlo al abrir la semana.
    expect((await leer(token, menuId)).body.gasto).toMatchObject({ gastoReal: '238.75' });
  });

  it('acepta el monto como número y sin nota', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const menuId = await crearMenu(hogarId);
    const res = await registrar(token, menuId, { monto: 240 }).expect(200);
    expect(res.body).toMatchObject({ gastoReal: '240.00', nota: null });
  });

  it('CA-27.2 corrige un gasto ya registrado y queda el último valor con quién y cuándo', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const menuId = await crearMenu(hogarId);
    await registrar(token, menuId, { monto: '238.75' }).expect(200);

    const res = await registrar(token, menuId, { monto: '251.40' }).expect(200);

    expect(res.body).toMatchObject({
      gastoReal: '251.40',
      diferenciaVsPresupuesto: { texto: 'Q6.40 por encima del presupuesto' },
    });
    const gasto = (await leer(token, menuId)).body.gasto;
    expect(gasto.gastoReal).toBe('251.40');
  });

  it.each([
    ['0', 'El monto debe ser mayor que Q0.00'],
    ['-15.00', 'El monto debe ser mayor que Q0.00'],
    ['120.555', 'El monto admite como máximo 2 decimales'],
    ['100000', 'El monto no puede pasar de Q99,999.99'],
    ['abc', 'Escribe un monto válido'],
  ])('CA-27.3 monto "%s" → 422 y no se guarda', async (monto, mensaje) => {
    const { token, hogarId } = await hogarDe('Rene');
    const menuId = await crearMenu(hogarId);

    const res = await registrar(token, menuId, { monto }).expect(422);

    expect(res.body).toMatchObject({ codigo: 'MONTO_INVALIDO', detail: mensaje });
    const [fila] = await bd.db.select().from(menuSemanal).where(eq(menuSemanal.id, menuId));
    expect(fila!.gastoReal).toBeNull();
  });

  it('un monto ausente o que no es texto ni número también es inválido', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const menuId = await crearMenu(hogarId);
    await registrar(token, menuId, {}).expect(422);
    await registrar(token, menuId, { monto: ['5'] }).expect(422);
  });

  it('una nota de más de 200 caracteres se rechaza', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const menuId = await crearMenu(hogarId);
    await registrar(token, menuId, { monto: '10', nota: 'x'.repeat(201) }).expect(400);
  });

  it('CA-27.4 un Borrador no admite gasto (409 MENU_NO_APROBADO)', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const menuId = await crearMenu(hogarId, 'BORRADOR', '2026-11-08', '2026-11-14');

    const res = await registrar(token, menuId, { monto: '100' }).expect(409);

    expect(res.body).toMatchObject({ codigo: 'MENU_NO_APROBADO' });
    expect((await leer(token, menuId)).body.gasto).toBeNull();
  });

  it('una semana del historial no se registra por aquí (409 SEMANA_HISTORICA)', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const menuId = await crearMenu(hogarId);
    await bd.db.update(menuSemanal).set({ estado: 'HISTORICO' }).where(eq(menuSemanal.id, menuId));
    const res = await registrar(token, menuId, { monto: '100' }).expect(409);
    expect(res.body).toMatchObject({ codigo: 'SEMANA_HISTORICA' });
  });

  it('CU-06.4 2b el menú trae la suma de los precios de la lista para prellenar el gasto', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const menuId = await crearMenu(hogarId);
    await conLista(menuId, hogarId, ['28.10', '45.50', null]);

    const menu = (await leer(token, menuId)).body;

    expect(menu.gastoSugerido).toBe('73.60');
    expect(menu.gasto).toBeNull();
  });

  it('sin precios en la lista no hay gasto sugerido', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const menuId = await crearMenu(hogarId);
    await conLista(menuId, hogarId, [null]);
    expect((await leer(token, menuId)).body.gastoSugerido).toBeNull();
  });

  it('RNF-06 un menú de otro hogar no existe y sin sesión no se entra', async () => {
    const dueno = await hogarDe('Rene');
    const otro = await hogarDe('Ana');
    const menuId = await crearMenu(dueno.hogarId);

    await registrar(otro.token, menuId, { monto: '100' }).expect(404);
    await http().put(`${API}/menus/${menuId}/gasto-real`).send({ monto: '100' }).expect(401);
    await http()
      .put(`${API}/menus/no-es-un-id/gasto-real`)
      .set(con(otro.token))
      .send({ monto: '100' })
      .expect(404);
    const [fila] = await bd.db.select().from(menuSemanal).where(eq(menuSemanal.id, menuId));
    expect(fila!.gastoReal).toBeNull();
  });
});
