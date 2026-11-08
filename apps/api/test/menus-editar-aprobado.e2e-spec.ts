/**
 * Editar un menú ya aprobado — integración contra PostgreSQL real (TEST_DATABASE_URL).
 * Cambiar un platillo de un menú aprobado ajusta también su lista de compras: actualiza las
 * cantidades, agrega lo nuevo, quita lo pendiente que ya no hace falta y respeta lo comprado,
 * lo quitado a mano, lo agregado a mano y la despensa.
 *
 * Semana del domingo 2026-11-01: lunes 11-02 y miércoles 11-04, con Σ de factores 6.00.
 * Lunes: Pollo en crema (2 lb de pechuga, 500 g de tomate, 1 cdta de mantequilla).
 * Miércoles: Pepián (2.5 lb de pechuga, 300 g de tomate).
 * Al aprobar: pechuga 7, tomate 3 y mantequilla 1.
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  and,
  despensaItem,
  eq,
  listaCompras,
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

describeConBd('Editar un menú aprobado (integración)', () => {
  const bd = usarBaseDePruebas({
    suite: 'menus-editar-aprobado',
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

  const crearPlatillo = async (
    hogarId: string,
    nombre: string,
    ingredientes: Ingrediente[],
    proteina: 'POLLO' | 'PESCADO' = 'POLLO',
  ) => {
    const [p] = await bd.db
      .insert(platillo)
      .values({
        hogarId,
        nombre,
        nombreNormalizado: normalizarNombreCatalogo(nombre),
        proteinaPrincipal: proteina,
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

  /** Menú Borrador con crema el lunes y pepián el miércoles, aprobado por la API. */
  const menuAprobado = async (hogarId: string, token: string) => {
    const crema = await crearPlatillo(hogarId, 'Pollo en crema', [
      ['Pechuga de pollo', 2, 'lb'],
      ['Tomate', 500, 'g'],
      ['Mantequilla', 1, 'cdta'],
    ]);
    const pepian = await crearPlatillo(hogarId, 'Pepián de pollo', [
      ['Pechuga de pollo', 2.5, 'lb'],
      ['Tomate', 300, 'g'],
    ]);
    const pescado = await crearPlatillo(
      hogarId,
      'Pescado frito',
      [['Filete de pescado', 1, 'lb']],
      'PESCADO',
    );
    const [menu] = await bd.db
      .insert(menuSemanal)
      .values({
        hogarId,
        fechaInicio: SEMANA,
        fechaFin: '2026-11-07',
        estado: 'BORRADOR',
        presupuestoSemanal: '245.00',
        sumaFactoresPorcion: '6.00',
      })
      .returning();
    await bd.db.insert(menuTiempo).values({
      menuId: menu!.id,
      tiempo: 'ALMUERZO' as TiempoComida,
      porcentaje: '100.00',
      presupuesto: '245.00',
    });
    const filas = await bd.db
      .insert(menuDetalle)
      .values(
        (
          [
            [LUNES, crema],
            [MIERCOLES, pepian],
          ] as const
        ).map(([fecha, platilloId]) => ({
          menuId: menu!.id,
          fecha,
          tiempo: 'ALMUERZO' as TiempoComida,
          platilloId,
        })),
      )
      .returning();
    const res = await http()
      .post(`${API}/menus/${menu!.id}/aprobar`)
      .set(con(token))
      .send({ version: menu!.version })
      .expect(200);
    return {
      menuId: menu!.id,
      listaId: res.body.lista.id as string,
      crema,
      pepian,
      pescado,
      detalle: (fecha: string) => filas.find((f) => f.fecha === fecha)!.id,
    };
  };

  const cambiar = (token: string, menuId: string, detalleId: string, platilloId: string) =>
    http()
      .patch(`${API}/menus/${menuId}/detalles/${detalleId}`)
      .set(con(token))
      .send({ platilloId, confirmar: true });

  type VistaItem = {
    id: string;
    producto: { nombre: string };
    estado: string;
    cantidadComprar: string;
    origen: string;
    comidas: string[];
  };

  const items = async (token: string, listaId: string): Promise<Map<string, VistaItem>> => {
    const res = await http().get(`${API}/listas/${listaId}`).set(con(token)).expect(200);
    return new Map((res.body.items as VistaItem[]).map((i) => [i.producto.nombre, i]));
  };

  const filaDe = async (listaId: string, nombre: string) => {
    const productoId = await idDe(producto, 'nombre', nombre);
    const [fila] = await bd.db
      .select()
      .from(listaItem)
      .where(and(eq(listaItem.listaId, listaId), eq(listaItem.productoId, productoId)));
    return fila;
  };

  const marcarComprado = async (listaId: string, nombre: string, precioReal?: string) => {
    const fila = await filaDe(listaId, nombre);
    await bd.db
      .update(listaItem)
      .set({ estado: 'COMPRADO', compradoEn: new Date(), ...(precioReal ? { precioReal } : {}) })
      .where(eq(listaItem.id, fila!.id));
  };

  const versionDeLista = async (listaId: string) => {
    const [l] = await bd.db.select().from(listaCompras).where(eq(listaCompras.id, listaId));
    return l!.version;
  };

  beforeAll(async () => {
    app = await crearAppConBd(bd.base);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('cambiar un platillo ajusta las cantidades, agrega lo nuevo y sube la versión de la lista', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const m = await menuAprobado(hogarId, token);
    const antes = await items(token, m.listaId);
    expect(antes.get('Pechuga de pollo')!.cantidadComprar).toBe('7');
    expect(antes.get('Tomate')!.cantidadComprar).toBe('3');
    expect(await versionDeLista(m.listaId)).toBe(1);

    // El miércoles pasa de Pepián a Pescado frito.
    await cambiar(token, m.menuId, m.detalle(MIERCOLES), m.pescado).expect(200);

    const despues = await items(token, m.listaId);
    // Solo queda la crema: 2 lb × 6 / 4 = 3 lb de pechuga y 750 g (1.65 lb) de tomate.
    expect(despues.get('Pechuga de pollo')!.cantidadComprar).toBe('3');
    expect(despues.get('Tomate')!.cantidadComprar).toBe('2');
    expect(despues.get('Mantequilla')!.cantidadComprar).toBe('1');
    // El pescado es nuevo: 1 lb × 6 / 4 = 1.5 lb → 2.
    expect(despues.get('Filete de pescado')).toMatchObject({
      cantidadComprar: '2',
      estado: 'PENDIENTE',
      origen: 'MENU',
    });
    expect(await versionDeLista(m.listaId)).toBe(2);
  });

  it('lo pendiente que ya no hace falta se quita de la lista', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const m = await menuAprobado(hogarId, token);

    // Solo la crema lleva mantequilla: al cambiar el lunes deja de hacer falta.
    await cambiar(token, m.menuId, m.detalle(LUNES), m.pescado).expect(200);

    const despues = await items(token, m.listaId);
    expect(despues.has('Mantequilla')).toBe(false);
    expect((await filaDe(m.listaId, 'Mantequilla'))!.eliminado).toBe(true);
    expect(despues.has('Filete de pescado')).toBe(true);
  });

  it('lo que ya se compró se conserva aunque deje de hacer falta', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const m = await menuAprobado(hogarId, token);
    await marcarComprado(m.listaId, 'Mantequilla');

    await cambiar(token, m.menuId, m.detalle(LUNES), m.pescado).expect(200);

    const despues = await items(token, m.listaId);
    expect(despues.get('Mantequilla')).toMatchObject({ estado: 'COMPRADO' });
  });

  it('si ahora hace falta más de lo ya comprado, vuelve a pendiente', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const m = await menuAprobado(hogarId, token);
    await marcarComprado(m.listaId, 'Pechuga de pollo', '70.00');

    // Dos pepianes: (2.5 + 2.5) lb × 6 / 4 = 7.5 lb → 8, más que las 7 compradas.
    await cambiar(token, m.menuId, m.detalle(LUNES), m.pepian).expect(200);

    const despues = await items(token, m.listaId);
    expect(despues.get('Pechuga de pollo')).toMatchObject({
      estado: 'PENDIENTE',
      cantidadComprar: '8',
    });
    const fila = await filaDe(m.listaId, 'Pechuga de pollo');
    expect(fila).toMatchObject({ precioReal: null, compradoEn: null });
  });

  it('si hace falta menos de lo comprado, sigue comprado', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const m = await menuAprobado(hogarId, token);
    await marcarComprado(m.listaId, 'Pechuga de pollo', '70.00');

    await cambiar(token, m.menuId, m.detalle(MIERCOLES), m.pescado).expect(200);

    const despues = await items(token, m.listaId);
    expect(despues.get('Pechuga de pollo')).toMatchObject({
      estado: 'COMPRADO',
      cantidadComprar: '3',
    });
  });

  it('lo agregado a mano no se toca, ni siquiera si el menú ahora pide ese mismo producto', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const m = await menuAprobado(hogarId, token);
    const ahora = new Date();
    await bd.db.insert(listaItem).values([
      {
        id: crypto.randomUUID(),
        listaId: m.listaId,
        textoLibre: 'Servilletas',
        origen: 'MANUAL',
        cantidadComprar: '1',
        modificadoEnDispositivo: ahora,
      },
      {
        id: crypto.randomUUID(),
        listaId: m.listaId,
        productoId: await idDe(producto, 'nombre', 'Filete de pescado'),
        origen: 'MANUAL',
        cantidadComprar: '5',
        modificadoEnDispositivo: ahora,
      },
    ]);

    await cambiar(token, m.menuId, m.detalle(MIERCOLES), m.pescado).expect(200);

    const despues = await items(token, m.listaId);
    expect(despues.get('Filete de pescado')).toMatchObject({
      origen: 'MANUAL',
      cantidadComprar: '5',
    });
    const filas = await bd.db.select().from(listaItem).where(eq(listaItem.listaId, m.listaId));
    expect(filas.filter((f) => f.textoLibre === 'Servilletas')).toHaveLength(1);
    const idFilete = await idDe(producto, 'nombre', 'Filete de pescado');
    // Una sola fila por producto (restricción única): la del menú no pisa la manual.
    expect(filas.filter((f) => f.productoId === idFilete)).toHaveLength(1);
  });

  it('lo que se quitó a mano mientras hacía falta sigue quitado', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const m = await menuAprobado(hogarId, token);
    const mantequilla = await filaDe(m.listaId, 'Mantequilla');
    await bd.db.update(listaItem).set({ eliminado: true }).where(eq(listaItem.id, mantequilla!.id));

    // La crema sigue el lunes, así que la mantequilla se sigue necesitando.
    await cambiar(token, m.menuId, m.detalle(MIERCOLES), m.pescado).expect(200);

    const despues = await items(token, m.listaId);
    expect(despues.has('Mantequilla')).toBe(false);
  });

  it('un producto que dejó de hacer falta y vuelve a pedirse reaparece pendiente', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const m = await menuAprobado(hogarId, token);

    await cambiar(token, m.menuId, m.detalle(LUNES), m.pescado).expect(200);
    expect((await items(token, m.listaId)).has('Mantequilla')).toBe(false);

    await cambiar(token, m.menuId, m.detalle(LUNES), m.crema).expect(200);
    const vuelve = (await items(token, m.listaId)).get('Mantequilla');
    expect(vuelve).toMatchObject({ estado: 'PENDIENTE', cantidadComprar: '1' });
  });

  it('las comidas de origen de cada ítem quedan al día', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const m = await menuAprobado(hogarId, token);

    await cambiar(token, m.menuId, m.detalle(MIERCOLES), m.pescado).expect(200);

    const despues = await items(token, m.listaId);
    expect(despues.get('Filete de pescado')!.comidas).toEqual([m.detalle(MIERCOLES)]);
    expect(despues.get('Pechuga de pollo')!.comidas).toEqual([m.detalle(LUNES)]);
    const origenes = await bd.db
      .select()
      .from(listaItemOrigen)
      .where(eq(listaItemOrigen.listaItemId, despues.get('Tomate')!.id));
    expect(origenes.map((o) => o.menuDetalleId)).toEqual([m.detalle(LUNES)]);
  });

  it('los productos de despensa de la lista conservan su cantidad', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    await bd.db.insert(despensaItem).values({
      hogarId,
      productoId: await idDe(producto, 'nombre', 'Arroz'),
      cantidad: '2',
      frecuencia: 'SEMANAL',
    });
    const m = await menuAprobado(hogarId, token);
    expect((await items(token, m.listaId)).get('Arroz')).toMatchObject({
      origen: 'DESPENSA',
      cantidadComprar: '2',
    });

    await cambiar(token, m.menuId, m.detalle(MIERCOLES), m.pescado).expect(200);

    expect((await items(token, m.listaId)).get('Arroz')).toMatchObject({
      origen: 'DESPENSA',
      cantidadComprar: '2',
    });
  });

  it('cambiar el menú de un hogar no toca la lista de otro', async () => {
    const a = await hogarDe('Ana');
    const b = await hogarDe('Beto');
    const ma = await menuAprobado(a.hogarId, a.token);
    const mb = await menuAprobado(b.hogarId, b.token);

    await cambiar(a.token, ma.menuId, ma.detalle(MIERCOLES), ma.pescado).expect(200);

    expect(await versionDeLista(mb.listaId)).toBe(1);
    expect((await items(b.token, mb.listaId)).get('Pechuga de pollo')!.cantidadComprar).toBe('7');
  });

  it('un menú de otro hogar no se puede cambiar', async () => {
    const a = await hogarDe('Ana');
    const b = await hogarDe('Beto');
    const ma = await menuAprobado(a.hogarId, a.token);

    await cambiar(b.token, ma.menuId, ma.detalle(MIERCOLES), ma.pescado).expect(404);
    expect(await versionDeLista(ma.listaId)).toBe(1);
  });
});
