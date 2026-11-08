/**
 * HU-24 Editar, mover y fijar platillos — integración contra PostgreSQL real (TEST_DATABASE_URL).
 * Cubre CA-24.1..4 (docs/03-pruebas/features/HU-24.feature), la lectura del menú, el candado de
 * fijado, la regeneración que conserva lo elegido a mano y el aislamiento por hogar (RNF-06).
 *
 * Semana del domingo 2026-11-01: lunes 11-02, martes 11-03, miércoles 11-04, jueves 11-05,
 * viernes 11-06, sábado 11-07.
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  and,
  configuracion,
  eq,
  menuDetalle,
  menuSemanal,
  platillo,
  platilloTiempo,
  tiempoComidaConfig,
} from '@menu/db';
import { normalizarNombreCatalogo, type ProteinaPrincipal, type TiempoComida } from '@menu/shared';
import { crearAppConBd, describeConBd, usarBaseDePruebas } from './utils/base-datos';

const API = '/api/v1';
const SEMANA = '2026-11-01';
const DIAS = {
  lunes: '2026-11-02',
  martes: '2026-11-03',
  miercoles: '2026-11-04',
  jueves: '2026-11-05',
  viernes: '2026-11-06',
  sabado: '2026-11-07',
} as const;
const CICLO: ProteinaPrincipal[] = ['POLLO', 'RES', 'CERDO', 'PESCADO', 'HUEVO'];

describeConBd('HU-24 Editar, mover y fijar platillos (integración)', () => {
  const bd = usarBaseDePruebas({
    suite: 'menus-edicion',
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

  const configurar = async (
    hogarId: string,
    p: Partial<Record<TiempoComida, string>>,
  ): Promise<void> => {
    const [config] = await bd.db
      .update(configuracion)
      .set({ presupuestoSemanal: '500.00' })
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

  /** Platillo del hogar con proteína y tiempos aplicables. */
  const crearPlatillo = async (
    hogarId: string,
    nombre: string,
    proteina: ProteinaPrincipal,
    tiempos: TiempoComida[] = ['ALMUERZO'],
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
    await bd.db
      .insert(platilloTiempo)
      .values(tiempos.map((tiempo) => ({ platilloId: p!.id, tiempo })));
    return p!.id;
  };

  /** Menú de la semana con los espacios dados `[fecha, tiempo, platilloId | null]`. */
  const crearMenu = async (
    hogarId: string,
    estado: 'BORRADOR' | 'APROBADO',
    espacios: [string, TiempoComida, string | null][],
  ) => {
    const [menu] = await bd.db
      .insert(menuSemanal)
      .values({
        hogarId,
        fechaInicio: SEMANA,
        fechaFin: '2026-11-07',
        estado,
        ...(estado === 'APROBADO'
          ? { aprobadoEn: new Date('2026-10-30T15:00:00Z'), presupuestoSemanal: '500.00' }
          : {}),
      })
      .returning();
    const filas = await bd.db
      .insert(menuDetalle)
      .values(
        espacios.map(([fecha, tiempo, platilloId]) => ({
          menuId: menu!.id,
          fecha,
          tiempo,
          platilloId,
        })),
      )
      .returning();
    const id = (fecha: string, tiempo: TiempoComida = 'ALMUERZO') =>
      filas.find((f) => f.fecha === fecha && f.tiempo === tiempo)!.id;
    return { menuId: menu!.id, id };
  };

  /** CA-24.1: lunes Carne guisada, miércoles Pescado, jueves Pepián y viernes Spaghetti. */
  const menuDelCriterio = async (hogarId: string) => {
    const carne = await crearPlatillo(hogarId, 'Carne guisada', 'RES');
    const pescado = await crearPlatillo(hogarId, 'Pescado frito', 'PESCADO');
    const pepian = await crearPlatillo(hogarId, 'Pepián de pollo', 'POLLO');
    const spaghetti = await crearPlatillo(hogarId, 'Spaghetti con carne', 'RES');
    const menu = await crearMenu(hogarId, 'BORRADOR', [
      [DIAS.lunes, 'ALMUERZO', carne],
      [DIAS.miercoles, 'ALMUERZO', pescado],
      [DIAS.jueves, 'ALMUERZO', pepian],
      [DIAS.viernes, 'ALMUERZO', spaghetti],
      [DIAS.sabado, 'ALMUERZO', null],
    ]);
    return { ...menu, carne, pescado, pepian, spaghetti };
  };

  const mover = (token: string, menuId: string, cuerpo: object) =>
    http().post(`${API}/menus/${menuId}/mover`).set(con(token)).send(cuerpo);
  const editar = (token: string, menuId: string, detalleId: string, cuerpo: object) =>
    http().patch(`${API}/menus/${menuId}/detalles/${detalleId}`).set(con(token)).send(cuerpo);
  const fijar = (token: string, menuId: string, detalleId: string, cuerpo: object) =>
    http().put(`${API}/menus/${menuId}/detalles/${detalleId}/fijado`).set(con(token)).send(cuerpo);

  type Detalle = {
    fecha: string;
    tiempo: string;
    platillo: { id: string; nombre: string } | null;
    fijado: boolean;
    origen: string;
    reglasAplicadas: string[];
  };
  const dia = (cuerpo: { detalles: Detalle[] }, fecha: string, tiempo = 'ALMUERZO') =>
    cuerpo.detalles.find((d) => d.fecha === fecha && d.tiempo === tiempo)!;

  beforeAll(async () => {
    app = await crearAppConBd(bd.base);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('CA-24.1 intercambiar lunes y jueves avisa RN-02 y, confirmado, ambos quedan fijados', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    await configurar(hogarId, { ALMUERZO: '100.00' });
    const m = await menuDelCriterio(hogarId);
    const cuerpo = { origenDetalleId: m.id(DIAS.lunes), destinoDetalleId: m.id(DIAS.jueves) };

    const aviso = await mover(token, m.menuId, cuerpo).expect(409);
    expect(aviso.body.codigo).toBe('CONFIRMACION_REQUERIDA');
    expect(aviso.body.advertencias).toEqual([
      expect.objectContaining({
        codigo: 'RN02_PROTEINA_CONSECUTIVA',
        mensaje: 'Proteína res repetida en días consecutivos (jueves y viernes)',
      }),
    ]);
    const sinCambio = await http().get(`${API}/menus/${m.menuId}`).set(con(token)).expect(200);
    expect(dia(sinCambio.body, DIAS.jueves).platillo!.nombre).toBe('Pepián de pollo');

    const res = await mover(token, m.menuId, { ...cuerpo, confirmar: true }).expect(200);
    expect(dia(res.body, DIAS.jueves)).toMatchObject({
      platillo: { nombre: 'Carne guisada' },
      fijado: true,
      origen: 'USUARIO',
      reglasAplicadas: ['RN02_CONFIRMADA'],
    });
    expect(dia(res.body, DIAS.lunes)).toMatchObject({
      platillo: { nombre: 'Pepián de pollo' },
      fijado: true,
    });
  });

  it('un intercambio sin conflictos no pide confirmar y mover a un espacio vacío lo desocupa', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    await configurar(hogarId, { ALMUERZO: '100.00' });
    const m = await menuDelCriterio(hogarId);
    const intercambio = await mover(token, m.menuId, {
      origenDetalleId: m.id(DIAS.lunes),
      destinoDetalleId: m.id(DIAS.miercoles),
    }).expect(200);
    expect(dia(intercambio.body, DIAS.lunes).platillo!.nombre).toBe('Pescado frito');
    expect(dia(intercambio.body, DIAS.miercoles).platillo!.nombre).toBe('Carne guisada');

    const vacio = await mover(token, m.menuId, {
      origenDetalleId: m.id(DIAS.jueves),
      destinoDetalleId: m.id(DIAS.sabado),
    }).expect(200);
    expect(dia(vacio.body, DIAS.sabado)).toMatchObject({
      platillo: { nombre: 'Pepián de pollo' },
      fijado: true,
    });
    expect(dia(vacio.body, DIAS.jueves)).toMatchObject({ platillo: null, fijado: false });
    expect(vacio.body.avisos).toEqual([
      expect.objectContaining({ codigo: 'SIN_SUGERENCIA', fecha: DIAS.jueves }),
    ]);
  });

  it('CA-24.2 elegir un platillo a mano lo fija y la regeneración lo conserva', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    await configurar(hogarId, { ALMUERZO: '100.00' });
    for (let i = 0; i < 12; i++) {
      await crearPlatillo(hogarId, `Almuerzo ${String(i + 1).padStart(2, '0')}`, CICLO[i % 5]!);
    }
    const chile = await crearPlatillo(hogarId, 'Chile relleno', 'CERDO');
    const generado = await http()
      .post(`${API}/menus/generar`)
      .set(con(token))
      .send({ semana: SEMANA })
      .expect(201);
    const martes = dia(generado.body, DIAS.martes) as Detalle & { id: string };

    // Se confirma por si el generador dejó una proteína vecina igual; no cambia lo que se prueba.
    const cuerpo = await editar(token, generado.body.id, martes.id, {
      platilloId: chile,
      confirmar: true,
    }).expect(200);
    expect(dia(cuerpo.body, DIAS.martes)).toMatchObject({
      platillo: { id: chile },
      fijado: true,
      origen: 'USUARIO',
    });

    const regenerado = await http()
      .post(`${API}/menus/generar`)
      .set(con(token))
      .send({ semana: SEMANA, regenerar: true })
      .expect(200);
    expect(dia(regenerado.body, DIAS.martes)).toMatchObject({
      platillo: { id: chile },
      fijado: true,
    });
  });

  it('elegir un platillo que repite proteína pide confirmar y lo deja registrado', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    await configurar(hogarId, { ALMUERZO: '100.00' });
    const m = await menuDelCriterio(hogarId);
    const otraRes = await crearPlatillo(hogarId, 'Res en salsa', 'RES');
    const aviso = await editar(token, m.menuId, m.id(DIAS.jueves), { platilloId: otraRes }).expect(
      409,
    );
    expect(aviso.body.codigo).toBe('CONFIRMACION_REQUERIDA');
    const res = await editar(token, m.menuId, m.id(DIAS.jueves), {
      platilloId: otraRes,
      confirmar: true,
    }).expect(200);
    expect(dia(res.body, DIAS.jueves)).toMatchObject({
      platillo: { nombre: 'Res en salsa' },
      fijado: true,
      reglasAplicadas: ['RN02_CONFIRMADA'],
    });
  });

  it('CA-24.3 mover un platillo a un tiempo donde no aplica se rechaza y el menú no cambia', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    await configurar(hogarId, { DESAYUNO: '20.00', ALMUERZO: '50.00', CENA: '30.00' });
    const caldo = await crearPlatillo(hogarId, 'Caldo de res', 'RES', ['ALMUERZO']);
    const m = await crearMenu(hogarId, 'BORRADOR', [
      [DIAS.sabado, 'ALMUERZO', caldo],
      [DIAS.sabado, 'DESAYUNO', null],
    ]);
    const res = await mover(token, m.menuId, {
      origenDetalleId: m.id(DIAS.sabado, 'ALMUERZO'),
      destinoDetalleId: m.id(DIAS.sabado, 'DESAYUNO'),
    }).expect(422);
    expect(res.body).toMatchObject({
      codigo: 'TIEMPO_NO_APLICABLE',
      detail: 'Caldo de res no aplica a Desayuno',
    });
    const igual = await http().get(`${API}/menus/${m.menuId}`).set(con(token)).expect(200);
    expect(dia(igual.body, DIAS.sabado, 'ALMUERZO').platillo!.nombre).toBe('Caldo de res');
    expect(dia(igual.body, DIAS.sabado, 'DESAYUNO').platillo).toBeNull();

    // Elegir a mano un platillo que no aplica al tiempo del espacio también se rechaza.
    const bloqueado = await editar(token, m.menuId, m.id(DIAS.sabado, 'DESAYUNO'), {
      platilloId: caldo,
    }).expect(422);
    expect(bloqueado.body.codigo).toBe('TIEMPO_NO_APLICABLE');
  });

  it('CA-24.4 un menú aprobado también se puede cambiar', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    await configurar(hogarId, { ALMUERZO: '100.00' });
    const pollo = await crearPlatillo(hogarId, 'Pollo en crema', 'POLLO');
    const otro = await crearPlatillo(hogarId, 'Tortitas', 'RES');
    const m = await crearMenu(hogarId, 'APROBADO', [
      [SEMANA, 'ALMUERZO', pollo],
      [DIAS.lunes, 'ALMUERZO', otro],
    ]);
    const cambio = await editar(token, m.menuId, m.id(SEMANA), {
      platilloId: otro,
      confirmar: true,
    });
    expect(cambio.status).toBe(200);
    const fijado = await fijar(token, m.menuId, m.id(SEMANA), { fijado: false });
    expect(fijado.status).toBe(200);
    const lectura = await http().get(`${API}/menus/${m.menuId}`).set(con(token)).expect(200);
    expect(lectura.body.estado).toBe('APROBADO');
    expect(dia(lectura.body, SEMANA).platillo!.nombre).toBe('Tortitas');
    expect(dia(lectura.body, SEMANA).fijado).toBe(false);
  });

  it('fijar y desfijar un espacio; uno vacío no se puede fijar', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    await configurar(hogarId, { ALMUERZO: '100.00' });
    const m = await menuDelCriterio(hogarId);
    const fijado = await fijar(token, m.menuId, m.id(DIAS.lunes), { fijado: true }).expect(200);
    expect(dia(fijado.body, DIAS.lunes).fijado).toBe(true);
    const libre = await fijar(token, m.menuId, m.id(DIAS.lunes), { fijado: false }).expect(200);
    expect(dia(libre.body, DIAS.lunes).fijado).toBe(false);
    const vacio = await fijar(token, m.menuId, m.id(DIAS.sabado), { fijado: true }).expect(422);
    expect(vacio.body.codigo).toBe('SIN_PLATILLO');
    await fijar(token, m.menuId, m.id(DIAS.lunes), { fijado: 'si' }).expect(400);
  });

  it('lee el menú por id y por la fecha de su semana; sin menú es 404 SIN_MENU', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    await configurar(hogarId, { ALMUERZO: '100.00' });
    const m = await menuDelCriterio(hogarId);
    const porId = await http().get(`${API}/menus/${m.menuId}`).set(con(token)).expect(200);
    const porFecha = await http()
      .get(`${API}/menus/semana/${DIAS.jueves}`)
      .set(con(token))
      .expect(200);
    expect(porFecha.body.id).toBe(porId.body.id);
    expect(porId.body).toMatchObject({
      estado: 'BORRADOR',
      fechaInicio: SEMANA,
      fechaFin: '2026-11-07',
    });
    const vacio = await http().get(`${API}/menus/semana/2026-12-20`).set(con(token)).expect(404);
    expect(vacio.body.codigo).toBe('SIN_MENU');
    await http().get(`${API}/menus/semana/noviembre`).set(con(token)).expect(404);
    await http().get(`${API}/menus/no-es-uuid`).set(con(token)).expect(404);
  });

  it('RNF-06 otro hogar no ve ni cambia el menú, y no puede usar platillos ajenos', async () => {
    const rene = await hogarDe('Rene');
    const ana = await hogarDe('Ana');
    await configurar(rene.hogarId, { ALMUERZO: '100.00' });
    await configurar(ana.hogarId, { ALMUERZO: '100.00' });
    const m = await menuDelCriterio(rene.hogarId);
    await http().get(`${API}/menus/${m.menuId}`).set(con(ana.token)).expect(404);
    await fijar(ana.token, m.menuId, m.id(DIAS.lunes), { fijado: true }).expect(404);
    await editar(ana.token, m.menuId, m.id(DIAS.lunes), { platilloId: m.pepian }).expect(404);
    await http().get(`${API}/menus/semana/${DIAS.lunes}`).set(con(ana.token)).expect(404);

    // El platillo de otro hogar no existe para quien edita su propio menú.
    const propio = await crearPlatillo(ana.hogarId, 'Mío', 'POLLO');
    const menuAna = await crearMenu(ana.hogarId, 'BORRADOR', [[DIAS.lunes, 'ALMUERZO', propio]]);
    const ajeno = await editar(ana.token, menuAna.menuId, menuAna.id(DIAS.lunes), {
      platilloId: m.pepian,
    }).expect(404);
    expect(ajeno.body.detail).toBe('El platillo no existe.');
  });

  it('requiere sesión', async () => {
    await http().get(`${API}/menus/semana/${DIAS.lunes}`).expect(401);
  });
});
