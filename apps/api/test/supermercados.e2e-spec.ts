/**
 * HU-09 Supermercados y marcas preferidas — integración contra PostgreSQL real
 * (TEST_DATABASE_URL). Cubre CA-09.1 (preferidos del hogar), CA-09.2 (marca preferida),
 * CA-09.3 (al menos un supermercado) y CA-09.4 (marca con precio antiguo: la API entrega la
 * fecha para que la app avise "Precio del dd/mm/aaaa").
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

describeConBd('HU-09 Supermercados y marcas (integración)', () => {
  const bd = usarBaseDePruebas({
    suite: 'supermercados',
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

  /** Vincula el producto con una marca en un supermercado y, si se pide, le pone un precio. */
  const vincular = async (
    nombreProducto: string,
    codigoSuper: string,
    marca: string | null,
    cantidad: string,
    precioTienda?: { monto: string; fecha: string; hogarId?: string },
  ) => {
    const [unidadL] = await bd.db
      .select({ id: unidad.id })
      .from(unidad)
      .where(eq(unidad.codigo, 'l'));
    const [vinculo] = await bd.db
      .insert(productoSupermercado)
      .values({
        productoId: await productoId(nombreProducto),
        supermercadoId: await supermercadoId(codigoSuper),
        nombreTienda: `${nombreProducto} ${marca ?? ''}`.trim(),
        marca,
        marcaNormalizada: marca ? marca.toLowerCase() : null,
        presentacionCantidad: cantidad,
        presentacionUnidadId: unidadL!.id,
        factor: '1',
      })
      .returning();
    if (precioTienda) {
      const [c] = precioTienda.hogarId
        ? []
        : await bd.db
            .insert(corrida)
            .values({ programadaPara: new Date(`${precioTienda.fecha}T10:00:00Z`) })
            .returning();
      await bd.db.insert(precio).values({
        corridaId: c?.id ?? null,
        productoSupermercadoId: vinculo!.id,
        origen: precioTienda.hogarId ? 'MANUAL' : 'AUTOMATICO',
        hogarId: precioTienda.hogarId ?? null,
        precio: precioTienda.monto,
        precioNormalizado: precioTienda.monto,
        fechaPrecio: precioTienda.fecha,
      });
    }
  };

  const supermercados = (token: string) =>
    http().get(`${API}/hogar/preferencias/supermercados`).set(con(token));
  const guardarSupermercados = (token: string, preferidos: string[]) =>
    http().put(`${API}/hogar/preferencias/supermercados`).set(con(token)).send({ preferidos });

  beforeAll(async () => {
    app = await crearAppConBd(bd.base);
  });
  afterAll(async () => {
    await app?.close();
  });

  describe('supermercados preferidos', () => {
    it('sin decisión previa, los cinco supermercados salen como preferidos', async () => {
      const { token } = await hogarDe('Rene');
      const res = await supermercados(token).expect(200);
      expect(res.body.map((s: { nombre: string }) => s.nombre)).toEqual([
        'La Torre',
        'Mercado',
        'Paiz',
        'Super Fresh',
        'Walmart',
      ]);
      expect(res.body.every((s: { preferido: boolean }) => s.preferido)).toBe(true);
    });

    it('CA-09.1 guarda Walmart y Paiz como preferidos y deja los demás sin marcar', async () => {
      const { token } = await hogarDe('Rene');
      const walmart = await supermercadoId('WALMART');
      const paiz = await supermercadoId('PAIZ');

      const res = await guardarSupermercados(token, [walmart, paiz]).expect(200);

      const preferidos = res.body
        .filter((s: { preferido: boolean }) => s.preferido)
        .map((s: { nombre: string }) => s.nombre);
      expect(preferidos).toEqual(['Paiz', 'Walmart']);
      const otra = await supermercados(token).expect(200);
      expect(otra.body).toEqual(res.body);
    });

    it('CA-09.3 sin ningún supermercado es 422 y las preferencias no cambian', async () => {
      const { token } = await hogarDe('Rene');
      const walmart = await supermercadoId('WALMART');
      await guardarSupermercados(token, [walmart]).expect(200);

      const res = await guardarSupermercados(token, []).expect(422);

      expect(res.body.codigo).toBe('SIN_SUPERMERCADO_PREFERIDO');
      expect(res.body.detail).toBe('Debes tener al menos un supermercado preferido');
      const despues = await supermercados(token).expect(200);
      expect(
        despues.body
          .filter((s: { preferido: boolean }) => s.preferido)
          .map((s: { nombre: string }) => s.nombre),
      ).toEqual(['Walmart']);
    });

    it('un supermercado que no existe es 404 y un id mal formado es 400', async () => {
      const { token } = await hogarDe('Rene');
      await guardarSupermercados(token, ['00000000-0000-4000-8000-000000000000']).expect(404);
      await guardarSupermercados(token, ['no-es-uuid']).expect(400);
    });

    it('las preferencias son de cada hogar', async () => {
      const yo = await hogarDe('Rene');
      const otro = await hogarDe('Ana');
      await guardarSupermercados(yo.token, [await supermercadoId('PAIZ')]).expect(200);
      const res = await supermercados(otro.token).expect(200);
      expect(res.body.every((s: { preferido: boolean }) => s.preferido)).toBe(true);
    });

    it('sin sesión es 401', async () => {
      await http().get(`${API}/hogar/preferencias/supermercados`).expect(401);
    });
  });

  describe('marcas preferidas', () => {
    const marcasDe = (token: string, id: string) =>
      http().get(`${API}/hogar/preferencias/marcas/${id}`).set(con(token));
    const elegir = (token: string, id: string, marca: string | null) =>
      http().put(`${API}/hogar/preferencias/marcas/${id}`).set(con(token)).send({ marca });

    it('CA-09.2 elige "Ideal" y queda como marca preferida del aceite', async () => {
      const { token } = await hogarDe('Rene');
      await vincular('Aceite', 'WALMART', 'Ideal', '1.000', {
        monto: '24.90',
        fecha: '2026-10-01',
      });
      await vincular('Aceite', 'PAIZ', 'Capullo', '1.000');
      const id = await productoId('Aceite');

      const antes = await marcasDe(token, id).expect(200);
      expect(antes.body.marcaPreferida).toBeNull();
      expect(antes.body.marcas.map((m: { marca: string }) => m.marca)).toEqual([
        'Capullo',
        'Ideal',
      ]);

      const res = await elegir(token, id, 'Ideal').expect(200);

      expect(res.body.marcaPreferida).toBe('Ideal');
      const lista = await http()
        .get(`${API}/hogar/preferencias/marcas`)
        .set(con(token))
        .expect(200);
      expect(lista.body).toEqual([{ productoId: id, producto: 'Aceite', marca: 'Ideal' }]);
    });

    it('CA-09.4 muestra el último precio con su fecha, para avisar que es antiguo', async () => {
      const { token } = await hogarDe('Rene');
      await vincular('Aceite', 'WALMART', 'Ideal', '1.000', {
        monto: '24.90',
        fecha: '2026-10-01',
      });

      const res = await marcasDe(token, await productoId('Aceite')).expect(200);

      expect(res.body.marcas).toEqual([
        {
          marca: 'Ideal',
          presentaciones: [
            {
              supermercado: 'Walmart',
              presentacion: '1 l',
              ultimoPrecio: { precio: '24.90', fecha: '2026-10-01' },
            },
          ],
        },
      ]);
    });

    it('un precio manual de otro hogar no se ve', async () => {
      const yo = await hogarDe('Rene');
      const otro = await hogarDe('Ana');
      await vincular('Aceite', 'WALMART', 'Ideal', '1.000', {
        monto: '19.99',
        fecha: '2026-10-20',
        hogarId: otro.hogarId,
      });
      const id = await productoId('Aceite');

      const mio = await marcasDe(yo.token, id).expect(200);
      const suyo = await marcasDe(otro.token, id).expect(200);

      expect(mio.body.marcas[0].presentaciones[0].ultimoPrecio).toBeNull();
      expect(suyo.body.marcas[0].presentaciones[0].ultimoPrecio.precio).toBe('19.99');
    });

    it('4a un producto sin marcas vinculadas devuelve la lista vacía', async () => {
      const { token } = await hogarDe('Rene');
      const res = await marcasDe(token, await productoId('Arroz')).expect(200);
      expect(res.body.marcas).toEqual([]);
    });

    it('5a quitar la marca vuelve a "cualquier marca"', async () => {
      const { token } = await hogarDe('Rene');
      await vincular('Aceite', 'WALMART', 'Ideal', '1.000');
      const id = await productoId('Aceite');
      await elegir(token, id, 'Ideal').expect(200);

      const res = await elegir(token, id, null).expect(200);

      expect(res.body.marcaPreferida).toBeNull();
      const lista = await http()
        .get(`${API}/hogar/preferencias/marcas`)
        .set(con(token))
        .expect(200);
      expect(lista.body).toEqual([]);
    });

    it('una marca sin vínculo es 422 MARCA_SIN_VINCULO y no cambia nada', async () => {
      const { token } = await hogarDe('Rene');
      await vincular('Aceite', 'WALMART', 'Ideal', '1.000');
      const id = await productoId('Aceite');

      const res = await elegir(token, id, 'Otra').expect(422);

      expect(res.body.codigo).toBe('MARCA_SIN_VINCULO');
      expect((await marcasDe(token, id).expect(200)).body.marcaPreferida).toBeNull();
    });

    it('un producto inexistente o un id mal formado es 404', async () => {
      const { token } = await hogarDe('Rene');
      await marcasDe(token, '00000000-0000-4000-8000-000000000000').expect(404);
      await marcasDe(token, 'no-es-uuid').expect(404);
      await elegir(token, '00000000-0000-4000-8000-000000000000', 'Ideal').expect(404);
    });

    it('la marca preferida es de cada hogar', async () => {
      const yo = await hogarDe('Rene');
      const otro = await hogarDe('Ana');
      await vincular('Aceite', 'WALMART', 'Ideal', '1.000');
      const id = await productoId('Aceite');
      await elegir(yo.token, id, 'Ideal').expect(200);
      expect((await marcasDe(otro.token, id).expect(200)).body.marcaPreferida).toBeNull();
    });
  });
});
