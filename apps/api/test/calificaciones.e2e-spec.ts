/**
 * HU-14 Calificar platillo — integración contra PostgreSQL real (TEST_DATABASE_URL). Cubre
 * CA-14.1..4 (docs/03-pruebas/features/HU-14.feature), el reemplazo de la calificación, el promedio
 * en el catálogo y el aislamiento por hogar (RNF-06).
 *
 * El calendario se fija en el jueves 2026-11-12 (hora de Guatemala), igual que los criterios.
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { calificacion, eq, menuDetalle, menuSemanal } from '@menu/db';
import { RELOJ_CALIFICACIONES } from '../src/calificaciones/calificaciones.constants';
import { crearAppConBd, describeConBd, usarBaseDePruebas } from './utils/base-datos';

const API = '/api/v1';
const HOY = new Date('2026-11-12T15:00:00.000Z');

describeConBd('HU-14 Calificar platillo (integración)', () => {
  const bd = usarBaseDePruebas({
    suite: 'calificaciones',
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

  const crearPlatillo = async (token: string, nombre: string): Promise<string> =>
    (
      await http()
        .post(`${API}/platillos`)
        .set(con(token))
        .send({ nombre, tiempos: ['ALMUERZO'], proteinaPrincipal: 'POLLO' })
        .expect(201)
    ).body.id as string;

  /** Menú de la semana que empieza en `inicio` con los espacios dados (`platilloId` null = vacío). */
  const crearMenu = async (
    hogarId: string,
    inicio: string,
    estado: 'BORRADOR' | 'APROBADO' | 'HISTORICO',
    comidas: { fecha: string; platilloId: string | null }[],
  ) => {
    const fin = new Date(`${inicio}T00:00:00Z`);
    fin.setUTCDate(fin.getUTCDate() + 6);
    const [menu] = await bd.db
      .insert(menuSemanal)
      .values({
        hogarId,
        fechaInicio: inicio,
        fechaFin: fin.toISOString().slice(0, 10),
        estado,
        // menu_aprobado_ck: un menú aprobado lleva fecha de aprobación y presupuesto.
        ...(estado === 'APROBADO' ? { aprobadoEn: HOY, presupuestoSemanal: '245.00' } : {}),
      })
      .returning();
    const detalles =
      comidas.length === 0
        ? []
        : await bd.db
            .insert(menuDetalle)
            .values(comidas.map((c) => ({ menuId: menu!.id, tiempo: 'ALMUERZO' as const, ...c })))
            .returning();
    return { menuId: menu!.id, detalles };
  };

  const calificar = (token: string, menuId: string, detalleId: string, cuerpo: object) =>
    http()
      .put(`${API}/menus/${menuId}/detalles/${detalleId}/calificacion`)
      .set(con(token))
      .send(cuerpo);

  const promedio = async (token: string, nombre: string) => {
    const res = await http()
      .get(`${API}/platillos`)
      .query({ q: nombre })
      .set(con(token))
      .expect(200);
    return (res.body.datos as { nombre: string; calificacionPromedio: string | null }[]).find(
      (p) => p.nombre === nombre,
    )!.calificacionPromedio;
  };

  beforeAll(async () => {
    app = await crearAppConBd(bd.base, (b) =>
      b.overrideProvider(RELOJ_CALIFICACIONES).useValue(() => HOY),
    );
  });

  afterAll(async () => {
    await app?.close();
  });

  it('CA-14.1 califica un almuerzo ya comido y el catálogo muestra el promedio', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const pollo = await crearPlatillo(token, 'Pollo en crema');
    const { menuId, detalles } = await crearMenu(hogarId, '2026-11-08', 'APROBADO', [
      { fecha: '2026-11-10', platilloId: pollo },
    ]);
    expect(await promedio(token, 'Pollo en crema')).toBeNull();

    const res = await calificar(token, menuId, detalles[0]!.id, { valor: 4 }).expect(200);
    expect(res.body).toEqual({
      valor: 4,
      platillo: { id: pollo, calificacionPromedio: '4.00', calificacionConteo: 1 },
    });
    expect(await promedio(token, 'Pollo en crema')).toBe('4.00');
  });

  it('CA-14.2 cambiar la calificación reemplaza la anterior y recalcula el promedio', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const caldo = await crearPlatillo(token, 'Caldo de res');
    const { menuId, detalles } = await crearMenu(hogarId, '2026-11-01', 'HISTORICO', [
      { fecha: '2026-11-03', platilloId: caldo },
      { fecha: '2026-11-04', platilloId: caldo },
    ]);
    await calificar(token, menuId, detalles[0]!.id, { valor: 3 }).expect(200);
    const segunda = await calificar(token, menuId, detalles[1]!.id, { valor: 5 }).expect(200);
    expect(segunda.body.platillo).toMatchObject({
      calificacionPromedio: '4.00',
      calificacionConteo: 2,
    });

    const cambio = await calificar(token, menuId, detalles[0]!.id, { valor: 5 }).expect(200);
    expect(cambio.body.platillo).toMatchObject({
      calificacionPromedio: '5.00',
      calificacionConteo: 2,
    });
    expect(await bd.db.select().from(calificacion)).toHaveLength(2);
  });

  it('el historial devuelve el id y la calificación de cada comida', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const pollo = await crearPlatillo(token, 'Pollo en crema');
    const { menuId, detalles } = await crearMenu(hogarId, '2026-11-01', 'HISTORICO', [
      { fecha: '2026-11-03', platilloId: pollo },
      { fecha: '2026-11-04', platilloId: pollo },
    ]);
    await calificar(token, menuId, detalles[0]!.id, { valor: 2 }).expect(200);
    const res = await http().get(`${API}/historial/semanas`).set(con(token)).expect(200);
    const lista = res.body.datos[0].detalles as {
      id: string;
      fecha: string;
      calificacion: number | null;
    }[];
    expect(lista.map((d) => [d.id, d.calificacion])).toEqual([
      [detalles[0]!.id, 2],
      [detalles[1]!.id, null],
    ]);
  });

  it('CA-14.3 una comida de fecha futura se rechaza; la de hoy sí se califica', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const pasta = await crearPlatillo(token, 'Spaghetti con carne');
    const { menuId, detalles } = await crearMenu(hogarId, '2026-11-08', 'APROBADO', [
      { fecha: '2026-11-14', platilloId: pasta },
      { fecha: '2026-11-12', platilloId: pasta },
    ]);
    const futura = await calificar(token, menuId, detalles[0]!.id, { valor: 4 }).expect(422);
    expect(futura.body.codigo).toBe('FECHA_FUTURA');
    expect(await bd.db.select().from(calificacion)).toHaveLength(0);
    await calificar(token, menuId, detalles[1]!.id, { valor: 4 }).expect(200);
  });

  it('CA-14.4 un valor fuera de rango es 422 con el mensaje', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const pollo = await crearPlatillo(token, 'Pollo en crema');
    const { menuId, detalles } = await crearMenu(hogarId, '2026-11-08', 'APROBADO', [
      { fecha: '2026-11-10', platilloId: pollo },
    ]);
    for (const valor of [6, 0, -1, 3.5]) {
      const res = await calificar(token, menuId, detalles[0]!.id, { valor }).expect(422);
      expect(res.body.codigo).toBe('CALIFICACION_FUERA_DE_RANGO');
      expect(res.body.detail).toBe('La calificación debe estar entre 1 y 5');
    }
    await calificar(token, menuId, detalles[0]!.id, { valor: 'cuatro' }).expect(400);
    await calificar(token, menuId, detalles[0]!.id, {}).expect(400);
  });

  it('un menú en borrador es 409 y un espacio sin platillo es 422', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const pollo = await crearPlatillo(token, 'Pollo en crema');
    const borrador = await crearMenu(hogarId, '2026-11-01', 'BORRADOR', [
      { fecha: '2026-11-03', platilloId: pollo },
    ]);
    const res = await calificar(token, borrador.menuId, borrador.detalles[0]!.id, {
      valor: 4,
    }).expect(409);
    expect(res.body.codigo).toBe('MENU_NO_APROBADO');

    const vacio = await crearMenu(hogarId, '2026-10-25', 'APROBADO', [
      { fecha: '2026-10-26', platilloId: null },
    ]);
    const sin = await calificar(token, vacio.menuId, vacio.detalles[0]!.id, { valor: 4 }).expect(
      422,
    );
    expect(sin.body.codigo).toBe('SIN_PLATILLO');
  });

  it('RNF-06 otro hogar no puede calificar y los ids mal formados son 404', async () => {
    const rene = await hogarDe('Rene');
    const ana = await hogarDe('Ana');
    const pollo = await crearPlatillo(rene.token, 'Pollo en crema');
    const { menuId, detalles } = await crearMenu(rene.hogarId, '2026-11-08', 'APROBADO', [
      { fecha: '2026-11-10', platilloId: pollo },
    ]);
    await calificar(ana.token, menuId, detalles[0]!.id, { valor: 4 }).expect(404);
    await calificar(rene.token, 'no-es-uuid', detalles[0]!.id, { valor: 4 }).expect(404);
    await calificar(rene.token, menuId, 'no-es-uuid', { valor: 4 }).expect(404);
    // El espacio debe pertenecer al menú indicado.
    const otro = await crearMenu(rene.hogarId, '2026-11-01', 'HISTORICO', []);
    await calificar(rene.token, otro.menuId, detalles[0]!.id, { valor: 4 }).expect(404);
    expect(await bd.db.select().from(calificacion)).toHaveLength(0);
  });

  it('requiere sesión', async () => {
    await http()
      .put(
        `${API}/menus/5c6a7f3e-5b8e-4c1e-9d55-1b8a2f0d9c11/detalles/5c6a7f3e-5b8e-4c1e-9d55-1b8a2f0d9c12/calificacion`,
      )
      .send({ valor: 4 })
      .expect(401);
  });

  it('borrar el espacio elimina su calificación (cascada)', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const pollo = await crearPlatillo(token, 'Pollo en crema');
    const { menuId, detalles } = await crearMenu(hogarId, '2026-11-08', 'APROBADO', [
      { fecha: '2026-11-10', platilloId: pollo },
    ]);
    await calificar(token, menuId, detalles[0]!.id, { valor: 4 }).expect(200);
    await bd.db.delete(menuDetalle).where(eq(menuDetalle.id, detalles[0]!.id));
    expect(await bd.db.select().from(calificacion)).toHaveLength(0);
  });

  it('reemplazar una semana histórica recalcula los promedios de lo que se había calificado', async () => {
    const { token } = await hogarDe('Rene');
    const pollo = await crearPlatillo(token, 'Pollo en crema');
    const caldo = await crearPlatillo(token, 'Caldo de res');
    const semana = (platilloId: string) => ({
      fechaInicio: '2025-04-06',
      detalles: [{ fecha: '2025-04-07', tiempo: 'ALMUERZO', platilloId }],
    });
    const creada = await http()
      .post(`${API}/historial/semanas`)
      .set(con(token))
      .send(semana(pollo))
      .expect(201);
    const listado = await http().get(`${API}/historial/semanas`).set(con(token)).expect(200);
    const detalleId = listado.body.datos[0].detalles[0].id as string;
    await calificar(token, creada.body.id, detalleId, { valor: 5 }).expect(200);
    expect(await promedio(token, 'Pollo en crema')).toBe('5.00');

    await http()
      .post(`${API}/historial/semanas`)
      .set(con(token))
      .send({ ...semana(caldo), reemplazar: true, version: creada.body.version })
      .expect(201);
    expect(await promedio(token, 'Pollo en crema')).toBeNull();
    expect(await bd.db.select().from(calificacion)).toHaveLength(0);
  });
});
