/**
 * HU-37 Histórico y variación de precios — integración contra PostgreSQL real (TEST_DATABASE_URL).
 * Cubre CA-37.1 a CA-37.4 sobre `GET /productos/{id}/precios`.
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

/** Fecha de calendario a `dias` de hoy (negativo = pasado). */
const fechaRelativa = (dias: number): string =>
  new Date(Date.now() + dias * 86_400_000).toISOString().slice(0, 10);

type Serie = { supermercado: { nombre: string } };

describeConBd('HU-37 Histórico y variación de precios (integración)', () => {
  const bd = usarBaseDePruebas({
    suite: 'historico-precios',
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

  let corridaId = '';
  const vinculos = new Map<string, string>();

  /** Sin hogar el precio es automático (común); con hogar es un precio manual de ese hogar. */
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

  /** GET del histórico; `.expect(estado)` comprueba el estado y devuelve la respuesta. */
  const historico = (token: string, nombreProducto: string, consulta = '') => ({
    expect: async (estado: number) => {
      const id = await productoId(nombreProducto);
      return http().get(`${API}/productos/${id}/precios${consulta}`).set(con(token)).expect(estado);
    },
  });

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

  it('CA-37.1 Pollo sube en Walmart: +4.8 % vs. anterior y +10.0 % en el periodo', async () => {
    const { token } = await hogarDe('Rene');
    await sembrarPrecio('Pechuga de pollo', 'WALMART', '20.00', fechaRelativa(-14));
    await sembrarPrecio('Pechuga de pollo', 'WALMART', '21.00', fechaRelativa(-7));
    await sembrarPrecio('Pechuga de pollo', 'WALMART', '22.00', fechaRelativa(0));

    const res = await historico(token, 'Pechuga de pollo').expect(200);

    expect(res.body.semanas).toBe(12);
    expect(res.body.series).toHaveLength(1);
    const [walmart] = res.body.series;
    expect(walmart.supermercado.nombre).toBe('Walmart');
    expect(walmart.puntos.map((p: { precioNormalizado: string }) => p.precioNormalizado)).toEqual([
      '20.00',
      '21.00',
      '22.00',
    ]);
    expect(walmart.puntos[0].origen).toBe('AUTOMATICO');
    expect(walmart.variacionAnterior).toMatchObject({ texto: '+4.8 %', tendencia: 'SUBE' });
    expect(walmart.variacionPeriodo).toMatchObject({ texto: '+10.0 %', tendencia: 'SUBE' });
  });

  it('CA-37.2 Tomate baja en Paiz: −10.0 % con indicador de baja', async () => {
    const { token } = await hogarDe('Rene');
    await sembrarPrecio('Tomate', 'PAIZ', '7.00', fechaRelativa(-7));
    await sembrarPrecio('Tomate', 'PAIZ', '6.30', fechaRelativa(0));

    const res = await historico(token, 'Tomate').expect(200);

    expect(res.body.series[0].variacionAnterior).toMatchObject({
      texto: '−10.0 %',
      tendencia: 'BAJA',
    });
  });

  it('CA-37.3 un supermercado con un solo precio muestra "—" y los demás sus series', async () => {
    const { token } = await hogarDe('Rene');
    await sembrarPrecio('Arroz', 'SUPER_FRESH', '12.90', fechaRelativa(0));
    await sembrarPrecio('Arroz', 'PAIZ', '13.00', fechaRelativa(-7));
    await sembrarPrecio('Arroz', 'PAIZ', '13.50', fechaRelativa(0));

    const res = await historico(token, 'Arroz').expect(200);

    const series = res.body.series as (Serie & {
      variacionAnterior: { texto: string; porcentaje: number | null };
      variacionPeriodo: { texto: string };
    })[];
    expect(series.map((s) => s.supermercado.nombre)).toEqual(['Paiz', 'Super Fresh']);
    expect(series[1]!.variacionAnterior).toMatchObject({ texto: '—', porcentaje: null });
    expect(series[1]!.variacionPeriodo.texto).toBe('—');
    expect(series[0]!.variacionAnterior.texto).toBe('+3.8 %');
  });

  it('CA-37.4 el precio manual de otro hogar no se muestra, el propio sí con su origen', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const otro = await hogarDe('Ana');
    await sembrarPrecio('Arroz', 'SUPER_FRESH', '11.00', fechaRelativa(-1), otro.hogarId);
    await sembrarPrecio('Arroz', 'SUPER_FRESH', '12.90', fechaRelativa(-2), hogarId);

    const res = await historico(token, 'Arroz').expect(200);

    expect(res.body.series[0].puntos).toEqual([
      { fecha: fechaRelativa(-2), precioNormalizado: '12.90', origen: 'MANUAL' },
    ]);
    expect(JSON.stringify(res.body)).not.toContain('11.00');
  });

  it('2a con semanas=4 deja fuera los precios de hace más de 4 semanas', async () => {
    const { token } = await hogarDe('Rene');
    await sembrarPrecio('Aceite', 'WALMART', '10.00', fechaRelativa(-50));
    await sembrarPrecio('Aceite', 'WALMART', '20.00', fechaRelativa(-14));
    await sembrarPrecio('Aceite', 'WALMART', '22.00', fechaRelativa(0));

    const en12 = await historico(token, 'Aceite', '?semanas=12').expect(200);
    const en4 = await historico(token, 'Aceite', '?semanas=4').expect(200);

    expect(en12.body.series[0].variacionPeriodo.texto).toBe('+120.0 %');
    expect(en4.body.semanas).toBe(4);
    expect(en4.body.series[0].puntos).toHaveLength(2);
    expect(en4.body.series[0].variacionPeriodo.texto).toBe('+10.0 %');
  });

  it('un precio de un vínculo reemplazado ya no cuenta', async () => {
    const { token } = await hogarDe('Rene');
    await sembrarPrecio('Sal', 'WALMART', '5.00', fechaRelativa(-3));
    await bd.db.update(productoSupermercado).set({ activo: false });
    const res = await historico(token, 'Sal').expect(200);
    expect(res.body.series).toEqual([]);
  });

  it('E1 un producto sin precios devuelve la serie vacía', async () => {
    const { token } = await hogarDe('Rene');
    const res = await historico(token, 'Sal').expect(200);
    expect(res.body).toMatchObject({ semanas: 12, series: [] });
  });

  it('un periodo inválido es 400 y un producto inexistente o mal formado es 404', async () => {
    const { token } = await hogarDe('Rene');
    const res = await historico(token, 'Sal', '?semanas=8').expect(400);
    expect(res.body.codigo).toBe('PERIODO_INVALIDO');
    await http()
      .get(`${API}/productos/00000000-0000-4000-8000-000000000000/precios`)
      .set(con(token))
      .expect(404);
    await http().get(`${API}/productos/no-es-uuid/precios`).set(con(token)).expect(404);
  });

  it('sin sesión es 401', async () => {
    await http().get(`${API}/productos/00000000-0000-4000-8000-000000000000/precios`).expect(401);
  });
});
