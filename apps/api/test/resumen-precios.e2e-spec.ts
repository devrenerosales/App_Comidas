/**
 * HU-36 Precio mínimo y mediana — integración contra PostgreSQL real (TEST_DATABASE_URL). Cubre
 * CA-36.1 a CA-36.5 sobre `GET /productos/{id}/resumen-precio` y que `precio_resumen` se
 * mantenga al registrar un precio, cambiar los supermercados preferidos o generar un menú.
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  and,
  corrida,
  eq,
  precio,
  precioResumen,
  producto,
  productoSupermercado,
  supermercado,
  unidad,
} from '@menu/db';
import { crearAppConBd, describeConBd, usarBaseDePruebas } from './utils/base-datos';

const API = '/api/v1';

/** Fecha de calendario a `dias` de hoy (negativo = pasado). */
const fechaRelativa = (dias: number): string =>
  new Date(Date.now() + dias * 86_400_000).toISOString().slice(0, 10);

describeConBd('HU-36 Precio mínimo y mediana (integración)', () => {
  const bd = usarBaseDePruebas({
    suite: 'resumen-precios',
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

  let corridaId: string;
  const vinculos = new Map<string, string>();

  /**
   * Un precio normalizado del producto en el supermercado. Sin hogar es automático (común a todos
   * los hogares); con hogar es manual de ese hogar.
   */
  const sembrarPrecio = async (
    nombreProducto: string,
    codigoSuper: string,
    monto: string,
    fecha: string,
    hogarId?: string,
  ) => {
    const clave = `${nombreProducto}/${codigoSuper}`;
    if (!vinculos.has(clave)) {
      const [lb] = await bd.db
        .select({ id: unidad.id })
        .from(unidad)
        .where(eq(unidad.codigo, 'lb'));
      const [v] = await bd.db
        .insert(productoSupermercado)
        .values({
          productoId: await productoId(nombreProducto),
          supermercadoId: await supermercadoId(codigoSuper),
          nombreTienda: nombreProducto,
          presentacionCantidad: '1',
          presentacionUnidadId: lb!.id,
          factor: '1',
        })
        .returning();
      vinculos.set(clave, v!.id);
    }
    if (!hogarId && !corridaId) {
      const [c] = await bd.db.insert(corrida).values({ programadaPara: new Date() }).returning();
      corridaId = c!.id;
    }
    await bd.db.insert(precio).values({
      productoSupermercadoId: vinculos.get(clave)!,
      origen: hogarId ? 'MANUAL' : 'AUTOMATICO',
      hogarId: hogarId ?? null,
      corridaId: hogarId ? null : corridaId,
      precio: monto,
      precioNormalizado: monto,
      fechaPrecio: fecha,
    });
  };

  /** GET del resumen; `.expect(estado)` comprueba el estado y devuelve la respuesta. */
  const resumen = (token: string, nombreProducto: string) => ({
    expect: async (estado: number) => {
      const id = await productoId(nombreProducto);
      return http().get(`${API}/productos/${id}/resumen-precio`).set(con(token)).expect(estado);
    },
  });

  const filaResumen = async (hogarId: string, nombreProducto: string) => {
    const [fila] = await bd.db
      .select()
      .from(precioResumen)
      .where(
        and(
          eq(precioResumen.hogarId, hogarId),
          eq(precioResumen.productoId, await productoId(nombreProducto)),
        ),
      );
    return fila;
  };

  beforeEach(() => {
    vinculos.clear();
    corridaId = '';
  });
  beforeAll(async () => {
    app = await crearAppConBd(bd.base);
  });
  afterAll(async () => {
    await app?.close();
  });

  it('CA-36.1 con tres precios la mediana es Q13.00 y el mínimo Q12.50 en Walmart', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const hoy = fechaRelativa(-1);
    await sembrarPrecio('Arroz', 'WALMART', '12.50', hoy);
    await sembrarPrecio('Arroz', 'PAIZ', '13.00', hoy);
    await sembrarPrecio('Arroz', 'LA_TORRE', '14.25', hoy);

    const res = await resumen(token, 'Arroz').expect(200);

    expect(res.body).toMatchObject({
      precioMediana: '13.00',
      precioMinimo: '12.50',
      supermercadoMinimo: { nombre: 'Walmart' },
      fechaPrecioMinimo: hoy,
      cantidadPrecios: 3,
      desactualizado: false,
    });
    expect(await filaResumen(hogarId, 'Arroz')).toMatchObject({
      precioMediana: '13.00',
      precioMinimo: '12.50',
      cantidadPrecios: 3,
      desactualizado: false,
    });
  });

  it('CA-36.2 con cuatro precios la mediana es Q22.20 y el mínimo Q20.75 en Super Fresh', async () => {
    const { token } = await hogarDe('Rene');
    const hoy = fechaRelativa(-1);
    await sembrarPrecio('Arroz', 'SUPER_FRESH', '20.75', hoy);
    await sembrarPrecio('Arroz', 'WALMART', '21.50', hoy);
    await sembrarPrecio('Arroz', 'PAIZ', '22.90', hoy);
    await sembrarPrecio('Arroz', 'LA_TORRE', '23.40', hoy);

    const res = await resumen(token, 'Arroz').expect(200);

    expect(res.body).toMatchObject({
      precioMediana: '22.20',
      precioMinimo: '20.75',
      supermercadoMinimo: { nombre: 'Super Fresh' },
    });
  });

  it('CA-36.3 con dos precios la mediana redondea hacia arriba: Q25.73', async () => {
    const { token } = await hogarDe('Rene');
    await sembrarPrecio('Aceite', 'WALMART', '24.95', fechaRelativa(-1));
    await sembrarPrecio('Aceite', 'PAIZ', '26.50', fechaRelativa(-1));
    expect((await resumen(token, 'Aceite').expect(200)).body.precioMediana).toBe('25.73');
  });

  describe('CA-36.4 vigencia de 14 días', () => {
    it('excluye el precio de hace 21 días', async () => {
      const { token } = await hogarDe('Rene');
      await sembrarPrecio('Tomate', 'WALMART', '6.50', fechaRelativa(-1));
      await sembrarPrecio('Tomate', 'PAIZ', '5.90', fechaRelativa(-21));

      const res = await resumen(token, 'Tomate').expect(200);

      expect(res.body).toMatchObject({
        precioMinimo: '6.50',
        precioMediana: '6.50',
        supermercadoMinimo: { nombre: 'Walmart' },
        cantidadPrecios: 1,
        desactualizado: false,
      });
    });

    it('1a sin ningún precio vigente usa los últimos y lo marca desactualizado', async () => {
      const { token, hogarId } = await hogarDe('Rene');
      await sembrarPrecio('Aceite', 'WALMART', '24.95', fechaRelativa(-21));
      await sembrarPrecio('Aceite', 'PAIZ', '26.50', fechaRelativa(-30));

      const res = await resumen(token, 'Aceite').expect(200);

      expect(res.body).toMatchObject({
        precioMediana: '25.73',
        precioMinimo: '24.95',
        desactualizado: true,
        fechaPrecioMasAntiguo: fechaRelativa(-30),
      });
      expect((await filaResumen(hogarId, 'Aceite'))!.desactualizado).toBe(true);
    });
  });

  describe('CA-36.5 empate en el mínimo', () => {
    it('gana el supermercado preferido del hogar', async () => {
      const { token } = await hogarDe('Rene');
      await sembrarPrecio('Azúcar', 'WALMART', '32.00', fechaRelativa(-1));
      await sembrarPrecio('Azúcar', 'PAIZ', '32.00', fechaRelativa(-1));
      await http()
        .put(`${API}/hogar/preferencias/supermercados`)
        .set(con(token))
        .send({ preferidos: [await supermercadoId('PAIZ')] })
        .expect(200);

      const res = await resumen(token, 'Azúcar').expect(200);

      expect(res.body.precioMinimo).toBe('32.00');
      expect(res.body.supermercadoMinimo.nombre).toBe('Paiz');
    });

    it('sin preferencias gana el primero por orden alfabético', async () => {
      const { token } = await hogarDe('Rene');
      await sembrarPrecio('Azúcar', 'WALMART', '32.00', fechaRelativa(-1));
      await sembrarPrecio('Azúcar', 'PAIZ', '32.00', fechaRelativa(-1));
      expect((await resumen(token, 'Azúcar').expect(200)).body.supermercadoMinimo.nombre).toBe(
        'Paiz',
      );
    });
  });

  describe('supermercados preferidos (HU-09)', () => {
    it('CA-09.1 el mínimo sale de los preferidos y la mediana de todos', async () => {
      const { token } = await hogarDe('Rene');
      const hoy = fechaRelativa(-1);
      await sembrarPrecio('Arroz', 'WALMART', '12.50', hoy);
      await sembrarPrecio('Arroz', 'PAIZ', '13.00', hoy);
      await sembrarPrecio('Arroz', 'LA_TORRE', '11.75', hoy);
      await http()
        .put(`${API}/hogar/preferencias/supermercados`)
        .set(con(token))
        .send({ preferidos: [await supermercadoId('WALMART'), await supermercadoId('PAIZ')] })
        .expect(200);

      const res = await resumen(token, 'Arroz').expect(200);

      expect(res.body).toMatchObject({
        precioMinimo: '12.50',
        supermercadoMinimo: { nombre: 'Walmart' },
        precioMediana: '12.50',
        cantidadPrecios: 3,
      });
    });

    it('guardar los supermercados preferidos recalcula los resúmenes del hogar', async () => {
      const { token, hogarId } = await hogarDe('Rene');
      const hoy = fechaRelativa(-1);
      await sembrarPrecio('Arroz', 'WALMART', '12.50', hoy);
      await sembrarPrecio('Arroz', 'LA_TORRE', '11.75', hoy);
      await resumen(token, 'Arroz').expect(200);
      expect((await filaResumen(hogarId, 'Arroz'))!.precioMinimo).toBe('11.75');

      await http()
        .put(`${API}/hogar/preferencias/supermercados`)
        .set(con(token))
        .send({ preferidos: [await supermercadoId('WALMART')] })
        .expect(200);

      expect((await filaResumen(hogarId, 'Arroz'))!.precioMinimo).toBe('12.50');
    });
  });

  describe('CA-34.1 el mínimo tras registrar un precio', () => {
    it('Q20.75 en Super Fresh pasa a ser el mínimo del producto', async () => {
      const { token, hogarId } = await hogarDe('Rene');
      await sembrarPrecio('Arroz', 'PAIZ', '21.90', fechaRelativa(-1));
      await sembrarPrecio('Arroz', 'WALMART', '22.50', fechaRelativa(-1));
      const [lb] = await bd.db
        .select({ id: unidad.id })
        .from(unidad)
        .where(eq(unidad.codigo, 'lb'));

      await http()
        .post(`${API}/precios`)
        .set(con(token))
        .send({
          productoId: await productoId('Arroz'),
          supermercadoId: await supermercadoId('SUPER_FRESH'),
          presentacionCantidad: 1,
          presentacionUnidadId: lb!.id,
          precio: '20.75',
          fechaPrecio: fechaRelativa(-1),
        })
        .expect(201);

      const fila = await filaResumen(hogarId, 'Arroz');
      expect(fila).toMatchObject({ precioMinimo: '20.75', cantidadPrecios: 3 });
      const res = await resumen(token, 'Arroz').expect(200);
      expect(res.body.supermercadoMinimo.nombre).toBe('Super Fresh');
      expect(res.body.precioMediana).toBe('21.90');
    });
  });

  describe('precios de cada hogar', () => {
    it('un precio manual de otro hogar no entra en mi resumen, y los automáticos sí', async () => {
      const yo = await hogarDe('Rene');
      const otro = await hogarDe('Ana');
      const hoy = fechaRelativa(-1);
      await sembrarPrecio('Arroz', 'WALMART', '12.50', hoy);
      await sembrarPrecio('Arroz', 'SUPER_FRESH', '5.00', hoy, otro.hogarId);

      const mio = await resumen(yo.token, 'Arroz').expect(200);
      const suyo = await resumen(otro.token, 'Arroz').expect(200);

      expect(mio.body).toMatchObject({ precioMinimo: '12.50', cantidadPrecios: 1 });
      expect(suyo.body).toMatchObject({ precioMinimo: '5.00', cantidadPrecios: 2 });
    });

    it('cada hogar tiene su propio resumen guardado', async () => {
      const yo = await hogarDe('Rene');
      const otro = await hogarDe('Ana');
      await sembrarPrecio('Arroz', 'WALMART', '12.50', fechaRelativa(-1));
      await resumen(yo.token, 'Arroz').expect(200);
      expect(await filaResumen(yo.hogarId, 'Arroz')).toBeDefined();
      expect(await filaResumen(otro.hogarId, 'Arroz')).toBeUndefined();
    });
  });

  describe('sin precio y errores', () => {
    it('E1 un producto sin precios es 404 SIN_PRECIO y no crea resumen', async () => {
      const { token, hogarId } = await hogarDe('Rene');
      const res = await resumen(token, 'Arroz').expect(404);
      expect(res.body.codigo).toBe('SIN_PRECIO');
      expect(await filaResumen(hogarId, 'Arroz')).toBeUndefined();
    });

    it('un vínculo reemplazado ya no cuenta', async () => {
      const { token } = await hogarDe('Rene');
      await sembrarPrecio('Arroz', 'WALMART', '12.50', fechaRelativa(-1));
      await sembrarPrecio('Arroz', 'PAIZ', '13.00', fechaRelativa(-1));
      await bd.db
        .update(productoSupermercado)
        .set({ activo: false })
        .where(eq(productoSupermercado.id, vinculos.get('Arroz/PAIZ')!));

      const res = await resumen(token, 'Arroz').expect(200);

      expect(res.body).toMatchObject({ cantidadPrecios: 1, precioMediana: '12.50' });
    });

    it('un producto inexistente o un id mal formado es 404 y sin sesión es 401', async () => {
      const { token } = await hogarDe('Rene');
      await http()
        .get(`${API}/productos/00000000-0000-4000-8000-000000000000/resumen-precio`)
        .set(con(token))
        .expect(404);
      await http().get(`${API}/productos/no-es-uuid/resumen-precio`).set(con(token)).expect(404);
      await http()
        .get(`${API}/productos/${await productoId('Arroz')}/resumen-precio`)
        .expect(401);
    });
  });
});
