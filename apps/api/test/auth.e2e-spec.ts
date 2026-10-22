/**
 * HU-01 Registro e inicio de sesión — integración contra PostgreSQL real (TEST_DATABASE_URL).
 * Cubre los escenarios CA-01.1..4 de docs/03-pruebas/features/HU-01.feature (PF-M1-01.1..4)
 * y las pruebas de seguridad de ADR-004 (aislamiento del perfil, reutilización del refresh).
 */
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getOptionsToken } from '@nestjs/throttler';
import request from 'supertest';
import { eq, hogar, miembroHogar, refreshToken, usuario } from '@menu/db';
import { crearAppConBd, describeConBd, usarBaseDePruebas } from './utils/base-datos';

const API = '/api/v1';
const RENE = { nombre: 'Rene', correo: 'rene@correo.com', contrasena: 'Almuerzo2026' };
const ANA = { nombre: 'Ana', correo: 'ana@correo.com', contrasena: 'Pepian2026' };
const MINUTO = 60_000;

type Respuesta = request.Response;

function cookieRefresh(res: Respuesta): string | undefined {
  const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
  return cookies.find((c) => c.startsWith('mf_refresh='));
}

function valorCookie(res: Respuesta): string {
  const cookie = cookieRefresh(res);
  if (!cookie) throw new Error('La respuesta no trae la cookie mf_refresh');
  return cookie.split(';')[0] as string;
}

