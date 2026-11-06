/**
 * HU-35 Vincular producto con su equivalente por supermercado — integración contra PostgreSQL
 * real (TEST_DATABASE_URL). Cubre CA-35.1 a CA-35.4 y las excepciones E1 y E2 de CU-08.2.
 * Los vínculos son comunes a todos los hogares (D-05).
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  corrida,
  eq,
  precio,
  producto,
  productoSupermercado,
  supermercado,
  unidad,
} from '@menu/db';
import { crearAppConBd, describeConBd, usarBaseDePruebas } from './utils/base-datos';

const API = '/api/v1';

describeConBd('HU-35 Vínculos producto ↔ supermercado (integración)', () => {
  const bd = usarBaseDePruebas({
    suite: 'vinculos',
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

  const supermercadoId = async (codigo: string) => {
    const [fila] = await bd.db
      .select({ id: supermercado.id })
      .from(supermercado)
      .where(eq(supermercado.codigo, codigo));
    return fila!.id;
  };
  const productoId = async (nombre: string) => {
    const [fila] = await bd.db
      .select({ id: producto.id })
      .from(producto)
      .where(eq(producto.nombre, nombre));
    return fila!.id;
  };
  const unidadId = async (codigo: string) => {
    const [fila] = await bd.db
      .select({ id: unidad.id })
      .from(unidad)
      .where(eq(unidad.codigo, codigo));
    return fila!.id;
  };
  /** Registra el dominio del supermercado, como se hará al revisar sus términos de uso (D-07). */
  const conDominio = (codigo: string, dominio: string) =>
    bd.db.update(supermercado).set({ dominio }).where(eq(supermercado.codigo, codigo));

  /** POST del vínculo; `.expect(estado)` comprueba el estado y devuelve la respuesta. */
  const vincular = (
    token: string,
    nombreProducto: string,
    cuerpo: Record<string, unknown>,
    reemplazar = false,
  ) => ({
    expect: async (estado: number) => {
      const id = await productoId(nombreProducto);
      return http()
        .post(`${API}/productos/${id}/vinculos${reemplazar ? '?reemplazar=true' : ''}`)
        .set(con(token))
        .send(cuerpo)
        .expect(estado);
    },
  });

  const cuerpoWalmart = async (extra: Record<string, unknown> = {}) => ({
    supermercadoId: await supermercadoId('WALMART'),
    nombreTienda: 'Arroz blanco 1 lb',
    presentacionCantidad: 1,
    presentacionUnidadId: await unidadId('lb'),
    sku: 'WM-000123',
    ...extra,
  });

  beforeAll(async () => {
    app = await crearAppConBd(bd.base);
  });
  afterAll(async () => {
    await app?.close();
  });

  it('CA-35.1 vincula con la misma presentación y el factor es 1', async () => {
    const { token } = await hogarDe('Rene');

    const res = await vincular(token, 'Arroz', await cuerpoWalmart()).expect(201);

    expect(res.body).toMatchObject({
      supermercado: { nombre: 'Walmart' },
      nombreTienda: 'Arroz blanco 1 lb',
      presentacion: { cantidad: '1', unidad: 'lb', texto: '1 lb' },
      factor: '1',
      sku: 'WM-000123',
      activo: true,
      ultimoPrecio: null,
    });
    const lista = await http()
      .get(`${API}/productos/${await productoId('Arroz')}/vinculos`)
      .set(con(token))
      .expect(200);
    expect(lista.body).toHaveLength(1);
  });

  it('CA-35.2 una bolsa de 5 lb contra una de 1 lb da factor 5', async () => {
    const { token } = await hogarDe('Rene');
    const res = await vincular(
      token,
      'Arroz',
      await cuerpoWalmart({
        supermercadoId: await supermercadoId('PAIZ'),
        presentacionCantidad: '5',
        sku: 'PZ-5',
      }),
    ).expect(201);
    expect(res.body.factor).toBe('5');
  });

  it('convierte entre unidades: 1 L contra 900 ml da 1.111111', async () => {
    const { token } = await hogarDe('Rene');
    const res = await vincular(token, 'Aceite', {
      supermercadoId: await supermercadoId('SUPER_FRESH'),
      nombreTienda: 'Aceite Ideal 1 L',
      marca: 'Ideal',
      presentacionCantidad: 1,
      presentacionUnidadId: await unidadId('l'),
    }).expect(201);
    expect(res.body).toMatchObject({ factor: '1.111111', marca: 'Ideal' });
    const [fila] = await bd.db
      .select({ marcaNormalizada: productoSupermercado.marcaNormalizada })
      .from(productoSupermercado);
    expect(fila!.marcaNormalizada).toBe('ideal');
  });

  it('CA-35.4 una unidad de otra magnitud es 422 y no guarda el vínculo', async () => {
    const { token } = await hogarDe('Rene');

    const res = await vincular(
      token,
      'Arroz',
      await cuerpoWalmart({ presentacionUnidadId: await unidadId('l') }),
    ).expect(422);

    expect(res.body.codigo).toBe('UNIDAD_NO_CONVERTIBLE');
    expect(res.body.detail).toBe('La unidad de la presentación no es convertible a libras');
    expect(await bd.db.select().from(productoSupermercado)).toHaveLength(0);
  });

  describe('CA-35.3 vínculo activo existente', () => {
    it('sin confirmar es 409 con el vínculo que ya existe', async () => {
      const { token } = await hogarDe('Rene');
      const primero = await vincular(token, 'Arroz', await cuerpoWalmart()).expect(201);

      const res = await vincular(
        token,
        'Arroz',
        await cuerpoWalmart({ nombreTienda: 'Arroz otro', sku: 'WM-2' }),
      ).expect(409);

      expect(res.body.codigo).toBe('VINCULO_ACTIVO_EXISTE');
      expect(res.body.vinculoExistente.id).toBe(primero.body.id);
      expect(await bd.db.select().from(productoSupermercado)).toHaveLength(1);
    });

    it('con reemplazar el anterior queda inactivo con su histórico y el nuevo activo', async () => {
      const { token, hogarId } = await hogarDe('Rene');
      const primero = await vincular(token, 'Arroz', await cuerpoWalmart()).expect(201);
      const [c] = await bd.db
        .insert(corrida)
        .values({ programadaPara: new Date('2026-10-20T10:00:00Z') })
        .returning();
      await bd.db.insert(precio).values({
        productoSupermercadoId: primero.body.id,
        origen: 'AUTOMATICO',
        corridaId: c!.id,
        precio: '12.50',
        precioNormalizado: '12.50',
        fechaPrecio: '2026-10-20',
      });

      const res = await vincular(
        token,
        'Arroz',
        await cuerpoWalmart({ nombreTienda: 'Arroz otro', sku: 'WM-2' }),
        true,
      ).expect(201);

      expect(res.body.activo).toBe(true);
      const filas = await bd.db.select().from(productoSupermercado);
      expect(filas).toHaveLength(2);
      const anterior = filas.find((f) => f.id === primero.body.id)!;
      expect(anterior.activo).toBe(false);
      expect(anterior.inactivadoEn).not.toBeNull();
      expect(filas.find((f) => f.id === res.body.id)!.creadoPorHogarId).toBe(hogarId);
      expect(await bd.db.select().from(precio)).toHaveLength(1);

      const lista = await http()
        .get(`${API}/productos/${await productoId('Arroz')}/vinculos`)
        .set(con(token))
        .expect(200);
      expect(lista.body.map((v: { activo: boolean }) => v.activo)).toEqual([true, false]);
      expect(lista.body[1].ultimoPrecio).toMatchObject({ precio: '12.50', fecha: '2026-10-20' });
    });

    it('en otro supermercado no hay conflicto', async () => {
      const { token } = await hogarDe('Rene');
      await vincular(token, 'Arroz', await cuerpoWalmart()).expect(201);
      await vincular(
        token,
        'Arroz',
        await cuerpoWalmart({ supermercadoId: await supermercadoId('PAIZ'), sku: 'PZ-1' }),
      ).expect(201);
    });
  });

  describe('URL y SKU (CU-08.2 paso 2, 2a y E2)', () => {
    it('Walmart pide URL o SKU', async () => {
      const { token } = await hogarDe('Rene');
      const res = await vincular(token, 'Arroz', await cuerpoWalmart({ sku: undefined })).expect(
        422,
      );
      expect(res.body.codigo).toBe('URL_O_SKU_REQUERIDO');
    });

    it('2a Super Fresh no pide URL ni SKU', async () => {
      const { token } = await hogarDe('Rene');
      await vincular(
        token,
        'Arroz',
        await cuerpoWalmart({
          supermercadoId: await supermercadoId('SUPER_FRESH'),
          sku: undefined,
        }),
      ).expect(201);
    });

    it('E2 una URL que no es del dominio del supermercado se rechaza', async () => {
      const { token } = await hogarDe('Rene');
      await conDominio('WALMART', 'walmart.com.gt');

      const res = await vincular(
        token,
        'Arroz',
        await cuerpoWalmart({ url: 'https://www.paiz.com.gt/arroz' }),
      ).expect(422);
      expect(res.body.codigo).toBe('URL_FUERA_DE_DOMINIO');

      await vincular(
        token,
        'Arroz',
        await cuerpoWalmart({ url: 'https://www.walmart.com.gt/arroz', sku: undefined }),
      ).expect(201);
    });
  });

  it('GET /supermercados lista los activos e indica cuáles piden URL o SKU', async () => {
    const { token } = await hogarDe('Rene');
    const res = await http().get(`${API}/supermercados`).set(con(token)).expect(200);
    expect(res.body.map((s: { nombre: string }) => s.nombre)).toEqual([
      'La Torre',
      'Mercado',
      'Paiz',
      'Super Fresh',
      'Walmart',
    ]);
    const pide = Object.fromEntries(
      res.body.map((s: { nombre: string; requiereEnlace: boolean }) => [
        s.nombre,
        s.requiereEnlace,
      ]),
    );
    expect(pide).toEqual({
      'La Torre': false,
      Mercado: false,
      Paiz: true,
      'Super Fresh': false,
      Walmart: true,
    });
  });

  describe('otras validaciones', () => {
    it('un supermercado, producto o vínculo inexistente es 404', async () => {
      const { token } = await hogarDe('Rene');
      await vincular(
        token,
        'Arroz',
        await cuerpoWalmart({ supermercadoId: '00000000-0000-4000-8000-000000000000' }),
      ).expect(404);
      await http()
        .post(`${API}/productos/00000000-0000-4000-8000-000000000000/vinculos`)
        .set(con(token))
        .send(await cuerpoWalmart())
        .expect(404);
      await http().get(`${API}/productos/no-es-uuid/vinculos`).set(con(token)).expect(404);
      await http()
        .patch(`${API}/vinculos/00000000-0000-4000-8000-000000000000`)
        .set(con(token))
        .send({ marca: 'X' })
        .expect(404);
    });

    it('presentación 0 o nombre vacío es 422; un cuerpo mal formado es 400', async () => {
      const { token } = await hogarDe('Rene');
      expect(
        (
          await vincular(token, 'Arroz', await cuerpoWalmart({ presentacionCantidad: 0 })).expect(
            422,
          )
        ).body.codigo,
      ).toBe('PRESENTACION_INVALIDA');
      expect(
        (await vincular(token, 'Arroz', await cuerpoWalmart({ nombreTienda: '  ' })).expect(422))
          .body.codigo,
      ).toBe('NOMBRE_TIENDA_OBLIGATORIO');
      await vincular(token, 'Arroz', await cuerpoWalmart({ supermercadoId: 'x' })).expect(400);
    });

    it('sin sesión es 401', async () => {
      await http()
        .get(`${API}/productos/${await productoId('Arroz')}/vinculos`)
        .expect(401);
    });
  });

  describe('editar y precios visibles', () => {
    it('PATCH cambia nombre en tienda y marca, y la marca se normaliza', async () => {
      const { token } = await hogarDe('Rene');
      const creado = await vincular(token, 'Arroz', await cuerpoWalmart()).expect(201);

      const res = await http()
        .patch(`${API}/vinculos/${creado.body.id}`)
        .set(con(token))
        .send({ nombreTienda: 'Arroz Gallo 1 lb', marca: 'Gallo' })
        .expect(200);

      expect(res.body).toMatchObject({ nombreTienda: 'Arroz Gallo 1 lb', marca: 'Gallo' });
      const [fila] = await bd.db.select().from(productoSupermercado);
      expect(fila!.marcaNormalizada).toBe('gallo');
    });

    it('PATCH no deja a Walmart sin URL ni SKU y no edita uno inactivo', async () => {
      const { token } = await hogarDe('Rene');
      const primero = await vincular(token, 'Arroz', await cuerpoWalmart()).expect(201);
      const res = await http()
        .patch(`${API}/vinculos/${primero.body.id}`)
        .set(con(token))
        .send({ sku: '' })
        .expect(422);
      expect(res.body.codigo).toBe('URL_O_SKU_REQUERIDO');

      await vincular(token, 'Arroz', await cuerpoWalmart({ sku: 'WM-2' }), true).expect(201);
      const inactivo = await http()
        .patch(`${API}/vinculos/${primero.body.id}`)
        .set(con(token))
        .send({ marca: 'X' })
        .expect(422);
      expect(inactivo.body.codigo).toBe('VINCULO_INACTIVO');
    });

    it('un precio manual de otro hogar no se ve en el último precio', async () => {
      const yo = await hogarDe('Rene');
      const otro = await hogarDe('Ana');
      const creado = await vincular(yo.token, 'Arroz', await cuerpoWalmart()).expect(201);
      await bd.db.insert(precio).values({
        productoSupermercadoId: creado.body.id,
        origen: 'MANUAL',
        hogarId: otro.hogarId,
        precio: '9.99',
        precioNormalizado: '9.99',
        fechaPrecio: '2026-10-25',
      });
      const id = await productoId('Arroz');

      const mio = await http()
        .get(`${API}/productos/${id}/vinculos`)
        .set(con(yo.token))
        .expect(200);
      const suyo = await http()
        .get(`${API}/productos/${id}/vinculos`)
        .set(con(otro.token))
        .expect(200);

      expect(mio.body[0].ultimoPrecio).toBeNull();
      expect(suyo.body[0].ultimoPrecio).toMatchObject({ precio: '9.99', origen: 'MANUAL' });
    });

    it('el vínculo es común: otro hogar lo ve', async () => {
      const yo = await hogarDe('Rene');
      const otro = await hogarDe('Ana');
      await vincular(yo.token, 'Arroz', await cuerpoWalmart()).expect(201);
      const res = await http()
        .get(`${API}/productos/${await productoId('Arroz')}/vinculos`)
        .set(con(otro.token))
        .expect(200);
      expect(res.body).toHaveLength(1);
    });
  });
});
