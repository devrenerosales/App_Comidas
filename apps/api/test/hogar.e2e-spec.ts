/**
 * HU-02 Crear hogar e invitar miembros — integración contra PostgreSQL real (TEST_DATABASE_URL).
 * Cubre CA-02.1..4 de docs/03-pruebas/features/HU-02.feature (PF-M1-02.1..4), los flujos 5c,
 * 6a, E1 y E2 de CU-01.2 y la suite de autorización RNF-06 / RN-10 de los endpoints del hogar.
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  configuracion,
  eq,
  hogar,
  invitacion,
  miembroHogar,
  sql,
  tiempoComidaConfig,
  usuario,
} from '@menu/db';
import { SERVICIO_CORREO } from '../src/correo/correo.tipos';
import { ServicioCorreoMemoria } from '../src/correo/memoria-correo.service';
import { crearAppConBd, describeConBd, usarBaseDePruebas } from './utils/base-datos';

const API = '/api/v1';
const DIA = 24 * 60 * 60 * 1000;
const RENE = { nombre: 'Rene', correo: 'rene@correo.com', contrasena: 'Almuerzo2026' };
const ANA = { nombre: 'Ana', correo: 'ana@correo.com', contrasena: 'Pepian2026' };
const LUIS = { nombre: 'Luis', correo: 'luis@correo.com', contrasena: 'Tamales2026' };
const PEDRO = { nombre: 'Pedro', correo: 'pedro@correo.com', contrasena: 'Chuchitos26' };

type Datos = typeof RENE;

describeConBd('HU-02 Crear hogar e invitar miembros (integración)', () => {
  const bd = usarBaseDePruebas({ suite: 'hogar', sembrar: false, truncarEntrePruebas: true });
  const correo = new ServicioCorreoMemoria(false);
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const con = (token: string) => ({ Authorization: `Bearer ${token}` });

  /** Registra al usuario y devuelve su token de acceso (sin hogar). */
  const registrar = async (datos: Datos): Promise<string> =>
    (await http().post(`${API}/auth/registro`).send(datos).expect(201)).body.accessToken;

  /** Crea el hogar y devuelve el token nuevo (con hogarId). */
  const crearHogar = async (token: string, nombre: string): Promise<string> =>
    (await http().post(`${API}/hogares`).set(con(token)).send({ nombre }).expect(201)).body
      .accessToken;

  const invitar = (token: string, cuerpo: Record<string, unknown>) =>
    http().post(`${API}/hogar/invitaciones`).set(con(token)).send(cuerpo);

  /** Token plano de un enlace `APP_URL/invitacion/<token>`. */
  const tokenDe = (enlace: string) => enlace.split('/invitacion/')[1] as string;

  const aceptar = (token: string, tokenInvitacion: string) =>
    http().post(`${API}/invitaciones/${tokenInvitacion}/aceptar`).set(con(token));

  /** Mueve la invitación al pasado: creada hace `dias` días con su vencimiento a 7 días. */
  const envejecer = async (id: string, dias: number) => {
    const creada = new Date(Date.now() - dias * DIA);
    await bd.db
      .update(invitacion)
      .set({ createdAt: creada, venceEn: new Date(creada.getTime() + 7 * DIA) })
      .where(eq(invitacion.id, id));
  };

  /** Rene con "Familia Rosales" (ADMIN). */
  const reneAdmin = async () => crearHogar(await registrar(RENE), 'Familia Rosales');

  /** Rene ADMIN y Ana MIEMBRO de "Familia Rosales". */
  const hogarConAna = async () => {
    const rene = await reneAdmin();
    const enlace = (await invitar(rene, { medio: 'ENLACE' }).expect(201)).body.enlace;
    const ana = (await aceptar(await registrar(ANA), tokenDe(enlace)).expect(200)).body.accessToken;
    return { rene, ana };
  };

  beforeAll(async () => {
    app = await crearAppConBd(bd.base, (b) => b.overrideProvider(SERVICIO_CORREO).useValue(correo));
  });

  beforeEach(() => correo.limpiar());

  afterAll(async () => {
    await app?.close();
  });

  describe('CA-02.1 Crear hogar e invitar por correo', () => {
    it('CA-02.1 crear "Familia Rosales": soy Administrador y se crea la configuración por defecto', async () => {
      const sinHogar = await registrar(RENE);
      const res = await http()
        .post(`${API}/hogares`)
        .set(con(sinHogar))
        .send({ nombre: '  Familia   Rosales ' })
        .expect(201);

      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.body).toMatchObject({
        hogar: { nombre: 'Familia Rosales', rol: 'ADMIN' },
        rol: 'ADMIN',
        configuracion: {
          version: 1,
          presupuestoSemanal: '250.00',
          diaInicioSemana: 'DOMINGO',
          diaPlanificacion: 'DOMINGO',
          horaPlanificacion: 8,
          tiempos: [
            { tiempo: 'DESAYUNO', activo: false, porcentaje: '0.00' },
            { tiempo: 'ALMUERZO', activo: true, porcentaje: '100.00' },
            { tiempo: 'CENA', activo: false, porcentaje: '0.00' },
          ],
        },
      });
      const hogarId = res.body.hogar.id as string;

      const [fila] = await bd.db.select().from(miembroHogar);
      expect(fila).toMatchObject({ hogarId, rol: 'ADMIN' });
      const [config] = await bd.db
        .select()
        .from(configuracion)
        .where(eq(configuracion.hogarId, hogarId));
      expect(config).toMatchObject({ presupuestoSemanal: '250.00', diaInicioSemana: 'DOMINGO' });
      expect(await bd.db.select().from(tiempoComidaConfig)).toHaveLength(3);

      // El token nuevo ya trae el hogar; /usuarios/yo lo confirma.
      const yo = await http().get(`${API}/usuarios/yo`).set(con(res.body.accessToken)).expect(200);
      expect(yo.body.hogar).toEqual({ id: hogarId, nombre: 'Familia Rosales', rol: 'ADMIN' });
      const vista = await http().get(`${API}/hogar`).set(con(res.body.accessToken)).expect(200);
      expect(vista.body).toMatchObject({
        id: hogarId,
        nombre: 'Familia Rosales',
        miembros: [{ nombre: 'Rene', correo: 'rene@correo.com', rol: 'ADMIN' }],
      });
      // El token anterior (sin hogarId) también sirve: HogarGuard lee la pertenencia de la base.
      await http().get(`${API}/hogar`).set(con(sinHogar)).expect(200);
    });

    it('CA-02.1 invito a "ana@correo.com" por correo: recibe un enlace válido por 7 días', async () => {
      const rene = await reneAdmin();
      const res = await invitar(rene, { medio: 'CORREO', correo: ' Ana@Correo.com ' }).expect(201);

      expect(res.body).toMatchObject({
        medio: 'CORREO',
        correo: 'ana@correo.com',
        estado: 'VIGENTE',
        correoEnviado: true,
        usadaEn: null,
      });
      const vigencia = new Date(res.body.venceEn).getTime() - new Date(res.body.creadaEn).getTime();
      expect(vigencia).toBe(7 * DIA);
      expect(res.body.enlace).toMatch(/^http:\/\/localhost:5173\/invitacion\/[A-Za-z0-9_-]{43}$/);

      const mensaje = correo.ultimo('ana@correo.com');
      expect(mensaje?.asunto).toBe('Rene te invitó a Familia Rosales en Menú Familiar');
      expect(mensaje?.texto).toContain(res.body.enlace);
      expect(mensaje?.texto).toContain('vence en 7 días');
      expect(mensaje?.html).toContain(`href="${res.body.enlace}"`);

      // Solo se guarda el hash del token (RNF-05).
      const [fila] = await bd.db.select().from(invitacion);
      const token = tokenDe(res.body.enlace);
      expect(fila?.tokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(fila?.tokenHash).not.toContain(token);
      expect(fila?.correoEnviado).toBe(true);

      // El enlace abre la invitación sin sesión.
      const publica = await http().get(`${API}/invitaciones/${token}`).expect(200);
      expect(publica.body).toEqual({
        hogarNombre: 'Familia Rosales',
        invitadoPor: 'Rene',
        medio: 'CORREO',
        correo: 'a**@correo.com',
        venceEn: res.body.venceEn,
      });
    });

    it('CA-02.1 un usuario con hogar no puede crear otro → 409 YA_TIENE_HOGAR', async () => {
      const rene = await reneAdmin();
      const res = await http()
        .post(`${API}/hogares`)
        .set(con(rene))
        .send({ nombre: 'Otro hogar' })
        .expect(409);
      expect(res.body).toMatchObject({
        codigo: 'YA_TIENE_HOGAR',
        detail: 'Tu cuenta ya pertenece a un hogar',
      });
      expect(await bd.db.select().from(hogar)).toHaveLength(1);
    });

    it('CA-02.1 dos solicitudes simultáneas de crear hogar dejan uno solo', async () => {
      const token = await registrar(RENE);
      const respuestas = await Promise.all(
        ['A', 'B'].map((n) => http().post(`${API}/hogares`).set(con(token)).send({ nombre: n })),
      );
      expect(respuestas.map((r) => r.status).sort()).toEqual([201, 409]);
      expect(await bd.db.select().from(hogar)).toHaveLength(1);
      expect(await bd.db.select().from(configuracion)).toHaveLength(1);
    });

    it('CA-02.1 nombre vacío o demasiado largo → 422 NOMBRE_HOGAR_INVALIDO', async () => {
      const token = await registrar(RENE);
      const vacio = await http()
        .post(`${API}/hogares`)
        .set(con(token))
        .send({ nombre: '   ' })
        .expect(422);
      expect(vacio.body).toMatchObject({
        codigo: 'NOMBRE_HOGAR_INVALIDO',
        detail: 'Ingresa el nombre del hogar',
      });
      await http()
        .post(`${API}/hogares`)
        .set(con(token))
        .send({ nombre: 'x'.repeat(81) })
        .expect(422);
      expect(await bd.db.select().from(hogar)).toHaveLength(0);
    });

    it('CA-02.1 correo inválido → 422 CORREO_INVALIDO; medio desconocido → 400', async () => {
      const rene = await reneAdmin();
      const sinCorreo = await invitar(rene, { medio: 'CORREO' }).expect(422);
      expect(sinCorreo.body.codigo).toBe('CORREO_INVALIDO');
      await invitar(rene, { medio: 'CORREO', correo: 'ana-correo' }).expect(422);
      const medio = await invitar(rene, { medio: 'PALOMA' }).expect(400);
      expect(medio.body.codigo).toBe('VALIDACION');
      expect(await bd.db.select().from(invitacion)).toHaveLength(0);
    });

    it('CU-01.2 5c: invitar a quien ya es miembro (o a sí mismo) → 409 "Ya es miembro"', async () => {
      const { rene } = await hogarConAna();
      const res = await invitar(rene, { medio: 'CORREO', correo: 'ana@correo.com' }).expect(409);
      expect(res.body).toMatchObject({ codigo: 'YA_ES_MIEMBRO', detail: 'Ya es miembro' });
      await invitar(rene, { medio: 'CORREO', correo: 'rene@correo.com' }).expect(409);
      expect(correo.enviados).toHaveLength(0);
    });

    it('CU-01.2 E2: si falla el correo la invitación queda creada y se ofrece el enlace', async () => {
      const rene = await reneAdmin();
      correo.fallarSiguiente = true;
      const res = await invitar(rene, { medio: 'CORREO', correo: 'ana@correo.com' }).expect(201);
      expect(res.body.correoEnviado).toBe(false);
      expect(res.body.enlace).toContain('/invitacion/');
      const [fila] = await bd.db.select().from(invitacion);
      expect(fila?.correoEnviado).toBe(false);
      await http()
        .get(`${API}/invitaciones/${tokenDe(res.body.enlace)}`)
        .expect(200);
    });

    it('CU-01.2: volver a invitar al mismo correo reemplaza la invitación anterior', async () => {
      const rene = await reneAdmin();
      const primera = await invitar(rene, { medio: 'CORREO', correo: 'ana@correo.com' });
      const segunda = await invitar(rene, { medio: 'CORREO', correo: 'ana@correo.com' });
      await http()
        .get(`${API}/invitaciones/${tokenDe(primera.body.enlace)}`)
        .expect(410);
      await http()
        .get(`${API}/invitaciones/${tokenDe(segunda.body.enlace)}`)
        .expect(200);
      const lista = await http().get(`${API}/hogar/invitaciones`).set(con(rene)).expect(200);
      expect(lista.body.map((i: { estado: string }) => i.estado)).toEqual(['VIGENTE', 'REVOCADA']);
    });

    it('CU-01.2: el administrador cambia el nombre del hogar', async () => {
      const rene = await reneAdmin();
      const res = await http()
        .patch(`${API}/hogar`)
        .set(con(rene))
        .send({ nombre: 'Familia Rosales López' })
        .expect(200);
      expect(res.body.nombre).toBe('Familia Rosales López');
    });
  });

  describe('CA-02.2 Unirse con enlace compartido', () => {
    it('CA-02.2 enlace generado hace 2 días: Ana queda como Miembro y el enlace ya no puede volver a usarse', async () => {
      const rene = await reneAdmin();
      const creada = await invitar(rene, { medio: 'ENLACE' }).expect(201);
      expect(creada.body).toMatchObject({ medio: 'ENLACE', correo: null, correoEnviado: false });
      expect(correo.enviados).toHaveLength(0);
      await envejecer(creada.body.id, 2);
      const token = tokenDe(creada.body.enlace);

      const publica = await http().get(`${API}/invitaciones/${token}`).expect(200);
      expect(publica.body).toMatchObject({ hogarNombre: 'Familia Rosales', correo: null });

      const ana = await registrar(ANA);
      const res = await aceptar(ana, token).expect(200);
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.body).toMatchObject({
        hogar: { nombre: 'Familia Rosales', rol: 'MIEMBRO' },
        rol: 'MIEMBRO',
      });
      const vista = await http().get(`${API}/hogar`).set(con(res.body.accessToken)).expect(200);
      expect(vista.body.miembros).toEqual([
        expect.objectContaining({ nombre: 'Rene', rol: 'ADMIN' }),
        expect.objectContaining({ nombre: 'Ana', correo: 'ana@correo.com', rol: 'MIEMBRO' }),
      ]);

      // Un solo uso: ni Ana de nuevo ni otra persona pueden reutilizarlo.
      const pedro = await registrar(PEDRO);
      const reuso = await aceptar(pedro, token).expect(410);
      expect(reuso.body).toMatchObject({
        codigo: 'INVITACION_NO_VALIDA',
        detail: 'Invitación no válida, pide una nueva',
      });
      await http().get(`${API}/invitaciones/${token}`).expect(410);
      const lista = await http().get(`${API}/hogar/invitaciones`).set(con(rene)).expect(200);
      expect(lista.body[0]).toMatchObject({ estado: 'USADA', usadaPor: 'Ana' });
      expect(await bd.db.select().from(miembroHogar)).toHaveLength(2);
    });

    it('CA-02.2 dos personas aceptan el mismo enlace a la vez: solo una se une', async () => {
      const rene = await reneAdmin();
      const token = tokenDe((await invitar(rene, { medio: 'ENLACE' })).body.enlace);
      const [ana, pedro] = await Promise.all([registrar(ANA), registrar(PEDRO)]);
      const respuestas = await Promise.all([aceptar(ana, token), aceptar(pedro, token)]);
      expect(respuestas.map((r) => r.status).sort()).toEqual([200, 410]);
      expect(await bd.db.select().from(miembroHogar)).toHaveLength(2);
    });

    it('CA-02.2 la invitación por correo la acepta la cuenta de ese correo', async () => {
      const rene = await reneAdmin();
      const enlace = (await invitar(rene, { medio: 'CORREO', correo: 'ana@correo.com' })).body
        .enlace;
      const res = await aceptar(await registrar(ANA), tokenDe(enlace)).expect(200);
      expect(res.body.rol).toBe('MIEMBRO');
    });

    it('CU-01.2: una invitación por correo no la acepta otra cuenta → 403 y sigue vigente', async () => {
      const rene = await reneAdmin();
      const enlace = (await invitar(rene, { medio: 'CORREO', correo: 'ana@correo.com' })).body
        .enlace;
      const res = await aceptar(await registrar(PEDRO), tokenDe(enlace)).expect(403);
      expect(res.body.codigo).toBe('INVITACION_DE_OTRO_CORREO');
      await aceptar(await registrar(ANA), tokenDe(enlace)).expect(200);
    });
  });

  describe('CA-02.3 Invitación vencida', () => {
    it('CA-02.3 invitación creada hace 8 días: ve "Invitación no válida, pide una nueva" y no se une', async () => {
      const rene = await reneAdmin();
      const creada = await invitar(rene, { medio: 'ENLACE' });
      await envejecer(creada.body.id, 8);
      const token = tokenDe(creada.body.enlace);

      const publica = await http().get(`${API}/invitaciones/${token}`).expect(410);
      expect(publica.headers['content-type']).toMatch(/application\/problem\+json/);
      expect(publica.body).toMatchObject({
        status: 410,
        codigo: 'INVITACION_NO_VALIDA',
        detail: 'Invitación no válida, pide una nueva',
      });
      const ana = await registrar(ANA);
      const res = await aceptar(ana, token).expect(410);
      expect(res.body.detail).toBe('Invitación no válida, pide una nueva');
      const yo = await http().get(`${API}/usuarios/yo`).set(con(ana)).expect(200);
      expect(yo.body.hogar).toBeNull();
      const lista = await http().get(`${API}/hogar/invitaciones`).set(con(rene)).expect(200);
      expect(lista.body[0].estado).toBe('VENCIDA');
    });

    it('CA-02.3 token inválido, inexistente o demasiado largo → 410', async () => {
      const ana = await registrar(ANA);
      await http().get(`${API}/invitaciones/no-existe`).expect(410);
      await aceptar(ana, 'no-existe').expect(410);
      await aceptar(ana, 'x'.repeat(200)).expect(410);
      await http()
        .get(`${API}/invitaciones/${'x'.repeat(200)}`)
        .expect(410);
    });

    it('CA-02.3 invitación revocada por el administrador → 410', async () => {
      const rene = await reneAdmin();
      const creada = await invitar(rene, { medio: 'ENLACE' });
      await http().delete(`${API}/hogar/invitaciones/${creada.body.id}`).set(con(rene)).expect(204);
      // Revocar de nuevo no es error.
      await http().delete(`${API}/hogar/invitaciones/${creada.body.id}`).set(con(rene)).expect(204);
      await aceptar(await registrar(ANA), tokenDe(creada.body.enlace)).expect(410);
    });

    it('CA-02.3 una invitación ya usada no se puede revocar → 409', async () => {
      const rene = await reneAdmin();
      const creada = await invitar(rene, { medio: 'ENLACE' });
      await aceptar(await registrar(ANA), tokenDe(creada.body.enlace)).expect(200);
      const res = await http()
        .delete(`${API}/hogar/invitaciones/${creada.body.id}`)
        .set(con(rene))
        .expect(409);
      expect(res.body.codigo).toBe('INVITACION_USADA');
    });
  });

  describe('CA-02.4 Aislamiento', () => {
    it('CA-02.4 Luis (Familia López) abre un enlace de "Familia Rosales": ve "Tu cuenta ya pertenece a un hogar" y no ve sus datos', async () => {
      const rene = await reneAdmin();
      const luis = await crearHogar(await registrar(LUIS), 'Familia López');
      const token = tokenDe((await invitar(rene, { medio: 'ENLACE' })).body.enlace);

      const res = await aceptar(luis, token).expect(409);
      expect(res.body).toMatchObject({
        codigo: 'YA_TIENE_HOGAR',
        detail: 'Tu cuenta ya pertenece a un hogar',
      });
      const vista = await http().get(`${API}/hogar`).set(con(luis)).expect(200);
      expect(vista.body.nombre).toBe('Familia López');
      expect(JSON.stringify(vista.body)).not.toMatch(/Rosales|rene@correo\.com/);
      // La invitación no se consumió: Ana todavía puede usarla.
      await aceptar(await registrar(ANA), token).expect(200);
    });

    it('CA-02.4 un miembro que abre otro enlace de su mismo hogar también recibe 409', async () => {
      const { rene, ana } = await hogarConAna();
      const token = tokenDe((await invitar(rene, { medio: 'ENLACE' })).body.enlace);
      await aceptar(ana, token).expect(409);
    });
  });

  describe('RNF-06 / RN-10 Autorización', () => {
    it('RNF-06 un usuario de otro hogar no puede ver los miembros ni las invitaciones ajenas', async () => {
      const rene = await reneAdmin();
      await invitar(rene, { medio: 'CORREO', correo: 'ana@correo.com' }).expect(201);
      const luis = await crearHogar(await registrar(LUIS), 'Familia López');
      const [rosales] = await bd.db.select().from(hogar).where(eq(hogar.nombre, 'Familia Rosales'));

      const miembros = await http().get(`${API}/hogar`).set(con(luis)).expect(200);
      expect(miembros.body.miembros).toHaveLength(1);
      expect(miembros.body.miembros[0].nombre).toBe('Luis');
      // No existe forma de pedir otro hogar por id.
      await http().get(`${API}/hogar/${rosales?.id}`).set(con(luis)).expect(404);
      await http().get(`${API}/hogares/${rosales?.id}`).set(con(luis)).expect(404);
      const invitaciones = await http().get(`${API}/hogar/invitaciones`).set(con(luis)).expect(200);
      expect(invitaciones.body).toEqual([]);
    });

    it('RNF-06 un usuario de otro hogar no puede revocar invitaciones ajenas (404) y siguen vigentes', async () => {
      const rene = await reneAdmin();
      const creada = await invitar(rene, { medio: 'ENLACE' });
      const luis = await crearHogar(await registrar(LUIS), 'Familia López');
      const res = await http()
        .delete(`${API}/hogar/invitaciones/${creada.body.id}`)
        .set(con(luis))
        .expect(404);
      expect(res.body.codigo).toBe('NO_ENCONTRADO');
      await http()
        .get(`${API}/invitaciones/${tokenDe(creada.body.enlace)}`)
        .expect(200);
      const [fila] = await bd.db.select().from(invitacion);
      expect(fila?.revocadaEn).toBeNull();
    });

    it('RNF-06 un id de invitación mal formado responde 404', async () => {
      const rene = await reneAdmin();
      await http().delete(`${API}/hogar/invitaciones/123`).set(con(rene)).expect(404);
    });

    it('RN-10 un MIEMBRO no puede invitar, listar ni revocar invitaciones ni renombrar el hogar', async () => {
      const { rene, ana } = await hogarConAna();
      const creada = await invitar(rene, { medio: 'ENLACE' });

      const res = await invitar(ana, { medio: 'CORREO', correo: 'luis@correo.com' }).expect(403);
      expect(res.body).toMatchObject({
        status: 403,
        codigo: 'SOLO_ADMINISTRADOR',
        detail: 'Solo el administrador del hogar puede hacer esta acción',
      });
      await invitar(ana, { medio: 'ENLACE' }).expect(403);
      await http().get(`${API}/hogar/invitaciones`).set(con(ana)).expect(403);
      await http().delete(`${API}/hogar/invitaciones/${creada.body.id}`).set(con(ana)).expect(403);
      await http().patch(`${API}/hogar`).set(con(ana)).send({ nombre: 'Mío' }).expect(403);
      // Pero sí ve su hogar y los miembros.
      const vista = await http().get(`${API}/hogar`).set(con(ana)).expect(200);
      expect(vista.body.miembros).toHaveLength(2);
      expect(await bd.db.select().from(invitacion)).toHaveLength(2);
    });

    it('RN-10 el rol se lee de la base: un token viejo de ADMIN no sirve si ahora es MIEMBRO', async () => {
      const rene = await reneAdmin();
      await bd.db.execute(sql`update miembro_hogar set rol = 'MIEMBRO'`);
      await invitar(rene, { medio: 'ENLACE' }).expect(403);
    });

    it('RNF-06 sin hogar las rutas /hogar responden 403 SIN_HOGAR; sin token, 401', async () => {
      const ana = await registrar(ANA);
      const res = await http().get(`${API}/hogar`).set(con(ana)).expect(403);
      expect(res.body.codigo).toBe('SIN_HOGAR');
      await invitar(ana, { medio: 'ENLACE' }).expect(403);
      await http().get(`${API}/hogar`).expect(401);
      await http().post(`${API}/hogares`).send({ nombre: 'X' }).expect(401);
      await http().post(`${API}/invitaciones/abc/aceptar`).expect(401);
    });

    it('RNF-06 un usuario desactivado no puede aceptar invitaciones', async () => {
      const rene = await reneAdmin();
      const token = tokenDe((await invitar(rene, { medio: 'ENLACE' })).body.enlace);
      const ana = await registrar(ANA);
      await bd.db.update(usuario).set({ activo: false }).where(eq(usuario.correo, ANA.correo));
      await aceptar(ana, token).expect(401);
    });
  });
});