describeConBd('HU-01 Registro e inicio de sesión (integración)', () => {
  const bd = usarBaseDePruebas({ suite: 'auth', sembrar: false, truncarEntrePruebas: true });
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  const registrar = (datos = RENE, nativo = false) => {
    const r = http().post(`${API}/auth/registro`);
    if (nativo) r.set('X-Cliente', 'android');
    return r.send(datos);
  };
  const login = (correo: string, contrasena: string) =>
    http().post(`${API}/auth/login`).send({ correo, contrasena });
  const usuarioEnBd = async (correo: string) =>
    (await bd.db.select().from(usuario).where(eq(usuario.correo, correo)))[0];

  beforeAll(async () => {
    app = await crearAppConBd(bd.base);
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('Registro', () => {
    it('CA-01.1 registro exitoso: cuenta con contraseña cifrada, sesión iniciada y sin hogar', async () => {
      const res = await registrar().expect(201);

      expect(res.body).toMatchObject({
        usuario: { nombre: 'Rene', correo: 'rene@correo.com', esAdminSistema: false },
        hogar: null,
      });
      expect(typeof res.body.accessToken).toBe('string');
      expect(new Date(res.body.expiraEn).getTime() - Date.now()).toBeLessThanOrEqual(15 * MINUTO);
      // PWA: el refresh no viaja en el cuerpo, solo en la cookie HttpOnly.
      expect(res.body.refreshToken).toBeUndefined();
      const cookie = cookieRefresh(res) as string;
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/Secure/i);
      expect(cookie).toMatch(/SameSite=Strict/i);
      expect(cookie).toMatch(/Path=\/api\/v1\/auth/);
      expect(res.headers['cache-control']).toBe('no-store');

      const fila = await usuarioEnBd('rene@correo.com');
      expect(fila?.hashContrasena).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
      expect(fila?.hashContrasena).not.toContain(RENE.contrasena);

      const yo = await http()
        .get(`${API}/usuarios/yo`)
        .set('Authorization', `Bearer ${res.body.accessToken}`)
        .expect(200);
      expect(yo.body).toEqual({
        id: fila?.id,
        nombre: 'Rene',
        correo: 'rene@correo.com',
        esAdminSistema: false,
        hogar: null,
      });
      const [refresh] = await bd.db.select().from(refreshToken);
      expect(refresh?.usuarioId).toBe(fila?.id);
      expect(refresh?.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('CA-01.1 registro desde Android: el refresh viaja en el cuerpo y no hay cookie', async () => {
      const res = await registrar(RENE, true).expect(201);
      expect(typeof res.body.refreshToken).toBe('string');
      expect(res.body.refreshToken.length).toBeGreaterThanOrEqual(43);
      expect(cookieRefresh(res)).toBeUndefined();
    });

    it('CA-01.1 normaliza el correo (espacios y mayúsculas) y recorta el nombre', async () => {
      const res = await registrar({
        ...RENE,
        nombre: '  Rene  ',
        correo: ' Rene@Correo.COM ',
      }).expect(201);
      expect(res.body.usuario).toMatchObject({ nombre: 'Rene', correo: 'rene@correo.com' });
    });

    it('CA-01.2 registro con un correo ya existente → 409 "Este correo ya tiene cuenta"', async () => {
      await registrar().expect(201);
      const res = await registrar({ ...RENE, correo: 'RENE@correo.com' }).expect(409);
      expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
      expect(res.body).toMatchObject({
        status: 409,
        codigo: 'CORREO_REGISTRADO',
        detail: 'Este correo ya tiene cuenta',
        instance: '/api/v1/auth/registro',
      });
      expect(await bd.db.select().from(usuario)).toHaveLength(1);
    });

    it('CA-01.4 contraseña "pollo" → 422 con el mensaje de la política y no se crea la cuenta', async () => {
      const res = await registrar({ ...RENE, contrasena: 'pollo' }).expect(422);
      expect(res.body).toMatchObject({
        status: 422,
        codigo: 'CONTRASENA_DEBIL',
        detail: 'La contraseña debe tener al menos 8 caracteres, una letra y un número',
        errores: [
          {
            campo: 'contrasena',
            mensaje: 'La contraseña debe tener al menos 8 caracteres, una letra y un número',
          },
        ],
      });
      expect(await usuarioEnBd('rene@correo.com')).toBeUndefined();
    });

    it('CA-01.4 contraseña sin número también se rechaza', async () => {
      await registrar({ ...RENE, contrasena: 'soloLetras' }).expect(422);
      expect(await bd.db.select().from(usuario)).toHaveLength(0);
    });

    it('datos mal formados → 400 VALIDACION con la lista de errores en español', async () => {
      const res = await registrar({
        nombre: '',
        correo: 'no-es-correo',
        contrasena: 'pollo',
      }).expect(400);
      expect(res.body.codigo).toBe('VALIDACION');
      const campos = (res.body.errores as { campo: string }[]).map((e) => e.campo);
      expect(campos).toEqual(expect.arrayContaining(['nombre', 'correo', 'contrasena']));
      expect(res.body.errores).toContainEqual({
        campo: 'correo',
        mensaje: 'Ingresa un correo válido',
      });
    });

    it('rechaza campos no permitidos (p. ej. esAdminSistema)', async () => {
      const res = await registrar({ ...RENE, esAdminSistema: true } as typeof RENE).expect(400);
      expect(res.body.errores).toContainEqual({
        campo: 'esAdminSistema',
        mensaje: 'Este campo no está permitido',
      });
    });
  });

  describe('Inicio de sesión', () => {
    it('CA-01.1 inicia sesión con correo y contraseña correctos (sin hogar)', async () => {
      await registrar().expect(201);
      const res = await login('Rene@Correo.com', RENE.contrasena).expect(200);
      expect(res.body).toMatchObject({ usuario: { correo: 'rene@correo.com' }, hogar: null });
      expect(cookieRefresh(res)).toBeDefined();
    });

    it('CA-01.1 con hogar: la respuesta y el token llevan hogarId y rol', async () => {
      await registrar().expect(201);
      const fila = await usuarioEnBd(RENE.correo);
      const [h] = await bd.db.insert(hogar).values({ nombre: 'Familia Rosales' }).returning();
      await bd.db
        .insert(miembroHogar)
        .values({ hogarId: h?.id as string, usuarioId: fila?.id as string, rol: 'ADMIN' });

      const res = await login(RENE.correo, RENE.contrasena).expect(200);
      expect(res.body.hogar).toEqual({ id: h?.id, nombre: 'Familia Rosales', rol: 'ADMIN' });
      const claims = app.get(JwtService).decode(res.body.accessToken);
      expect(claims).toMatchObject({ sub: fila?.id, hogarId: h?.id, rol: 'ADMIN' });
      expect(claims.exp - claims.iat).toBe(15 * 60);
    });

    it('CA-01.3 mensaje genérico: correo inexistente y contraseña incorrecta responden igual', async () => {
      await registrar().expect(201);
      const inexistente = await login('nadie@correo.com', 'Almuerzo2026').expect(401);
      const incorrecta = await login(RENE.correo, 'incorrecta1').expect(401);
      for (const res of [inexistente, incorrecta]) {
        expect(res.body).toMatchObject({
          status: 401,
          codigo: 'CREDENCIALES_INVALIDAS',
          detail: 'Correo o contraseña incorrectos',
        });
      }
    });

    it('CA-01.3 con 4 intentos fallidos en 15 min, el quinto muestra el mensaje genérico y bloquea 15 min', async () => {
      await registrar().expect(201);
      await bd.db
        .update(usuario)
        .set({ intentosFallidos: 4, primerIntentoFallidoEn: new Date(Date.now() - 5 * MINUTO) })
        .where(eq(usuario.correo, RENE.correo));

      const quinto = await login(RENE.correo, 'incorrecta1').expect(401);
      expect(quinto.body.detail).toBe('Correo o contraseña incorrectos');

      const fila = await usuarioEnBd(RENE.correo);
      const bloqueo = (fila?.bloqueadoHasta as Date).getTime() - Date.now();
      expect(bloqueo).toBeGreaterThan(14 * MINUTO);
      expect(bloqueo).toBeLessThanOrEqual(15 * MINUTO);

      // Bloqueada: ni con la contraseña correcta.
      const bloqueada = await login(RENE.correo, RENE.contrasena).expect(423);
      expect(bloqueada.body).toMatchObject({ codigo: 'CUENTA_BLOQUEADA', status: 423 });
      expect(new Date(bloqueada.body.bloqueadoHasta).getTime()).toBe(
        (fila?.bloqueadoHasta as Date).getTime(),
      );
    });

    it('CA-01.3 cinco intentos fallidos seguidos por la API bloquean la cuenta', async () => {
      await registrar().expect(201);
      for (let i = 0; i < 5; i++) await login(RENE.correo, `incorrecta${i}`).expect(401);
      await login(RENE.correo, RENE.contrasena).expect(423);
    });

    it('CA-01.3 los intentos fuera de la ventana de 15 min no cuentan', async () => {
      await registrar().expect(201);
      await bd.db
        .update(usuario)
        .set({ intentosFallidos: 4, primerIntentoFallidoEn: new Date(Date.now() - 16 * MINUTO) })
        .where(eq(usuario.correo, RENE.correo));
      await login(RENE.correo, 'incorrecta1').expect(401);
      const fila = await usuarioEnBd(RENE.correo);
      expect(fila).toMatchObject({ intentosFallidos: 1, bloqueadoHasta: null });
    });

    it('CA-01.3 al vencer el bloqueo se puede iniciar sesión y se reinician los contadores', async () => {
      await registrar().expect(201);
      await bd.db
        .update(usuario)
        .set({ intentosFallidos: 2, bloqueadoHasta: new Date(Date.now() - MINUTO) })
        .where(eq(usuario.correo, RENE.correo));
      await login(RENE.correo, RENE.contrasena).expect(200);
      expect(await usuarioEnBd(RENE.correo)).toMatchObject({
        intentosFallidos: 0,
        bloqueadoHasta: null,
        primerIntentoFallidoEn: null,
      });
    });

    it('una cuenta inactiva no puede iniciar sesión (mensaje genérico)', async () => {
      await registrar().expect(201);
      await bd.db.update(usuario).set({ activo: false }).where(eq(usuario.correo, RENE.correo));
      const res = await login(RENE.correo, RENE.contrasena).expect(401);
      expect(res.body.codigo).toBe('CREDENCIALES_INVALIDAS');
    });

    it('guarda el dispositivo indicado en el refresh token', async () => {
      await registrar().expect(201);
      await http()
        .post(`${API}/auth/login`)
        .send({ correo: RENE.correo, contrasena: RENE.contrasena, dispositivo: 'Pixel de Rene' })
        .expect(200);
      const filas = await bd.db.select().from(refreshToken);
      expect(filas.map((f) => f.dispositivo)).toContain('Pixel de Rene');
    });
  });

  describe('Refresh rotativo y cierre de sesión (ADR-004)', () => {
    it('renueva con la cookie, rota el refresh y emite un nuevo token de acceso', async () => {
      const registro = await registrar().expect(201);
      const cookie1 = valorCookie(registro);
      const res = await http().post(`${API}/auth/refresh`).set('Cookie', cookie1).expect(200);
      expect(res.body.usuario.correo).toBe(RENE.correo);
      expect(typeof res.body.accessToken).toBe('string');
      const cookie2 = valorCookie(res);
      expect(cookie2).not.toBe(cookie1);
      await http().post(`${API}/auth/refresh`).set('Cookie', cookie2).expect(200);
    });

    it('seguridad: reutilizar un refresh ya rotado revoca toda la familia', async () => {
      const registro = await registrar().expect(201);
      const cookie1 = valorCookie(registro);
      const rotado = await http().post(`${API}/auth/refresh`).set('Cookie', cookie1).expect(200);
      const cookie2 = valorCookie(rotado);

      const reuso = await http().post(`${API}/auth/refresh`).set('Cookie', cookie1).expect(401);
      expect(reuso.body.codigo).toBe('SESION_REVOCADA');
      expect(cookieRefresh(reuso)).toMatch(/mf_refresh=;/);

      // El refresh legítimo más reciente también quedó revocado.
      const legitimo = await http().post(`${API}/auth/refresh`).set('Cookie', cookie2).expect(401);
      expect(legitimo.body.codigo).toBe('SESION_INVALIDA');
      const filas = await bd.db.select().from(refreshToken);
      expect(filas).toHaveLength(2);
      expect(filas.every((f) => f.revocadoEn !== null)).toBe(true);
    });

    it('la reutilización no afecta las sesiones de otros dispositivos (otra familia)', async () => {
      const registro = await registrar().expect(201);
      const otro = await login(RENE.correo, RENE.contrasena).expect(200);
      const cookie1 = valorCookie(registro);
      await http().post(`${API}/auth/refresh`).set('Cookie', cookie1).expect(200);
      await http().post(`${API}/auth/refresh`).set('Cookie', cookie1).expect(401);
      await http().post(`${API}/auth/refresh`).set('Cookie', valorCookie(otro)).expect(200);
    });

    it('Android renueva enviando el refresh en el cuerpo', async () => {
      const registro = await registrar(RENE, true).expect(201);
      const res = await http()
        .post(`${API}/auth/refresh`)
        .set('X-Cliente', 'android')
        .send({ refreshToken: registro.body.refreshToken })
        .expect(200);
      expect(res.body.refreshToken).not.toBe(registro.body.refreshToken);
    });

    it('sin refresh, con uno desconocido o vencido → 401 SESION_INVALIDA', async () => {
      await http().post(`${API}/auth/refresh`).expect(401);
      await http().post(`${API}/auth/refresh`).send({ refreshToken: 'desconocido' }).expect(401);
      const registro = await registrar().expect(201);
      await bd.db.update(refreshToken).set({ venceEn: new Date(Date.now() - 1000) });
      const res = await http()
        .post(`${API}/auth/refresh`)
        .set('Cookie', valorCookie(registro))
        .expect(401);
      expect(res.body.codigo).toBe('SESION_INVALIDA');
    });

    it('si la cuenta se desactiva, el refresh deja de servir y se revoca', async () => {
      const registro = await registrar().expect(201);
      await bd.db.update(usuario).set({ activo: false });
      await http().post(`${API}/auth/refresh`).set('Cookie', valorCookie(registro)).expect(401);
      const [fila] = await bd.db.select().from(refreshToken);
      expect(fila?.revocadoEn).not.toBeNull();
    });

    it('el refresh refleja el hogar vigente del usuario', async () => {
      const registro = await registrar().expect(201);
      const fila = await usuarioEnBd(RENE.correo);
      const [h] = await bd.db.insert(hogar).values({ nombre: 'Casa' }).returning();
      await bd.db
        .insert(miembroHogar)
        .values({ hogarId: h?.id as string, usuarioId: fila?.id as string, rol: 'MIEMBRO' });
      const res = await http()
        .post(`${API}/auth/refresh`)
        .set('Cookie', valorCookie(registro))
        .expect(200);
      expect(res.body.hogar).toEqual({ id: h?.id, nombre: 'Casa', rol: 'MIEMBRO' });
    });

    it('cerrar sesión revoca el refresh, borra la cookie y responde 204', async () => {
      const registro = await registrar().expect(201);
      const cookie = valorCookie(registro);
      const res = await http()
        .post(`${API}/auth/logout`)
        .set('Authorization', `Bearer ${registro.body.accessToken}`)
        .set('Cookie', cookie)
        .expect(204);
      expect(cookieRefresh(res)).toMatch(/mf_refresh=;/);
      const despues = await http().post(`${API}/auth/refresh`).set('Cookie', cookie).expect(401);
      expect(despues.body.codigo).toBe('SESION_INVALIDA');
    });

    it('cerrar sesión exige token de acceso', async () => {
      const res = await http().post(`${API}/auth/logout`).expect(401);
      expect(res.body.codigo).toBe('NO_AUTENTICADO');
    });

    it('seguridad: no se puede cerrar la sesión de otro usuario con su refresh', async () => {
      const rene = await registrar(RENE, true).expect(201);
      const ana = await registrar(ANA, true).expect(201);
      await http()
        .post(`${API}/auth/logout`)
        .set('Authorization', `Bearer ${ana.body.accessToken}`)
        .send({ refreshToken: rene.body.refreshToken })
        .expect(204);
      await http()
        .post(`${API}/auth/refresh`)
        .send({ refreshToken: rene.body.refreshToken })
        .expect(200);
    });
  });

  describe('Perfil y guard JWT', () => {
    it('seguridad: el token de un usuario solo permite leer su propio perfil', async () => {
      const rene = await registrar().expect(201);
      const ana = await registrar(ANA).expect(201);
      const comoRene = await http()
        .get(`${API}/usuarios/yo`)
        .set('Authorization', `Bearer ${rene.body.accessToken}`)
        .expect(200);
      const comoAna = await http()
        .get(`${API}/usuarios/yo`)
        .set('Authorization', `Bearer ${ana.body.accessToken}`)
        .expect(200);
      expect(comoRene.body.correo).toBe(RENE.correo);
      expect(comoAna.body.correo).toBe(ANA.correo);
      // Un parámetro con el id de otro usuario se ignora: siempre responde el dueño del token.
      await http()
        .get(`${API}/usuarios/yo?id=${comoAna.body.id}`)
        .set('Authorization', `Bearer ${rene.body.accessToken}`)
        .expect(200)
        .expect((r) => expect(r.body.id).toBe(comoRene.body.id));
    });

    it('seguridad: un token con el sub de otro usuario firmado con otra clave → 401', async () => {
      await registrar().expect(201);
      const ana = await registrar(ANA).expect(201);
      const falso = new JwtService({ secret: 'otra-clave-de-32-caracteres-como-minimo!!' }).sign({
        sub: ana.body.usuario.id,
        hogarId: null,
        rol: null,
      });
      const res = await http()
        .get(`${API}/usuarios/yo`)
        .set('Authorization', `Bearer ${falso}`)
        .expect(401);
      expect(res.body.codigo).toBe('TOKEN_INVALIDO');
    });

    it('sin token → 401 NO_AUTENTICADO; token vencido → 401 TOKEN_EXPIRADO', async () => {
      const sin = await http().get(`${API}/usuarios/yo`).expect(401);
      expect(sin.body).toMatchObject({ codigo: 'NO_AUTENTICADO', instance: '/api/v1/usuarios/yo' });
      const registro = await registrar().expect(201);
      const ahora = Math.floor(Date.now() / 1000);
      const vencido = app.get(JwtService).sign({
        sub: registro.body.usuario.id,
        hogarId: null,
        rol: null,
        iat: ahora - 1000,
        exp: ahora - 100,
      });
      const res = await http()
        .get(`${API}/usuarios/yo`)
        .set('Authorization', `Bearer ${vencido}`)
        .expect(401);
      expect(res.body.codigo).toBe('TOKEN_EXPIRADO');
    });

    it('el token de un usuario eliminado ya no sirve para leer el perfil', async () => {
      const registro = await registrar().expect(201);
      await bd.db.delete(usuario);
      await http()
        .get(`${API}/usuarios/yo`)
        .set('Authorization', `Bearer ${registro.body.accessToken}`)
        .expect(401);
    });

    it('/health sigue siendo público', async () => {
      await http().get(`${API}/health`).expect(200);
    });
  });
});

describeConBd('HU-01 límite de solicitudes en /auth (integración)', () => {
  const bd = usarBaseDePruebas({ suite: 'auth_limite', sembrar: false });
  let app: INestApplication;

  beforeAll(async () => {
    app = await crearAppConBd(bd.base, (b) =>
      b.overrideProvider(getOptionsToken()).useValue([{ name: 'default', ttl: 60_000, limit: 3 }]),
    );
  });

  afterAll(async () => {
    await app?.close();
  });

  it('CA-01.3 throttling por IP: la cuarta solicitud en un minuto recibe 429 RFC 7807', async () => {
    const intento = () =>
      request(app.getHttpServer())
        .post(`${API}/auth/login`)
        .send({ correo: 'x@correo.com', contrasena: 'Almuerzo2026' });
    for (let i = 0; i < 3; i++) await intento().expect(401);
    const res = await intento().expect(429);
    expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
    expect(res.body).toMatchObject({ status: 429, codigo: 'LIMITE_SOLICITUDES' });
    expect(res.headers['retry-after']).toBeDefined();
  });
});
