/**
 * HU-05 Tiempos de comida, HU-06 Presupuesto y distribución y HU-07 Recálculo con vista previa —
 * integración contra PostgreSQL real (TEST_DATABASE_URL). Cubre CA-05.1..4, CA-06.1..4 y
 * CA-07.1..5 (docs/03-pruebas/features/HU-05..07.feature), el control de versión (CU-02.3 E1) y
 * la autorización RNF-06 / RN-10 de /hogar/configuracion.
 *
 * El calendario se fija en el jueves 2026-10-22 (hora de Guatemala), igual que los criterios.
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  and,
  configuracion,
  eq,
  hogar,
  menuDetalle,
  menuSemanal,
  menuTiempo,
  platillo,
  tiempoComidaConfig,
} from '@menu/db';
import { RELOJ_CONFIGURACION } from '../src/configuracion/configuracion.constants';
import { crearAppConBd, describeConBd, usarBaseDePruebas } from './utils/base-datos';

const API = '/api/v1';
const HOY = new Date('2026-10-22T15:00:00.000Z');
const RENE = { nombre: 'Rene', correo: 'rene@correo.com', contrasena: 'Almuerzo2026' };
const ANA = { nombre: 'Ana', correo: 'ana@correo.com', contrasena: 'Pepian2026' };
const LUIS = { nombre: 'Luis', correo: 'luis@correo.com', contrasena: 'Tamales2026' };

type Datos = typeof RENE;
type Porcentajes = Partial<Record<'DESAYUNO' | 'ALMUERZO' | 'CENA', string>>;

describeConBd('HU-05 / HU-06 / HU-07 Configuración de tiempos y presupuesto (integración)', () => {
  const bd = usarBaseDePruebas({ suite: 'config', sembrar: false, truncarEntrePruebas: true });
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const con = (token: string) => ({ Authorization: `Bearer ${token}` });

  const registrar = async (datos: Datos): Promise<string> =>
    (await http().post(`${API}/auth/registro`).send(datos).expect(201)).body.accessToken;

  /** Crea el hogar y devuelve el token del administrador y el id del hogar. */
  const crearHogar = async (datos: Datos, nombre: string) => {
    const res = await http()
      .post(`${API}/hogares`)
      .set(con(await registrar(datos)))
      .send({ nombre })
      .expect(201);
    return { token: res.body.accessToken as string, hogarId: res.body.hogar.id as string };
  };

  /** Rene ADMIN de "Familia Rosales" y Ana MIEMBRO. */
  const hogarConAna = async () => {
    const rene = await crearHogar(RENE, 'Familia Rosales');
    const enlace = (
      await http()
        .post(`${API}/hogar/invitaciones`)
        .set(con(rene.token))
        .send({ medio: 'ENLACE' })
        .expect(201)
    ).body.enlace as string;
    const ana = (
      await http()
        .post(`${API}/invitaciones/${enlace.split('/invitacion/')[1]}/aceptar`)
        .set(con(await registrar(ANA)))
        .expect(200)
    ).body.accessToken as string;
    return { ...rene, ana };
  };

  /** Deja la configuración con el presupuesto y los porcentajes indicados (directo en la base). */
  const fijarConfiguracion = async (hogarId: string, presupuesto: string, p: Porcentajes) => {
    const [config] = await bd.db
      .update(configuracion)
      .set({ presupuestoSemanal: presupuesto })
      .where(eq(configuracion.hogarId, hogarId))
      .returning();
    for (const tiempo of ['DESAYUNO', 'ALMUERZO', 'CENA'] as const) {
      await bd.db
        .update(tiempoComidaConfig)
        .set({ activo: p[tiempo] !== undefined, porcentaje: p[tiempo] ?? '0.00' })
        .where(
          and(
            eq(tiempoComidaConfig.configuracionId, config!.id),
            eq(tiempoComidaConfig.tiempo, tiempo),
          ),
        );
    }
  };

  const leer = (token: string) => http().get(`${API}/hogar/configuracion`).set(con(token));
  const vistaPrevia = (token: string, cuerpo: Record<string, unknown>) =>
    http().post(`${API}/hogar/configuracion/vista-previa`).set(con(token)).send(cuerpo);
  const guardarTiempos = (token: string, cuerpo: Record<string, unknown>) =>
    http().put(`${API}/hogar/configuracion/tiempos`).set(con(token)).send(cuerpo);
  const guardarPresupuesto = (token: string, cuerpo: Record<string, unknown>) =>
    http().put(`${API}/hogar/configuracion/presupuesto`).set(con(token)).send(cuerpo);

  /** Tiempos activos de la respuesta como `{ tiempo: [porcentaje, monto] }`. */
  const activos = (body: {
    tiempos: { tiempo: string; activo: boolean; porcentaje: string; monto: string }[];
  }) =>
    Object.fromEntries(
      body.tiempos.filter((t) => t.activo).map((t) => [t.tiempo, [t.porcentaje, t.monto]]),
    );

  /** Menú semanal con su copia por tiempo (D-04) y un platillo en un día. */
  const crearMenu = async (
    hogarId: string,
    datos: {
      fechaInicio: string;
      fechaFin: string;
      estado: 'BORRADOR' | 'APROBADO' | 'HISTORICO';
      tiempos: {
        tiempo: 'DESAYUNO' | 'ALMUERZO' | 'CENA';
        porcentaje: string;
        presupuesto: string;
      }[];
      platillo: { nombre: string; fecha: string; tiempo: 'DESAYUNO' | 'ALMUERZO' | 'CENA' };
    },
  ) => {
    const [plato] = await bd.db
      .insert(platillo)
      .values({
        hogarId,
        nombre: datos.platillo.nombre,
        nombreNormalizado: datos.platillo.nombre.toLowerCase() + datos.fechaInicio,
      })
      .returning();
    const aprobado = datos.estado !== 'BORRADOR';
    const [menu] = await bd.db
      .insert(menuSemanal)
      .values({
        hogarId,
        fechaInicio: datos.fechaInicio,
        fechaFin: datos.fechaFin,
        estado: datos.estado,
        configuracionVersion: 1,
        presupuestoSemanal: '600.00',
        aprobadoEn: aprobado ? new Date('2026-10-21T15:00:00.000Z') : null,
      })
      .returning();
    await bd.db.insert(menuTiempo).values(datos.tiempos.map((t) => ({ ...t, menuId: menu!.id })));
    await bd.db.insert(menuDetalle).values({
      menuId: menu!.id,
      fecha: datos.platillo.fecha,
      tiempo: datos.platillo.tiempo,
      platilloId: plato!.id,
    });
    return menu!.id;
  };

  beforeAll(async () => {
    app = await crearAppConBd(bd.base, (b) =>
      b.overrideProvider(RELOJ_CONFIGURACION).useValue(() => HOY),
    );
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('GET /hogar/configuracion', () => {
    it('CA-05.1 hogar nuevo: solo almuerzo al 100 % con Q250 y montos en texto decimal', async () => {
      const { token } = await crearHogar(RENE, 'Familia Rosales');
      const res = await leer(token).expect(200);
      expect(res.body).toMatchObject({
        version: 1,
        presupuestoSemanal: '250.00',
        diaInicioSemana: 'DOMINGO',
        diaPlanificacion: 'DOMINGO',
        horaPlanificacion: 8,
        pesos: { preferencia: '0.40', novedad: '0.25', ahorro: '0.20', afinidad: '0.15' },
        tiempos: [
          { tiempo: 'DESAYUNO', activo: false, porcentaje: '0.00', monto: '0.00' },
          { tiempo: 'ALMUERZO', activo: true, porcentaje: '100.00', monto: '250.00' },
          { tiempo: 'CENA', activo: false, porcentaje: '0.00', monto: '0.00' },
        ],
      });
      expect(typeof res.body.actualizadoEn).toBe('string');
    });
  });

  describe('HU-05 Tiempos de comida parametrizables', () => {
    it('CA-05.1 de solo almuerzo a almuerzo y cena con Q500: almuerzo Q300 y cena Q200', async () => {
      const { token, hogarId } = await crearHogar(RENE, 'Familia Rosales');
      await fijarConfiguracion(hogarId, '500.00', { ALMUERZO: '100.00' });

      const vista = await vistaPrevia(token, { tiempos: ['ALMUERZO', 'CENA'] }).expect(200);
      expect(vista.body.nuevo).toEqual([
        { tiempo: 'ALMUERZO', porcentaje: '60.00', monto: '300.00' },
        { tiempo: 'CENA', porcentaje: '40.00', monto: '200.00' },
      ]);

      const res = await guardarTiempos(token, {
        version: vista.body.version,
        tiempos: vista.body.nuevo.map(
          ({ tiempo, porcentaje }: { tiempo: string; porcentaje: string }) => ({
            tiempo,
            porcentaje,
          }),
        ),
      }).expect(200);
      expect(activos(res.body)).toEqual({
        ALMUERZO: ['60.00', '300.00'],
        CENA: ['40.00', '200.00'],
      });
      expect(res.body.version).toBe(2);
      expect(res.body.borradoresDesactualizados).toEqual([]);
      // El próximo menú se sugerirá con almuerzo y cena: la configuración vigente los tiene activos.
      expect(activos((await leer(token).expect(200)).body)).toEqual({
        ALMUERZO: ['60.00', '300.00'],
        CENA: ['40.00', '200.00'],
      });
      expect(vista.body.aplicaDesde).toBe('2026-10-25');
    });

    it('CA-05.2 dos tiempos: desayuno y almuerzo con Q500 → Q145 y Q355', async () => {
      const { token, hogarId } = await crearHogar(RENE, 'Familia Rosales');
      await fijarConfiguracion(hogarId, '500.00', { ALMUERZO: '100.00' });
      const vista = await vistaPrevia(token, { tiempos: ['ALMUERZO', 'DESAYUNO'] }).expect(200);
      expect(vista.body.nuevo).toEqual([
        { tiempo: 'DESAYUNO', porcentaje: '29.00', monto: '145.00' },
        { tiempo: 'ALMUERZO', porcentaje: '71.00', monto: '355.00' },
      ]);
      const res = await guardarTiempos(token, {
        version: 1,
        tiempos: [
          { tiempo: 'DESAYUNO', porcentaje: '29.00' },
          { tiempo: 'ALMUERZO', porcentaje: 71 },
        ],
      }).expect(200);
      expect(activos(res.body)).toEqual({
        DESAYUNO: ['29.00', '145.00'],
        ALMUERZO: ['71.00', '355.00'],
      });
    });

    it('CA-05.3 un solo tiempo que no es almuerzo → 422 COMBINACION_TIEMPOS_INVALIDA sin vista previa', async () => {
      const { token } = await crearHogar(RENE, 'Familia Rosales');
      const res = await vistaPrevia(token, { tiempos: ['CENA'] }).expect(422);
      expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
      expect(res.body).toMatchObject({
        codigo: 'COMBINACION_TIEMPOS_INVALIDA',
        errores: [{ campo: 'tiempos' }],
      });
      await guardarTiempos(token, {
        version: 1,
        tiempos: [{ tiempo: 'CENA', porcentaje: '100' }],
      }).expect(422);
      await guardarTiempos(token, {
        version: 1,
        tiempos: [
          { tiempo: 'CENA', porcentaje: '50' },
          { tiempo: 'CENA', porcentaje: '50' },
        ],
      }).expect(422);
      // Repetidos o desconocidos en la vista previa: 400 de validación del DTO.
      await vistaPrevia(token, { tiempos: ['CENA', 'CENA'] }).expect(400);
      await vistaPrevia(token, { tiempos: ['MERIENDA'] }).expect(400);
      expect((await leer(token).expect(200)).body.version).toBe(1);
    });

    it('CA-05.4 un miembro no puede cambiar los tiempos: 403 y la configuración no cambia', async () => {
      const { ana, token } = await hogarConAna();
      const mensaje = 'Solo el administrador puede cambiar los tiempos de comida';
      const previa = await vistaPrevia(ana, { tiempos: ['DESAYUNO', 'ALMUERZO'] }).expect(403);
      expect(previa.body).toMatchObject({ codigo: 'SOLO_ADMINISTRADOR', detail: mensaje });
      const res = await guardarTiempos(ana, {
        version: 1,
        tiempos: [
          { tiempo: 'DESAYUNO', porcentaje: '29' },
          { tiempo: 'ALMUERZO', porcentaje: '71' },
        ],
      }).expect(403);
      expect(res.body.detail).toBe(mensaje);
      // Aunque el cuerpo no sea válido, el miembro recibe 403 (la guarda corre antes de validar).
      expect((await guardarTiempos(ana, {}).expect(403)).body.detail).toBe(mensaje);
      // El miembro sí puede leer la configuración.
      const vista = await leer(ana).expect(200);
      expect(activos(vista.body)).toEqual({ ALMUERZO: ['100.00', '250.00'] });
      expect((await leer(token).expect(200)).body.version).toBe(1);
    });
  });

  describe('HU-06 Presupuesto semanal y su distribución', () => {
    it('CA-06.1 tres tiempos, Q700 con 20/50/30 → Q140.00, Q350.00 y Q210.00', async () => {
      const { token, hogarId } = await crearHogar(RENE, 'Familia Rosales');
      await fijarConfiguracion(hogarId, '250.00', {
        DESAYUNO: '20.00',
        ALMUERZO: '50.00',
        CENA: '30.00',
      });
      const res = await guardarPresupuesto(token, {
        version: 1,
        presupuestoSemanal: '700',
        modo: 'PORCENTAJE',
        distribucion: [
          { tiempo: 'DESAYUNO', porcentaje: '20' },
          { tiempo: 'ALMUERZO', porcentaje: '50' },
          { tiempo: 'CENA', porcentaje: '30' },
        ],
      }).expect(200);
      expect(res.body.presupuestoSemanal).toBe('700.00');
      expect(activos(res.body)).toEqual({
        DESAYUNO: ['20.00', '140.00'],
        ALMUERZO: ['50.00', '350.00'],
        CENA: ['30.00', '210.00'],
      });
      const [config] = await bd.db
        .select()
        .from(configuracion)
        .where(eq(configuracion.hogarId, hogarId));
      expect(config).toMatchObject({ presupuestoSemanal: '700.00', version: 2 });
    });

    it('CA-06.2 por monto: Q320 almuerzo y Q180 cena de Q500 → 64 % y 36 %', async () => {
      const { token, hogarId } = await crearHogar(RENE, 'Familia Rosales');
      await fijarConfiguracion(hogarId, '500.00', { ALMUERZO: '60.00', CENA: '40.00' });
      const res = await guardarPresupuesto(token, {
        version: 1,
        presupuestoSemanal: '500.00',
        modo: 'MONTO',
        distribucion: [
          { tiempo: 'CENA', monto: '180' },
          { tiempo: 'ALMUERZO', monto: 320 },
        ],
      }).expect(200);
      expect(activos(res.body)).toEqual({
        ALMUERZO: ['64.00', '320.00'],
        CENA: ['36.00', '180.00'],
      });
      const filas = await bd.db.select().from(tiempoComidaConfig);
      expect(Object.fromEntries(filas.map((f) => [f.tiempo, f.porcentaje]))).toEqual({
        DESAYUNO: '0.00',
        ALMUERZO: '64.00',
        CENA: '36.00',
      });
    });

    it('CA-06.3 porcentajes 20/50/25 → 422 "Faltan 5 % por asignar" y no se guarda', async () => {
      const { token, hogarId } = await crearHogar(RENE, 'Familia Rosales');
      await fijarConfiguracion(hogarId, '500.00', {
        DESAYUNO: '20.00',
        ALMUERZO: '50.00',
        CENA: '30.00',
      });
      const res = await guardarPresupuesto(token, {
        version: 1,
        presupuestoSemanal: '500.00',
        modo: 'PORCENTAJE',
        distribucion: [
          { tiempo: 'DESAYUNO', porcentaje: '20' },
          { tiempo: 'ALMUERZO', porcentaje: '50' },
          { tiempo: 'CENA', porcentaje: '25' },
        ],
      }).expect(422);
      expect(res.body).toMatchObject({
        codigo: 'PORCENTAJES_NO_SUMAN_100',
        detail: 'Faltan 5 % por asignar',
        errores: [{ campo: 'distribucion', mensaje: 'Faltan 5 % por asignar' }],
      });
      const sobran = await guardarTiempos(token, {
        version: 1,
        tiempos: [
          { tiempo: 'ALMUERZO', porcentaje: '70' },
          { tiempo: 'CENA', porcentaje: '40' },
        ],
      }).expect(422);
      expect(sobran.body.detail).toBe('Sobran 10 %');
      expect((await leer(token).expect(200)).body.version).toBe(1);
    });

    it('CA-06.4 montos Q320 + Q200 con Q500 → 422 "Excede el presupuesto por Q20.00"', async () => {
      const { token, hogarId } = await crearHogar(RENE, 'Familia Rosales');
      await fijarConfiguracion(hogarId, '500.00', { ALMUERZO: '60.00', CENA: '40.00' });
      const res = await guardarPresupuesto(token, {
        version: 1,
        presupuestoSemanal: '500',
        modo: 'MONTO',
        distribucion: [
          { tiempo: 'ALMUERZO', monto: '320' },
          { tiempo: 'CENA', monto: '200' },
        ],
      }).expect(422);
      expect(res.body).toMatchObject({
        codigo: 'MONTOS_NO_SUMAN_PRESUPUESTO',
        detail: 'Excede el presupuesto por Q20.00',
      });
      const faltan = await guardarPresupuesto(token, {
        version: 1,
        presupuestoSemanal: '500',
        modo: 'MONTO',
        distribucion: [
          { tiempo: 'ALMUERZO', monto: '300' },
          { tiempo: 'CENA', monto: '180' },
        ],
      }).expect(422);
      expect(faltan.body.detail).toBe('Faltan Q20.00 por asignar');
      const filas = await bd.db.select().from(tiempoComidaConfig);
      expect(filas.find((f) => f.tiempo === 'ALMUERZO')?.porcentaje).toBe('60.00');
    });

    it('CA-06.1 cambiar solo el monto conserva los porcentajes y recalcula los montos', async () => {
      const { token, hogarId } = await crearHogar(RENE, 'Familia Rosales');
      await fijarConfiguracion(hogarId, '500.00', { ALMUERZO: '60.00', CENA: '40.00' });
      const res = await guardarPresupuesto(token, { version: 1, presupuestoSemanal: '600' }).expect(
        200,
      );
      expect(activos(res.body)).toEqual({
        ALMUERZO: ['60.00', '360.00'],
        CENA: ['40.00', '240.00'],
      });
    });

    it('CA-06.1 presupuesto inválido → 422 "Ingresa un presupuesto mayor a Q0.00"', async () => {
      const { token } = await crearHogar(RENE, 'Familia Rosales');
      for (const presupuestoSemanal of ['0', '-5', '10.123', 'abc']) {
        const res = await guardarPresupuesto(token, { version: 1, presupuestoSemanal }).expect(422);
        expect(res.body).toMatchObject({
          codigo: 'PRESUPUESTO_INVALIDO',
          detail: 'Ingresa un presupuesto mayor a Q0.00',
        });
      }
      await guardarPresupuesto(token, { version: 1 }).expect(400);
    });

    it('CA-06.2 la distribución debe traer exactamente los tiempos activos', async () => {
      const { token } = await crearHogar(RENE, 'Familia Rosales');
      const res = await guardarPresupuesto(token, {
        version: 1,
        presupuestoSemanal: '500',
        modo: 'PORCENTAJE',
        distribucion: [
          { tiempo: 'ALMUERZO', porcentaje: '60' },
          { tiempo: 'CENA', porcentaje: '40' },
        ],
      }).expect(422);
      expect(res.body.codigo).toBe('DISTRIBUCION_INVALIDA');
      const sinMonto = await guardarPresupuesto(token, {
        version: 1,
        presupuestoSemanal: '500',
        modo: 'MONTO',
        distribucion: [{ tiempo: 'ALMUERZO', porcentaje: '100' }],
      }).expect(422);
      expect(sinMonto.body.codigo).toBe('DISTRIBUCION_INVALIDA');
      const malFormado = await guardarPresupuesto(token, {
        version: 1,
        presupuestoSemanal: '500',
        modo: 'PORCENTAJE',
        distribucion: [{ tiempo: 'ALMUERZO', porcentaje: '100.001' }],
      }).expect(422);
      expect(malFormado.body.codigo).toBe('DISTRIBUCION_INVALIDA');
    });

    it('CA-06.1 un miembro no puede cambiar el presupuesto (RN-10)', async () => {
      const { ana } = await hogarConAna();
      const res = await guardarPresupuesto(ana, { version: 1, presupuestoSemanal: '900' }).expect(
        403,
      );
      expect(res.body).toMatchObject({
        codigo: 'SOLO_ADMINISTRADOR',
        detail: 'Solo el administrador puede cambiar esta configuración',
      });
    });
  });

  describe('HU-07 Recálculo de la distribución con vista previa', () => {
    it('CA-07.1 de almuerzo 60 % (Q360) y cena 40 % (Q240) a tres tiempos: Q120/Q300/Q180 sin guardar', async () => {
      const { token, hogarId } = await crearHogar(RENE, 'Familia Rosales');
      await fijarConfiguracion(hogarId, '600.00', { ALMUERZO: '60.00', CENA: '40.00' });
      const res = await vistaPrevia(token, { tiempos: ['DESAYUNO', 'ALMUERZO', 'CENA'] }).expect(
        200,
      );
      expect(
        res.body.impacto.map(
          (i: { tiempo: string; actual: { monto: string } | null; nuevo: { monto: string } }) => [
            i.tiempo,
            i.actual?.monto ?? '—',
            i.nuevo.monto,
          ],
        ),
      ).toEqual([
        ['DESAYUNO', '—', '120.00'],
        ['ALMUERZO', '360.00', '300.00'],
        ['CENA', '240.00', '180.00'],
      ]);
      expect(res.body.impacto[0].cambio).toBe('AGREGADO');
      expect(res.body.presupuestoSemanal).toBe('600.00');
      // No se ha guardado ningún cambio.
      const actual = await leer(token).expect(200);
      expect(actual.body.version).toBe(1);
      expect(activos(actual.body)).toEqual({
        ALMUERZO: ['60.00', '360.00'],
        CENA: ['40.00', '240.00'],
      });
    });

    it('CA-07.2 con el menú del 2026-10-25 aprobado: se conserva y lo nuevo aplica desde 2026-11-01', async () => {
      const { token, hogarId } = await crearHogar(RENE, 'Familia Rosales');
      await fijarConfiguracion(hogarId, '600.00', { ALMUERZO: '60.00', CENA: '40.00' });
      const aprobado = await crearMenu(hogarId, {
        fechaInicio: '2026-10-25',
        fechaFin: '2026-10-31',
        estado: 'APROBADO',
        tiempos: [
          { tiempo: 'ALMUERZO', porcentaje: '60.00', presupuesto: '360.00' },
          { tiempo: 'CENA', porcentaje: '40.00', presupuesto: '240.00' },
        ],
        platillo: { nombre: 'Pollo en crema', fecha: '2026-10-26', tiempo: 'ALMUERZO' },
      });

      const vista = await vistaPrevia(token, { tiempos: ['DESAYUNO', 'ALMUERZO', 'CENA'] }).expect(
        200,
      );
      expect(vista.body).toMatchObject({
        aplicaDesde: '2026-11-01',
        menusAprobadosConservados: [
          { id: aprobado, fechaInicio: '2026-10-25', fechaFin: '2026-10-31' },
        ],
        borradoresADesactualizar: [],
      });
      const res = await guardarTiempos(token, {
        version: 1,
        tiempos: [
          { tiempo: 'DESAYUNO', porcentaje: '20' },
          { tiempo: 'ALMUERZO', porcentaje: '50' },
          { tiempo: 'CENA', porcentaje: '30' },
        ],
      }).expect(200);
      // La semana del 2026-11-01 se sugerirá con desayuno Q120, almuerzo Q300 y cena Q180.
      expect(activos(res.body)).toEqual({
        DESAYUNO: ['20.00', '120.00'],
        ALMUERZO: ['50.00', '300.00'],
        CENA: ['30.00', '180.00'],
      });
      // El aprobado conserva almuerzo y cena, "Pollo en crema" y el presupuesto Q360 (D-04).
      const [menu] = await bd.db.select().from(menuSemanal).where(eq(menuSemanal.id, aprobado));
      expect(menu).toMatchObject({ estado: 'APROBADO', desactualizado: false });
      const tiempos = await bd.db.select().from(menuTiempo).where(eq(menuTiempo.menuId, aprobado));
      expect(Object.fromEntries(tiempos.map((t) => [t.tiempo, t.presupuesto]))).toEqual({
        ALMUERZO: '360.00',
        CENA: '240.00',
      });
      const [detalle] = await bd.db
        .select({ nombre: platillo.nombre, fecha: menuDetalle.fecha })
        .from(menuDetalle)
        .innerJoin(platillo, eq(platillo.id, menuDetalle.platilloId))
        .where(eq(menuDetalle.menuId, aprobado));
      expect(detalle).toEqual({ nombre: 'Pollo en crema', fecha: '2026-10-26' });
      expect(res.body.borradoresDesactualizados).toEqual([]);
    });

    it('CA-07.3 cancelar desde la vista previa: el hogar sigue con solo almuerzo y Q250', async () => {
      const { token } = await crearHogar(RENE, 'Familia Rosales');
      const vista = await vistaPrevia(token, { tiempos: ['ALMUERZO', 'CENA'] }).expect(200);
      expect(vista.body.nuevo.map((r: { monto: string }) => r.monto)).toEqual(['150.00', '100.00']);
      // Cancelar no llama a la API: la configuración vigente no cambia.
      const actual = await leer(token).expect(200);
      expect(actual.body.presupuestoSemanal).toBe('250.00');
      expect(activos(actual.body)).toEqual({ ALMUERZO: ['100.00', '250.00'] });
    });

    it('CA-07.4 el borrador del 2026-11-01 queda Desactualizado y sus platillos no cambian', async () => {
      const { token, hogarId } = await crearHogar(RENE, 'Familia Rosales');
      const borrador = await crearMenu(hogarId, {
        fechaInicio: '2026-11-01',
        fechaFin: '2026-11-07',
        estado: 'BORRADOR',
        tiempos: [{ tiempo: 'ALMUERZO', porcentaje: '100.00', presupuesto: '250.00' }],
        platillo: { nombre: 'Pepián de pollo', fecha: '2026-11-03', tiempo: 'ALMUERZO' },
      });
      // Un menú histórico y uno ya terminado no se tocan.
      const pasado = await crearMenu(hogarId, {
        fechaInicio: '2026-10-11',
        fechaFin: '2026-10-17',
        estado: 'BORRADOR',
        tiempos: [{ tiempo: 'ALMUERZO', porcentaje: '100.00', presupuesto: '250.00' }],
        platillo: { nombre: 'Caldo de res', fecha: '2026-10-12', tiempo: 'ALMUERZO' },
      });

      const vista = await vistaPrevia(token, { tiempos: ['ALMUERZO', 'CENA'] }).expect(200);
      expect(vista.body.borradoresADesactualizar).toEqual([
        { id: borrador, fechaInicio: '2026-11-01', fechaFin: '2026-11-07' },
      ]);
      const res = await guardarTiempos(token, {
        version: 1,
        tiempos: [
          { tiempo: 'ALMUERZO', porcentaje: '60' },
          { tiempo: 'CENA', porcentaje: '40' },
        ],
      }).expect(200);
      expect(res.body.borradoresDesactualizados).toEqual([
        { id: borrador, fechaInicio: '2026-11-01', fechaFin: '2026-11-07' },
      ]);
      const menus = await bd.db.select().from(menuSemanal);
      expect(menus.find((m) => m.id === borrador)).toMatchObject({
        estado: 'BORRADOR',
        desactualizado: true,
      });
      expect(menus.find((m) => m.id === pasado)?.desactualizado).toBe(false);
      // "Pepián de pollo" del martes sigue en el borrador y su copia por tiempo no cambia.
      const [detalle] = await bd.db
        .select({ nombre: platillo.nombre, tiempo: menuDetalle.tiempo })
        .from(menuDetalle)
        .innerJoin(platillo, eq(platillo.id, menuDetalle.platilloId))
        .where(eq(menuDetalle.menuId, borrador));
      expect(detalle).toEqual({ nombre: 'Pepián de pollo', tiempo: 'ALMUERZO' });
      const tiempos = await bd.db.select().from(menuTiempo).where(eq(menuTiempo.menuId, borrador));
      expect(tiempos).toHaveLength(1);
    });

    it('CA-07.4 cambiar solo el presupuesto también marca los borradores futuros', async () => {
      const { token, hogarId } = await crearHogar(RENE, 'Familia Rosales');
      const borrador = await crearMenu(hogarId, {
        fechaInicio: '2026-10-25',
        fechaFin: '2026-10-31',
        estado: 'BORRADOR',
        tiempos: [{ tiempo: 'ALMUERZO', porcentaje: '100.00', presupuesto: '250.00' }],
        platillo: { nombre: 'Pepián de pollo', fecha: '2026-10-27', tiempo: 'ALMUERZO' },
      });
      // Guardar lo mismo no cambia nada: no sube la versión ni marca borradores.
      const igual = await guardarPresupuesto(token, { version: 1, presupuestoSemanal: '250' });
      expect(igual.status).toBe(200);
      expect(igual.body).toMatchObject({ version: 1, borradoresDesactualizados: [] });
      const res = await guardarPresupuesto(token, { version: 1, presupuestoSemanal: '300' }).expect(
        200,
      );
      expect(res.body.borradoresDesactualizados).toEqual([
        { id: borrador, fechaInicio: '2026-10-25', fechaFin: '2026-10-31' },
      ]);
    });

    it('CA-07.5 ajuste en la vista previa que no suma 100 % → 422 "Faltan 5 % por asignar"', async () => {
      const { token } = await crearHogar(RENE, 'Familia Rosales');
      const res = await vistaPrevia(token, {
        tiempos: ['DESAYUNO', 'ALMUERZO', 'CENA'],
        distribucion: [
          { tiempo: 'DESAYUNO', porcentaje: '20' },
          { tiempo: 'ALMUERZO', porcentaje: '45' },
          { tiempo: 'CENA', porcentaje: '30' },
        ],
      }).expect(422);
      expect(res.body).toMatchObject({
        codigo: 'PORCENTAJES_NO_SUMAN_100',
        detail: 'Faltan 5 % por asignar',
      });
      // Un ajuste válido y un presupuesto en edición se reflejan en la vista previa.
      const valido = await vistaPrevia(token, {
        tiempos: ['ALMUERZO', 'CENA'],
        presupuestoSemanal: '500',
        distribucion: [
          { tiempo: 'ALMUERZO', porcentaje: '64' },
          { tiempo: 'CENA', porcentaje: '36' },
        ],
      }).expect(200);
      expect(valido.body.nuevo.map((r: { monto: string }) => r.monto)).toEqual([
        '320.00',
        '180.00',
      ]);
      const otroTiempo = await vistaPrevia(token, {
        tiempos: ['ALMUERZO', 'CENA'],
        distribucion: [{ tiempo: 'ALMUERZO', porcentaje: '100' }],
      }).expect(422);
      expect(otroTiempo.body.codigo).toBe('DISTRIBUCION_INVALIDA');
      const sinPresupuesto = await vistaPrevia(token, {
        tiempos: ['ALMUERZO'],
        presupuestoSemanal: '0',
      }).expect(422);
      expect(sinPresupuesto.body.codigo).toBe('PRESUPUESTO_INVALIDO');
    });

    it('CA-07.1 E1 otro administrador guardó antes: 409 "La configuración cambió, revisa de nuevo"', async () => {
      const { token } = await crearHogar(RENE, 'Familia Rosales');
      const cuerpo = {
        version: 1,
        tiempos: [
          { tiempo: 'ALMUERZO', porcentaje: '60' },
          { tiempo: 'CENA', porcentaje: '40' },
        ],
      };
      await guardarTiempos(token, cuerpo).expect(200);
      const res = await guardarTiempos(token, {
        ...cuerpo,
        tiempos: [{ tiempo: 'ALMUERZO', porcentaje: '100' }],
      }).expect(409);
      expect(res.body).toMatchObject({
        codigo: 'VERSION_DESACTUALIZADA',
        detail: 'La configuración cambió, revisa de nuevo',
      });
      await guardarPresupuesto(token, { version: 1, presupuestoSemanal: '900' }).expect(409);
      // Dos guardados simultáneos con la misma versión: solo uno gana.
      const [a, b] = await Promise.all([
        guardarPresupuesto(token, { version: 2, presupuestoSemanal: '700' }),
        guardarPresupuesto(token, { version: 2, presupuestoSemanal: '800' }),
      ]);
      expect([a.status, b.status].sort()).toEqual([200, 409]);
      expect((await leer(token).expect(200)).body.version).toBe(3);
      // También guarda el presupuesto junto con los tiempos en una sola transacción.
      const conPresupuesto = await guardarTiempos(token, {
        version: 3,
        presupuestoSemanal: '500',
        tiempos: [{ tiempo: 'ALMUERZO', porcentaje: '100' }],
      }).expect(200);
      expect(activos(conPresupuesto.body)).toEqual({ ALMUERZO: ['100.00', '500.00'] });
      await guardarTiempos(token, {
        version: 4,
        presupuestoSemanal: '0',
        tiempos: [{ tiempo: 'ALMUERZO', porcentaje: '100' }],
      }).expect(422);
    });
  });

  describe('HU-20 Pesos del motor', () => {
    const guardarPesos = (token: string, cuerpo: object) =>
      http().put(`${API}/hogar/configuracion/pesos-motor`).set(con(token)).send(cuerpo);
    const pesos = { preferencia: '0.30', novedad: '0.30', ahorro: '0.25', afinidad: '0.15' };

    it('el administrador guarda pesos que suman 1.00 y la versión sube', async () => {
      const { token } = await crearHogar(RENE, 'Familia Rosales');
      const res = await guardarPesos(token, { version: 1, ...pesos }).expect(200);
      expect(res.body).toMatchObject({ version: 2, pesos });
      const leida = await leer(token).expect(200);
      expect(leida.body.pesos).toEqual(pesos);
    });

    it('CA-20.3 pesos que no suman 1.00 → 422 con la suma actual y no se guarda', async () => {
      const { token } = await crearHogar(RENE, 'Familia Rosales');
      const res = await guardarPesos(token, {
        version: 1,
        preferencia: '0.50',
        novedad: '0.25',
        ahorro: '0.20',
        afinidad: '0.15',
      }).expect(422);
      expect(res.body.codigo).toBe('PESOS_INVALIDOS');
      expect(res.body.detail).toBe('Los pesos deben sumar 1.00 (suma actual 1.10)');
      const leida = await leer(token).expect(200);
      expect(leida.body).toMatchObject({
        version: 1,
        pesos: { preferencia: '0.40', novedad: '0.25', ahorro: '0.20', afinidad: '0.15' },
      });
    });

    it('CA-20.4 un miembro recibe 403 y los pesos no cambian', async () => {
      const { ana, token } = await hogarConAna();
      await guardarPesos(ana, {
        version: 1,
        preferencia: '0.30',
        novedad: '0.30',
        ahorro: '0.20',
        afinidad: '0.20',
      }).expect(403);
      const leida = await leer(token).expect(200);
      expect(leida.body.pesos).toEqual({
        preferencia: '0.40',
        novedad: '0.25',
        ahorro: '0.20',
        afinidad: '0.15',
      });
    });

    it('otro administrador guardó antes → 409 VERSION_DESACTUALIZADA', async () => {
      const { token } = await crearHogar(RENE, 'Familia Rosales');
      await guardarPesos(token, { version: 1, ...pesos }).expect(200);
      const res = await guardarPesos(token, { version: 1, ...pesos }).expect(409);
      expect(res.body.codigo).toBe('VERSION_DESACTUALIZADA');
    });

    it('sin cambios no sube la versión y un peso fuera de rango se rechaza', async () => {
      const { token } = await crearHogar(RENE, 'Familia Rosales');
      const igual = { preferencia: '0.40', novedad: '0.25', ahorro: '0.20', afinidad: '0.15' };
      await guardarPesos(token, { version: 1, ...igual }).expect(200);
      expect((await leer(token).expect(200)).body.version).toBe(1);
      await guardarPesos(token, { version: 1, ...igual, preferencia: '1.50' }).expect(422);
    });
  });

  describe('RNF-06 / RN-10 Autorización', () => {
    it('RNF-06 cada hogar ve y cambia solo su configuración', async () => {
      const rene = await crearHogar(RENE, 'Familia Rosales');
      const luis = await crearHogar(LUIS, 'Familia López');
      await guardarPresupuesto(luis.token, { version: 1, presupuestoSemanal: '900' }).expect(200);
      expect((await leer(rene.token).expect(200)).body.presupuestoSemanal).toBe('250.00');
      expect((await leer(luis.token).expect(200)).body.presupuestoSemanal).toBe('900.00');
      // Un menú de otro hogar no aparece ni se marca.
      await crearMenu(luis.hogarId, {
        fechaInicio: '2026-11-01',
        fechaFin: '2026-11-07',
        estado: 'BORRADOR',
        tiempos: [{ tiempo: 'ALMUERZO', porcentaje: '100.00', presupuesto: '900.00' }],
        platillo: { nombre: 'Pepián de pollo', fecha: '2026-11-03', tiempo: 'ALMUERZO' },
      });
      const vista = await vistaPrevia(rene.token, { tiempos: ['ALMUERZO', 'CENA'] }).expect(200);
      expect(vista.body.borradoresADesactualizar).toEqual([]);
      const res = await guardarTiempos(rene.token, {
        version: 1,
        tiempos: [
          { tiempo: 'ALMUERZO', porcentaje: '60' },
          { tiempo: 'CENA', porcentaje: '40' },
        ],
      }).expect(200);
      expect(res.body.borradoresDesactualizados).toEqual([]);
      const [menuLuis] = await bd.db.select().from(menuSemanal);
      expect(menuLuis?.desactualizado).toBe(false);
      // No existe forma de pedir la configuración de otro hogar por la ruta.
      await http()
        .get(`${API}/hogares/${luis.hogarId}/configuracion`)
        .set(con(rene.token))
        .expect(404);
    });

    it('RNF-06 sin hogar → 403 SIN_HOGAR; sin token → 401', async () => {
      const sinHogar = await registrar(RENE);
      expect((await leer(sinHogar).expect(403)).body.codigo).toBe('SIN_HOGAR');
      await http().get(`${API}/hogar/configuracion`).expect(401);
      await http().put(`${API}/hogar/configuracion/tiempos`).send({}).expect(401);
    });

    it('RN-10 el miembro ve la configuración pero no la vista previa ni los guardados', async () => {
      const { ana, hogarId } = await hogarConAna();
      await leer(ana).expect(200);
      await vistaPrevia(ana, { tiempos: ['ALMUERZO'] }).expect(403);
      await guardarPresupuesto(ana, { version: 1, presupuestoSemanal: '1' }).expect(403);
      const [h] = await bd.db.select().from(hogar).where(eq(hogar.id, hogarId));
      expect(h).toBeDefined();
    });
  });
});
