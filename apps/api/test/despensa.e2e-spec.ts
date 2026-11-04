/**
 * HU-29 Agregar despensa según frecuencia — integración contra PostgreSQL real
 * (TEST_DATABASE_URL). Cubre CA-29.1 a CA-29.4: el CRUD de /despensa y la inclusión de lo que toca
 * al aprobar el menú (CU-07.2), con la última inclusión que avanza una sola vez por semana.
 *
 * Semana del domingo 2026-10-25: lunes 10-26. La siguiente, 2026-11-01.
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  and,
  despensaItem,
  eq,
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
const SEMANA = '2026-10-25';
const LUNES = '2026-10-26';

describeConBd('HU-29 Despensa según frecuencia (integración)', () => {
  const bd = usarBaseDePruebas({
    suite: 'despensa',
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

  const productoId = (nombre: string) => idDe(producto, 'nombre', nombre);

  /** Registra un producto de despensa directamente, con la última inclusión que se quiera. */
  const sembrarDespensa = async (
    hogarId: string,
    nombre: string,
    cantidad: string,
    frecuencia: 'SEMANAL' | 'QUINCENAL' | 'MENSUAL',
    ultimaInclusionSemana: string | null,
  ) => {
    const [fila] = await bd.db
      .insert(despensaItem)
      .values({
        hogarId,
        productoId: await productoId(nombre),
        cantidad,
        frecuencia,
        ultimaInclusionSemana,
      })
      .returning();
    return fila!.id;
  };

  const despensaDe = async (hogarId: string, nombre: string) => {
    const [fila] = await bd.db
      .select()
      .from(despensaItem)
      .where(
        and(
          eq(despensaItem.hogarId, hogarId),
          eq(despensaItem.productoId, await productoId(nombre)),
        ),
      );
    return fila!;
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
        productoId: await productoId(nombreProducto),
        cantidad: String(cantidad),
        unidadId: await idDe(unidad, 'codigo', codigoUnidad),
      });
    }
    return p!.id;
  };

  /** Borrador de la semana con un almuerzo y la Σ de factores 4.00 (igual a las porciones base). */
  const crearBorrador = async (
    hogarId: string,
    platilloId: string,
    semana = SEMANA,
    lunes = LUNES,
    fin = '2026-10-31',
  ) => {
    const [menu] = await bd.db
      .insert(menuSemanal)
      .values({
        hogarId,
        fechaInicio: semana,
        fechaFin: fin,
        estado: 'BORRADOR',
        presupuestoSemanal: '245.00',
        sumaFactoresPorcion: '4.00',
      })
      .returning();
    await bd.db.insert(menuTiempo).values({
      menuId: menu!.id,
      tiempo: 'ALMUERZO' as TiempoComida,
      porcentaje: '100.00',
      presupuesto: '245.00',
    });
    await bd.db
      .insert(menuDetalle)
      .values({ menuId: menu!.id, fecha: lunes, tiempo: 'ALMUERZO' as TiempoComida, platilloId });
    return { menuId: menu!.id, version: menu!.version };
  };

  const aprobar = (token: string, m: { menuId: string; version: number }) =>
    http().post(`${API}/menus/${m.menuId}/aprobar`).set(con(token)).send({ version: m.version });

  const itemsDe = async (token: string, listaId: string) => {
    const lista = await http().get(`${API}/listas/${listaId}`).set(con(token)).expect(200);
    return new Map<string, { cantidadComprar: string; origen: string }>(
      lista.body.items.map((i: { producto: { nombre: string } }) => [i.producto.nombre, i]),
    );
  };

  const pollo = (hogarId: string) =>
    crearPlatillo(hogarId, 'Pollo en crema', [['Pechuga de pollo', 2, 'lb']]);

  const agregar = (token: string, cuerpo: object) =>
    http().post(`${API}/despensa`).set(con(token)).send(cuerpo);

  beforeAll(async () => {
    app = await crearAppConBd(bd.base);
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('mantener la despensa (CU-07.2 paso 1)', () => {
    it('CA-29.3 agrega "Frijol negro" x2 semanal y lo lista como que toca en la primera lista', async () => {
      const { token } = await hogarDe('Rene');

      const res = await agregar(token, {
        productoId: await productoId('Frijol negro'),
        cantidad: '2',
        frecuencia: 'SEMANAL',
        notas: ' Para el almuerzo ',
      }).expect(201);

      expect(res.body).toMatchObject({
        producto: { nombre: 'Frijol negro', etiqueta: 'Frijol negro · bolsa 1 lb' },
        cantidad: '2.000',
        frecuencia: 'SEMANAL',
        ultimaInclusionSemana: null,
        proximaInclusion: null,
        tocaEstaSemana: true,
        notas: 'Para el almuerzo',
      });
      const lista = await http().get(`${API}/despensa`).set(con(token)).expect(200);
      expect(lista.body).toHaveLength(1);
      expect(lista.body[0].id).toBe(res.body.id);
    });

    it('acepta la cantidad como número y con decimales', async () => {
      const { token } = await hogarDe('Rene');
      const res = await agregar(token, {
        productoId: await productoId('Arroz'),
        cantidad: 1.5,
        frecuencia: 'MENSUAL',
      }).expect(201);
      expect(res.body).toMatchObject({ cantidad: '1.500', notas: null });
    });

    it.each([['0'], ['-1'], ['abc'], ['']])(
      'CA-29.4 la cantidad "%s" es 422 CANTIDAD_INVALIDA y no se guarda',
      async (cantidad) => {
        const { token, hogarId } = await hogarDe('Rene');
        const res = await agregar(token, {
          productoId: await productoId('Arroz'),
          cantidad,
          frecuencia: 'SEMANAL',
        }).expect(422);
        expect(res.body).toMatchObject({
          codigo: 'CANTIDAD_INVALIDA',
          detail: 'La cantidad debe ser mayor que 0',
        });
        const filas = await bd.db
          .select()
          .from(despensaItem)
          .where(eq(despensaItem.hogarId, hogarId));
        expect(filas).toHaveLength(0);
      },
    );

    it('una cantidad ausente o que no es texto ni número también es inválida', async () => {
      const { token } = await hogarDe('Rene');
      const base = { productoId: await productoId('Arroz'), frecuencia: 'SEMANAL' };
      await agregar(token, base).expect(422);
      await agregar(token, { ...base, cantidad: ['2'] }).expect(422);
    });

    it('E1 una frecuencia vacía o inventada es 422 FRECUENCIA_INVALIDA', async () => {
      const { token } = await hogarDe('Rene');
      const base = { productoId: await productoId('Arroz'), cantidad: '1' };
      for (const frecuencia of [undefined, '', 'ANUAL', 'semanal']) {
        const res = await agregar(token, { ...base, frecuencia }).expect(422);
        expect(res.body).toMatchObject({ codigo: 'FRECUENCIA_INVALIDA' });
      }
    });

    it('un producto inexistente, mal formado o inactivo es 422 PRODUCTO_INVALIDO', async () => {
      const { token } = await hogarDe('Rene');
      const cuerpo = (productoId: unknown) => ({
        productoId,
        cantidad: '1',
        frecuencia: 'SEMANAL',
      });
      for (const id of ['no-es-uuid', '3f2b7c52-5a53-4f60-a1f4-2f9a0f0e0c11', undefined]) {
        const res = await agregar(token, cuerpo(id)).expect(422);
        expect(res.body).toMatchObject({ codigo: 'PRODUCTO_INVALIDO' });
      }
      const arroz = await productoId('Arroz');
      await bd.db.update(producto).set({ activo: false }).where(eq(producto.id, arroz));
      await agregar(token, cuerpo(arroz)).expect(422);
      await bd.db.update(producto).set({ activo: true }).where(eq(producto.id, arroz));
    });

    it('una nota de más de 200 caracteres se rechaza', async () => {
      const { token } = await hogarDe('Rene');
      await agregar(token, {
        productoId: await productoId('Arroz'),
        cantidad: '1',
        frecuencia: 'SEMANAL',
        notas: 'x'.repeat(201),
      }).expect(400);
    });

    it('un producto que ya está en la despensa es 409 YA_EN_DESPENSA', async () => {
      const { token } = await hogarDe('Rene');
      const cuerpo = {
        productoId: await productoId('Arroz'),
        cantidad: '1',
        frecuencia: 'SEMANAL',
      };
      await agregar(token, cuerpo).expect(201);
      const res = await agregar(token, cuerpo).expect(409);
      expect(res.body).toMatchObject({ codigo: 'YA_EN_DESPENSA' });
    });

    it('cambia cantidad, frecuencia y nota sin tocar la última inclusión', async () => {
      const { token, hogarId } = await hogarDe('Rene');
      const id = await sembrarDespensa(hogarId, 'Aceite', '1.000', 'QUINCENAL', '2026-10-11');

      const res = await http()
        .patch(`${API}/despensa/${id}`)
        .set(con(token))
        .send({ cantidad: '2', frecuencia: 'MENSUAL', notas: 'Grande' })
        .expect(200);

      expect(res.body).toMatchObject({
        cantidad: '2.000',
        frecuencia: 'MENSUAL',
        notas: 'Grande',
        ultimaInclusionSemana: '2026-10-11',
        proximaInclusion: '2026-11-08',
      });
      await http().patch(`${API}/despensa/${id}`).set(con(token)).send({}).expect(200);
    });

    it('un cambio inválido no se guarda', async () => {
      const { token, hogarId } = await hogarDe('Rene');
      const id = await sembrarDespensa(hogarId, 'Aceite', '1.000', 'QUINCENAL', null);
      await http()
        .patch(`${API}/despensa/${id}`)
        .set(con(token))
        .send({ cantidad: '0' })
        .expect(422);
      await http()
        .patch(`${API}/despensa/${id}`)
        .set(con(token))
        .send({ frecuencia: 'ANUAL' })
        .expect(422);
      expect(await despensaDe(hogarId, 'Aceite')).toMatchObject({
        cantidad: '1.000',
        frecuencia: 'QUINCENAL',
      });
    });

    it('quitar un producto lo da de baja y agregarlo de nuevo lo reactiva como nuevo', async () => {
      const { token, hogarId } = await hogarDe('Rene');
      const id = await sembrarDespensa(hogarId, 'Arroz', '2.000', 'SEMANAL', '2026-10-18');

      await http().delete(`${API}/despensa/${id}`).set(con(token)).expect(204);
      expect((await http().get(`${API}/despensa`).set(con(token)).expect(200)).body).toEqual([]);
      expect((await despensaDe(hogarId, 'Arroz')).activo).toBe(false);
      await http().delete(`${API}/despensa/${id}`).set(con(token)).expect(404);
      await http()
        .patch(`${API}/despensa/${id}`)
        .set(con(token))
        .send({ cantidad: '3' })
        .expect(404);

      const res = await agregar(token, {
        productoId: await productoId('Arroz'),
        cantidad: '3',
        frecuencia: 'QUINCENAL',
      }).expect(201);
      expect(res.body).toMatchObject({
        id,
        cantidad: '3.000',
        frecuencia: 'QUINCENAL',
        ultimaInclusionSemana: null,
        tocaEstaSemana: true,
      });
    });

    it('RNF-06 cada hogar ve solo su despensa y un id ajeno o mal formado no existe', async () => {
      const dueno = await hogarDe('Rene');
      const otro = await hogarDe('Ana');
      const id = await sembrarDespensa(dueno.hogarId, 'Arroz', '2.000', 'SEMANAL', null);

      expect((await http().get(`${API}/despensa`).set(con(otro.token)).expect(200)).body).toEqual(
        [],
      );
      await http()
        .patch(`${API}/despensa/${id}`)
        .set(con(otro.token))
        .send({ cantidad: '9' })
        .expect(404);
      await http().delete(`${API}/despensa/${id}`).set(con(otro.token)).expect(404);
      await http().delete(`${API}/despensa/no-es-un-id`).set(con(otro.token)).expect(404);
      await http().get(`${API}/despensa`).expect(401);
      expect(await despensaDe(dueno.hogarId, 'Arroz')).toMatchObject({
        cantidad: '2.000',
        activo: true,
      });
      // Otro hogar puede tener el mismo producto sin chocar.
      await agregar(otro.token, {
        productoId: await productoId('Arroz'),
        cantidad: '1',
        frecuencia: 'SEMANAL',
      }).expect(201);
    });
  });

  describe('la despensa en la lista al aprobar (CU-07.2 pasos 2 a 5)', () => {
    it('CA-29.1 solo entran los productos que tocan y su última inclusión pasa a la semana de la lista', async () => {
      const { token, hogarId } = await hogarDe('Rene');
      await sembrarDespensa(hogarId, 'Arroz', '2.000', 'SEMANAL', '2026-10-18');
      await sembrarDespensa(hogarId, 'Aceite', '1.000', 'QUINCENAL', '2026-10-11');
      await sembrarDespensa(hogarId, 'Sal', '1.000', 'MENSUAL', '2026-10-04');
      const m = await crearBorrador(hogarId, await pollo(hogarId));

      const res = await aprobar(token, m).expect(200);

      expect(res.body.lista).toMatchObject({ totalItems: 3, itemsMenu: 1, itemsDespensa: 2 });
      const items = await itemsDe(token, res.body.lista.id);
      expect([...items.keys()].sort()).toEqual(['Aceite', 'Arroz', 'Pechuga de pollo']);
      expect(items.get('Arroz')).toMatchObject({ cantidadComprar: '2', origen: 'DESPENSA' });
      expect(items.get('Aceite')).toMatchObject({ cantidadComprar: '1', origen: 'DESPENSA' });
      expect(items.get('Pechuga de pollo')).toMatchObject({ origen: 'MENU' });
      // La Sal mensual solo lleva 3 de 4 semanas: no entra y no avanza.
      expect((await despensaDe(hogarId, 'Arroz')).ultimaInclusionSemana).toBe(SEMANA);
      expect((await despensaDe(hogarId, 'Aceite')).ultimaInclusionSemana).toBe(SEMANA);
      expect((await despensaDe(hogarId, 'Aceite')).ultimaInclusionListaId).toBe(res.body.lista.id);
      expect((await despensaDe(hogarId, 'Sal')).ultimaInclusionSemana).toBe('2026-10-04');
    });

    it('CA-29.2 el aceite del platillo y el de la despensa quedan en una línea con 2 botellas "Menú + Despensa"', async () => {
      const { token, hogarId } = await hogarDe('Rene');
      await sembrarDespensa(hogarId, 'Aceite', '1.000', 'SEMANAL', null);
      // 450 ml de una botella de 900 ml: el menú pide 1 botella.
      const pescado = await crearPlatillo(hogarId, 'Pescado frito', [['Aceite', 450, 'ml']]);
      const m = await crearBorrador(hogarId, pescado);

      const res = await aprobar(token, m).expect(200);

      const items = await itemsDe(token, res.body.lista.id);
      expect(items.size).toBe(1);
      expect(items.get('Aceite')).toMatchObject({
        cantidadComprar: '2',
        origen: 'MENU_Y_DESPENSA',
      });
      expect(res.body.lista).toMatchObject({ totalItems: 1, itemsMenu: 1, itemsDespensa: 1 });
    });

    it('CA-29.3 un producto agregado hoy sin inclusión previa entra en la primera lista', async () => {
      const { token, hogarId } = await hogarDe('Rene');
      await agregar(token, {
        productoId: await productoId('Frijol negro'),
        cantidad: '2',
        frecuencia: 'SEMANAL',
      }).expect(201);
      const m = await crearBorrador(hogarId, await pollo(hogarId));

      const res = await aprobar(token, m).expect(200);

      const items = await itemsDe(token, res.body.lista.id);
      expect(items.get('Frijol negro')).toMatchObject({ cantidadComprar: '2', origen: 'DESPENSA' });
    });

    it('la semana siguiente vuelve a tocar el semanal pero no el quincenal, y una semana no se incluye dos veces', async () => {
      const { token, hogarId } = await hogarDe('Rene');
      await sembrarDespensa(hogarId, 'Arroz', '2.000', 'SEMANAL', '2026-10-18');
      await sembrarDespensa(hogarId, 'Aceite', '1.000', 'QUINCENAL', '2026-10-11');
      const receta = await pollo(hogarId);
      const primera = await crearBorrador(hogarId, receta);
      await aprobar(token, primera).expect(200);

      const segunda = await crearBorrador(
        hogarId,
        receta,
        '2026-11-01',
        '2026-11-02',
        '2026-11-07',
      );
      const res = await aprobar(token, segunda).expect(200);

      const items = await itemsDe(token, res.body.lista.id);
      expect(items.has('Arroz')).toBe(true);
      expect(items.has('Aceite')).toBe(false);
      expect((await despensaDe(hogarId, 'Arroz')).ultimaInclusionSemana).toBe('2026-11-01');
      expect((await despensaDe(hogarId, 'Aceite')).ultimaInclusionSemana).toBe(SEMANA);
    });

    it('un producto dado de baja no entra y sin despensa la lista queda como antes', async () => {
      const { token, hogarId } = await hogarDe('Rene');
      const id = await sembrarDespensa(hogarId, 'Arroz', '2.000', 'SEMANAL', null);
      await http().delete(`${API}/despensa/${id}`).set(con(token)).expect(204);
      const m = await crearBorrador(hogarId, await pollo(hogarId));

      const res = await aprobar(token, m).expect(200);

      expect(res.body.lista).toMatchObject({ totalItems: 1, itemsMenu: 1, itemsDespensa: 0 });
      expect((await despensaDe(hogarId, 'Arroz')).ultimaInclusionSemana).toBeNull();
    });

    it('la despensa de otro hogar no entra en mi lista', async () => {
      const yo = await hogarDe('Rene');
      const otro = await hogarDe('Ana');
      await sembrarDespensa(otro.hogarId, 'Arroz', '2.000', 'SEMANAL', null);
      const m = await crearBorrador(yo.hogarId, await pollo(yo.hogarId));
      const res = await aprobar(yo.token, m).expect(200);
      expect(res.body.lista).toMatchObject({ totalItems: 1, itemsDespensa: 0 });
      expect((await despensaDe(otro.hogarId, 'Arroz')).ultimaInclusionSemana).toBeNull();
    });
  });
});
