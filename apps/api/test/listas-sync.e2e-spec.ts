/**
 * HU-30 Editar y marcar la lista de compras — integración contra PostgreSQL real
 * (TEST_DATABASE_URL). Cubre CA-30.1 a CA-30.4 sobre POST /listas/{id}/sync: marcar, lote sin
 * conexión, idempotencia por id de cambio, conflictos de última escritura gana y validaciones.
 *
 * Semana del domingo 2026-11-01: lunes 11-02 y miércoles 11-04.
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  eq,
  listaItem,
  menuDetalle,
  menuSemanal,
  menuTiempo,
  platillo,
  platilloIngrediente,
  platilloTiempo,
  producto,
  syncCambio,
  unidad,
} from '@menu/db';
import { normalizarNombreCatalogo, type TiempoComida } from '@menu/shared';
import { crearAppConBd, describeConBd, usarBaseDePruebas } from './utils/base-datos';

const API = '/api/v1';
const SEMANA = '2026-11-01';
const LUNES = '2026-11-02';
const MIERCOLES = '2026-11-04';

describeConBd('HU-30 Editar y marcar la lista de compras (integración)', () => {
  const bd = usarBaseDePruebas({
    suite: 'listas-sync',
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

  /** Aprueba la semana y devuelve la lista con sus ítems por nombre. */
  const listaAprobada = async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const m = await menuDeLaSemana(hogarId);
    const res = await aprobar(token, m.menuId, m.version).expect(200);
    const listaId = res.body.lista.id as string;
    const lista = await http().get(`${API}/listas/${listaId}`).set(con(token)).expect(200);
    const porNombre = (cuerpo: { items: { id: string; producto: { nombre: string } }[] }) =>
      new Map(cuerpo.items.map((i) => [i.producto.nombre, i.id]));
    return { token, hogarId, listaId, m, items: porNombre(lista.body), lista: lista.body };
  };

  let reloj = 0;
  // Las horas de los cambios son posteriores a la aprobación, que fija la hora de cada ítem.
  const BASE = Date.now() + 60_000;
  const hora = (minutos: number) => new Date(BASE + minutos * 60_000).toISOString();
  const cambio = (
    operacion: string,
    itemId: string,
    minutos: number,
    datos?: object,
  ): Record<string, unknown> => {
    reloj += 1;
    return {
      id: `00000000-0000-4000-8000-${String(reloj).padStart(12, '0')}`,
      itemId,
      operacion,
      marcaTiempo: hora(minutos),
      ...(datos ? { datos } : {}),
    };
  };
  const sync = (token: string, listaId: string, cambios: object[]) =>
    http().post(`${API}/listas/${listaId}/sync`).set(con(token)).send({ cambios });

  it('CA-30.1 marcar un producto como comprado lo guarda en el servidor y cuenta 1 comprado', async () => {
    const { token, listaId, items } = await listaAprobada();

    const res = await sync(token, listaId, [
      cambio('MARCAR_COMPRADO', items.get('Pechuga de pollo')!, 0),
    ]).expect(200);

    expect(res.body.resultados).toEqual([{ id: expect.any(String), resultado: 'APLICADO' }]);
    expect(res.body.lista).toMatchObject({ total: 3, comprados: 1 });
    expect(res.body.version).toBe(2);
    const pechuga = res.body.lista.items.find(
      (i: { producto: { nombre: string } }) => i.producto.nombre === 'Pechuga de pollo',
    );
    expect(pechuga.estado).toBe('COMPRADO');
    const [fila] = await bd.db.select().from(listaItem).where(eq(listaItem.id, pechuga.id));
    expect(fila).toMatchObject({ estado: 'COMPRADO', version: 2 });
    expect(fila!.compradoEn).toEqual(new Date(hora(0)));
    expect(fila!.compradoPorId).not.toBeNull();
  });

  it('desmarcar lo devuelve a pendiente y "Ya lo tengo" cuenta como cubierto', async () => {
    const { token, listaId, items } = await listaAprobada();
    const pollo = items.get('Pechuga de pollo')!;
    const tomate = items.get('Tomate')!;

    const res = await sync(token, listaId, [
      cambio('MARCAR_COMPRADO', pollo, 0),
      cambio('DESMARCAR_COMPRADO', pollo, 1),
      cambio('MARCAR_YA_LO_TENGO', tomate, 2),
    ]).expect(200);

    expect(res.body.lista.comprados).toBe(1);
    const estados = Object.fromEntries(
      res.body.lista.items.map((i: { producto: { nombre: string }; estado: string }) => [
        i.producto.nombre,
        i.estado,
      ]),
    );
    expect(estados).toMatchObject({ 'Pechuga de pollo': 'PENDIENTE', Tomate: 'YA_LO_TENGO' });
  });

  it('CA-30.2 un lote de cambios sin conexión (3 marcas y un producto nuevo) se aplica completo', async () => {
    const { token, listaId, items } = await listaAprobada();
    const nuevo = '11111111-1111-4111-8111-111111111111';

    const res = await sync(token, listaId, [
      cambio('MARCAR_COMPRADO', items.get('Pechuga de pollo')!, 0),
      cambio('MARCAR_COMPRADO', items.get('Tomate')!, 1),
      cambio('MARCAR_COMPRADO', items.get('Mantequilla')!, 2),
      cambio('AGREGAR', nuevo, 3, { textoLibre: 'Tortillas', cantidadComprar: 30 }),
    ]).expect(200);

    expect(res.body.resultados.map((r: { resultado: string }) => r.resultado)).toEqual(
      Array(4).fill('APLICADO'),
    );
    expect(res.body.lista).toMatchObject({ total: 4, comprados: 3 });
    const tortillas = res.body.lista.items.find((i: { id: string }) => i.id === nuevo);
    expect(tortillas).toMatchObject({
      producto: { id: null, nombre: 'Tortillas' },
      cantidadComprar: '30',
      origen: 'MANUAL',
      estado: 'PENDIENTE',
      presentacion: null,
    });
  });

  it('reenviar un lote ya aplicado no repite nada (idempotente por id de cambio)', async () => {
    const { token, listaId, items } = await listaAprobada();
    const lote = [cambio('MARCAR_COMPRADO', items.get('Tomate')!, 0)];

    await sync(token, listaId, lote).expect(200);
    const otra = await sync(token, listaId, lote).expect(200);

    expect(otra.body.resultados).toEqual([
      { id: lote[0]!.id, resultado: 'APLICADO', motivo: 'DUPLICADO' },
    ]);
    expect(otra.body.version).toBe(2);
    const registros = await bd.db.select().from(syncCambio);
    expect(registros).toHaveLength(1);
  });

  it('CA-30.3 quitado a las 10:00 y comprado a las 10:05 desde otro dispositivo: vuelve comprado', async () => {
    const { token, listaId, items } = await listaAprobada();
    const azucar = items.get('Tomate')!;

    await sync(token, listaId, [cambio('ELIMINAR', azucar, 0)]).expect(200);
    const quitado = await http().get(`${API}/listas/${listaId}`).set(con(token)).expect(200);
    expect(quitado.body.total).toBe(2);

    const res = await sync(token, listaId, [cambio('MARCAR_COMPRADO', azucar, 5)]).expect(200);

    expect(res.body.resultados[0].resultado).toBe('APLICADO');
    expect(res.body.lista.total).toBe(3);
    const restaurado = res.body.lista.items.find((i: { id: string }) => i.id === azucar);
    expect(restaurado.estado).toBe('COMPRADO');
  });

  it('un cambio más antiguo que el último aplicado queda obsoleto y no cambia el ítem', async () => {
    const { token, listaId, items } = await listaAprobada();
    const tomate = items.get('Tomate')!;
    await sync(token, listaId, [cambio('ELIMINAR', tomate, 10)]).expect(200);

    const res = await sync(token, listaId, [cambio('MARCAR_COMPRADO', tomate, 5)]).expect(200);

    expect(res.body.resultados[0]).toMatchObject({
      resultado: 'OBSOLETO',
      motivo: 'CAMBIO_ANTIGUO',
    });
    expect(res.body.lista.total).toBe(2);
    expect(res.body.version).toBe(2);
  });

  it('CA-30.4 agregar con cantidad 0 se rechaza y no se agrega; el resto del lote sí se aplica', async () => {
    const { token, listaId, items } = await listaAprobada();
    const cebolla = '22222222-2222-4222-8222-222222222222';

    const res = await sync(token, listaId, [
      cambio('AGREGAR', cebolla, 0, { textoLibre: 'Cebolla', cantidadComprar: 0 }),
      cambio('MARCAR_COMPRADO', items.get('Tomate')!, 1),
    ]).expect(200);

    expect(res.body.resultados.map((r: { resultado: string }) => r.resultado)).toEqual([
      'RECHAZADO',
      'APLICADO',
    ]);
    expect(res.body.resultados[0].motivo).toBe('CANTIDAD_INVALIDA');
    expect(res.body.lista.total).toBe(3);
    expect(res.body.lista.items.some((i: { id: string }) => i.id === cebolla)).toBe(false);
  });

  it('actualiza la cantidad, quita y vuelve a agregar un producto del catálogo', async () => {
    const { token, listaId, items } = await listaAprobada();
    const [cebollaCatalogo] = await bd.db
      .select({ id: producto.id })
      .from(producto)
      .where(eq(producto.nombre, 'Cebolla'));
    const nuevo = '33333333-3333-4333-8333-333333333333';

    const agregado = await sync(token, listaId, [
      cambio('ACTUALIZAR', items.get('Pechuga de pollo')!, 0, { cantidadComprar: 9 }),
      cambio('AGREGAR', nuevo, 1, { productoId: cebollaCatalogo!.id, cantidadComprar: 2 }),
    ]).expect(200);
    expect(agregado.body.lista.items.find((i: { id: string }) => i.id === nuevo)).toMatchObject({
      producto: { id: cebollaCatalogo!.id, nombre: 'Cebolla' },
      cantidadComprar: '2',
      presentacion: { texto: 'lb 1 lb' },
    });
    expect(
      agregado.body.lista.items.find(
        (i: { producto: { nombre: string } }) => i.producto.nombre === 'Pechuga de pollo',
      ).cantidadComprar,
    ).toBe('9');

    await sync(token, listaId, [cambio('ELIMINAR', nuevo, 2)]).expect(200);
    // Con otro id para el mismo producto se reutiliza el ítem quitado en vez de duplicarlo.
    const otroId = '44444444-4444-4444-8444-444444444444';
    const vuelto = await sync(token, listaId, [
      cambio('AGREGAR', otroId, 3, { productoId: cebollaCatalogo!.id, cantidadComprar: 4 }),
    ]).expect(200);
    expect(vuelto.body.resultados[0].resultado).toBe('APLICADO');
    const cebollas = vuelto.body.lista.items.filter(
      (i: { producto: { nombre: string } }) => i.producto.nombre === 'Cebolla',
    );
    expect(cebollas).toHaveLength(1);
    expect(cebollas[0]).toMatchObject({ id: nuevo, cantidadComprar: '4' });
  });

  it('un producto vigente que se agrega de nuevo y un producto inexistente se descartan', async () => {
    const { token, listaId, items } = await listaAprobada();
    const [pechugaCatalogo] = await bd.db
      .select({ id: producto.id })
      .from(producto)
      .where(eq(producto.nombre, 'Pechuga de pollo'));

    const res = await sync(token, listaId, [
      cambio('AGREGAR', '55555555-5555-4555-8555-555555555555', 0, {
        productoId: pechugaCatalogo!.id,
        cantidadComprar: 2,
      }),
      cambio('AGREGAR', '66666666-6666-4666-8666-666666666666', 1, {
        productoId: '99999999-9999-4999-8999-999999999999',
        cantidadComprar: 2,
      }),
      cambio('MARCAR_COMPRADO', '77777777-7777-4777-8777-777777777777', 2),
      cambio('REGISTRAR_PRECIO', items.get('Tomate')!, 3),
    ]).expect(200);

    expect(
      res.body.resultados.map((r: { resultado: string; motivo: string }) => [
        r.resultado,
        r.motivo,
      ]),
    ).toEqual([
      ['OBSOLETO', 'YA_EXISTE'],
      ['RECHAZADO', 'PRODUCTO_INVALIDO'],
      ['RECHAZADO', 'ITEM_NO_ENCONTRADO'],
      ['RECHAZADO', 'OPERACION_NO_SOPORTADA'],
    ]);
    expect(res.body.lista.total).toBe(3);
    expect(res.body.version).toBe(1);
  });

  it('una lista de otro hogar o inexistente es 404 y no se aplica nada', async () => {
    const { token, listaId, items } = await listaAprobada();
    const otro = await hogarDe('Ana');

    await sync(otro.token, listaId, [cambio('MARCAR_COMPRADO', items.get('Tomate')!, 0)]).expect(
      404,
    );
    await sync(token, '88888888-8888-4888-8888-888888888888', []).expect(404);
    await http()
      .post(`${API}/listas/no-es-uuid/sync`)
      .set(con(token))
      .send({ cambios: [] })
      .expect(404);
    const [fila] = await bd.db
      .select()
      .from(listaItem)
      .where(eq(listaItem.id, items.get('Tomate')!));
    expect(fila!.estado).toBe('PENDIENTE');
  });

  it('valida el cuerpo: operación, marca de tiempo y lote de más de 500 cambios', async () => {
    const { token, listaId, items } = await listaAprobada();
    const tomate = items.get('Tomate')!;

    await sync(token, listaId, [{ ...cambio('BORRAR_TODO', tomate, 0) }]).expect(400);
    await sync(token, listaId, [
      { ...cambio('MARCAR_COMPRADO', tomate, 0), marcaTiempo: 'ayer' },
    ]).expect(400);
    await http().post(`${API}/listas/${listaId}/sync`).set(con(token)).send({}).expect(400);
    const grande = Array.from({ length: 501 }, () => cambio('MARCAR_COMPRADO', tomate, 0));
    const res = await sync(token, listaId, grande).expect(422);
    expect(res.body.codigo).toBe('LOTE_DEMASIADO_GRANDE');
  });
});
