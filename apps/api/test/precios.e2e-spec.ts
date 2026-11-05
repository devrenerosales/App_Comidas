/**
 * HU-34 Registrar precio manual — integración contra PostgreSQL real (TEST_DATABASE_URL).
 * Cubre CA-34.1 (precio manual del hogar), CA-34.4 (precio y fecha inválidos) y el flujo
 * alterno 1a (vínculo mínimo). El ticket con OCR (CA-34.2 y CA-34.3) es otra entrega.
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { eq, precio, producto, productoSupermercado, supermercado, unidad } from '@menu/db';
import { crearAppConBd, describeConBd, usarBaseDePruebas } from './utils/base-datos';

const API = '/api/v1';

/** Fecha de calendario a `dias` de hoy (negativo = pasado); con margen de sobra para la zona. */
const fechaRelativa = (dias: number): string =>
  new Date(Date.now() + dias * 86_400_000).toISOString().slice(0, 10);

describeConBd('HU-34 Registrar precio manual (integración)', () => {
  const bd = usarBaseDePruebas({
    suite: 'precios',
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

  const idDe = async (
    tabla: typeof producto | typeof supermercado | typeof unidad,
    columna: 'nombre' | 'codigo',
    valor: string,
  ) => {
    const [fila] = await bd.db
      .select({ id: tabla.id })
      .from(tabla)
      .where(eq((tabla as never)[columna], valor));
    return fila!.id;
  };
  const productoId = (nombre: string) => idDe(producto, 'nombre', nombre);
  const supermercadoId = (codigo: string) => idDe(supermercado, 'codigo', codigo);
  const unidadId = (codigo: string) => idDe(unidad, 'codigo', codigo);

  const registrar = (token: string, cuerpo: Record<string, unknown>) =>
    http().post(`${API}/precios`).set(con(token)).send(cuerpo);

  /** Precio de Arroz (bolsa de 1 lb) en Super Fresh, que no pide URL ni SKU. */
  const cuerpoArroz = async (extra: Record<string, unknown> = {}) => ({
    productoId: await productoId('Arroz'),
    supermercadoId: await supermercadoId('SUPER_FRESH'),
    presentacionCantidad: 1,
    presentacionUnidadId: await unidadId('lb'),
    precio: '12.90',
    fechaPrecio: fechaRelativa(-1),
    ...extra,
  });

  beforeAll(async () => {
    app = await crearAppConBd(bd.base);
  });
  afterAll(async () => {
    await app?.close();
  });

  describe('CA-34.1 registrar el precio de Super Fresh', () => {
    it('guarda el precio con origen MANUAL, el hogar y la fecha, y crea el vínculo mínimo (1a)', async () => {
      const { token, hogarId } = await hogarDe('Rene');
      const fecha = fechaRelativa(-1);

      const res = await registrar(token, await cuerpoArroz({ precio: '20.75' })).expect(201);

      expect(res.body).toMatchObject({
        precio: '20.75',
        precioNormalizado: '20.75',
        fechaPrecio: fecha,
        origen: 'MANUAL',
        vinculoCreado: true,
        vinculo: {
          supermercado: { nombre: 'Super Fresh' },
          nombreTienda: 'Arroz',
          factor: '1',
          ultimoPrecio: { precio: '20.75', fecha, origen: 'MANUAL' },
        },
      });
      const [fila] = await bd.db.select().from(precio);
      expect(fila).toMatchObject({
        origen: 'MANUAL',
        hogarId,
        precio: '20.75',
        precioNormalizado: '20.75',
        fechaPrecio: fecha,
      });
      expect(fila!.registradoPorId).not.toBeNull();
    });

    it('un segundo precio usa el vínculo que ya existe', async () => {
      const { token } = await hogarDe('Rene');
      await registrar(token, await cuerpoArroz()).expect(201);

      const res = await registrar(
        token,
        await cuerpoArroz({ precio: '13.50', presentacionCantidad: undefined }),
      ).expect(201);

      expect(res.body.vinculoCreado).toBe(false);
      expect(await bd.db.select().from(productoSupermercado)).toHaveLength(1);
      expect(await bd.db.select().from(precio)).toHaveLength(2);
    });

    it('acepta el precio como número y con coma decimal', async () => {
      const { token } = await hogarDe('Rene');
      const a = await registrar(token, await cuerpoArroz({ precio: 6.5 })).expect(201);
      const b = await registrar(token, await cuerpoArroz({ precio: '7,25' })).expect(201);
      expect([a.body.precio, b.body.precio]).toEqual(['6.50', '7.25']);
    });

    it('CA-35.2 el precio normalizado usa el factor del vínculo', async () => {
      const { token } = await hogarDe('Rene');
      const vinculo = await http()
        .post(`${API}/productos/${await productoId('Arroz')}/vinculos`)
        .set(con(token))
        .send({
          supermercadoId: await supermercadoId('PAIZ'),
          nombreTienda: 'Arroz 5 lb',
          presentacionCantidad: 5,
          presentacionUnidadId: await unidadId('lb'),
          sku: 'PZ-5',
        })
        .expect(201);

      const res = await registrar(token, {
        productoSupermercadoId: vinculo.body.id,
        precio: 31.25,
        fechaPrecio: fechaRelativa(0),
      }).expect(201);

      expect(res.body).toMatchObject({ precio: '31.25', precioNormalizado: '6.25' });
      expect(res.body.vinculoCreado).toBe(false);
    });
  });

  describe('CA-34.4 datos inválidos', () => {
    it.each([
      ['0.00', 'PRECIO_INVALIDO', 'El precio debe ser mayor que 0'],
      ['12.905', 'PRECIO_INVALIDO', 'El precio admite como máximo 2 decimales'],
      ['-3', 'PRECIO_INVALIDO', 'El precio debe ser mayor que 0'],
      ['abc', 'PRECIO_INVALIDO', 'Ingresa un precio válido (usa punto para los decimales)'],
    ])('el precio %p es 422 y no se guarda', async (valor, codigo, mensaje) => {
      const { token } = await hogarDe('Rene');
      const res = await registrar(token, await cuerpoArroz({ precio: valor })).expect(422);
      expect(res.body.codigo).toBe(codigo);
      expect(res.body.detail).toBe(mensaje);
      expect(await bd.db.select().from(precio)).toHaveLength(0);
      expect(await bd.db.select().from(productoSupermercado)).toHaveLength(0);
    });

    it('una fecha futura es 422 y no se guarda', async () => {
      const { token } = await hogarDe('Rene');
      const res = await registrar(
        token,
        await cuerpoArroz({ fechaPrecio: fechaRelativa(5) }),
      ).expect(422);
      expect(res.body.codigo).toBe('FECHA_FUTURA');
      expect(res.body.detail).toBe('La fecha de compra no puede ser futura');
      expect(await bd.db.select().from(precio)).toHaveLength(0);
    });

    it('una fecha que no existe es 422 FECHA_INVALIDA', async () => {
      const { token } = await hogarDe('Rene');
      const res = await registrar(token, await cuerpoArroz({ fechaPrecio: '2026-02-30' })).expect(
        422,
      );
      expect(res.body.codigo).toBe('FECHA_INVALIDA');
    });

    it('sin precio o con fecha que no es texto es 400', async () => {
      const { token } = await hogarDe('Rene');
      await registrar(token, await cuerpoArroz({ fechaPrecio: 20261024 })).expect(400);
    });
  });

  describe('vínculo mínimo (1a) y errores de referencia', () => {
    it('sin vínculo ni presentación es 422 VINCULO_REQUERIDO', async () => {
      const { token } = await hogarDe('Rene');
      const res = await registrar(
        token,
        await cuerpoArroz({ presentacionCantidad: undefined, presentacionUnidadId: undefined }),
      ).expect(422);
      expect(res.body.codigo).toBe('VINCULO_REQUERIDO');
    });

    it('una presentación en otra magnitud no crea vínculo ni precio', async () => {
      const { token } = await hogarDe('Rene');
      const res = await registrar(
        token,
        await cuerpoArroz({ presentacionUnidadId: await unidadId('l') }),
      ).expect(422);
      expect(res.body.codigo).toBe('UNIDAD_NO_CONVERTIBLE');
      expect(await bd.db.select().from(productoSupermercado)).toHaveLength(0);
      expect(await bd.db.select().from(precio)).toHaveLength(0);
    });

    it('Walmart y Paiz piden primero un vínculo con URL o SKU', async () => {
      const { token } = await hogarDe('Rene');
      const res = await registrar(
        token,
        await cuerpoArroz({ supermercadoId: await supermercadoId('WALMART') }),
      ).expect(422);
      expect(res.body.codigo).toBe('URL_O_SKU_REQUERIDO');
      expect(await bd.db.select().from(precio)).toHaveLength(0);
    });

    it('sin producto o supermercado es 422 y un id inexistente es 404', async () => {
      const { token } = await hogarDe('Rene');
      const sin = await registrar(token, { precio: '5', fechaPrecio: fechaRelativa(-1) }).expect(
        422,
      );
      expect(sin.body.codigo).toBe('DATOS_INCOMPLETOS');
      await registrar(
        token,
        await cuerpoArroz({ productoId: '00000000-0000-4000-8000-000000000000' }),
      ).expect(404);
      await registrar(token, {
        productoSupermercadoId: '00000000-0000-4000-8000-000000000000',
        precio: '5',
        fechaPrecio: fechaRelativa(-1),
      }).expect(404);
    });

    it('un vínculo reemplazado (inactivo) no admite precios nuevos', async () => {
      const { token } = await hogarDe('Rene');
      const primero = await registrar(token, await cuerpoArroz()).expect(201);
      await http()
        .post(`${API}/productos/${await productoId('Arroz')}/vinculos?reemplazar=true`)
        .set(con(token))
        .send({
          supermercadoId: await supermercadoId('SUPER_FRESH'),
          nombreTienda: 'Arroz nuevo',
          presentacionCantidad: 1,
          presentacionUnidadId: await unidadId('lb'),
        })
        .expect(201);

      const res = await registrar(token, {
        productoSupermercadoId: primero.body.vinculo.id,
        precio: '5',
        fechaPrecio: fechaRelativa(-1),
      }).expect(422);
      expect(res.body.codigo).toBe('VINCULO_INACTIVO');
    });

    it('sin sesión es 401', async () => {
      await http().post(`${API}/precios`).send({}).expect(401);
    });
  });

  describe('el precio es del hogar que lo registra', () => {
    it('otro hogar no lo ve en el último precio del vínculo', async () => {
      const yo = await hogarDe('Rene');
      const otro = await hogarDe('Ana');
      await registrar(yo.token, await cuerpoArroz({ precio: '9.99' })).expect(201);
      const id = await productoId('Arroz');

      const mio = await http()
        .get(`${API}/productos/${id}/vinculos`)
        .set(con(yo.token))
        .expect(200);
      const suyo = await http()
        .get(`${API}/productos/${id}/vinculos`)
        .set(con(otro.token))
        .expect(200);

      expect(mio.body[0].ultimoPrecio).toMatchObject({ precio: '9.99', origen: 'MANUAL' });
      expect(suyo.body[0].ultimoPrecio).toBeNull();
    });
  });
});
