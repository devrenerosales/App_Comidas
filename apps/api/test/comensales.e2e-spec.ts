/**
 * HU-03 Registrar comensales con factor de porción — integración contra PostgreSQL real
 * (TEST_DATABASE_URL). Cubre CA-03.1..6 de docs/03-pruebas/features/HU-03.feature
 * (PF-M1-03.1..6), CU-01.3 2a, 2b, E1, E2 y E3, D-02 y la autorización RNF-06 / RN-10.
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { comensal, eq, sql } from '@menu/db';
import { crearAppConBd, describeConBd, usarBaseDePruebas } from './utils/base-datos';

const API = '/api/v1';
const RENE = { nombre: 'Rene', correo: 'rene@correo.com', contrasena: 'Almuerzo2026' };
const ANA = { nombre: 'Ana', correo: 'ana@correo.com', contrasena: 'Pepian2026' };
const LUIS = { nombre: 'Luis', correo: 'luis@correo.com', contrasena: 'Tamales2026' };
const MENSAJE_FACTOR = 'El factor debe estar entre 0.25 y 2.0 en pasos de 0.25';

type Datos = typeof RENE;

describeConBd('HU-03 Registrar comensales (integración)', () => {
  const bd = usarBaseDePruebas({ suite: 'comensales', sembrar: false, truncarEntrePruebas: true });
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const con = (token: string) => ({ Authorization: `Bearer ${token}` });

  const registrar = async (datos: Datos): Promise<string> =>
    (await http().post(`${API}/auth/registro`).send(datos).expect(201)).body.accessToken;

  const crearHogar = async (token: string, nombre: string): Promise<string> =>
    (await http().post(`${API}/hogares`).set(con(token)).send({ nombre }).expect(201)).body
      .accessToken;

  const agregar = (token: string, cuerpo: Record<string, unknown>) =>
    http().post(`${API}/hogar/comensales`).set(con(token)).send(cuerpo);

  const listar = (token: string, query = '') =>
    http().get(`${API}/hogar/comensales${query}`).set(con(token)).expect(200);

  /** "Familia Rosales" con Rene, Ana y Diego en 1.0; devuelve el token de Rene y los ids. */
  const familiaRosales = async () => {
    const rene = await crearHogar(await registrar(RENE), 'Familia Rosales');
    const ids: Record<string, string> = {};
    for (const nombre of ['Rene', 'Ana', 'Diego']) {
      ids[nombre] = (await agregar(rene, { nombre }).expect(201)).body.comensal.id;
    }
    return { rene, ids };
  };

  /** Ana se une a "Familia Rosales" como MIEMBRO con un enlace. */
  const unirAna = async (rene: string): Promise<string> => {
    const enlace: string = (
      await http()
        .post(`${API}/hogar/invitaciones`)
        .set(con(rene))
        .send({ medio: 'ENLACE' })
        .expect(201)
    ).body.enlace;
    const token = enlace.split('/invitacion/')[1] as string;
    return (
      await http()
        .post(`${API}/invitaciones/${token}/aceptar`)
        .set(con(await registrar(ANA)))
        .expect(200)
    ).body.accessToken;
  };

  beforeAll(async () => {
    app = await crearAppConBd(bd.base);
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('CA-03.1 Agregar un comensal con el factor sugerido', () => {
    it('CA-03.1 agrego a "Abuela Carmen" sin cambiar el factor: queda en 1.0 y Σ factores 4.0', async () => {
      const { rene } = await familiaRosales();
      const res = await agregar(rene, { nombre: '  Abuela   Carmen ' }).expect(201);
      expect(res.body).toEqual({
        comensal: {
          id: expect.any(String),
          nombre: 'Abuela Carmen',
          tipo: 'ADULTO',
          factorPorcion: '1.00',
          activo: true,
        },
        totales: { activos: 4, adultos: 4, ninos: 0, sumaFactores: '4.00' },
      });

      const lista = await listar(rene);
      expect(lista.body.comensales.map((c: { nombre: string }) => c.nombre)).toEqual([
        'Rene',
        'Ana',
        'Diego',
        'Abuela Carmen',
      ]);
      expect(lista.body.totales).toEqual({
        activos: 4,
        adultos: 4,
        ninos: 0,
        sumaFactores: '4.00',
      });
      const [fila] = await bd.db
        .select()
        .from(comensal)
        .where(eq(comensal.nombre, 'Abuela Carmen'));
      expect(fila).toMatchObject({ nombreNormalizado: 'abuela carmen', factorPorcion: '1.00' });
    });

    it('CA-03.1 un hogar nuevo no tiene comensales y su total de porciones es 0', async () => {
      const rene = await crearHogar(await registrar(RENE), 'Familia Rosales');
      const lista = await listar(rene);
      expect(lista.body).toEqual({
        comensales: [],
        totales: { activos: 0, adultos: 0, ninos: 0, sumaFactores: '0.00' },
      });
    });
  });

  describe('CA-03.2 Quitar un comensal', () => {
    it('CA-03.2 quito a "Diego" y confirmo: queda inactivo y el hogar tiene 3 activos', async () => {
      const { rene, ids } = await familiaRosales();
      await agregar(rene, { nombre: 'Abuela Carmen' }).expect(201);

      const res = await http()
        .delete(`${API}/hogar/comensales/${ids.Diego}`)
        .set(con(rene))
        .expect(200);
      expect(res.body).toMatchObject({
        comensal: { id: ids.Diego, nombre: 'Diego', activo: false },
        totales: { activos: 3, sumaFactores: '3.00' },
      });
      // No se borra: baja lógica.
      const [fila] = await bd.db.select().from(comensal).where(eq(comensal.id, ids.Diego!));
      expect(fila?.activo).toBe(false);

      const activos = await listar(rene);
      expect(activos.body.comensales).toHaveLength(3);
      const todos = await listar(rene, '?incluirInactivos=true');
      expect(todos.body.comensales).toHaveLength(4);
      expect(todos.body.comensales[3]).toMatchObject({ nombre: 'Diego', activo: false });
      expect(todos.body.totales.activos).toBe(3);

      // Repetir no es error.
      await http().delete(`${API}/hogar/comensales/${ids.Diego}`).set(con(rene)).expect(200);
    });

    it('CA-03.2 reactivar a "Diego" lo vuelve a contar en el total de porciones', async () => {
      const { rene, ids } = await familiaRosales();
      await http().delete(`${API}/hogar/comensales/${ids.Diego}`).set(con(rene)).expect(200);
      const res = await http()
        .post(`${API}/hogar/comensales/${ids.Diego}/reactivar`)
        .set(con(rene))
        .expect(200);
      expect(res.body).toMatchObject({
        comensal: { nombre: 'Diego', activo: true },
        totales: { activos: 3, sumaFactores: '3.00' },
      });
    });

    it('CA-03.2 CU-01.3 E2: no se puede quitar el último comensal activo', async () => {
      const rene = await crearHogar(await registrar(RENE), 'Familia Rosales');
      const unico = (await agregar(rene, { nombre: 'Rene' }).expect(201)).body.comensal.id;
      const res = await http()
        .delete(`${API}/hogar/comensales/${unico}`)
        .set(con(rene))
        .expect(422);
      expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
      expect(res.body).toMatchObject({
        codigo: 'ULTIMO_COMENSAL',
        detail: 'Debe quedar al menos un comensal activo en el hogar',
      });
      expect((await listar(rene)).body.totales.activos).toBe(1);
    });

    it('CA-03.2 CU-01.3 E2: dos bajas simultáneas de los dos últimos dejan al menos uno activo', async () => {
      const rene = await crearHogar(await registrar(RENE), 'Familia Rosales');
      const a = (await agregar(rene, { nombre: 'Rene' }).expect(201)).body.comensal.id;
      const b = (await agregar(rene, { nombre: 'Ana' }).expect(201)).body.comensal.id;
      const resultados = await Promise.all(
        [a, b].map((id) => http().delete(`${API}/hogar/comensales/${id}`).set(con(rene))),
      );
      expect(resultados.map((r) => r.status).sort()).toEqual([200, 422]);
      expect((await listar(rene)).body.totales.activos).toBe(1);
    });
  });

  describe('CA-03.3 Nombre repetido', () => {
    it('CA-03.3 agregar otro "Ana" (sin importar mayúsculas, espacios ni tildes) → 409 y no se guarda', async () => {
      const { rene } = await familiaRosales();
      for (const nombre of ['Ana', ' ana ', 'ANA', 'Aná']) {
        const res = await agregar(rene, { nombre }).expect(409);
        expect(res.body).toMatchObject({
          status: 409,
          codigo: 'NOMBRE_REPETIDO',
          detail: 'Ya existe un comensal con ese nombre',
          errores: [{ campo: 'nombre', mensaje: 'Ya existe un comensal con ese nombre' }],
          activo: true,
        });
      }
      expect(await bd.db.select().from(comensal)).toHaveLength(3);
    });

    it('CA-03.3 renombrar a "Diego" como "Ana" → 409 y conserva su nombre', async () => {
      const { rene, ids } = await familiaRosales();
      await http()
        .patch(`${API}/hogar/comensales/${ids.Diego}`)
        .set(con(rene))
        .send({ nombre: 'ana' })
        .expect(409);
      const [fila] = await bd.db.select().from(comensal).where(eq(comensal.id, ids.Diego!));
      expect(fila?.nombre).toBe('Diego');
    });

    it('CA-03.3 si el repetido está inactivo se indica su id para reactivarlo', async () => {
      const { rene, ids } = await familiaRosales();
      await http().delete(`${API}/hogar/comensales/${ids.Diego}`).set(con(rene)).expect(200);
      const res = await agregar(rene, { nombre: 'Diego' }).expect(409);
      expect(res.body).toMatchObject({ comensalId: ids.Diego, activo: false });
    });

    it('CA-03.3 el mismo nombre en otro hogar sí se permite', async () => {
      await familiaRosales();
      const luis = await crearHogar(await registrar(LUIS), 'Familia López');
      await agregar(luis, { nombre: 'Ana' }).expect(201);
    });

    it('CA-03.3 CU-01.3 E1: nombre vacío o de más de 60 caracteres → 422 NOMBRE_COMENSAL_INVALIDO', async () => {
      const { rene } = await familiaRosales();
      const vacio = await agregar(rene, { nombre: '   ' }).expect(422);
      expect(vacio.body).toMatchObject({
        codigo: 'NOMBRE_COMENSAL_INVALIDO',
        detail: 'Ingresa el nombre del comensal',
      });
      await agregar(rene, { nombre: 'x'.repeat(61) }).expect(422);
      await agregar(rene, {}).expect(422);
      expect(await bd.db.select().from(comensal)).toHaveLength(3);
    });
  });

  describe('CA-03.4 Un miembro no puede modificar comensales', () => {
    it('CA-03.4 Ana (Miembro) intenta agregar a "Abuela Carmen": "Solo el administrador puede modificar comensales"', async () => {
      const { rene, ids } = await familiaRosales();
      const ana = await unirAna(rene);

      const res = await agregar(ana, { nombre: 'Abuela Carmen' }).expect(403);
      expect(res.body).toMatchObject({
        status: 403,
        codigo: 'SOLO_ADMINISTRADOR',
        detail: 'Solo el administrador puede modificar comensales',
      });
      await http()
        .patch(`${API}/hogar/comensales/${ids.Diego}`)
        .set(con(ana))
        .send({ factorPorcion: '0.5' })
        .expect(403);
      await http().delete(`${API}/hogar/comensales/${ids.Diego}`).set(con(ana)).expect(403);
      await http().post(`${API}/hogar/comensales/${ids.Diego}/reactivar`).set(con(ana)).expect(403);

      // Pero sí puede consultar los comensales y el total (solo lectura).
      const lista = await listar(ana);
      expect(lista.body.totales.sumaFactores).toBe('3.00');
      const filas = await bd.db.select().from(comensal);
      expect(filas).toHaveLength(3);
      expect(filas.every((f) => f.activo && f.factorPorcion === '1.00')).toBe(true);
    });

    it('CA-03.4 el rol se lee de la base: un token viejo de ADMIN no sirve si ahora es MIEMBRO', async () => {
      const { rene } = await familiaRosales();
      await bd.db.execute(sql`update miembro_hogar set rol = 'MIEMBRO'`);
      await agregar(rene, { nombre: 'Abuela Carmen' }).expect(403);
    });
  });

  describe('CA-03.5 Comensal pequeño con factor 0.5', () => {
    it('CA-03.5 agrego a "Sofía" niño con 0.5: Σ factores 3.5 y la etiqueta no cambia el cálculo', async () => {
      const { rene } = await familiaRosales();
      const res = await agregar(rene, {
        nombre: 'Sofía',
        tipo: 'NINO',
        factorPorcion: 0.5,
      }).expect(201);
      expect(res.body.comensal).toMatchObject({
        nombre: 'Sofía',
        tipo: 'NINO',
        factorPorcion: '0.50',
      });
      expect(res.body.totales).toEqual({
        activos: 4,
        adultos: 3,
        ninos: 1,
        sumaFactores: '3.50',
      });

      // Cambiar solo la etiqueta no cambia la suma.
      const editado = await http()
        .patch(`${API}/hogar/comensales/${res.body.comensal.id}`)
        .set(con(rene))
        .send({ tipo: 'ADULTO' })
        .expect(200);
      expect(editado.body.totales).toMatchObject({ adultos: 4, ninos: 0, sumaFactores: '3.50' });
    });

    it('CA-03.5 CU-01.3 2a: editar el factor recalcula la Σ factores (acepta texto decimal)', async () => {
      const { rene, ids } = await familiaRosales();
      const res = await http()
        .patch(`${API}/hogar/comensales/${ids.Diego}`)
        .set(con(rene))
        .send({ factorPorcion: '1.75', nombre: 'Diego R.' })
        .expect(200);
      expect(res.body).toMatchObject({
        comensal: { nombre: 'Diego R.', factorPorcion: '1.75' },
        totales: { sumaFactores: '3.75' },
      });
      // Un PATCH vacío no cambia nada.
      const igual = await http()
        .patch(`${API}/hogar/comensales/${ids.Diego}`)
        .set(con(rene))
        .send({})
        .expect(200);
      expect(igual.body.comensal.factorPorcion).toBe('1.75');
    });
  });

  describe('CA-03.6 Factor fuera de rango o fuera de paso', () => {
    it.each([0, 2.25, 0.3, '0.3', 'abc'])(
      'CA-03.6 cambiar el factor de "Diego" a %p → 422 y conserva 1.0',
      async (factor) => {
        const { rene, ids } = await familiaRosales();
        const res = await http()
          .patch(`${API}/hogar/comensales/${ids.Diego}`)
          .set(con(rene))
          .send({ factorPorcion: factor })
          .expect(422);
        expect(res.body).toMatchObject({ codigo: 'FACTOR_INVALIDO', detail: MENSAJE_FACTOR });
        const [fila] = await bd.db.select().from(comensal).where(eq(comensal.id, ids.Diego!));
        expect(fila?.factorPorcion).toBe('1.00');
      },
    );

    it('CA-03.6 crear con factor 2.5 → 422 FACTOR_INVALIDO y no se guarda; 0.25 y 2.0 sí', async () => {
      const { rene } = await familiaRosales();
      await agregar(rene, { nombre: 'Sofía', factorPorcion: 2.5 }).expect(422);
      expect(await bd.db.select().from(comensal)).toHaveLength(3);
      await agregar(rene, { nombre: 'Bebé', factorPorcion: 0.25 }).expect(201);
      const res = await agregar(rene, { nombre: 'Tío', factorPorcion: '2.0' }).expect(201);
      expect(res.body.totales.sumaFactores).toBe('5.25');
    });

    it('CA-03.6 la base rechaza un factor fuera de paso aunque se salte la API (CHECK)', async () => {
      const { ids } = await familiaRosales();
      await expect(
        bd.db.update(comensal).set({ factorPorcion: '0.30' }).where(eq(comensal.id, ids.Diego!)),
      ).rejects.toThrow();
    });

    it('CA-03.6 etiqueta desconocida o campos extra → 400 VALIDACION', async () => {
      const { rene } = await familiaRosales();
      await agregar(rene, { nombre: 'Sofía', tipo: 'BEBE' }).expect(400);
      await agregar(rene, { nombre: 'Sofía', hogarId: 'otro' }).expect(400);
    });
  });

  describe('RNF-06 / RN-10 Autorización', () => {
    it('RNF-06 otro hogar no ve ni edita, quita o reactiva comensales ajenos (404)', async () => {
      const { ids } = await familiaRosales();
      const luis = await crearHogar(await registrar(LUIS), 'Familia López');

      const lista = await listar(luis, '?incluirInactivos=1');
      expect(lista.body.comensales).toEqual([]);
      const ajeno = ids.Diego;
      const editar = await http()
        .patch(`${API}/hogar/comensales/${ajeno}`)
        .set(con(luis))
        .send({ factorPorcion: 0.5 })
        .expect(404);
      expect(editar.body.codigo).toBe('NO_ENCONTRADO');
      await http().delete(`${API}/hogar/comensales/${ajeno}`).set(con(luis)).expect(404);
      await http().post(`${API}/hogar/comensales/${ajeno}/reactivar`).set(con(luis)).expect(404);
      const [fila] = await bd.db.select().from(comensal).where(eq(comensal.id, ajeno!));
      expect(fila).toMatchObject({ factorPorcion: '1.00', activo: true });
    });

    it('RNF-06 un id mal formado o inexistente responde 404', async () => {
      const { rene } = await familiaRosales();
      await http().delete(`${API}/hogar/comensales/123`).set(con(rene)).expect(404);
      await http()
        .patch(`${API}/hogar/comensales/6f1c2b9e-7d3a-4b8c-9e2f-1a2b3c4d5e6f`)
        .set(con(rene))
        .send({ nombre: 'X' })
        .expect(404);
      await http()
        .post(`${API}/hogar/comensales/6f1c2b9e-7d3a-4b8c-9e2f-1a2b3c4d5e6f/reactivar`)
        .set(con(rene))
        .expect(404);
    });

    it('RNF-06 sin hogar → 403 SIN_HOGAR; sin token → 401', async () => {
      const ana = await registrar(ANA);
      const res = await http().get(`${API}/hogar/comensales`).set(con(ana)).expect(403);
      expect(res.body.codigo).toBe('SIN_HOGAR');
      await agregar(ana, { nombre: 'Ana' }).expect(403);
      await http().get(`${API}/hogar/comensales`).expect(401);
    });
  });
});
