import { describe, expect, it, vi } from 'vitest';
import { ClienteHttp } from './cliente';
import { ProblemaApi, SIN_CONEXION, mensajeDeError } from './problema';
import type { Sesion } from './tipos';

const SESION: Sesion = {
  usuario: { id: 'u1', nombre: 'Rene', correo: 'rene@correo.com', esAdminSistema: false },
  accessToken: 'nuevo',
  expiraEn: '2026-10-22T15:15:00.000Z',
  hogar: null,
};

it('al limpiar la sesión elimina los tokens y avisa al proveedor de autenticación', () => {
  const cliente = new ClienteHttp({ base: '/api/v1', nativo: true });
  const oyente = vi.fn();
  cliente.alCambiarSesion(oyente);
  cliente.establecerSesion({ ...SESION, refreshToken: 'refresh-anterior' });
  cliente.limpiarSesion();
  expect(cliente.tieneSesion).toBe(false);
  expect(cliente.refreshToken).toBeNull();
  expect(oyente).toHaveBeenCalledTimes(1);
  expect(oyente).toHaveBeenCalledWith(null);
});

function json(status: number, cuerpo?: unknown): Response {
  return new Response(cuerpo === undefined ? null : JSON.stringify(cuerpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function problema(status: number, codigo: string, detail: string) {
  return json(status, { status, codigo, detail, title: 'x', type: 'y' });
}

type Llamada = [string, RequestInit];

function crear(respuestas: Response[], nativo = false) {
  const fetch = vi.fn<(url: string, init: RequestInit) => Promise<Response>>();
  for (const r of respuestas) fetch.mockResolvedValueOnce(r);
  const cliente = new ClienteHttp({
    base: '/api/v1',
    fetch: fetch as unknown as typeof globalThis.fetch,
    nativo,
  });
  const cabeceras = (i: number) =>
    (fetch.mock.calls[i] as Llamada)[1].headers as Record<string, string>;
  return { cliente, fetch, cabeceras };
}

describe('ClienteHttp', () => {
  it('reintenta multipart tras renovar, conserva el archivo y deja el boundary al navegador', async () => {
    const { cliente, fetch, cabeceras } = crear([
      json(401),
      json(200, SESION),
      json(201, { id: 'i1' }),
    ]);
    cliente.establecerAcceso('vencido');
    const cuerpo = new FormData();
    cuerpo.append('archivo', new File(['fecha'], 'menus.csv'));
    expect(await cliente.peticion('/importaciones', { metodo: 'POST', cuerpo })).toEqual({
      id: 'i1',
    });
    expect(cabeceras(0)['Content-Type']).toBeUndefined();
    expect(cabeceras(2)['Content-Type']).toBeUndefined();
    expect(cabeceras(2).Authorization).toBe('Bearer nuevo');
    expect(fetch.mock.calls[0]![1].body).toBe(cuerpo);
    expect(fetch.mock.calls[2]![1].body).toBe(cuerpo);
  });
  it('descarga archivos con el token de acceso', async () => {
    const { cliente, cabeceras } = crear([new Response('fecha,platillo')]);
    cliente.establecerAcceso('token');
    const blob = await cliente.peticion<Blob>('/importaciones/plantilla?formato=csv', {
      respuesta: 'blob',
    });
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBe('fecha,platillo'.length);
    expect(cabeceras(0).Authorization).toBe('Bearer token');
  });
  it('HU-02 establecerAcceso reemplaza solo el token de acceso (hogar nuevo)', async () => {
    const { cliente, cabeceras } = crear([json(200, {})], true);
    cliente.establecerSesion({ ...SESION, accessToken: 'sin-hogar', refreshToken: 'r1' });
    cliente.establecerAcceso('con-hogar');
    await cliente.peticion('/hogar');
    expect(cabeceras(0).Authorization).toBe('Bearer con-hogar');
    expect(cliente.refreshToken).toBe('r1');
  });

  it('envía JSON con el token de acceso y cookies (credentials: include)', async () => {
    const { cliente, fetch, cabeceras } = crear([json(200, { ok: true })]);
    cliente.establecerSesion({ ...SESION, accessToken: 'acceso' });
    await expect(cliente.peticion('/x', { metodo: 'POST', cuerpo: { a: 1 } })).resolves.toEqual({
      ok: true,
    });
    const [url, init] = fetch.mock.calls[0] as Llamada;
    expect(url).toBe('/api/v1/x');
    expect(init).toMatchObject({ method: 'POST', body: '{"a":1}', credentials: 'include' });
    expect(cabeceras(0)).toMatchObject({
      Authorization: 'Bearer acceso',
      'Content-Type': 'application/json',
      Accept: 'application/json',
    });
    expect(cabeceras(0)['X-Cliente']).toBeUndefined();
  });

  it('204 → undefined; sin token no envía Authorization', async () => {
    const { cliente, cabeceras } = crear([new Response(null, { status: 204 })]);
    await expect(cliente.peticion('/x', { autenticar: false })).resolves.toBeUndefined();
    expect(cabeceras(0).Authorization).toBeUndefined();
    expect(cabeceras(0)['Content-Type']).toBeUndefined();
  });

  it('ante un 401 renueva una vez con el refresh y reintenta la petición', async () => {
    const { cliente, fetch, cabeceras } = crear([
      problema(401, 'TOKEN_EXPIRADO', 'Tu sesión expiró.'),
      json(200, SESION),
      json(200, { menu: 1 }),
    ]);
    const oyente = vi.fn();
    cliente.alCambiarSesion(oyente);
    cliente.establecerSesion({ ...SESION, accessToken: 'vencido' });
    await expect(cliente.peticion('/menus')).resolves.toEqual({ menu: 1 });
    expect((fetch.mock.calls[1] as Llamada)[0]).toBe('/api/v1/auth/refresh');
    expect(cabeceras(1).Authorization).toBeUndefined();
    expect(cabeceras(2).Authorization).toBe('Bearer nuevo');
    expect(oyente).toHaveBeenCalledWith(SESION);
  });

  it('reintenta solo una vez: un segundo 401 se propaga', async () => {
    const { cliente, fetch } = crear([
      problema(401, 'TOKEN_INVALIDO', 'a'),
      json(200, SESION),
      problema(401, 'TOKEN_INVALIDO', 'b'),
    ]);
    const error = await cliente.peticion('/x').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ProblemaApi);
    expect((error as ProblemaApi).message).toBe('b');
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('si el refresh falla, termina la sesión y avisa a los oyentes (CU-01.1 E2)', async () => {
    const { cliente } = crear([
      problema(401, 'TOKEN_EXPIRADO', 'Tu sesión expiró.'),
      problema(401, 'SESION_INVALIDA', 'Tu sesión terminó. Inicia sesión de nuevo.'),
    ]);
    const oyente = vi.fn();
    const anular = cliente.alCambiarSesion(oyente);
    cliente.establecerSesion(SESION);
    await expect(cliente.peticion('/x')).rejects.toMatchObject({ codigo: 'TOKEN_EXPIRADO' });
    expect(oyente).toHaveBeenCalledWith(null);
    expect(cliente.tieneSesion).toBe(false);
    anular();
  });

  it('las peticiones de login no intentan renovar ante 401', async () => {
    const { cliente, fetch } = crear([
      problema(401, 'CREDENCIALES_INVALIDAS', 'Correo o contraseña incorrectos'),
    ]);
    await expect(
      cliente.peticion('/auth/login', { metodo: 'POST', cuerpo: {}, autenticar: false }),
    ).rejects.toMatchObject({
      status: 401,
      message: 'Correo o contraseña incorrectos',
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('varias renovaciones simultáneas comparten una sola solicitud', async () => {
    const { cliente, fetch } = crear([json(200, SESION)]);
    const [a, b] = await Promise.all([cliente.renovar(), cliente.renovar()]);
    expect(a).toEqual(SESION);
    expect(b).toBe(a);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('usa Web Locks para serializar la renovación entre pestañas', async () => {
    const fetch = vi.fn().mockResolvedValue(json(200, SESION));
    const locks = { request: vi.fn((_n: string, fn: () => Promise<unknown>) => fn()) };
    const cliente = new ClienteHttp({ base: '', fetch, locks: locks as unknown as LockManager });
    await cliente.renovar();
    expect(locks.request).toHaveBeenCalledWith('menu-familiar-refresh', expect.any(Function));
  });

  it('renovar sin red devuelve null sin cerrar la sesión local', async () => {
    const fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const cliente = new ClienteHttp({ base: '', fetch });
    cliente.establecerSesion(SESION);
    await expect(cliente.renovar()).resolves.toBeNull();
    expect(cliente.tieneSesion).toBe(true);
  });

  it('sin conexión → ProblemaApi SIN_CONEXION con el mensaje de CU-01.1 E1', async () => {
    const fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const cliente = new ClienteHttp({ base: '', fetch });
    await expect(cliente.peticion('/auth/login', { autenticar: false })).rejects.toMatchObject({
      codigo: SIN_CONEXION,
      status: 0,
      message: 'Necesitas conexión para iniciar sesión',
    });
  });

  it('Android: envía X-Cliente y el refresh en el cuerpo', async () => {
    const { cliente, fetch, cabeceras } = crear(
      [json(200, { ...SESION, refreshToken: 'r2' })],
      true,
    );
    cliente.establecerSesion({ ...SESION, refreshToken: 'r1' });
    expect(cliente.refreshToken).toBe('r1');
    await cliente.renovar();
    expect(cabeceras(0)['X-Cliente']).toBe('android');
    expect((fetch.mock.calls[0] as Llamada)[1].body).toBe('{"refreshToken":"r1"}');
    expect(cliente.refreshToken).toBe('r2');
    cliente.limpiarSesion();
    expect(cliente.refreshToken).toBeNull();
  });

  it('usa fetch global por defecto', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue(json(200, { ok: 1 }));
    try {
      await expect(new ClienteHttp({ base: '/b' }).peticion('/x')).resolves.toEqual({ ok: 1 });
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe('ProblemaApi (RFC 7807)', () => {
  it('lee codigo, detail y errores por campo', async () => {
    const p = await ProblemaApi.desde(
      json(422, {
        status: 422,
        codigo: 'CONTRASENA_DEBIL',
        detail: 'La contraseña debe tener al menos 8 caracteres, una letra y un número',
        errores: [{ campo: 'contrasena', mensaje: 'Débil' }],
      }),
    );
    expect(p.codigo).toBe('CONTRASENA_DEBIL');
    expect(p.errorDe('contrasena')).toBe('Débil');
    expect(p.errorDe('correo')).toBeUndefined();
    expect(mensajeDeError(p)).toBe(
      'La contraseña debe tener al menos 8 caracteres, una letra y un número',
    );
  });

  it('5xx sin cuerpo JSON (API apagada o proxy sin destino) → servidor no disponible', async () => {
    for (const status of [500, 502, 503, 504]) {
      const p = await ProblemaApi.desde(new Response('<html>', { status }));
      expect(p.codigo).toBe('SERVIDOR_NO_DISPONIBLE');
      expect(p.status).toBe(status);
      expect(p.message).toBe(
        'No pudimos comunicarnos con el servidor. Intenta de nuevo en unos minutos.',
      );
    }
    const vacio = await ProblemaApi.desde(new Response(null, { status: 500 }));
    expect(vacio.codigo).toBe('SERVIDOR_NO_DISPONIBLE');
  });

  it('5xx con problema JSON conserva el detalle de la API', async () => {
    const p = await ProblemaApi.desde(
      new Response(
        JSON.stringify({
          status: 500,
          detail: 'Ocurrió un error inesperado. Intenta de nuevo más tarde.',
        }),
        { status: 500 },
      ),
    );
    expect(p.codigo).toBe('HTTP_500');
    expect(p.message).toBe('Ocurrió un error inesperado. Intenta de nuevo más tarde.');
  });

  it('cuerpo no JSON en 4xx → mensaje genérico y código HTTP_xxx', async () => {
    const p = await ProblemaApi.desde(new Response('<html>', { status: 404 }));
    expect(p.codigo).toBe('HTTP_404');
    expect(p.message).toBe('Ocurrió un error inesperado. Intenta de nuevo más tarde.');
    expect(p.errores).toEqual([]);
    const sinDetalle = new ProblemaApi({ status: 500, title: 'Error interno' });
    expect(sinDetalle.message).toBe('Error interno');
    expect(new ProblemaApi({ status: 503 }).message).toBe('Error 503');
    expect(mensajeDeError(new Error('x'))).toBe(
      'Ocurrió un error inesperado. Intenta de nuevo más tarde.',
    );
  });
});
