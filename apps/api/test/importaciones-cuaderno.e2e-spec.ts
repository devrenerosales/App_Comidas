import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Workbook } from 'exceljs';
import {
  categoria,
  despensaItem,
  eq,
  importacionFila,
  menuSemanal,
  miembroHogar,
  platillo,
  producto,
} from '@menu/db';
import { diasSemanaHistorica } from '@menu/shared';
import { RELOJ_IMPORTACIONES } from '../src/importaciones/importaciones.controller';
import { crearAppConBd, describeConBd, usarBaseDePruebas } from './utils/base-datos';
const API = '/api/v1/importaciones';
const SEMANAS = ['2025-04-06', '2025-04-13', '2025-04-20'];
describeConBd('HU-18 Carga inicial del cuaderno', () => {
  const bd = usarBaseDePruebas({
    suite: 'importaciones-cuaderno',
    sembrar: true,
    truncarEntrePruebas: true,
  });
  let app: INestApplication;
  let token: string;
  let hogarId: string;
  const http = () => request(app.getHttpServer());
  const crearHogar = async (correo = 'ana@correo.com') => {
    const cuenta = await http()
      .post('/api/v1/auth/registro')
      .send({ nombre: 'Familia', correo, contrasena: 'Almuerzo2026' })
      .expect(201);
    const res = await http()
      .post('/api/v1/hogares')
      .set('Authorization', `Bearer ${cuenta.body.accessToken}`)
      .send({ nombre: correo })
      .expect(201);
    return { token: res.body.accessToken as string, hogarId: res.body.hogar.id as string };
  };
  const menus = (gastos = ['224', '241.75', '265']) =>
    'fecha,tiempo_comida,platillo,gasto_semana_gtq\n' +
    SEMANAS.flatMap((s, i) =>
      diasSemanaHistorica(s).map((f) => `${f},almuerzo,Sopa,${gastos[i]}`),
    ).join('\n');
  const LISTAS =
    'fecha,lista,tipo,producto,cantidad,unidad_compra,presentacion,precio_gtq,supermercado\n' +
    [
      '2026-03-01,Despensa marzo,despensa,Arroz,2,bolsa,,25.00,Paiz',
      '2026-03-01,Despensa marzo,despensa,Leche,1,caja,1 l,30.00,',
      '2026-03-01,Despensa marzo,despensa,Jabón para ropa,1,unidad,,759.00,',
      '2026-03-01,Compras sueltas,compras,Pechuga de pollo,2,lb,,20.00,',
      '2026-03-01,Compras sueltas,compras,Atún,2,lata,,33.00,',
    ].join('\n');
  const cargar = (
    opciones: { menus?: string; listas?: string | null; origen?: string; acceso?: string } = {},
  ) => {
    const r = http()
      .post(API)
      .set('Authorization', `Bearer ${opciones.acceso ?? token}`)
      .field('origen', opciones.origen ?? 'CUADERNO')
      .attach('archivo', Buffer.from(opciones.menus ?? menus()), 'menus.csv');
    const listas = opciones.listas === undefined ? LISTAS : opciones.listas;
    return listas === null ? r : r.attach('listas', Buffer.from(listas), 'listas.csv');
  };
  const consultar = (id: string, acceso = token) =>
    http().get(`${API}/${id}`).set('Authorization', `Bearer ${acceso}`);
  const confirmar = (id: string, revision: string) =>
    http()
      .post(`${API}/${id}/confirmar`)
      .set('Authorization', `Bearer ${token}`)
      .send({ revision });
  const reemplazarTodo = (id: string, revision: string, semanas = SEMANAS) =>
    http()
      .put(`${API}/${id}/semanas`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        revision,
        decisiones: semanas.map((semanaInicio) => ({ semanaInicio, decision: 'REEMPLAZAR' })),
      });
  beforeAll(async () => {
    app = await crearAppConBd(bd.base, (b) =>
      b.overrideProvider(RELOJ_IMPORTACIONES).useValue(() => new Date('2026-10-28T15:00:00Z')),
    );
  });
  beforeEach(async () => {
    ({ token, hogarId } = await crearHogar());
    await bd.db.insert(platillo).values({ hogarId, nombre: 'Sopa', nombreNormalizado: 'sopa' });
  });
  afterAll(async () => {
    await app?.close();
  });

  it('CA-18.1 carga las semanas como históricas de origen cuaderno y reporta gasto mínimo, máximo y promedio', async () => {
    const r = await cargar().expect(201);
    expect(r.body).toMatchObject({
      origen: 'CUADERNO',
      totalFilas: 26,
      filasConError: 0,
      puedeConfirmar: true,
      listas: [
        { lista: 'Despensa marzo', tipo: 'DESPENSA', productos: 3, total: '814.00', nuevos: 2 },
        { lista: 'Compras sueltas', tipo: 'COMPRAS', productos: 2, total: '53.00', nuevos: 1 },
      ],
    });
    expect(await bd.db.select().from(menuSemanal)).toHaveLength(0);
    expect(await bd.db.select().from(despensaItem)).toHaveLength(0);
    const final = await confirmar(r.body.id, r.body.revision).expect(201);
    expect(final.body).toMatchObject({
      semanasCreadas: 3,
      gastoSemanal: { semanas: 3, minimo: '224.00', maximo: '265.00', promedio: '243.58' },
    });
    const semanas = await bd.db.select().from(menuSemanal).orderBy(menuSemanal.fechaInicio);
    expect(semanas.map((s) => [s.estado, s.origen, s.gastoReal])).toEqual([
      ['HISTORICO', 'CUADERNO', '224.00'],
      ['HISTORICO', 'CUADERNO', '241.75'],
      ['HISTORICO', 'CUADERNO', '265.00'],
    ]);
    expect((await consultar(r.body.id).expect(200)).body).toMatchObject({
      estado: 'CONFIRMADA',
      reporte: final.body,
    });
  });

  it('CA-18.2 registra la despensa del hogar con frecuencia mensual y asocia o crea los productos', async () => {
    const antes = await bd.db.select().from(producto);
    const r = await cargar().expect(201);
    const final = await confirmar(r.body.id, r.body.revision).expect(201);
    expect(final.body).toMatchObject({
      productosCreados: 3,
      despensaCargada: 3,
      listas: [
        { lista: 'Despensa marzo', productos: 3, total: '814.00' },
        { lista: 'Compras sueltas', productos: 2, total: '53.00' },
      ],
    });
    const items = await bd.db.select().from(despensaItem);
    expect(items).toHaveLength(3);
    expect(
      items.every((i) => i.hogarId === hogarId && i.frecuencia === 'MENSUAL' && i.activo),
    ).toBe(true);
    const nombres = new Map((await bd.db.select().from(producto)).map((p) => [p.id, p] as const));
    expect(
      items.map((i) => [nombres.get(i.productoId)!.nombre, i.cantidad, i.precioReferencia]).sort(),
    ).toEqual([
      ['Arroz', '2.000', '25.00'],
      ['Jabón para ropa', '1.000', '759.00'],
      ['Leche', '1.000', '30.00'],
    ]);
    // Arroz ya estaba en la semilla: se asoció sin crear otro.
    const despues = await bd.db.select().from(producto);
    expect(despues).toHaveLength(antes.length + 3);
    expect(despues.filter((p) => p.nombreNormalizado === 'arroz')).toHaveLength(1);
    const [otros] = await bd.db.select().from(categoria).where(eq(categoria.codigo, 'otros'));
    const leche = despues.find((p) => p.nombreNormalizado === 'leche')!;
    expect(leche).toMatchObject({
      nombre: 'Leche',
      tipo: 'DESPENSA',
      categoriaId: otros!.id,
      unidadCompra: 'caja',
      presentacionCantidad: '1.000',
      activo: true,
    });
    // Los de la lista de compras sueltas solo entran al catálogo; no son despensa.
    expect(despues.find((p) => p.nombreNormalizado === 'atun')).toMatchObject({
      tipo: 'INGREDIENTE',
      unidadCompra: 'lata',
      presentacionCantidad: '1.000',
    });
  });

  it('CA-18.3 repetir la carga con Reemplazar no duplica semanas, productos ni despensa', async () => {
    const primera = await cargar().expect(201);
    await confirmar(primera.body.id, primera.body.revision).expect(201);
    const productos = (await bd.db.select().from(producto)).length;
    const otra = await cargar().expect(201);
    expect(otra.body.semanas.map((s: { decision: string }) => s.decision)).toEqual([
      'OMITIR',
      'OMITIR',
      'OMITIR',
    ]);
    expect(otra.body.listas.map((l: { nuevos: number }) => l.nuevos)).toEqual([0, 0]);
    const lista = await reemplazarTodo(otra.body.id, otra.body.revision).expect(200);
    const final = await confirmar(otra.body.id, lista.body.revision).expect(201);
    expect(final.body).toMatchObject({
      semanasCreadas: 0,
      reemplazadas: 3,
      productosCreados: 0,
      despensaCargada: 3,
    });
    const semanas = await bd.db.select().from(menuSemanal);
    expect(semanas).toHaveLength(3);
    expect(semanas.every((s) => s.origen === 'CUADERNO' && s.version === 2)).toBe(true);
    expect(await bd.db.select().from(despensaItem)).toHaveLength(3);
    expect(await bd.db.select().from(producto)).toHaveLength(productos);
  });

  it('CA-18.3 una nueva carga actualiza cantidad y precio sin tocar la frecuencia elegida', async () => {
    const primera = await cargar().expect(201);
    await confirmar(primera.body.id, primera.body.revision).expect(201);
    await bd.db.update(despensaItem).set({ frecuencia: 'SEMANAL', activo: false });
    const otra = await cargar({
      listas: LISTAS.replace('Arroz,2,bolsa,,25.00', 'Arroz,5,bolsa,,27.50'),
    }).expect(201);
    await confirmar(otra.body.id, otra.body.revision).expect(201);
    const [arroz] = await bd.db
      .select()
      .from(despensaItem)
      .innerJoin(producto, eq(producto.id, despensaItem.productoId))
      .where(eq(producto.nombreNormalizado, 'arroz'));
    expect(arroz!.despensa_item).toMatchObject({
      cantidad: '5.000',
      precioReferencia: '27.50',
      frecuencia: 'SEMANAL',
      activo: true,
    });
  });

  it('CA-18.4 una cifra corregida en el archivo se recarga y el reporte final la muestra', async () => {
    const mal = await cargar({ menus: menus(['284.50', '241.75', '265']) }).expect(201);
    const inicial = await confirmar(mal.body.id, mal.body.revision).expect(201);
    expect(inicial.body.gastoSemanal.maximo).toBe('284.50');
    const bien = await cargar({ menus: menus(['248.50', '241.75', '265']) }).expect(201);
    const lista = await reemplazarTodo(bien.body.id, bien.body.revision, ['2025-04-06']).expect(
      200,
    );
    const final = await confirmar(bien.body.id, lista.body.revision).expect(201);
    expect(final.body).toMatchObject({
      reemplazadas: 1,
      omitidas: 2,
      gastoSemanal: { semanas: 1, minimo: '248.50', maximo: '248.50', promedio: '248.50' },
    });
    const [semana] = await bd.db
      .select()
      .from(menuSemanal)
      .where(eq(menuSemanal.fechaInicio, '2025-04-06'));
    expect(semana!.gastoReal).toBe('248.50');
  });

  it('acepta un Excel con las hojas Menus y Listas', async () => {
    const libro = new Workbook();
    const hojaMenus = libro.addWorksheet('Menus');
    for (const f of menus().split('\n')) hojaMenus.addRow(f.split(','));
    const hojaListas = libro.addWorksheet('Listas');
    for (const f of LISTAS.split('\n')) hojaListas.addRow(f.split(','));
    const r = await http()
      .post(API)
      .set('Authorization', `Bearer ${token}`)
      .field('origen', 'CUADERNO')
      .attach('archivo', Buffer.from(await libro.xlsx.writeBuffer()), 'cuaderno.xlsx')
      .expect(201);
    expect(r.body).toMatchObject({ origen: 'CUADERNO', filasConError: 0, puedeConfirmar: true });
    expect(r.body.listas).toHaveLength(2);
    expect((await confirmar(r.body.id, r.body.revision).expect(201)).body.despensaCargada).toBe(3);
  });

  it('rechaza listas en una importación normal o enviadas dos veces', async () => {
    const normal = await cargar({ origen: 'ARCHIVO' }).expect(422);
    expect(normal.body.codigo).toBe('LISTAS_REQUIEREN_CUADERNO');
    const libro = new Workbook();
    libro.addWorksheet('Menus').addRows(
      menus()
        .split('\n')
        .map((f) => f.split(',')),
    );
    libro.addWorksheet('Listas').addRows(LISTAS.split('\n').map((f) => f.split(',')));
    const doble = await http()
      .post(API)
      .set('Authorization', `Bearer ${token}`)
      .field('origen', 'CUADERNO')
      .attach('archivo', Buffer.from(await libro.xlsx.writeBuffer()), 'cuaderno.xlsx')
      .attach('listas', Buffer.from(LISTAS), 'listas.csv')
      .expect(422);
    expect(doble.body.codigo).toBe('LISTAS_DUPLICADAS');
    const sinListas = await cargar({ listas: null }).expect(201);
    expect(sinListas.body).toMatchObject({ origen: 'CUADERNO', listas: [], puedeConfirmar: true });
    expect(await bd.db.select().from(menuSemanal)).toHaveLength(0);
  });

  it('bloquea con errores de lista, los muestra por hoja y no guarda nada', async () => {
    const mala = LISTAS.replace('Leche,1,caja,1 l', 'Leche,0,caja,1 saco');
    const r = await cargar({ listas: mala }).expect(201);
    expect(r.body).toMatchObject({
      estado: 'CON_ERRORES',
      filasConError: 1,
      puedeConfirmar: false,
    });
    const hoja = await http()
      .get(`${API}/${r.body.id}/filas?hoja=LISTAS&soloErrores=true`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(hoja.body.datos).toHaveLength(1);
    expect(hoja.body.datos[0].errores.map((e: { columna: string }) => e.columna).sort()).toEqual([
      'cantidad',
      'presentacion',
    ]);
    const menusHoja = await http()
      .get(`${API}/${r.body.id}/filas?soloErrores=true`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(menusHoja.body.datos).toEqual([]);
    await confirmar(r.body.id, r.body.revision).expect(422);
    expect(await bd.db.select().from(despensaItem)).toHaveLength(0);
    expect(await bd.db.select().from(menuSemanal)).toHaveLength(0);
  });

  it('respeta los platillos sin resolver y permite confirmar solo las listas con todas las semanas omitidas', async () => {
    const r = await cargar({ menus: menus().replace(/Sopa/g, 'Hilachas') }).expect(201);
    expect(r.body).toMatchObject({ pendientes: ['Hilachas'], puedeConfirmar: false });
    await confirmar(r.body.id, r.body.revision).expect(422);
    const primera = await cargar().expect(201);
    await confirmar(primera.body.id, primera.body.revision).expect(201);
    await bd.db.delete(despensaItem);
    const soloListas = await cargar().expect(201);
    expect(soloListas.body.puedeConfirmar).toBe(true);
    const final = await confirmar(soloListas.body.id, soloListas.body.revision).expect(201);
    expect(final.body).toMatchObject({
      omitidas: 3,
      despensaCargada: 3,
      gastoSemanal: null,
    });
    expect(await bd.db.select().from(despensaItem)).toHaveLength(3);
  });

  it('cancelar descarta también las filas de listas', async () => {
    const r = await cargar().expect(201);
    await http()
      .post(`${API}/${r.body.id}/cancelar`)
      .set('Authorization', `Bearer ${token}`)
      .send({ revision: r.body.revision })
      .expect(201);
    expect(await bd.db.select().from(importacionFila)).toHaveLength(0);
    expect(await bd.db.select().from(despensaItem)).toHaveLength(0);
  });

  it('aísla la despensa por hogar y solo la carga el administrador', async () => {
    const otro = await crearHogar('otra@correo.com');
    const mio = await cargar().expect(201);
    await consultar(mio.body.id, otro.token).expect(404);
    await confirmar(mio.body.id, mio.body.revision).expect(201);
    expect(
      await bd.db.select().from(despensaItem).where(eq(despensaItem.hogarId, otro.hogarId)),
    ).toEqual([]);
    await bd.db
      .update(miembroHogar)
      .set({ rol: 'MIEMBRO' })
      .where(eq(miembroHogar.hogarId, hogarId));
    await cargar().expect(403);
  });
});
