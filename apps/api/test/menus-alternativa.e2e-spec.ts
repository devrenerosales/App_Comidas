/**
 * HU-23 Pedir alternativa para un día — integración contra PostgreSQL real (TEST_DATABASE_URL).
 * Cubre CA-23.1, CA-23.3 y CA-23.4, las exclusiones (RN-02, RN-03 y ya mostradas), el menú aprobado
 * y el aislamiento por hogar (RNF-06). CA-23.2 (exceso por la alternativa) depende de los precios
 * (S5, HU-26): sin ellos el costo es incompleto y no hay exceso que calcular.
 *
 * Semana del domingo 2026-11-01: lunes 11-02 Carne guisada (res), martes 11-03 Pescado frito
 * (pescado), miércoles 11-04 Tortitas de carne (res).
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  eq,
  menuAlternativaMostrada,
  menuDetalle,
  menuSemanal,
  menuTiempo,
  platillo,
  platilloTiempo,
} from '@menu/db';
import { normalizarNombreCatalogo, type ProteinaPrincipal } from '@menu/shared';
import { crearAppConBd, describeConBd, usarBaseDePruebas } from './utils/base-datos';

const API = '/api/v1';
const LUNES = '2026-11-02';
const MARTES = '2026-11-03';
const MIERCOLES = '2026-11-04';

describeConBd('HU-23 Alternativa para un día (integración)', () => {
  const bd = usarBaseDePruebas({
    suite: 'menus-alternativa',
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

  /** Platillo de almuerzo; los favoritos puntúan más que los calificados con 4 o 2 estrellas. */
  const crearPlatillo = async (
    hogarId: string,
    nombre: string,
    proteina: ProteinaPrincipal,
    gusto: { favorito: true } | { promedio: string },
  ): Promise<string> => {
    const [p] = await bd.db
      .insert(platillo)
      .values({
        hogarId,
        nombre,
        nombreNormalizado: normalizarNombreCatalogo(nombre),
        proteinaPrincipal: proteina,
        ...('favorito' in gusto ? { favorito: true } : { calificacionPromedio: gusto.promedio }),
      })
      .returning();
    await bd.db.insert(platilloTiempo).values({ platilloId: p!.id, tiempo: 'ALMUERZO' });
    return p!.id;
  };

  /** CA-23.1: Borrador de solo almuerzo con la semana del criterio y dos candidatos de reserva. */
  const crearMenu = async (hogarId: string, estado: 'BORRADOR' | 'APROBADO' = 'BORRADOR') => {
    const carne = await crearPlatillo(hogarId, 'Carne guisada', 'RES', { favorito: true });
    const pescado = await crearPlatillo(hogarId, 'Pescado frito', 'PESCADO', { favorito: true });
    const tortitas = await crearPlatillo(hogarId, 'Tortitas de carne', 'RES', { favorito: true });
    await crearPlatillo(hogarId, 'Pollo en crema', 'POLLO', { promedio: '4.00' });
    await crearPlatillo(hogarId, 'Chile relleno', 'CERDO', { promedio: '2.00' });
    const [menu] = await bd.db
      .insert(menuSemanal)
      .values({
        hogarId,
        fechaInicio: '2026-11-01',
        fechaFin: '2026-11-07',
        estado,
        presupuestoSemanal: '245.00',
        pesoPreferencia: '0.40',
        pesoNovedad: '0.25',
        pesoAhorro: '0.20',
        pesoAfinidad: '0.15',
        ...(estado === 'APROBADO' ? { aprobadoEn: new Date('2026-10-30T15:00:00Z') } : {}),
      })
      .returning();
    await bd.db.insert(menuTiempo).values({
      menuId: menu!.id,
      tiempo: 'ALMUERZO',
      porcentaje: '100.00',
      presupuesto: '245.00',
    });
    const filas = await bd.db
      .insert(menuDetalle)
      .values([
        { menuId: menu!.id, fecha: LUNES, tiempo: 'ALMUERZO', platilloId: carne },
        { menuId: menu!.id, fecha: MARTES, tiempo: 'ALMUERZO', platilloId: pescado },
        { menuId: menu!.id, fecha: MIERCOLES, tiempo: 'ALMUERZO', platilloId: tortitas },
      ])
      .returning();
    const id = (fecha: string) => filas.find((f) => f.fecha === fecha)!.id;
    return { menuId: menu!.id, id };
  };

  type Detalle = { fecha: string; platillo: { nombre: string } | null; origen: string };
  const dia = (cuerpo: { detalles: Detalle[] }, fecha: string) =>
    cuerpo.detalles.find((d) => d.fecha === fecha)!;

  const alternativa = (token: string, menuId: string, detalleId: string) =>
    http().post(`${API}/menus/${menuId}/detalles/${detalleId}/alternativa`).set(con(token));

  beforeAll(async () => {
    app = await crearAppConBd(bd.base);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('CA-23.1 cambia solo el martes por el mejor que no es de res ni de pescado ni está en la semana', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const m = await crearMenu(hogarId);

    const res = await alternativa(token, m.menuId, m.id(MARTES)).expect(200);

    expect(dia(res.body, MARTES)).toMatchObject({
      platillo: { nombre: 'Pollo en crema' },
      origen: 'ALTERNATIVA',
    });
    expect(dia(res.body, LUNES).platillo!.nombre).toBe('Carne guisada');
    expect(dia(res.body, MIERCOLES).platillo!.nombre).toBe('Tortitas de carne');
    expect(res.body.detalles[1]).toMatchObject({ fijado: false, costoIncompleto: true });
    const mostradas = await bd.db
      .select()
      .from(menuAlternativaMostrada)
      .where(eq(menuAlternativaMostrada.menuDetalleId, m.id(MARTES)));
    expect(mostradas).toHaveLength(2);
  });

  it('CA-23.3 al agotarse los candidatos avisa y el espacio conserva su platillo, sin vaivén', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const m = await crearMenu(hogarId);

    await alternativa(token, m.menuId, m.id(MARTES)).expect(200);
    const segunda = await alternativa(token, m.menuId, m.id(MARTES)).expect(200);
    expect(dia(segunda.body, MARTES).platillo!.nombre).toBe('Chile relleno');

    const agotada = await alternativa(token, m.menuId, m.id(MARTES)).expect(422);

    expect(agotada.body).toMatchObject({
      codigo: 'SIN_ALTERNATIVAS',
      detail: 'No hay más alternativas para este día',
    });
    const lectura = await http().get(`${API}/menus/${m.menuId}`).set(con(token)).expect(200);
    expect(dia(lectura.body, MARTES).platillo!.nombre).toBe('Chile relleno');
  });

  it('CA-23.4 un espacio fijado no admite alternativa hasta quitarle el fijado', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const m = await crearMenu(hogarId);
    await http()
      .put(`${API}/menus/${m.menuId}/detalles/${m.id(MARTES)}/fijado`)
      .set(con(token))
      .send({ fijado: true })
      .expect(200);

    const res = await alternativa(token, m.menuId, m.id(MARTES)).expect(409);
    expect(res.body.codigo).toBe('ESPACIO_FIJADO');

    await http()
      .put(`${API}/menus/${m.menuId}/detalles/${m.id(MARTES)}/fijado`)
      .set(con(token))
      .send({ fijado: false })
      .expect(200);
    await alternativa(token, m.menuId, m.id(MARTES)).expect(200);
  });

  it('un menú aprobado también admite alternativas', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const m = await crearMenu(hogarId, 'APROBADO');

    await alternativa(token, m.menuId, m.id(MARTES)).expect(200);

    const [martes] = await bd.db
      .select()
      .from(menuDetalle)
      .where(eq(menuDetalle.id, m.id(MARTES)));
    expect(martes!.origen).toBe('ALTERNATIVA');
  });

  it('el menú o el espacio de otro hogar, o un id mal formado, es 404 (RNF-06)', async () => {
    const ana = await hogarDe('Ana');
    const rene = await hogarDe('Rene');
    const m = await crearMenu(ana.hogarId);
    const propio = await crearMenu(rene.hogarId);

    await alternativa(rene.token, m.menuId, m.id(MARTES)).expect(404);
    await alternativa(rene.token, propio.menuId, m.id(MARTES)).expect(404);
    await alternativa(rene.token, 'no-es-un-id', m.id(MARTES)).expect(404);
    await alternativa(rene.token, propio.menuId, 'no-es-un-id').expect(404);
    const [martes] = await bd.db
      .select()
      .from(menuDetalle)
      .where(eq(menuDetalle.id, m.id(MARTES)));
    expect(martes!.origen).toBe('MOTOR');
  });

  it('exige sesión', async () => {
    await http()
      .post(
        `${API}/menus/00000000-0000-4000-8000-000000000000/detalles/00000000-0000-4000-8000-000000000001/alternativa`,
      )
      .expect(401);
  });
});
