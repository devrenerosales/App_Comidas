/**
 * HU-13 Catálogo de productos, HU-11 Gestionar platillos y HU-12 Ingredientes por porciones base
 * — integración contra PostgreSQL real (TEST_DATABASE_URL). Cubre CA-13.1..4, CA-11.1..4,
 * CA-12.1..5 (docs/03-pruebas/features/HU-11..13.feature), la búsqueda pg_trgm sin tildes y la
 * suite de aislamiento RNF-06 (otro hogar no ve ni modifica platillos ajenos).
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PRODUCTOS_SEMILLA, comensal, eq, producto, usuario, type Db } from '@menu/db';
import { normalizarNombreCatalogo } from '@menu/shared';
import { crearAppConBd, describeConBd, usarBaseDePruebas } from './utils/base-datos';

const API = '/api/v1';

describeConBd('HU-11, HU-12 y HU-13 Catálogo (integración)', () => {
  const bd = usarBaseDePruebas({ suite: 'catalogo', sembrar: true, truncarEntrePruebas: true });
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const con = (token: string) => ({ Authorization: `Bearer ${token}` });
  let n = 0;

  /** Registra a una persona con su propio hogar y devuelve el token con hogar. */
  const hogarDe = async (nombre: string): Promise<string> => {
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
    return hogar.body.accessToken as string;
  };

  const adminSistema = async (db: Db, correoParcial: string) => {
    const filas = await db.select().from(usuario);
    const u = filas.find((f) => f.correo.startsWith(correoParcial));
    await db.update(usuario).set({ esAdminSistema: true }).where(eq(usuario.id, u!.id));
  };

  const unidades = async (token: string): Promise<Record<string, string>> => {
    const res = await http().get(`${API}/unidades`).set(con(token)).expect(200);
    return Object.fromEntries(
      (res.body as { codigo: string; id: string }[]).map((u) => [u.codigo, u.id]),
    );
  };

  const categorias = async (token: string): Promise<Record<string, string>> => {
    const res = await http().get(`${API}/categorias`).set(con(token)).expect(200);
    return Object.fromEntries(
      (res.body as { codigo: string; id: string }[]).map((c) => [c.codigo, c.id]),
    );
  };

  const productoPorNombre = async (token: string, nombre: string) => {
    const res = await http()
      .get(`${API}/productos`)
      .query({ q: nombre, activo: 'todos' })
      .set(con(token))
      .expect(200);
    const p = (res.body.datos as { nombre: string; id: string }[]).find((d) => d.nombre === nombre);
    if (!p) throw new Error(`No está ${nombre}`);
    return p;
  };

  const crearPlatillo = (token: string, cuerpo: Record<string, unknown>) =>
    http().post(`${API}/platillos`).set(con(token)).send(cuerpo);

  const platilloBasico = async (token: string, nombre: string) =>
    (
      await crearPlatillo(token, {
        nombre,
        tiempos: ['ALMUERZO'],
        proteinaPrincipal: 'POLLO',
      }).expect(201)
    ).body.id as string;

  const comensales = async (token: string, factores: string[]) => {
    const hogar = await http().get(`${API}/hogar`).set(con(token)).expect(200);
    await bd.db.insert(comensal).values(
      factores.map((f, i) => ({
        hogarId: hogar.body.id as string,
        nombre: `Comensal ${i}`,
        nombreNormalizado: `comensal ${i}`,
        tipo: 'ADULTO' as const,
        factorPorcion: f,
      })),
    );
  };

  /** "Pollo en crema" con Pechuga 2 lb y Crema 250 ml para 4 porciones base. */
  const polloEnCrema = async (token: string) => {
    const u = await unidades(token);
    const pechuga = await productoPorNombre(token, 'Pechuga de pollo');
    const crema = await productoPorNombre(token, 'Crema');
    const id = await platilloBasico(token, 'Pollo en crema');
    const res = await http()
      .put(`${API}/platillos/${id}/ingredientes`)
      .set(con(token))
      .send({
        porcionesBase: 4,
        ingredientes: [
          { productoId: pechuga.id, cantidad: 2, unidadId: u.lb },
          { productoId: crema.id, cantidad: '250', unidadId: u.ml },
        ],
      });
    return { id, res, pechuga, crema, u };
  };

  beforeAll(async () => {
    app = await crearAppConBd(bd.base);
  });

  afterAll(async () => {
    await app?.close();
  });

  // ---------------------------------------------------------------------------
  // HU-13 Catálogo de productos
  // ---------------------------------------------------------------------------

  describe('HU-13 Catálogo de productos', () => {
    it('la semilla carga los productos básicos con nombre normalizado igual al de @menu/shared', async () => {
      const filas = await bd.db.select().from(producto);
      expect(filas).toHaveLength(PRODUCTOS_SEMILLA.length);
      for (const f of filas) expect(f.nombreNormalizado).toBe(normalizarNombreCatalogo(f.nombre));
    });

    it('CA-13.1 crear "Arroz" despensa, granos, bolsa 2 lb: aparece al filtrar por despensa como "Arroz · bolsa 2 lb"', async () => {
      const token = await hogarDe('Rene');
      const [u, c] = [await unidades(token), await categorias(token)];
      const res = await http()
        .post(`${API}/productos`)
        .set(con(token))
        .send({
          nombre: ' Arroz ',
          tipo: 'DESPENSA',
          categoriaId: c.granos,
          unidadCompra: 'bolsa',
          presentacionCantidad: 2,
          presentacionUnidadId: u.lb,
        })
        .expect(201);
      expect(res.body).toMatchObject({
        nombre: 'Arroz',
        tipo: 'DESPENSA',
        categoria: { codigo: 'granos' },
        presentacion: { cantidad: '2.000', unidad: { codigo: 'lb', magnitud: 'MASA' } },
        etiqueta: 'Arroz · bolsa 2 lb',
        activo: true,
      });
      const lista = await http()
        .get(`${API}/productos`)
        .query({ tipo: 'DESPENSA', q: 'arroz' })
        .set(con(token))
        .expect(200);
      const etiquetas = (lista.body.datos as { etiqueta: string }[]).map((d) => d.etiqueta);
      expect(etiquetas).toContain('Arroz · bolsa 2 lb');
      // Los de tipo INGREDIENTE no aparecen al filtrar por despensa.
      const despensa = await http()
        .get(`${API}/productos`)
        .query({ tipo: 'DESPENSA', tamano: 100 })
        .set(con(token))
        .expect(200);
      expect(
        (despensa.body.datos as { tipo: string }[]).every((d) => d.tipo !== 'INGREDIENTE'),
      ).toBe(true);
      expect(despensa.body.paginacion).toMatchObject({ pagina: 1, tamano: 100 });
    });

    it('CA-13.2 inactivar "Crema" usada en "Pollo en crema": sale del buscador y el platillo advierte "Ingrediente inactivo: Crema"', async () => {
      const token = await hogarDe('Rene');
      const { id, crema } = await polloEnCrema(token);
      // Un miembro sin la marca de administrador del sistema no puede (D-05).
      await http()
        .post(`${API}/productos/${crema.id}/inactivar`)
        .set(con(token))
        .expect(403)
        .expect((r) => expect(r.body.codigo).toBe('SOLO_ADMIN_SISTEMA'));
      await adminSistema(bd.db, 'rene');
      const res = await http()
        .post(`${API}/productos/${crema.id}/inactivar`)
        .set(con(token))
        .expect(200);
      expect(res.body.producto.activo).toBe(false);
      expect(res.body.platillosAfectados).toEqual([{ id, nombre: 'Pollo en crema' }]);

      const buscador = await http()
        .get(`${API}/productos`)
        .query({ q: 'crema' })
        .set(con(token))
        .expect(200);
      expect((buscador.body.datos as { nombre: string }[]).map((d) => d.nombre)).not.toContain(
        'Crema',
      );

      const detalle = await http().get(`${API}/platillos/${id}`).set(con(token)).expect(200);
      expect(detalle.body.advertencias).toEqual([
        {
          codigo: 'INGREDIENTE_INACTIVO',
          mensaje: 'Ingrediente inactivo: Crema',
          productoId: crema.id,
        },
      ]);
      expect(detalle.body.ingredientes).toHaveLength(2);
      const lista = await http().get(`${API}/platillos`).set(con(token)).expect(200);
      expect(lista.body.datos[0].ingredientesInactivos).toBe(1);

      // Volver a guardar los ingredientes con la crema inactiva sí se permite (ya estaba).
      const ingredientes = (
        detalle.body.ingredientes as {
          producto: { id: string };
          cantidad: string;
          unidad: { id: string };
        }[]
      ).map((i) => ({ productoId: i.producto.id, cantidad: i.cantidad, unidadId: i.unidad.id }));
      await http()
        .put(`${API}/platillos/${id}/ingredientes`)
        .set(con(token))
        .send({ porcionesBase: 4, ingredientes })
        .expect(200);

      const reactivado = await http()
        .post(`${API}/productos/${crema.id}/reactivar`)
        .set(con(token))
        .expect(200);
      expect(reactivado.body.producto.activo).toBe(true);
    });

    it('CA-13.3 "aceite" botella 900 ml duplicado: no guarda y ofrece abrir "Aceite · botella 900 ml"', async () => {
      const token = await hogarDe('Rene');
      const [u, c] = [await unidades(token), await categorias(token)];
      const aceite = await productoPorNombre(token, 'Aceite');
      const res = await http()
        .post(`${API}/productos`)
        .set(con(token))
        .send({
          nombre: 'aceite',
          tipo: 'AMBOS',
          categoriaId: c.abarrotes,
          unidadCompra: 'botella',
          presentacionCantidad: '900',
          presentacionUnidadId: u.ml,
        })
        .expect(409);
      expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
      expect(res.body).toMatchObject({
        codigo: 'PRODUCTO_DUPLICADO',
        detail: 'Ya existe Aceite · botella 900 ml',
        existenteId: aceite.id,
        existente: 'Aceite · botella 900 ml',
      });
    });

    it('CA-13.4 "Frijol negro" con presentación 0 lb: "La presentación debe ser mayor que 0"', async () => {
      const token = await hogarDe('Rene');
      const [u, c] = [await unidades(token), await categorias(token)];
      const res = await http()
        .post(`${API}/productos`)
        .set(con(token))
        .send({
          nombre: 'Frijol negro',
          tipo: 'AMBOS',
          categoriaId: c.granos,
          unidadCompra: 'bolsa',
          presentacionCantidad: 0,
          presentacionUnidadId: u.lb,
        })
        .expect(422);
      expect(res.body).toMatchObject({
        codigo: 'PRESENTACION_INVALIDA',
        detail: 'La presentación debe ser mayor que 0',
        errores: [
          { campo: 'presentacionCantidad', mensaje: 'La presentación debe ser mayor que 0' },
        ],
      });
    });

    it('búsqueda pg_trgm sin tildes ni mayúsculas y con errores de escritura', async () => {
      const token = await hogarDe('Rene');
      const buscar = async (q: string) =>
        (
          (await http().get(`${API}/productos`).query({ q }).set(con(token)).expect(200)).body
            .datos as {
            nombre: string;
          }[]
        ).map((d) => d.nombre);
      expect(await buscar('GUISQUIL')).toContain('Güisquil');
      expect(await buscar('pollo')).toEqual(
        expect.arrayContaining(['Pechuga de pollo', 'Pollo entero']),
      );
      expect(await buscar('pechga')).toContain('Pechuga de pollo');
      expect(await buscar('100%_x')).toEqual([]);
      const carnes = await http()
        .get(`${API}/productos`)
        .query({ categoria: 'carnes' })
        .set(con(token))
        .expect(200);
      expect(
        (carnes.body.datos as { categoria: { codigo: string } }[]).every(
          (d) => d.categoria.codigo === 'carnes',
        ),
      ).toBe(true);
    });

    it('editar producto: solo administrador del sistema; magnitud en uso y validaciones', async () => {
      const token = await hogarDe('Rene');
      const { pechuga, u } = await polloEnCrema(token);
      await http()
        .patch(`${API}/productos/${pechuga.id}`)
        .set(con(token))
        .send({ nombre: 'X' })
        .expect(403);
      await adminSistema(bd.db, 'rene');
      const editado = await http()
        .patch(`${API}/productos/${pechuga.id}`)
        .set(con(token))
        .send({ unidadCompra: 'bandeja', presentacionCantidad: '2' })
        .expect(200);
      expect(editado.body.etiqueta).toBe('Pechuga de pollo · bandeja 2 lb');
      await http()
        .patch(`${API}/productos/${pechuga.id}`)
        .set(con(token))
        .send({ presentacionUnidadId: u.ml })
        .expect(422)
        .expect((r) => expect(r.body.codigo).toBe('MAGNITUD_EN_USO'));
      await http()
        .patch(`${API}/productos/${pechuga.id}`)
        .set(con(token))
        .send({ presentacionUnidadId: u.kg, presentacionCantidad: '1' })
        .expect(200);
      const aceite = await productoPorNombre(token, 'Aceite');
      await http()
        .patch(`${API}/productos/${pechuga.id}`)
        .set(con(token))
        .send({ nombre: 'Aceite', presentacionCantidad: '900', presentacionUnidadId: u.ml })
        .expect(422);
      await http()
        .patch(`${API}/productos/${aceite.id}`)
        .set(con(token))
        .send({ nombre: 'aceite ', unidadCompra: 'garrafa' })
        .expect(200);
      await http()
        .get(`${API}/productos/00000000-0000-4000-8000-000000000000`)
        .set(con(token))
        .expect(404);
      await http().get(`${API}/productos/no-es-uuid`).set(con(token)).expect(404);
      await http()
        .post(`${API}/productos/00000000-0000-4000-8000-000000000000/inactivar`)
        .set(con(token))
        .expect(404);
      await http()
        .patch(`${API}/productos/00000000-0000-4000-8000-000000000000`)
        .set(con(token))
        .send({})
        .expect(404);
    });

    it('validaciones al crear producto: nombre, unidad de compra, categoría y unidad', async () => {
      const token = await hogarDe('Rene');
      const [u, c] = [await unidades(token), await categorias(token)];
      const base = {
        nombre: 'Miltomate',
        tipo: 'INGREDIENTE',
        categoriaId: c.verduras,
        unidadCompra: 'lb',
        presentacionCantidad: '1',
        presentacionUnidadId: u.lb,
      };
      const codigo = async (cuerpo: Record<string, unknown>, status = 422) =>
        (
          await http()
            .post(`${API}/productos`)
            .set(con(token))
            .send({ ...base, ...cuerpo })
            .expect(status)
        ).body.codigo;
      expect(await codigo({ nombre: '   ' })).toBe('NOMBRE_OBLIGATORIO');
      expect(await codigo({ nombre: 'x'.repeat(81) })).toBe('NOMBRE_LARGO');
      expect(await codigo({ unidadCompra: ' ' })).toBe('UNIDAD_COMPRA_INVALIDA');
      expect(await codigo({ presentacionCantidad: '1.0005' })).toBe('PRESENTACION_INVALIDA');
      expect(await codigo({ categoriaId: '00000000-0000-4000-8000-000000000000' })).toBe(
        'CATEGORIA_NO_EXISTE',
      );
      expect(await codigo({ presentacionUnidadId: '00000000-0000-4000-8000-000000000000' })).toBe(
        'UNIDAD_NO_EXISTE',
      );
      expect(await codigo({ presentacionCantidad: 'mucho' }, 400)).toBe('VALIDACION');
      expect(await codigo({ tipo: 'OTRO' }, 400)).toBe('VALIDACION');
    });

    it('sin hogar no se accede al catálogo (403 SIN_HOGAR)', async () => {
      const registro = await http()
        .post(`${API}/auth/registro`)
        .send({ nombre: 'Solo', correo: 'solo@correo.com', contrasena: 'Almuerzo2026' })
        .expect(201);
      await http().get(`${API}/productos`).set(con(registro.body.accessToken)).expect(403);
      await http().get(`${API}/platillos`).expect(401);
    });
  });

  // ---------------------------------------------------------------------------
  // HU-11 Gestionar platillos
  // ---------------------------------------------------------------------------

  describe('HU-11 Gestionar platillos', () => {
    it('CA-11.1 crear "Pepián de pollo" para Almuerzo, pollo, "típico, fin de semana": aparece en activos y al filtrar por pollo', async () => {
      const token = await hogarDe('Rene');
      const res = await crearPlatillo(token, {
        nombre: '  Pepián  de pollo ',
        tiempos: ['ALMUERZO'],
        proteinaPrincipal: 'POLLO',
        etiquetas: ['típico', ' fin de semana ', 'Típico'],
      }).expect(201);
      expect(res.body).toMatchObject({
        nombre: 'Pepián de pollo',
        tiempos: ['ALMUERZO'],
        proteinaPrincipal: 'POLLO',
        etiquetas: ['fin de semana', 'típico'],
        porcionesBase: 4,
        incompleto: true,
        activo: true,
        ingredientes: [],
        advertencias: [],
      });
      await platilloBasico(token, 'Caldo de res');
      await crearPlatillo(token, {
        nombre: 'Huevos rancheros',
        tiempos: ['DESAYUNO', 'CENA'],
        proteinaPrincipal: 'HUEVO',
      }).expect(201);

      const activos = await http().get(`${API}/platillos`).set(con(token)).expect(200);
      expect((activos.body.datos as { nombre: string }[]).map((d) => d.nombre)).toEqual([
        'Caldo de res',
        'Huevos rancheros',
        'Pepián de pollo',
      ]);
      const pollo = await http()
        .get(`${API}/platillos`)
        .query({ proteina: 'POLLO' })
        .set(con(token))
        .expect(200);
      expect((pollo.body.datos as { nombre: string }[]).map((d) => d.nombre)).toEqual([
        'Caldo de res',
        'Pepián de pollo',
      ]);
      const cena = await http()
        .get(`${API}/platillos`)
        .query({ tiempo: 'CENA' })
        .set(con(token))
        .expect(200);
      expect(cena.body.datos[0]).toMatchObject({
        nombre: 'Huevos rancheros',
        tiempos: ['DESAYUNO', 'CENA'],
      });
      const tipico = await http()
        .get(`${API}/platillos`)
        .query({ etiqueta: 'TIPICO' })
        .set(con(token))
        .expect(200);
      expect(tipico.body.paginacion.total).toBe(1);
      const busqueda = await http()
        .get(`${API}/platillos`)
        .query({ q: 'pepian' })
        .set(con(token))
        .expect(200);
      expect(busqueda.body.datos[0].nombre).toBe('Pepián de pollo');
      const sin = await http()
        .get(`${API}/platillos`)
        .query({ q: 'tamales' })
        .set(con(token))
        .expect(200);
      expect(sin.body).toEqual({
        datos: [],
        paginacion: { pagina: 1, tamano: 20, total: 0, totalPaginas: 0 },
      });
    });

    it('CA-11.2 inactivar "Pescado frito": sale de activos y aparece con el filtro Inactivos; se puede reactivar', async () => {
      const token = await hogarDe('Rene');
      const id = await platilloBasico(token, 'Pescado frito');
      const res = await http().post(`${API}/platillos/${id}/inactivar`).set(con(token)).expect(200);
      expect(res.body.activo).toBe(false);
      const activos = await http().get(`${API}/platillos`).set(con(token)).expect(200);
      expect(activos.body.datos).toEqual([]);
      const inactivos = await http()
        .get(`${API}/platillos`)
        .query({ estado: 'INACTIVO' })
        .set(con(token))
        .expect(200);
      expect(inactivos.body.datos.map((d: { nombre: string }) => d.nombre)).toEqual([
        'Pescado frito',
      ]);
      await http().post(`${API}/platillos/${id}/reactivar`).set(con(token)).expect(200);
      const otraVez = await http().get(`${API}/platillos`).set(con(token)).expect(200);
      expect(otraVez.body.datos).toHaveLength(1);
    });

    it('CA-11.3 "carne GUISADA" duplicado de "Carne guisada": 409 "Ya existe el platillo Carne guisada" con el id para abrirlo', async () => {
      const token = await hogarDe('Rene');
      const id = await platilloBasico(token, 'Carne guisada');
      const res = await crearPlatillo(token, {
        nombre: 'carne GUISADA',
        tiempos: ['ALMUERZO'],
      }).expect(409);
      expect(res.body).toMatchObject({
        codigo: 'PLATILLO_DUPLICADO',
        detail: 'Ya existe el platillo Carne guisada',
        existenteId: id,
        existenteNombre: 'Carne guisada',
      });
      // También sin distinguir tildes y al renombrar otro platillo.
      await crearPlatillo(token, { nombre: 'Cárne guisáda', tiempos: ['ALMUERZO'] }).expect(409);
      const otro = await platilloBasico(token, 'Chile relleno');
      await http()
        .patch(`${API}/platillos/${otro}`)
        .set(con(token))
        .send({ nombre: 'CARNE guisada' })
        .expect(409);
    });

    it('CA-11.4 "Chile relleno" sin tiempo de comida: "Selecciona al menos un tiempo de comida"', async () => {
      const token = await hogarDe('Rene');
      for (const cuerpo of [
        { nombre: 'Chile relleno', tiempos: [] },
        { nombre: 'Chile relleno' },
      ]) {
        const res = await crearPlatillo(token, cuerpo).expect(422);
        expect(res.body).toMatchObject({
          codigo: 'SIN_TIEMPO',
          detail: 'Selecciona al menos un tiempo de comida',
          errores: [{ campo: 'tiempos', mensaje: 'Selecciona al menos un tiempo de comida' }],
        });
      }
      const lista = await http().get(`${API}/platillos`).set(con(token)).expect(200);
      expect(lista.body.datos).toEqual([]);
    });

    it('CU-03.1 E1 y límites: nombre vacío o largo, máximo 10 etiquetas, proteína de la lista', async () => {
      const token = await hogarDe('Rene');
      const codigo = async (cuerpo: Record<string, unknown>, status = 422) =>
        (await crearPlatillo(token, { tiempos: ['ALMUERZO'], ...cuerpo }).expect(status)).body
          .codigo;
      expect(await codigo({ nombre: '  ' })).toBe('NOMBRE_OBLIGATORIO');
      expect(await codigo({})).toBe('NOMBRE_OBLIGATORIO');
      expect(await codigo({ nombre: 'x'.repeat(81) })).toBe('NOMBRE_LARGO');
      expect(
        await codigo({ nombre: 'Tacos', etiquetas: Array.from({ length: 11 }, (_, i) => `e${i}`) }),
      ).toBe('MAX_ETIQUETAS');
      expect(await codigo({ nombre: 'Tacos', etiquetas: ['x'.repeat(31)] })).toBe('ETIQUETA_LARGA');
      expect(await codigo({ nombre: 'Tacos', proteinaPrincipal: 'TOFU' }, 400)).toBe('VALIDACION');
      expect(await codigo({ nombre: 'Tacos', tiempos: ['MERIENDA'] }, 400)).toBe('VALIDACION');
    });

    it('editar platillo: tiempos, proteína, etiquetas y favorito; INCOMPLETO filtra los sin ingredientes', async () => {
      const token = await hogarDe('Rene');
      const id = await platilloBasico(token, 'Tortitas de carne');
      const res = await http()
        .patch(`${API}/platillos/${id}`)
        .set(con(token))
        .send({
          nombre: 'Tortitas de carne',
          tiempos: ['CENA', 'ALMUERZO'],
          proteinaPrincipal: 'RES',
          etiquetas: ['rápido'],
          favorito: true,
        })
        .expect(200);
      expect(res.body).toMatchObject({
        tiempos: ['ALMUERZO', 'CENA'],
        proteinaPrincipal: 'RES',
        etiquetas: ['rápido'],
        favorito: true,
      });
      await http()
        .patch(`${API}/platillos/${id}`)
        .set(con(token))
        .send({ tiempos: [] })
        .expect(422);
      await http().patch(`${API}/platillos/${id}`).set(con(token)).send({}).expect(200);
      const incompletos = await http()
        .get(`${API}/platillos`)
        .query({ estado: 'INCOMPLETO' })
        .set(con(token))
        .expect(200);
      expect(incompletos.body.datos.map((d: { id: string }) => d.id)).toEqual([id]);
      await http().get(`${API}/platillos`).query({ estado: 'OTRO' }).set(con(token)).expect(400);
      await http().get(`${API}/platillos`).query({ tamano: 500 }).set(con(token)).expect(400);
    });

    it('MIEMBRO (no administrador) también gestiona platillos', async () => {
      const rene = await hogarDe('Rene');
      const enlace = (
        await http()
          .post(`${API}/hogar/invitaciones`)
          .set(con(rene))
          .send({ medio: 'ENLACE' })
          .expect(201)
      ).body.enlace as string;
      const ana = (
        await http()
          .post(`${API}/auth/registro`)
          .send({ nombre: 'Ana', correo: 'ana@correo.com', contrasena: 'Pepian2026' })
          .expect(201)
      ).body.accessToken;
      const miembro = (
        await http()
          .post(`${API}/invitaciones/${enlace.split('/invitacion/')[1]}/aceptar`)
          .set(con(ana))
          .expect(200)
      ).body.accessToken;
      const id = await platilloBasico(miembro, 'Pollo guisado');
      await http().post(`${API}/platillos/${id}/inactivar`).set(con(miembro)).expect(200);
      const deRene = await http()
        .get(`${API}/platillos`)
        .query({ estado: 'INACTIVO' })
        .set(con(rene))
        .expect(200);
      expect(deRene.body.datos[0].nombre).toBe('Pollo guisado');
    });
  });

  // ---------------------------------------------------------------------------
  // HU-12 Ingredientes por porciones base
  // ---------------------------------------------------------------------------

  describe('HU-12 Ingredientes por porciones base', () => {
    it('CA-12.1 6 comensales con factor 1.0: "Pechuga de pollo" 2 lb → 3 lb y "Crema" 250 ml → 375 ml', async () => {
      const token = await hogarDe('Rene');
      await comensales(token, ['1.00', '1.00', '1.00', '1.00', '1.00', '1.00']);
      const { res, id } = await polloEnCrema(token);
      expect(res.status).toBe(200);
      expect(res.body.incompleto).toBe(false);
      expect(res.body.ingredientes).toHaveLength(2);
      expect(res.body.ingredientes[0]).toMatchObject({
        producto: { nombre: 'Pechuga de pollo', presentacionUnidad: { codigo: 'lb' } },
        cantidad: '2.000',
        unidad: { codigo: 'lb' },
      });
      expect(res.body.vistaPrevia).toEqual({
        porcionesBase: 4,
        sumaFactores: '6.00',
        origen: 'COMENSALES',
        ingredientes: [
          expect.objectContaining({
            nombre: 'Pechuga de pollo',
            cantidadBase: '2.000',
            cantidadEscalada: '3.000',
            unidad: 'lb',
          }),
          expect.objectContaining({
            nombre: 'Crema',
            cantidadBase: '250.000',
            cantidadEscalada: '375.000',
            unidad: 'ml',
          }),
        ],
      });
      const lista = await http()
        .get(`${API}/platillos`)
        .query({ estado: 'INCOMPLETO' })
        .set(con(token))
        .expect(200);
      expect(lista.body.datos).toEqual([]);
      // Quitar todos los ingredientes deja el platillo "Incompleto".
      const vacio = await http()
        .put(`${API}/platillos/${id}/ingredientes`)
        .set(con(token))
        .send({ porcionesBase: 6, ingredientes: [] })
        .expect(200);
      expect(vacio.body).toMatchObject({ incompleto: true, porcionesBase: 6, ingredientes: [] });
    });

    it('CA-12.2 crear "Miltomate" desde el buscador (lb, 1 lb) y agregarlo a "Pepián de pollo" con 1 lb', async () => {
      const token = await hogarDe('Rene');
      const [u, c] = [await unidades(token), await categorias(token)];
      const antes = await http()
        .get(`${API}/productos`)
        .query({ q: 'miltomate' })
        .set(con(token))
        .expect(200);
      expect((antes.body.datos as { nombre: string }[]).map((d) => d.nombre)).not.toContain(
        'Miltomate',
      );
      const miltomate = await http()
        .post(`${API}/productos`)
        .set(con(token))
        .send({
          nombre: 'Miltomate',
          tipo: 'INGREDIENTE',
          categoriaId: c.verduras,
          unidadCompra: 'lb',
          presentacionCantidad: '1',
          presentacionUnidadId: u.lb,
        })
        .expect(201);
      const id = await platilloBasico(token, 'Pepián de pollo');
      const res = await http()
        .put(`${API}/platillos/${id}/ingredientes`)
        .set(con(token))
        .send({
          porcionesBase: 4,
          ingredientes: [{ productoId: miltomate.body.id, cantidad: '1', unidadId: u.lb }],
        })
        .expect(200);
      expect(
        res.body.ingredientes.map((i: { producto: { nombre: string } }) => i.producto.nombre),
      ).toEqual(['Miltomate']);
      // Sin comensales activos la vista previa queda en las porciones base.
      expect(res.body.vistaPrevia).toMatchObject({
        sumaFactores: '4.00',
        origen: 'PORCIONES_BASE',
      });
      const conIngrediente = await http()
        .get(`${API}/platillos`)
        .query({ ingrediente: miltomate.body.id })
        .set(con(token))
        .expect(200);
      expect(conIngrediente.body.datos[0].nombre).toBe('Pepián de pollo');
    });

    it('CA-12.3 "Carne de res para guisar" (lb) con 500 ml: "La unidad ml no es compatible con lb"', async () => {
      const token = await hogarDe('Rene');
      const u = await unidades(token);
      const carne = await productoPorNombre(token, 'Carne de res para guisar');
      const id = await platilloBasico(token, 'Carne guisada');
      const res = await http()
        .put(`${API}/platillos/${id}/ingredientes`)
        .set(con(token))
        .send({
          porcionesBase: 4,
          ingredientes: [{ productoId: carne.id, cantidad: '500', unidadId: u.ml }],
        })
        .expect(422);
      expect(res.body).toMatchObject({
        codigo: 'UNIDAD_INCOMPATIBLE',
        detail: 'La unidad ml no es compatible con lb',
        errores: [
          { campo: 'ingredientes.0.unidadId', mensaje: 'La unidad ml no es compatible con lb' },
        ],
      });
      const detalle = await http().get(`${API}/platillos/${id}`).set(con(token)).expect(200);
      expect(detalle.body.ingredientes).toEqual([]);
      // Misma magnitud (g para un producto en lb) sí se acepta.
      await http()
        .put(`${API}/platillos/${id}/ingredientes`)
        .set(con(token))
        .send({
          porcionesBase: 4,
          ingredientes: [{ productoId: carne.id, cantidad: '500', unidadId: u.g }],
        })
        .expect(200);
    });

    it('CA-12.4 "Arroz" con cantidad 0 en "Tortitas de carne": "La cantidad debe ser mayor que 0"', async () => {
      const token = await hogarDe('Rene');
      const u = await unidades(token);
      const arroz = await productoPorNombre(token, 'Arroz');
      const id = await platilloBasico(token, 'Tortitas de carne');
      const res = await http()
        .put(`${API}/platillos/${id}/ingredientes`)
        .set(con(token))
        .send({
          porcionesBase: 4,
          ingredientes: [{ productoId: arroz.id, cantidad: 0, unidadId: u.lb }],
        })
        .expect(422);
      expect(res.body).toMatchObject({
        codigo: 'CANTIDAD_INVALIDA',
        detail: 'La cantidad debe ser mayor que 0',
        errores: [
          { campo: 'ingredientes.0.cantidad', mensaje: 'La cantidad debe ser mayor que 0' },
        ],
      });
      const negativa = await http()
        .put(`${API}/platillos/${id}/ingredientes`)
        .set(con(token))
        .send({
          porcionesBase: 4,
          ingredientes: [{ productoId: arroz.id, cantidad: '-1', unidadId: u.lb }],
        })
        .expect(422);
      expect(negativa.body.codigo).toBe('CANTIDAD_INVALIDA');
    });

    it('CA-12.5 Σ factores 1.0 + 1.0 + 0.5 = 2.5: "Pechuga de pollo" 1.25 lb y "Crema" 156.25 ml', async () => {
      const token = await hogarDe('Rene');
      await comensales(token, ['1.00', '1.00', '0.50']);
      const { id } = await polloEnCrema(token);
      const res = await http()
        .get(`${API}/platillos/${id}/vista-previa`)
        .set(con(token))
        .expect(200);
      expect(res.body).toMatchObject({
        porcionesBase: 4,
        sumaFactores: '2.50',
        origen: 'COMENSALES',
        ingredientes: [
          { nombre: 'Pechuga de pollo', cantidadEscalada: '1.250', unidad: 'lb' },
          { nombre: 'Crema', cantidadEscalada: '156.250', unidad: 'ml' },
        ],
      });
      // Con sumaFactores como parámetro (vista previa del editor).
      const param = await http()
        .get(`${API}/platillos/${id}/vista-previa`)
        .query({ sumaFactores: 8 })
        .set(con(token))
        .expect(200);
      expect(param.body).toMatchObject({ sumaFactores: '8.00', origen: 'PARAMETRO' });
      expect(param.body.ingredientes[0].cantidadEscalada).toBe('4.000');
      await http()
        .get(`${API}/platillos/${id}/vista-previa`)
        .query({ sumaFactores: 0 })
        .set(con(token))
        .expect(400);
    });

    it('CU-03.2 E3 y validaciones: producto repetido, inactivo, inexistente, porciones fuera de 1–20', async () => {
      const token = await hogarDe('Rene');
      const { id, pechuga, crema, u } = await polloEnCrema(token);
      const put = (cuerpo: Record<string, unknown>) =>
        http().put(`${API}/platillos/${id}/ingredientes`).set(con(token)).send(cuerpo);
      const repetido = await put({
        porcionesBase: 4,
        ingredientes: [
          { productoId: pechuga.id, cantidad: '1', unidadId: u.lb },
          { productoId: pechuga.id, cantidad: '1', unidadId: u.lb },
        ],
      }).expect(422);
      expect(repetido.body).toMatchObject({
        codigo: 'PRODUCTO_REPETIDO',
        errores: [{ campo: 'ingredientes.1.productoId' }],
      });
      expect((await put({ porcionesBase: 0, ingredientes: [] }).expect(422)).body.codigo).toBe(
        'PORCIONES_INVALIDAS',
      );
      expect((await put({ porcionesBase: 21, ingredientes: [] }).expect(422)).body.codigo).toBe(
        'PORCIONES_INVALIDAS',
      );
      expect((await put({ porcionesBase: 2.5, ingredientes: [] }).expect(422)).body.codigo).toBe(
        'PORCIONES_INVALIDAS',
      );
      expect(
        (
          await put({
            porcionesBase: 4,
            ingredientes: [
              { productoId: '00000000-0000-4000-8000-000000000000', cantidad: '1', unidadId: u.lb },
            ],
          }).expect(422)
        ).body.codigo,
      ).toBe('PRODUCTO_NO_EXISTE');
      expect(
        (
          await put({
            porcionesBase: 4,
            ingredientes: [
              {
                productoId: pechuga.id,
                cantidad: '1',
                unidadId: '00000000-0000-4000-8000-000000000000',
              },
            ],
          }).expect(422)
        ).body.codigo,
      ).toBe('UNIDAD_NO_EXISTE');
      await put({
        porcionesBase: 4,
        ingredientes: [{ productoId: 'x', cantidad: '1', unidadId: u.lb }],
      }).expect(400);
      // Un producto inactivo que no estaba en el platillo no se puede agregar.
      const queso = await productoPorNombre(token, 'Queso fresco');
      await bd.db.update(producto).set({ activo: false }).where(eq(producto.id, queso.id));
      const inactivo = await put({
        porcionesBase: 4,
        ingredientes: [
          { productoId: queso.id, cantidad: '1', unidadId: u.lb },
          { productoId: crema.id, cantidad: '1', unidadId: u.taza },
        ],
      }).expect(422);
      expect(inactivo.body.codigo).toBe('PRODUCTO_INACTIVO');
      // Una taza de crema (volumen) sí es compatible con un producto en ml.
      await put({
        porcionesBase: 4,
        ingredientes: [{ productoId: crema.id, cantidad: '1', unidadId: u.taza }],
      }).expect(200);
    });
  });

  // ---------------------------------------------------------------------------
  // RNF-06 Aislamiento entre hogares
  // ---------------------------------------------------------------------------

  describe('RNF-06 otro hogar no ve ni modifica platillos ajenos', () => {
    it('RNF-06 los platillos de "Familia Rene" no existen para "Familia Luis" (404) y no aparecen en su lista', async () => {
      const rene = await hogarDe('Rene');
      const luis = await hogarDe('Luis');
      const { id, pechuga, u } = await polloEnCrema(rene);
      const lista = await http()
        .get(`${API}/platillos`)
        .query({ estado: 'ACTIVO' })
        .set(con(luis))
        .expect(200);
      expect(lista.body.datos).toEqual([]);
      const ajenas = [
        http().get(`${API}/platillos/${id}`).set(con(luis)),
        http().patch(`${API}/platillos/${id}`).set(con(luis)).send({ nombre: 'Robado' }),
        http().post(`${API}/platillos/${id}/inactivar`).set(con(luis)),
        http().post(`${API}/platillos/${id}/reactivar`).set(con(luis)),
        http().get(`${API}/platillos/${id}/vista-previa`).set(con(luis)),
        http()
          .put(`${API}/platillos/${id}/ingredientes`)
          .set(con(luis))
          .send({
            porcionesBase: 4,
            ingredientes: [{ productoId: pechuga.id, cantidad: '1', unidadId: u.lb }],
          }),
      ];
      for (const r of await Promise.all(ajenas)) {
        expect(r.status).toBe(404);
        expect(r.body.codigo).toBe('NO_ENCONTRADO');
      }
      // Mismo nombre en otro hogar sí se permite (único por hogar).
      await platilloBasico(luis, 'Pollo en crema');
      const deRene = await http().get(`${API}/platillos/${id}`).set(con(rene)).expect(200);
      expect(deRene.body.nombre).toBe('Pollo en crema');
      expect(deRene.body.ingredientes).toHaveLength(2);
      // La lista de afectados al inactivar un producto solo trae platillos del hogar propio.
      await adminSistema(bd.db, 'luis');
      const afectados = await http()
        .post(`${API}/productos/${pechuga.id}/inactivar`)
        .set(con(luis))
        .expect(200);
      expect(afectados.body.platillosAfectados).toEqual([]);
      await http().get(`${API}/platillos/no-es-uuid`).set(con(rene)).expect(404);
    });
  });
});
