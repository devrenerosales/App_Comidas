/** Repositorios de HU-01 contra PostgreSQL real: unicidad, bloqueo atómico y hogar. */
import { eq, hogar, miembroHogar, usuario } from '@menu/db';
import { DB } from '../src/database/database.constants';
import { CorreoDuplicadoError, UsuariosRepositorio } from '../src/usuarios/usuarios.repositorio';
import { describeConBd, usarBaseDePruebas } from './utils/base-datos';

describeConBd('UsuariosRepositorio (integración)', () => {
  const bd = usarBaseDePruebas({
    suite: 'usuarios_repo',
    sembrar: false,
    truncarEntrePruebas: true,
  });
  const repo = () => new UsuariosRepositorio(bd.db);
  const datos = { nombre: 'Rene', correo: 'rene@correo.com', hashContrasena: 'h' };

  it('DB es el token de inyección del cliente Drizzle', () => {
    expect(typeof DB).toBe('symbol');
  });

  it('CA-01.2 el índice único del correo produce CorreoDuplicadoError', async () => {
    await repo().crear(datos);
    await expect(repo().crear(datos)).rejects.toBeInstanceOf(CorreoDuplicadoError);
  });

  it('propaga errores que no son de unicidad', async () => {
    await expect(repo().crear({ ...datos, nombre: 'x'.repeat(81) })).rejects.not.toBeInstanceOf(
      CorreoDuplicadoError,
    );
  });

  it('CA-01.3 intentos fallidos concurrentes se cuentan sin perder ninguno (FOR UPDATE)', async () => {
    const u = await repo().crear(datos);
    const ahora = new Date();
    await Promise.all([1, 2, 3].map(() => repo().registrarIntentoFallido(u.id, ahora)));
    const [fila] = await bd.db.select().from(usuario).where(eq(usuario.id, u.id));
    expect(fila?.intentosFallidos).toBe(3);
    await repo().registrarIntentoFallido(u.id, ahora);
    const estado = await repo().registrarIntentoFallido(u.id, ahora);
    expect(estado.bloqueadoHasta?.getTime()).toBe(ahora.getTime() + 15 * 60_000);
    await repo().reiniciarIntentos(u.id);
    expect((await repo().buscarPorId(u.id))?.bloqueadoHasta).toBeNull();
  });

  it('hogarDe devuelve el hogar y el rol, o null', async () => {
    const u = await repo().crear(datos);
    expect(await repo().hogarDe(u.id)).toBeNull();
    const [h] = await bd.db.insert(hogar).values({ nombre: 'Casa' }).returning();
    await bd.db
      .insert(miembroHogar)
      .values({ hogarId: h?.id as string, usuarioId: u.id, rol: 'ADMIN' });
    expect(await repo().hogarDe(u.id)).toEqual({ id: h?.id, nombre: 'Casa', rol: 'ADMIN' });
  });
});
