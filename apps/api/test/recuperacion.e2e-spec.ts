import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { eq, tokenRecuperacion, usuario } from '@menu/db';
import { SERVICIO_CORREO } from '../src/correo/correo.tipos';
import { ServicioCorreoMemoria } from '../src/correo/memoria-correo.service';
import { crearAppConBd, describeConBd, usarBaseDePruebas } from './utils/base-datos';
import { hashRecuperacion } from '../src/auth/recuperacion.service';

const CUENTA = { nombre: 'Ana', correo: 'ana@correo.com', contrasena: 'Almuerzo2026' };
const LOGIN = { correo: CUENTA.correo, contrasena: CUENTA.contrasena };
const NUEVA = 'PepianDePollo9';
const API = '/api/v1/auth';

describeConBd('HU-04 Recuperación de contraseña', () => {
  const bd = usarBaseDePruebas({
    suite: 'recuperacion',
    sembrar: false,
    truncarEntrePruebas: true,
  });
  let app: INestApplication;
  let correo: ServicioCorreoMemoria;
  const http = () => request(app.getHttpServer());
  const registro = () =>
    http().post(`${API}/registro`).set('X-Cliente', 'android').send(CUENTA).expect(201);
  const solicitar = (direccion = CUENTA.correo) =>
    http().post(`${API}/recuperar`).send({ correo: direccion }).expect(202);
  const tokenEnCorreo = () => {
    const mensaje = correo.ultimo(CUENTA.correo);
    const token = mensaje?.texto.match(/\/restablecer\/([A-Za-z0-9_-]{43})/)?.[1];
    if (!token) throw new Error('Falta el enlace de recuperación');
    return token;
  };
  const restablecer = (token: string, contrasena = NUEVA, confirmacion = contrasena) =>
    http().post(`${API}/restablecer`).send({ token, contrasena, confirmacion });

  beforeAll(async () => {
    correo = new ServicioCorreoMemoria(false);
    app = await crearAppConBd(bd.base, (builder) =>
      builder.overrideProvider(SERVICIO_CORREO).useValue(correo),
    );
  });
  beforeEach(() => correo.limpiar());
  afterAll(async () => {
    await app?.close();
  });

  it('CA-04.1 restablece, reinicia bloqueo y revoca accesos y refresh de todos los dispositivos', async () => {
    const sesion = await registro();
    const segunda = await http()
      .post(`${API}/login`)
      .set('X-Cliente', 'android')
      .send(LOGIN)
      .expect(200);
    await bd.db
      .update(usuario)
      .set({ intentosFallidos: 5, bloqueadoHasta: new Date(Date.now() + 900_000) });
    await solicitar(' ANA@CORREO.COM ');
    const token = tokenEnCorreo();
    const [fila] = await bd.db.select().from(tokenRecuperacion);
    expect(fila?.tokenHash).toBe(hashRecuperacion(token));
    expect(fila?.tokenHash).not.toBe(token);
    expect((fila?.venceEn.getTime() ?? 0) - Date.now()).toBeGreaterThan(59 * 60_000);
    await http().post(`${API}/validar-recuperacion`).send({ token }).expect(204);
    await restablecer(token).expect(200, { mensaje: 'Contraseña actualizada' });
    await http().post(`${API}/validar-recuperacion`).send({ token }).expect(410);
    await restablecer(token).expect(410);
    for (const s of [sesion, segunda]) {
      await http()
        .post(`${API}/refresh`)
        .set('X-Cliente', 'android')
        .send({ refreshToken: s.body.refreshToken })
        .expect(401);
      await http()
        .get('/api/v1/usuarios/yo')
        .set('Authorization', `Bearer ${s.body.accessToken}`)
        .expect(401);
    }
    await http().post(`${API}/login`).send(LOGIN).expect(401);
    const nueva = await http()
      .post(`${API}/login`)
      .send({ correo: CUENTA.correo, contrasena: NUEVA })
      .expect(200);
    await http()
      .get('/api/v1/usuarios/yo')
      .set('Authorization', `Bearer ${nueva.body.accessToken}`)
      .expect(200);
    const [cuenta] = await bd.db.select().from(usuario);
    expect(cuenta).toMatchObject({
      intentosFallidos: 0,
      bloqueadoHasta: null,
      primerIntentoFallidoEn: null,
    });
  });

  it('CA-04.2 responde igual para un correo existente, desconocido o cuenta inactiva', async () => {
    await registro();
    const existente = await solicitar();
    correo.limpiar();
    const desconocido = await solicitar('nadie@correo.com');
    await bd.db.update(usuario).set({ activo: false });
    const inactivo = await solicitar();
    expect(desconocido.body).toEqual(existente.body);
    expect(inactivo.body).toEqual(existente.body);
    expect(correo.enviados).toHaveLength(0);
    expect(desconocido.body).toEqual({ mensaje: 'Si el correo existe, recibirás un enlace' });
  });

  it('CA-04.3 rechaza el enlace vencido y el token desconocido sin cambiar contraseña', async () => {
    await registro();
    await solicitar();
    await bd.db.update(tokenRecuperacion).set({ venceEn: new Date(Date.now() - 1) });
    await http().post(`${API}/validar-recuperacion`).send({ token: tokenEnCorreo() }).expect(410);
    await restablecer(tokenEnCorreo()).expect(410);
    await restablecer('x'.repeat(43)).expect(410);
    await http().post(`${API}/login`).send(LOGIN).expect(200);
  });

  it('valida correo, política de contraseña y confirmación sin consumir el enlace', async () => {
    await http().post(`${API}/recuperar`).send({ correo: 'mal' }).expect(400);
    await registro();
    await solicitar();
    const token = tokenEnCorreo();
    await restablecer(token, 'pollo').expect(422);
    await restablecer(token, NUEVA, 'OtraContrasena9').expect(422);
    await restablecer(token).expect(200);
  });

  it('un restablecimiento consume los demás enlaces de la cuenta', async () => {
    await registro();
    await solicitar();
    const primero = tokenEnCorreo();
    correo.limpiar();
    await solicitar();
    const segundo = tokenEnCorreo();
    await restablecer(segundo).expect(200);
    await restablecer(primero).expect(410);
  });

  it('dos usos simultáneos del mismo enlace solo permiten un restablecimiento', async () => {
    await registro();
    await solicitar();
    const token = tokenEnCorreo();
    const resultados = await Promise.all([restablecer(token), restablecer(token)]);
    expect(resultados.map((r) => r.status).sort()).toEqual([200, 410]);
    const [fila] = await bd.db
      .select()
      .from(tokenRecuperacion)
      .where(eq(tokenRecuperacion.tokenHash, hashRecuperacion(token)));
    expect(fila?.usadoEn).not.toBeNull();
  });

  it('un error de SMTP conserva el mensaje neutro', async () => {
    await registro();
    const fallo = jest
      .spyOn(correo, 'enviar')
      .mockRejectedValueOnce(new Error('SMTP no disponible'));
    await solicitar();
    expect(fallo).toHaveBeenCalled();
    fallo.mockRestore();
  });
});
