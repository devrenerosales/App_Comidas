/**
 * Prueba de humo del helper de integración (test/utils/base-datos.ts) contra PostgreSQL real.
 * Sirve de ejemplo para las historias que agreguen repositorios.
 */
import { INestApplication } from '@nestjs/common';
import { eq, hogar, supermercado, type Db } from '@menu/db';
import { DB } from '../src/database/database.constants';
import {
  crearAppConBd,
  describeConBd,
  enTransaccionRevertida,
  usarBaseDePruebas,
} from './utils/base-datos';

describeConBd('Base de pruebas aislada (integración)', () => {
  const bd = usarBaseDePruebas({ suite: 'helper', sembrar: true, truncarEntrePruebas: true });
  let app: INestApplication;

  beforeAll(async () => {
    app = await crearAppConBd(bd.base);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('la base está migrada y sembrada (4 supermercados con extracción apagada)', async () => {
    const filas = await bd.db.select().from(supermercado);
    expect(filas).toHaveLength(4);
    expect(filas.every((s) => !s.extraccionPermitida)).toBe(true);
  });

  it('la API inyecta DB apuntando a la base aislada', async () => {
    const db = app.get<Db>(DB);
    await db.insert(hogar).values({ nombre: 'Familia API' });
    expect(await bd.db.select().from(hogar).where(eq(hogar.nombre, 'Familia API'))).toHaveLength(1);
  });

  it('truncarEntrePruebas deja las tablas vacías salvo la semilla', async () => {
    expect(await bd.db.select().from(hogar)).toHaveLength(0);
    expect(await bd.db.select().from(supermercado)).toHaveLength(4);
  });

  it('enTransaccionRevertida no deja datos', async () => {
    const insertados = await enTransaccionRevertida(bd.db, (tx) =>
      tx.insert(hogar).values({ nombre: 'Temporal' }).returning(),
    );
    expect(insertados).toHaveLength(1);
    expect(await bd.db.select().from(hogar)).toHaveLength(0);
  });

  it('enTransaccionRevertida propaga errores reales', async () => {
    await expect(
      enTransaccionRevertida(bd.db, async () => {
        throw new Error('fallo de negocio');
      }),
    ).rejects.toThrow('fallo de negocio');
  });
});
