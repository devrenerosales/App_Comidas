/**
 * HU-25 Aprobar menú — integración contra PostgreSQL real (TEST_DATABASE_URL).
 * Cubre CA-25.1..3, la aprobación doble o simultánea, la versión desactualizada, el solo lectura
 * posterior y el aislamiento por hogar (RNF-06).
 *
 * Semana del domingo 2026-11-01: lunes 11-02, martes 11-03, miércoles 11-04.
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  eq,
  listaCompras,
  menuDetalle,
  menuSemanal,
  menuTiempo,
  platillo,
  platilloTiempo,
} from '@menu/db';
import { normalizarNombreCatalogo, type TiempoComida } from '@menu/shared';
import { crearAppConBd, describeConBd, usarBaseDePruebas } from './utils/base-datos';

const API = '/api/v1';
const SEMANA = '2026-11-01';
const DIAS = { lunes: '2026-11-02', martes: '2026-11-03', miercoles: '2026-11-04' } as const;

describeConBd('HU-25 Aprobar menú (integración)', () => {
  const bd = usarBaseDePruebas({
    suite: 'menus-aprobacion',
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
    return { token: hogar.body.accessToken as string, hogarId: hogar.body.hogar.id as string };
  };

  const crearPlatillo = async (hogarId: string, nombre: string): Promise<string> => {
    const [p] = await bd.db
      .insert(platillo)
      .values({
        hogarId,
        nombre,
        nombreNormalizado: normalizarNombreCatalogo(nombre),
        proteinaPrincipal: 'POLLO',
      })
      .returning();
    await bd.db.insert(platilloTiempo).values({ platilloId: p!.id, tiempo: 'ALMUERZO' });
    return p!.id;
  };

  /** Borrador de la semana con `[fecha, platilloId | null]` de almuerzo y un exceso por tiempo. */
  const crearBorrador = async (
    hogarId: string,
    espacios: [string, string | null][],
    excesoAlmuerzo = '0.00',
  ) => {
    const [menu] = await bd.db
      .insert(menuSemanal)
      .values({
        hogarId,
        fechaInicio: SEMANA,
        fechaFin: '2026-11-07',
        estado: 'BORRADOR',
        presupuestoSemanal: '245.00',
      })
      .returning();
    await bd.db.insert(menuTiempo).values({
      menuId: menu!.id,
      tiempo: 'ALMUERZO' as TiempoComida,
      porcentaje: '100.00',
      presupuesto: '245.00',
      exceso: excesoAlmuerzo,
    });
    const filas = await bd.db
      .insert(menuDetalle)
      .values(
        espacios.map(([fecha, platilloId]) => ({
          menuId: menu!.id,
          fecha,
          tiempo: 'ALMUERZO' as TiempoComida,
          platilloId,
        })),
      )
      .returning();
    return {
      menuId: menu!.id,
      version: menu!.version,
      detalle: (fecha: string) => filas.find((f) => f.fecha === fecha)!.id,
    };
  };

  const menuCompleto = async (hogarId: string) => {
    const pollo = await crearPlatillo(hogarId, 'Pollo asado');
    const pepian = await crearPlatillo(hogarId, 'Pepián');
    return crearBorrador(hogarId, [
      [DIAS.lunes, pollo],
      [DIAS.martes, pepian],
    ]);
  };

  const aprobar = (token: string, menuId: string, cuerpo: object) =>
    http().post(`${API}/menus/${menuId}/aprobar`).set(con(token)).send(cuerpo);

  const listas = (menuId: string) =>
    bd.db.select().from(listaCompras).where(eq(listaCompras.menuId, menuId));

  beforeAll(async () => {
    app = await crearAppConBd(bd.base);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('CA-25.1 aprueba el Borrador con mi usuario y la fecha, y crea la lista de la semana', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const m = await menuCompleto(hogarId);

    const res = await aprobar(token, m.menuId, { version: m.version }).expect(200);

    expect(res.body.menu).toMatchObject({
      id: m.menuId,
      estado: 'APROBADO',
      version: m.version + 1,
      aprobadoPor: { nombre: 'Rene' },
      presupuestoSemanal: '245.00',
      excede: null,
    });
    expect(res.body.menu.aprobadoEn).toEqual(expect.any(String));
    expect(res.body.excede).toBeNull();
    const [lista] = await listas(m.menuId);
    expect(lista).toMatchObject({ hogarId, version: 1 });
    expect(res.body.lista).toMatchObject({
      id: lista!.id,
      version: 1,
      totalItems: 0,
      url: `/api/v1/listas/${lista!.id}`,
    });
    expect(res.body.menu.listaId).toBe(lista!.id);
    const [guardado] = await bd.db.select().from(menuSemanal).where(eq(menuSemanal.id, m.menuId));
    expect(guardado).toMatchObject({ estado: 'APROBADO', excesoAlAprobar: '0.00' });
    expect(guardado!.aprobadoPorId).not.toBeNull();
  });

  it('CA-25.1 el menú aprobado sigue editable: cambiar un platillo responde 200 y sigue aprobado', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const m = await menuCompleto(hogarId);
    await aprobar(token, m.menuId, { version: m.version }).expect(200);

    const pollo = await crearPlatillo(hogarId, 'Chile relleno');
    const res = await http()
      .patch(`${API}/menus/${m.menuId}/detalles/${m.detalle(DIAS.lunes)}`)
      .set(con(token))
      .send({ platilloId: pollo, confirmar: true })
      .expect(200);
    expect(res.body).toMatchObject({ estado: 'APROBADO', aprobadoPor: { nombre: 'Rene' } });
    const lectura = await http().get(`${API}/menus/${m.menuId}`).set(con(token)).expect(200);
    expect(lectura.body).toMatchObject({ estado: 'APROBADO', aprobadoPor: { nombre: 'Rene' } });
    const lunes = (lectura.body.detalles as { fecha: string; platillo: { nombre: string } }[]).find(
      (d) => d.fecha === DIAS.lunes,
    );
    expect(lunes!.platillo.nombre).toBe('Chile relleno');
  });

  it('CA-25.2 aprobar con presupuesto excedido no pide confirmación y registra el exceso', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const pollo = await crearPlatillo(hogarId, 'Pollo asado');
    const m = await crearBorrador(hogarId, [[DIAS.lunes, pollo]], '17.00');

    const res = await aprobar(token, m.menuId, { version: m.version }).expect(200);

    expect(res.body.excede).toEqual({ monto: '17.00', texto: 'Excede por Q17.00' });
    expect(res.body.menu.excede).toEqual({ monto: '17.00', texto: 'Excede por Q17.00' });
    const [guardado] = await bd.db.select().from(menuSemanal).where(eq(menuSemanal.id, m.menuId));
    expect(guardado!.excesoAlAprobar).toBe('17.00');
    expect(await listas(m.menuId)).toHaveLength(1);
  });

  it('CA-25.3 con un espacio vacío no se aprueba: señala cuál y no crea la lista', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const pollo = await crearPlatillo(hogarId, 'Pollo asado');
    const m = await crearBorrador(hogarId, [
      [DIAS.lunes, pollo],
      [DIAS.miercoles, null],
    ]);

    const res = await aprobar(token, m.menuId, { version: m.version }).expect(422);

    expect(res.body).toMatchObject({
      codigo: 'ESPACIOS_VACIOS',
      detail: 'Asigna un platillo a: miércoles almuerzo',
      espacios: [{ fecha: DIAS.miercoles, tiempo: 'ALMUERZO' }],
    });
    const [guardado] = await bd.db.select().from(menuSemanal).where(eq(menuSemanal.id, m.menuId));
    expect(guardado).toMatchObject({ estado: 'BORRADOR', aprobadoEn: null });
    expect(await listas(m.menuId)).toHaveLength(0);
  });

  it('aprobar dos veces responde MENU_YA_APROBADO y deja una sola lista', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const m = await menuCompleto(hogarId);
    await aprobar(token, m.menuId, { version: m.version }).expect(200);

    const otra = await aprobar(token, m.menuId, { version: m.version }).expect(409);

    expect(otra.body).toMatchObject({ codigo: 'MENU_YA_APROBADO', menuId: m.menuId });
    expect(otra.body.detail).toMatch(/^Rene aprobó este menú a las \d{2}:\d{2}$/);
    expect(await listas(m.menuId)).toHaveLength(1);
  });

  it('dos aprobaciones simultáneas: una gana y la otra recibe un conflicto', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const m = await menuCompleto(hogarId);

    const [a, b] = await Promise.all([
      aprobar(token, m.menuId, { version: m.version }),
      aprobar(token, m.menuId, { version: m.version }),
    ]);

    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const perdedora = a.status === 409 ? a : b;
    expect(['MENU_YA_APROBADO', 'VERSION_DESACTUALIZADA']).toContain(perdedora.body.codigo);
    expect(await listas(m.menuId)).toHaveLength(1);
  });

  it('una versión distinta a la del menú es VERSION_DESACTUALIZADA y no aprueba', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const m = await menuCompleto(hogarId);

    const res = await aprobar(token, m.menuId, { version: m.version + 3 }).expect(409);

    expect(res.body.codigo).toBe('VERSION_DESACTUALIZADA');
    const [guardado] = await bd.db.select().from(menuSemanal).where(eq(menuSemanal.id, m.menuId));
    expect(guardado!.estado).toBe('BORRADOR');
    expect(await listas(m.menuId)).toHaveLength(0);
  });

  it('exige la versión del menú', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const m = await menuCompleto(hogarId);
    await aprobar(token, m.menuId, {}).expect(400);
    await aprobar(token, m.menuId, { version: 'cuatro' }).expect(400);
  });

  it('una semana histórica no se aprueba', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const m = await menuCompleto(hogarId);
    await bd.db
      .update(menuSemanal)
      .set({ estado: 'HISTORICO' })
      .where(eq(menuSemanal.id, m.menuId));

    const res = await aprobar(token, m.menuId, { version: m.version }).expect(409);

    expect(res.body.codigo).toBe('SEMANA_HISTORICA');
    expect(await listas(m.menuId)).toHaveLength(0);
  });

  it('el menú de otro hogar o un id mal formado es 404 (RNF-06)', async () => {
    const ana = await hogarDe('Ana');
    const rene = await hogarDe('Rene');
    const m = await menuCompleto(ana.hogarId);

    await aprobar(rene.token, m.menuId, { version: m.version }).expect(404);
    await aprobar(rene.token, 'no-es-un-id', { version: 1 }).expect(404);
    const [guardado] = await bd.db.select().from(menuSemanal).where(eq(menuSemanal.id, m.menuId));
    expect(guardado!.estado).toBe('BORRADOR');
  });

  it('exige sesión', async () => {
    await http()
      .post(`${API}/menus/00000000-0000-4000-8000-000000000000/aprobar`)
      .send({ version: 1 })
      .expect(401);
  });
});
