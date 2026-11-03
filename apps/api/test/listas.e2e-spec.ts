/**
 * HU-28 Consolidar ingredientes del menú aprobado — integración contra PostgreSQL real
 * (TEST_DATABASE_URL). Cubre CA-28.1 a CA-28.6: suma por producto con la Σ de factores congelada
 * del menú, conversión de gramos a la unidad de compra, ingredientes sin conversión, menú en
 * Borrador, y el exceso aprobado en el encabezado de la lista.
 *
 * Semana del domingo 2026-11-01: lunes 11-02 y miércoles 11-04.
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  and,
  eq,
  listaItem,
  listaItemOrigen,
  menuDetalle,
  menuSemanal,
  menuTiempo,
  platillo,
  platilloIngrediente,
  platilloTiempo,
  producto,
  unidad,
} from '@menu/db';
import { normalizarNombreCatalogo, type TiempoComida } from '@menu/shared';
import { crearAppConBd, describeConBd, usarBaseDePruebas } from './utils/base-datos';

const API = '/api/v1';
const SEMANA = '2026-11-01';
const LUNES = '2026-11-02';
const MIERCOLES = '2026-11-04';

describeConBd('HU-28 Consolidar la lista de compras (integración)', () => {
  const bd = usarBaseDePruebas({
    suite: 'listas',
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
    tabla: typeof producto | typeof unidad,
    columna: 'nombre' | 'codigo',
    valor: string,
  ) => {
    const [fila] = await bd.db
      .select({ id: tabla.id })
      .from(tabla)
      .where(eq((tabla as never)[columna], valor));
    return fila!.id;
  };

  type Ingrediente = [producto: string, cantidad: number, unidad: string];

  const crearPlatillo = async (hogarId: string, nombre: string, ingredientes: Ingrediente[]) => {
    const [p] = await bd.db
      .insert(platillo)
      .values({
        hogarId,
        nombre,
        nombreNormalizado: normalizarNombreCatalogo(nombre),
        proteinaPrincipal: 'POLLO',
        porcionesBase: 4,
      })
      .returning();
    await bd.db.insert(platilloTiempo).values({ platilloId: p!.id, tiempo: 'ALMUERZO' });
    for (const [nombreProducto, cantidad, codigoUnidad] of ingredientes) {
      await bd.db.insert(platilloIngrediente).values({
        platilloId: p!.id,
        productoId: await idDe(producto, 'nombre', nombreProducto),
        cantidad: String(cantidad),
        unidadId: await idDe(unidad, 'codigo', codigoUnidad),
      });
    }
    return p!.id;
  };

  /** Borrador con `[fecha, platilloId]` de almuerzo y la Σ de factores con que se generó (D-04). */
  const crearBorrador = async (
    hogarId: string,
    espacios: [string, string][],
    opciones: { suma?: string; exceso?: string } = {},
  ) => {
    const [menu] = await bd.db
      .insert(menuSemanal)
      .values({
        hogarId,
        fechaInicio: SEMANA,
        fechaFin: '2026-11-07',
        estado: 'BORRADOR',
        presupuestoSemanal: '245.00',
        sumaFactoresPorcion: opciones.suma ?? '6.00',
      })
      .returning();
    await bd.db.insert(menuTiempo).values({
      menuId: menu!.id,
      tiempo: 'ALMUERZO' as TiempoComida,
      porcentaje: '100.00',
      presupuesto: '245.00',
      exceso: opciones.exceso ?? '0.00',
    });
    const filas = await bd.db
      .insert(menuDetalle)
      .values(
        espacios.map(([fecha, platilloId]) => ({
          menuId: menu!.id,
          fecha,
          tiempo: 'ALMUERZO' as TiempoComida,
          platilloId,
        })),
      )
      .returning();
    return {
      menuId: menu!.id,
      version: menu!.version,
      detalle: (fecha: string) => filas.find((f) => f.fecha === fecha)!.id,
    };
  };

  const aprobar = (token: string, menuId: string, version: number) =>
    http().post(`${API}/menus/${menuId}/aprobar`).set(con(token)).send({ version });

  /** Pollo en crema (lunes) y Pepián de pollo (miércoles) con Σ 6, como en CA-28.1 y CA-28.2. */
  const menuDeLaSemana = async (hogarId: string, exceso?: string) => {
    const crema = await crearPlatillo(hogarId, 'Pollo en crema', [
      ['Pechuga de pollo', 2, 'lb'],
      ['Tomate', 500, 'g'],
      ['Mantequilla', 1, 'cdta'],
    ]);
    const pepian = await crearPlatillo(hogarId, 'Pepián de pollo', [
      ['Pechuga de pollo', 2.5, 'lb'],
      ['Tomate', 300, 'g'],
    ]);
    return crearBorrador(
      hogarId,
      [
        [LUNES, crema],
        [MIERCOLES, pepian],
      ],
      { exceso },
    );
  };

  beforeAll(async () => {
    app = await crearAppConBd(bd.base);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('CA-28.1 y CA-28.2 al aprobar suma por producto, convierte gramos a libras y redondea hacia arriba', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const m = await menuDeLaSemana(hogarId);

    const res = await aprobar(token, m.menuId, m.version).expect(200);

    expect(res.body.lista).toMatchObject({ totalItems: 3, itemsMenu: 3, sinConversion: 1 });
    const lista = await http().get(res.body.lista.url).set(con(token)).expect(200);
    expect(lista.body).toMatchObject({
      id: res.body.lista.id,
      menuId: m.menuId,
      semana: { desde: SEMANA, hasta: '2026-11-07' },
      total: 3,
      comprados: 0,
      sinConversion: 1,
      excede: null,
    });
    const porNombre = new Map(
      (lista.body.items as { producto: { nombre: string } }[]).map((i) => [i.producto.nombre, i]),
    );
    // CA-28.1: 2 lb y 2.5 lb de pollo para 4 porciones con Σ 6 → 6.75 lb requeridas, 7 a comprar.
    expect(porNombre.get('Pechuga de pollo')).toMatchObject({
      cantidadRequerida: { cantidad: '6.75', unidad: 'lb' },
      equivalente: null,
      cantidadComprar: '7',
      presentacion: { texto: 'lb 1 lb' },
      origen: 'MENU',
      estado: 'PENDIENTE',
      sinConversion: false,
    });
    // CA-28.2: 500 g + 300 g de tomate, Σ 6 → 1200 g requeridos, 2.65 lb, 3 a comprar.
    expect(porNombre.get('Tomate')).toMatchObject({
      cantidadRequerida: { cantidad: '1200', unidad: 'g' },
      equivalente: { cantidad: '2.65', unidad: 'lb' },
      cantidadComprar: '3',
    });
  });

  it('CA-28.3 una unidad sin equivalencia queda "Sin conversión" y los demás productos salen normal', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const m = await menuDeLaSemana(hogarId);
    const res = await aprobar(token, m.menuId, m.version).expect(200);

    const lista = await http().get(res.body.lista.url).set(con(token)).expect(200);

    const items = lista.body.items as { producto: { nombre: string }; sinConversion: boolean }[];
    expect(items.filter((i) => i.sinConversion).map((i) => i.producto.nombre)).toEqual([
      'Mantequilla',
    ]);
    const mantequilla = items.find((i) => i.producto.nombre === 'Mantequilla')!;
    expect(mantequilla).toMatchObject({
      cantidadRequerida: { cantidad: '1.5', unidad: 'cdta' },
      equivalente: null,
      cantidadComprar: '1',
    });
    expect(items).toHaveLength(3);
  });

  it('guarda los ítems con origen Menú y las comidas que los originan (CU-07.1 paso 8)', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const m = await menuDeLaSemana(hogarId);
    const res = await aprobar(token, m.menuId, m.version).expect(200);

    const items = await bd.db
      .select()
      .from(listaItem)
      .where(eq(listaItem.listaId, res.body.lista.id));
    expect(items).toHaveLength(3);
    expect(new Set(items.map((i) => i.origen))).toEqual(new Set(['MENU']));
    const pechuga = items.find((i) => i.cantidadRequerida === '6.750')!;
    const origenes = await bd.db
      .select()
      .from(listaItemOrigen)
      .where(and(eq(listaItemOrigen.listaItemId, pechuga.id)));
    expect(origenes.map((o) => [o.menuDetalleId, o.cantidadRequerida]).sort()).toEqual(
      [
        [m.detalle(LUNES), '3.000'],
        [m.detalle(MIERCOLES), '3.750'],
      ].sort(),
    );
    const lista = await http().get(res.body.lista.url).set(con(token)).expect(200);
    const pechugaVista = (lista.body.items as { id: string; comidas: string[] }[]).find(
      (i) => i.id === pechuga.id,
    )!;
    expect([...pechugaVista.comidas].sort()).toEqual(
      [m.detalle(LUNES), m.detalle(MIERCOLES)].sort(),
    );
  });

  it('CA-28.5 con Σ 2.5 escala 2 lb para 4 porciones a 1.25 lb y compra 2', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const crema = await crearPlatillo(hogarId, 'Pollo en crema', [['Pechuga de pollo', 2, 'lb']]);
    const m = await crearBorrador(hogarId, [[LUNES, crema]], { suma: '2.50' });
    const res = await aprobar(token, m.menuId, m.version).expect(200);

    const lista = await http().get(res.body.lista.url).set(con(token)).expect(200);

    expect(lista.body.items).toHaveLength(1);
    expect(lista.body.items[0]).toMatchObject({
      cantidadRequerida: { cantidad: '1.25', unidad: 'lb' },
      cantidadComprar: '2',
    });
  });

  it('CA-28.4 un menú en Borrador no tiene lista y no se crea ninguna', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const m = await menuDeLaSemana(hogarId);

    const res = await http().get(`${API}/menus/${m.menuId}/lista`).set(con(token)).expect(409);

    expect(res.body).toMatchObject({
      codigo: 'MENU_NO_APROBADO',
      detail: 'Aprueba el menú para generar la lista',
    });
    const items = await bd.db.select().from(listaItem);
    expect(items).toEqual([]);
  });

  it('un menú aprobado redirige (303) a su lista', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const m = await menuDeLaSemana(hogarId);
    const aprobado = await aprobar(token, m.menuId, m.version).expect(200);

    const res = await http().get(`${API}/menus/${m.menuId}/lista`).set(con(token)).expect(303);

    expect(res.headers.location).toBe(`/api/v1/listas/${aprobado.body.lista.id}`);
  });

  it('CA-28.6 el encabezado de la lista muestra el exceso con que se aprobó', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const m = await menuDeLaSemana(hogarId, '17.00');
    const res = await aprobar(token, m.menuId, m.version).expect(200);

    const lista = await http().get(res.body.lista.url).set(con(token)).expect(200);

    expect(lista.body.excede).toEqual({ monto: '17.00', texto: 'Excede por Q17.00' });
    expect(lista.body.items).toHaveLength(3);
  });

  it('una lista de otro hogar o un id mal formado es 404', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const m = await menuDeLaSemana(hogarId);
    const aprobado = await aprobar(token, m.menuId, m.version).expect(200);
    const otro = await hogarDe('Ana');

    await http().get(aprobado.body.lista.url).set(con(otro.token)).expect(404);
    await http().get(`${API}/listas/no-es-uuid`).set(con(token)).expect(404);
  });
});
