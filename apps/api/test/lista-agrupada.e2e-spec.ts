/**
 * HU-31 Agrupar lista por supermercado y categoría — integración contra PostgreSQL real
 * (TEST_DATABASE_URL). Cubre CA-31.1 a CA-31.4 sobre `GET /listas/{id}`: cada ítem trae su
 * categoría y la compra sugerida (supermercado del mínimo, precio, fecha y vigencia); la
 * agrupación en sí la hace la app con `agruparPorSupermercado` de @menu/shared.
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  eq,
  listaCompras,
  listaItem,
  menuSemanal,
  precio,
  precioResumen,
  producto,
  productoSupermercado,
  supermercado,
  unidad,
} from '@menu/db';
import { agruparPorSupermercado } from '@menu/shared';
import { crearAppConBd, describeConBd, usarBaseDePruebas } from './utils/base-datos';

const API = '/api/v1';

/** Fecha de calendario a `dias` de hoy (negativo = pasado). */
const fechaRelativa = (dias: number): string =>
  new Date(Date.now() + dias * 86_400_000).toISOString().slice(0, 10);

describeConBd('HU-31 Agrupar la lista por supermercado (integración)', () => {
  const bd = usarBaseDePruebas({
    suite: 'lista-agrupada',
    sembrar: true,
    truncarEntrePruebas: true,
  });
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const con = (token: string) => ({ Authorization: `Bearer ${token}` });
  let n = 0;
  const vinculos = new Map<string, string>();

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

  /** Precio manual del hogar, normalizado a la presentación del catálogo. */
  const sembrarPrecio = async (
    hogarId: string,
    nombreProducto: string,
    codigoSuper: string,
    monto: string,
    fecha: string,
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
    await bd.db.insert(precio).values({
      productoSupermercadoId: vinculos.get(clave)!,
      origen: 'MANUAL',
      hogarId,
      precio: monto,
      precioNormalizado: monto,
      fechaPrecio: fecha,
    });
  };

  /** Lista con los ítems `[producto | texto libre, cantidadComprar]` de un menú aprobado. */
  const crearLista = async (
    hogarId: string,
    items: ({ producto: string } | { texto: string })[],
    cantidades: string[],
  ) => {
    const [menu] = await bd.db
      .insert(menuSemanal)
      .values({
        hogarId,
        fechaInicio: '2026-11-01',
        fechaFin: '2026-11-07',
        estado: 'APROBADO',
        aprobadoEn: new Date(),
        presupuestoSemanal: '245.00',
        sumaFactoresPorcion: '6.00',
      })
      .returning();
    const [lista] = await bd.db
      .insert(listaCompras)
      .values({ hogarId, menuId: menu!.id })
      .returning();
    for (const [i, item] of items.entries()) {
      await bd.db.insert(listaItem).values({
        id: crypto.randomUUID(),
        listaId: lista!.id,
        productoId: 'producto' in item ? await productoId(item.producto) : null,
        textoLibre: 'texto' in item ? item.texto : null,
        origen: 'producto' in item ? 'MENU' : 'MANUAL',
        cantidadComprar: cantidades[i]!,
        modificadoEnDispositivo: new Date(),
      });
    }
    return lista!.id;
  };

  const verLista = (token: string, listaId: string) =>
    http().get(`${API}/listas/${listaId}`).set(con(token)).expect(200);

  beforeEach(() => vinculos.clear());
  beforeAll(async () => {
    app = await crearAppConBd(bd.base);
  });
  afterAll(async () => {
    await app?.close();
  });

  it('CA-31.1 cada producto va al supermercado más barato con subtotales y total', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const hoy = fechaRelativa(-1);
    await sembrarPrecio(hogarId, 'Arroz', 'WALMART', '12.50', hoy);
    await sembrarPrecio(hogarId, 'Arroz', 'PAIZ', '13.00', hoy);
    await sembrarPrecio(hogarId, 'Pechuga de pollo', 'WALMART', '22.50', hoy);
    await sembrarPrecio(hogarId, 'Pechuga de pollo', 'PAIZ', '21.90', hoy);
    await sembrarPrecio(hogarId, 'Tomate', 'WALMART', '6.50', hoy);
    await sembrarPrecio(hogarId, 'Tomate', 'PAIZ', '6.25', hoy);
    const listaId = await crearLista(
      hogarId,
      [{ producto: 'Arroz' }, { producto: 'Pechuga de pollo' }, { producto: 'Tomate' }],
      ['2', '7', '2'],
    );

    const res = await verLista(token, listaId);
    const agrupada = agruparPorSupermercado(res.body.items);

    const [paiz, walmart] = agrupada.grupos;
    expect(walmart!.supermercado!.nombre).toBe('Walmart');
    expect(walmart!.categorias[0]!.items[0]).toMatchObject({ costo: '25.00' });
    expect(walmart!.subtotal).toBe('25.00');
    expect(paiz!.supermercado!.nombre).toBe('Paiz');
    expect(
      paiz!.categorias.map((c) => [
        c.categoria,
        c.items[0]!.item.producto.nombre,
        c.items[0]!.costo,
      ]),
    ).toEqual([
      ['Carnes', 'Pechuga de pollo', '153.30'],
      ['Verduras', 'Tomate', '12.50'],
    ]);
    expect(paiz!.subtotal).toBe('165.80');
    expect(agrupada.total).toBe('190.80');
  });

  it('CA-31.2 un único precio de hace 21 días aparece con la advertencia de su fecha', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const vieja = fechaRelativa(-21);
    await sembrarPrecio(hogarId, 'Aceite', 'WALMART', '24.95', vieja);
    const listaId = await crearLista(hogarId, [{ producto: 'Aceite' }], ['1']);

    const res = await verLista(token, listaId);
    const [grupo] = agruparPorSupermercado(res.body.items).grupos;

    expect(res.body.items[0].compra).toMatchObject({
      supermercado: { nombre: 'Walmart' },
      precio: '24.95',
      fecha: vieja,
      desactualizado: true,
    });
    expect(grupo!.supermercado!.nombre).toBe('Walmart');
    const dia = `${vieja.slice(8, 10)}/${vieja.slice(5, 7)}/${vieja.slice(0, 4)}`;
    expect(grupo!.categorias[0]!.items[0]!.advertencia).toBe(`Precio del ${dia}`);
  });

  it('un precio que envejece después de calcular el resumen se marca al abrir la lista', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    await sembrarPrecio(hogarId, 'Aceite', 'WALMART', '24.95', fechaRelativa(-1));
    const listaId = await crearLista(hogarId, [{ producto: 'Aceite' }], ['1']);
    expect((await verLista(token, listaId)).body.items[0].compra.desactualizado).toBe(false);

    // Pasan los días: el único precio queda con 21 días y el resumen guardado ya no es vigente.
    await bd.db.update(precio).set({ fechaPrecio: fechaRelativa(-21) });
    const [antes] = await bd.db.select().from(precioResumen);
    expect(antes!.desactualizado).toBe(false);

    const res = await verLista(token, listaId);
    expect(res.body.items[0].compra).toMatchObject({ desactualizado: true });
  });

  it('CA-31.3 con el mismo precio gana el supermercado preferido del hogar', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const hoy = fechaRelativa(-1);
    await sembrarPrecio(hogarId, 'Azúcar', 'WALMART', '32.00', hoy);
    await sembrarPrecio(hogarId, 'Azúcar', 'PAIZ', '32.00', hoy);
    await http()
      .put(`${API}/hogar/preferencias/supermercados`)
      .set(con(token))
      .send({ preferidos: [await supermercadoId('PAIZ')] })
      .expect(200);
    const listaId = await crearLista(hogarId, [{ producto: 'Azúcar' }], ['1']);

    const res = await verLista(token, listaId);
    const [grupo] = agruparPorSupermercado(res.body.items).grupos;

    expect(grupo!.supermercado!.nombre).toBe('Paiz');
    expect(grupo!.categorias[0]!.categoria).toBe('Abarrotes');
  });

  it('CA-31.4 un producto de texto libre o sin precio va a "Sin precio" y no suma', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    await sembrarPrecio(hogarId, 'Arroz', 'WALMART', '12.50', fechaRelativa(-1));
    const listaId = await crearLista(
      hogarId,
      [{ texto: 'Tortillas' }, { producto: 'Sal' }, { producto: 'Arroz' }],
      ['1', '1', '1'],
    );

    const res = await verLista(token, listaId);
    const tortillas = res.body.items.find(
      (i: { producto: { nombre: string } }) => i.producto.nombre === 'Tortillas',
    );
    expect(tortillas).toMatchObject({ categoria: null, compra: null });

    const agrupada = agruparPorSupermercado(res.body.items);
    const sin = agrupada.grupos.at(-1)!;
    expect(sin.supermercado).toBeNull();
    expect(sin.subtotal).toBeNull();
    expect(
      sin.categorias.flatMap((c) => c.items.map((a) => a.item.producto.nombre)).sort(),
    ).toEqual(['Sal', 'Tortillas']);
    expect(agrupada.total).toBe('12.50');
  });

  it('el precio manual de otro hogar no entra en la compra sugerida (D-05)', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const otro = await hogarDe('Ana');
    await sembrarPrecio(otro.hogarId, 'Arroz', 'PAIZ', '1.00', fechaRelativa(-1));
    const listaId = await crearLista(hogarId, [{ producto: 'Arroz' }], ['1']);

    const res = await verLista(token, listaId);

    expect(res.body.items[0].compra).toBeNull();
  });

  it('una lista de otro hogar es 404', async () => {
    const { hogarId } = await hogarDe('Rene');
    const otro = await hogarDe('Ana');
    const listaId = await crearLista(hogarId, [{ producto: 'Arroz' }], ['1']);
    await http().get(`${API}/listas/${listaId}`).set(con(otro.token)).expect(404);
  });
});
