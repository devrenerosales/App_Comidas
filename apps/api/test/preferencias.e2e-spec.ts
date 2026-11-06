/**
 * HU-10 Restricciones y gustos del hogar — integración contra PostgreSQL real (TEST_DATABASE_URL).
 * Cubre CA-10.1..4 (docs/03-pruebas/features/HU-10.feature), el filtro que consume el motor, la
 * regla de elementos inactivos (CU-02.6 E1) y el aislamiento por hogar (RNF-06).
 *
 * Con los productos de la semilla: "Pollo en crema" lleva Crema (en ml); "Caldo de res" no lleva
 * ingredientes.
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { eq, platillo } from '@menu/db';
import { PreferenciasRepositorio } from '../src/preferencias/preferencias.repositorio';
import { crearAppConBd, describeConBd, usarBaseDePruebas } from './utils/base-datos';

const API = '/api/v1';

describeConBd('HU-10 Restricciones y gustos (integración)', () => {
  const bd = usarBaseDePruebas({ suite: 'preferencias', sembrar: true, truncarEntrePruebas: true });
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

  const producto = async (token: string, nombre: string): Promise<string> => {
    const res = await http()
      .get(`${API}/productos`)
      .query({ q: nombre, activo: 'todos' })
      .set(con(token))
      .expect(200);
    const p = (res.body.datos as { nombre: string; id: string }[]).find((d) => d.nombre === nombre);
    if (!p) throw new Error(`No está ${nombre}`);
    return p.id;
  };

  const crearPlatillo = async (token: string, nombre: string, productos: string[] = []) => {
    const id = (
      await http()
        .post(`${API}/platillos`)
        .set(con(token))
        .send({ nombre, tiempos: ['ALMUERZO'], proteinaPrincipal: 'POLLO' })
        .expect(201)
    ).body.id as string;
    if (productos.length > 0) {
      const unidades = await http().get(`${API}/unidades`).set(con(token)).expect(200);
      const unidad = (unidades.body as { codigo: string; id: string }[]).find(
        (u) => u.codigo === 'ml',
      )!.id;
      await http()
        .put(`${API}/platillos/${id}/ingredientes`)
        .set(con(token))
        .send({
          porcionesBase: 4,
          ingredientes: productos.map((productoId) => ({
            productoId,
            cantidad: 250,
            unidadId: unidad,
          })),
        })
        .expect(200);
    }
    return id;
  };

  const leer = (token: string) => http().get(`${API}/hogar/preferencias/gustos`).set(con(token));
  const guardar = (token: string, ingredientesExcluidos: string[], favoritos: string[]) =>
    http()
      .put(`${API}/hogar/preferencias/gustos`)
      .set(con(token))
      .send({ ingredientesExcluidos, favoritos });
  const excluidosParaMotor = (hogarId: string) =>
    app.get(PreferenciasRepositorio).platillosExcluidosParaMotor(hogarId);

  beforeAll(async () => {
    app = await crearAppConBd(bd.base);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('sin nada guardado devuelve listas vacías', async () => {
    const { token } = await hogarDe('Rene');
    const res = await leer(token).expect(200);
    expect(res.body).toEqual({
      ingredientesExcluidos: [],
      favoritos: [],
      impacto: { platillosExcluidos: [] },
      advertencias: [],
    });
  });

  it('CA-10.1 excluir un ingrediente muestra los platillos que dejan de sugerirse', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const crema = await producto(token, 'Crema');
    const pollo = await crearPlatillo(token, 'Pollo en crema', [crema]);
    await crearPlatillo(token, 'Caldo de res');

    const res = await guardar(token, [crema], []).expect(200);
    expect(res.body.ingredientesExcluidos).toEqual([{ id: crema, nombre: 'Crema', activo: true }]);
    expect(res.body.impacto.platillosExcluidos).toEqual([
      { id: pollo, nombre: 'Pollo en crema', ingredientes: ['Crema'] },
    ]);
    expect((await leer(token).expect(200)).body.impacto.platillosExcluidos).toHaveLength(1);
    expect([...(await excluidosParaMotor(hogarId))]).toEqual([pollo]);
  });

  it('CA-10.2 marcar favoritos los guarda y quedan marcados en el platillo', async () => {
    const { token } = await hogarDe('Rene');
    const a = await crearPlatillo(token, 'Pepián de pollo');
    const b = await crearPlatillo(token, 'Caldo de res');
    await crearPlatillo(token, 'Tamales');

    const res = await guardar(token, [], [a, b]).expect(200);
    expect(res.body.favoritos.map((f: { nombre: string }) => f.nombre)).toEqual([
      'Caldo de res',
      'Pepián de pollo',
    ]);
    const filas = await bd.db.select().from(platillo).where(eq(platillo.favorito, true));
    expect(filas.map((f) => f.id).sort()).toEqual([a, b].sort());

    // Reemplaza la lista completa: lo que ya no viene deja de ser favorito.
    await guardar(token, [], [a]).expect(200);
    expect((await leer(token).expect(200)).body.favoritos).toHaveLength(1);
  });

  it('CA-10.3 un favorito con ingrediente excluido avisa, se guarda y no se sugiere', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const crema = await producto(token, 'Crema');
    const pollo = await crearPlatillo(token, 'Pollo en crema', [crema]);

    const previa = await http()
      .post(`${API}/hogar/preferencias/gustos/vista-previa`)
      .set(con(token))
      .send({ ingredientesExcluidos: [crema], favoritos: [pollo] })
      .expect(200);
    expect(previa.body.advertencias).toEqual([
      {
        codigo: 'FAVORITO_CON_EXCLUIDO',
        platillo: { id: pollo, nombre: 'Pollo en crema' },
        ingredientes: ['Crema'],
        mensaje: 'Pollo en crema contiene un ingrediente excluido: Crema',
      },
    ]);
    // La vista previa no guarda nada.
    expect((await leer(token).expect(200)).body.favoritos).toEqual([]);

    const res = await guardar(token, [crema], [pollo]).expect(200);
    expect(res.body.advertencias).toHaveLength(1);
    expect(res.body.favoritos).toHaveLength(1);
    expect((await excluidosParaMotor(hogarId)).has(pollo)).toBe(true);
  });

  it('CA-10.4 quitar la exclusión devuelve el platillo al motor', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const crema = await producto(token, 'Crema');
    const pollo = await crearPlatillo(token, 'Pollo en crema', [crema]);
    await guardar(token, [crema], []).expect(200);
    expect((await excluidosParaMotor(hogarId)).has(pollo)).toBe(true);

    const res = await guardar(token, [], []).expect(200);
    expect(res.body.impacto.platillosExcluidos).toEqual([]);
    expect((await excluidosParaMotor(hogarId)).size).toBe(0);
  });

  it('un platillo inactivo no aparece en el impacto de la exclusión', async () => {
    const { token, hogarId } = await hogarDe('Rene');
    const crema = await producto(token, 'Crema');
    const pollo = await crearPlatillo(token, 'Pollo en crema', [crema]);
    await http().post(`${API}/platillos/${pollo}/inactivar`).set(con(token)).expect(200);
    const res = await guardar(token, [crema], []).expect(200);
    expect(res.body.impacto.platillosExcluidos).toEqual([]);
    // El filtro del motor es solo por ingrediente: el motor ya ignora los platillos inactivos.
    expect((await excluidosParaMotor(hogarId)).has(pollo)).toBe(true);
  });

  it('E1 no se puede agregar un platillo o ingrediente inactivo, pero se conserva el ya guardado', async () => {
    const { token } = await hogarDe('Rene');
    const crema = await producto(token, 'Crema');
    const caldo = await crearPlatillo(token, 'Caldo de res');
    await http().post(`${API}/platillos/${caldo}/inactivar`).set(con(token)).expect(200);
    const rechazo = await guardar(token, [], [caldo]).expect(422);
    expect(rechazo.body.codigo).toBe('INACTIVO');

    const sopa = await crearPlatillo(token, 'Sopa');
    await guardar(token, [crema], [sopa]).expect(200);
    await http().post(`${API}/platillos/${sopa}/inactivar`).set(con(token)).expect(200);
    // Volver a guardar la misma lista sí se permite aunque "Sopa" ya esté inactiva.
    await guardar(token, [crema], [sopa]).expect(200);
  });

  it('un id inexistente es 404 y uno mal formado es 400', async () => {
    const { token } = await hogarDe('Rene');
    await guardar(token, [], ['5c6a7f3e-5b8e-4c1e-9d55-1b8a2f0d9c11']).expect(404);
    await guardar(token, ['5c6a7f3e-5b8e-4c1e-9d55-1b8a2f0d9c11'], []).expect(404);
    await guardar(token, ['no-es-uuid'], []).expect(400);
    await http()
      .put(`${API}/hogar/preferencias/gustos`)
      .set(con(token))
      .send({ favoritos: [] })
      .expect(400);
  });

  it('RNF-06 otro hogar no ve ni puede marcar los platillos ajenos', async () => {
    const rene = await hogarDe('Rene');
    const ana = await hogarDe('Ana');
    const crema = await producto(rene.token, 'Crema');
    const pollo = await crearPlatillo(rene.token, 'Pollo en crema', [crema]);
    await guardar(rene.token, [crema], [pollo]).expect(200);

    expect((await leer(ana.token).expect(200)).body.ingredientesExcluidos).toEqual([]);
    expect((await leer(ana.token).expect(200)).body.favoritos).toEqual([]);
    await guardar(ana.token, [], [pollo]).expect(404);
    expect((await excluidosParaMotor(ana.hogarId)).size).toBe(0);
  });

  it('requiere sesión', async () => {
    await http().get(`${API}/hogar/preferencias/gustos`).expect(401);
  });
});
