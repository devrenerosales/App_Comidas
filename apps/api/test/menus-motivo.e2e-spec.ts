/**
 * HU-22 Ver el motivo de la sugerencia — integración contra PostgreSQL real (TEST_DATABASE_URL).
 * Cubre CA-22.1..4: factores y pesos guardados al generar, platillo elegido por el usuario, pesos
 * cambiados después de generar, reemplazo por presupuesto y el aislamiento por hogar (RNF-06).
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { configuracion, eq, menuDetalle, menuSemanal, platillo, platilloTiempo } from '@menu/db';
import { normalizarNombreCatalogo, type ProteinaPrincipal } from '@menu/shared';
import { crearAppConBd, describeConBd, usarBaseDePruebas } from './utils/base-datos';

const API = '/api/v1';
const LUNES = '2026-11-02';
const MARTES = '2026-11-03';

describeConBd('HU-22 Motivo de la sugerencia (integración)', () => {
  const bd = usarBaseDePruebas({
    suite: 'menus-motivo',
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

  const crearPlatillo = async (
    hogarId: string,
    nombre: string,
    proteina: ProteinaPrincipal = 'POLLO',
  ): Promise<string> => {
    const [p] = await bd.db
      .insert(platillo)
      .values({
        hogarId,
        nombre,
        nombreNormalizado: normalizarNombreCatalogo(nombre),
        proteinaPrincipal: proteina,
      })
      .returning();
    await bd.db.insert(platilloTiempo).values({ platilloId: p!.id, tiempo: 'ALMUERZO' });
    return p!.id;
  };

  /**
   * Borrador generado con pesos 0.40/0.25/0.20/0.15: el lunes lo sugirió el motor (CA-22.1), el
   * martes es un reemplazo por presupuesto (CA-22.4) y el miércoles quedó vacío.
   */
  const crearMenu = async (hogarId: string) => {
    const pollo = await crearPlatillo(hogarId, 'Pollo en crema');
    const tortitas = await crearPlatillo(hogarId, 'Tortitas de carne', 'RES');
    const [menu] = await bd.db
      .insert(menuSemanal)
      .values({
        hogarId,
        fechaInicio: '2026-11-01',
        fechaFin: '2026-11-07',
        pesoPreferencia: '0.40',
        pesoNovedad: '0.25',
        pesoAhorro: '0.20',
        pesoAfinidad: '0.15',
      })
      .returning();
    const filas = await bd.db
      .insert(menuDetalle)
      .values([
        {
          menuId: menu!.id,
          fecha: LUNES,
          tiempo: 'ALMUERZO',
          platilloId: pollo,
          puntaje: '0.6375',
          factorPreferencia: '0.9000',
          factorNovedad: '0.5000',
          factorAhorro: '0.2000',
          factorAfinidad: '0.7500',
          costoEstimado: '28.00',
        },
        {
          menuId: menu!.id,
          fecha: MARTES,
          tiempo: 'ALMUERZO',
          platilloId: tortitas,
          origen: 'REEMPLAZO_PRESUPUESTO',
          puntaje: '0.5000',
          factorPreferencia: '0.5000',
          factorNovedad: '0.5000',
          factorAhorro: '0.5000',
          factorAfinidad: '0.5000',
          costoIncompleto: true,
          reglasAplicadas: ['REEMPLAZO_PRESUPUESTO'],
          notas: 'Q22.00 más barato',
        },
        { menuId: menu!.id, fecha: '2026-11-04', tiempo: 'ALMUERZO', platilloId: null },
      ])
      .returning();
    const id = (fecha: string) => filas.find((f) => f.fecha === fecha)!.id;
    return { menuId: menu!.id, id, pollo };
  };

  const motivo = (token: string, menuId: string, detalleId: string) =>
    http().get(`${API}/menus/${menuId}/detalles/${detalleId}/motivo`).set(con(token));

  beforeAll(async () => {
    app = await crearAppConBd(bd.base);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('CA-22.1 muestra los cuatro factores, los pesos, el puntaje y el costo guardados', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const m = await crearMenu(hogarId);

    const res = await motivo(token, m.menuId, m.id(LUNES)).expect(200);

    expect(res.body).toMatchObject({
      origen: 'MOTOR',
      platillo: { nombre: 'Pollo en crema' },
      puntaje: '0.6375',
      factores: { preferencia: '0.9000', novedad: '0.5000', ahorro: '0.2000', afinidad: '0.7500' },
      pesos: { preferencia: '0.40', novedad: '0.25', ahorro: '0.20', afinidad: '0.15' },
      costo: { estimado: '28.00', incompleto: false },
      reglasAplicadas: [],
      resumen: 'Sugerido sobre todo porque es de sus favoritos o está muy bien calificado',
    });
  });

  it('CA-22.2 un platillo cambiado por el usuario dice "Elegido por el usuario" sin factores', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const m = await crearMenu(hogarId);
    const chile = await crearPlatillo(hogarId, 'Chile relleno', 'CERDO');
    await http()
      .patch(`${API}/menus/${m.menuId}/detalles/${m.id(LUNES)}`)
      .set(con(token))
      .send({ platilloId: chile, confirmar: true })
      .expect(200);

    const res = await motivo(token, m.menuId, m.id(LUNES)).expect(200);

    expect(res.body).toMatchObject({
      origen: 'USUARIO',
      platillo: { nombre: 'Chile relleno' },
      puntaje: null,
      factores: null,
      pesos: null,
      resumen: 'Elegido por el usuario',
    });
  });

  it('CA-22.3 conserva los pesos usados aunque el administrador los cambie después', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const m = await crearMenu(hogarId);
    await bd.db
      .update(configuracion)
      .set({
        pesoPreferencia: '0.30',
        pesoNovedad: '0.30',
        pesoAhorro: '0.25',
        pesoAfinidad: '0.15',
      })
      .where(eq(configuracion.hogarId, hogarId));

    const res = await motivo(token, m.menuId, m.id(LUNES)).expect(200);

    expect(res.body.pesos).toEqual({
      preferencia: '0.40',
      novedad: '0.25',
      ahorro: '0.20',
      afinidad: '0.15',
    });
    expect(res.body.puntaje).toBe('0.6375');
  });

  it('CA-22.4 un reemplazo por presupuesto muestra su motivo y la regla aplicada', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const m = await crearMenu(hogarId);

    const res = await motivo(token, m.menuId, m.id(MARTES)).expect(200);

    expect(res.body).toMatchObject({
      origen: 'REEMPLAZO_PRESUPUESTO',
      reglasAplicadas: ['REEMPLAZO_PRESUPUESTO'],
      costo: { estimado: null, incompleto: true },
      resumen: 'Reemplazo por presupuesto: Q22.00 más barato',
    });
  });

  it('un espacio sin platillo no tiene motivo (422)', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const m = await crearMenu(hogarId);
    const res = await motivo(token, m.menuId, m.id('2026-11-04')).expect(422);
    expect(res.body.codigo).toBe('SIN_PLATILLO');
  });

  it('el menú o el espacio de otro hogar, o un id mal formado, es 404 (RNF-06)', async () => {
    const ana = await hogarDe('Ana');
    const rene = await hogarDe('Rene');
    const m = await crearMenu(ana.hogarId);
    const propio = await crearMenu(rene.hogarId);

    await motivo(rene.token, m.menuId, m.id(LUNES)).expect(404);
    await motivo(rene.token, propio.menuId, m.id(LUNES)).expect(404);
    await motivo(rene.token, 'no-es-un-id', m.id(LUNES)).expect(404);
    await motivo(rene.token, propio.menuId, 'no-es-un-id').expect(404);
  });

  it('exige sesión', async () => {
    await http()
      .get(
        `${API}/menus/00000000-0000-4000-8000-000000000000/detalles/00000000-0000-4000-8000-000000000001/motivo`,
      )
      .expect(401);
  });
});
