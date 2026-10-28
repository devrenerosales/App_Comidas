import {
  and,
  eq,
  importacionPlatillo,
  platillo,
  platilloAlias,
  platilloTiempo,
  sql,
} from '@menu/db';
import {
  limpiarTexto,
  normalizarNombreCatalogo,
  type ProteinaPrincipal,
  type TiempoComida,
} from '@menu/shared';
import { Problema } from '../comun/problema';
import type { TransaccionHistorial } from '../historial/historial.repositorio';
import type { DecisionesPlatillosDto } from './importaciones.dto';
import { UMBRAL_SIMILITUD, type FilaMenu } from './importaciones.tipos';

export type NombreImportado = typeof importacionPlatillo.$inferSelect;
export interface Sugerencia {
  platilloId: string;
  similitud: number;
}
export interface Cambio {
  decision: 'ASOCIAR' | 'CREAR';
  platilloId: string | null;
  nombreFinal: string | null;
}
export interface CatalogoHogar {
  /** Platillos activos que se pueden elegir como destino. */
  activos: ReadonlySet<string>;
  /** Nombres normalizados ya usados por un platillo o un alias del hogar. */
  ocupados: ReadonlySet<string>;
}
export const SIMILITUD_EXACTA = '1.0000';

/** Un nombre que coincidió con el catálogo o un alias al cargar no admite decisión. */
export const esAutomatica = (n: Pick<NombreImportado, 'decision' | 'similitud'>) =>
  n.decision === 'ASOCIAR' && n.similitud === SIMILITUD_EXACTA;

/**
 * Mejor platillo activo del hogar para cada nombre normalizado, por trigramas (pg_trgm).
 * Un solo viaje a la base con la mejor coincidencia por nombre.
 */
export async function buscarSugerencias(
  tx: TransaccionHistorial,
  hogarId: string,
  nombres: string[],
): Promise<Map<string, Sugerencia>> {
  if (!nombres.length) return new Map();
  const { rows } = await tx.execute<{ nombre: string; id: string; similitud: number }>(sql`
    select n.nombre as nombre, p.id as id, p.sim::float8 as similitud
    from jsonb_array_elements_text(${JSON.stringify(nombres)}::jsonb) as n(nombre)
    cross join lateral (
      select id, similarity(nombre_normalizado, n.nombre) as sim
      from platillo
      where hogar_id = ${hogarId} and activo
      order by sim desc, nombre_normalizado
      limit 1
    ) p
  `);
  return new Map(rows.map((r) => [r.nombre, { platilloId: r.id, similitud: Number(r.similitud) }]));
}

/** Completa la sugerencia de cada nombre: 1.0 para los automáticos y la más parecida para el resto. */
export function completarSugerencias<
  T extends { nombreNormalizado: string; platilloId: string | null },
>(nombres: T[], sugerencias: Map<string, Sugerencia>) {
  return nombres.map((n) => {
    if (n.platilloId)
      return { ...n, platilloSugeridoId: n.platilloId, similitud: SIMILITUD_EXACTA };
    const s = sugerencias.get(n.nombreNormalizado);
    return s && s.similitud > 0
      ? { ...n, platilloSugeridoId: s.platilloId, similitud: s.similitud.toFixed(4) }
      : { ...n, platilloSugeridoId: null, similitud: null };
  });
}

/** Propuesta del sistema para un nombre sin decisión (CU-04.3 pasos 3 y 4). */
export function propuestaDe(
  n: Pick<NombreImportado, 'platilloSugeridoId' | 'similitud'>,
  umbral = UMBRAL_SIMILITUD,
) {
  const similitud = n.similitud === null ? null : Number(n.similitud);
  return n.platilloSugeridoId && similitud !== null && similitud >= umbral
    ? { accion: 'ASOCIAR' as const, platilloId: n.platilloSugeridoId, similitud }
    : { accion: 'CREAR' as const, platilloId: null, similitud };
}

const invalida = (mensaje: string) => new Problema(422, 'DECISION_INVALIDA', mensaje);

/**
 * Aplica "aceptar todas las propuestas" y las decisiones explícitas (estas ganan) y devuelve
 * solo lo que cambia. No escribe: valida contra el catálogo y entre los platillos nuevos.
 */
export function aplicarDecisiones(
  nombres: NombreImportado[],
  datos: Pick<DecisionesPlatillosDto, 'aceptarPropuestas' | 'decisiones'>,
  catalogo: CatalogoHogar,
): Map<string, Cambio> {
  if (!datos.aceptarPropuestas && !datos.decisiones?.length)
    throw new Problema(422, 'SIN_DECISIONES', 'Indica al menos una decisión');
  const porNombre = new Map(nombres.map((n) => [n.nombreNormalizado, n]));
  const cambios = new Map<string, Cambio>();
  if (datos.aceptarPropuestas)
    for (const n of nombres) {
      if (n.decision !== 'PENDIENTE') continue;
      const p = propuestaDe(n);
      cambios.set(
        n.nombreNormalizado,
        p.accion === 'ASOCIAR'
          ? { decision: 'ASOCIAR', platilloId: p.platilloId, nombreFinal: null }
          : { decision: 'CREAR', platilloId: null, nombreFinal: null },
      );
    }
  const vistos = new Set<string>();
  for (const d of datos.decisiones ?? []) {
    const n = porNombre.get(d.nombreNormalizado);
    if (!n || vistos.has(d.nombreNormalizado))
      throw invalida('Elige un platillo de esta importación, una sola vez');
    if (esAutomatica(n)) throw invalida(`"${n.nombreOriginal}" ya se asoció automáticamente`);
    vistos.add(d.nombreNormalizado);
    if (d.decision === 'ASOCIAR') {
      if (!d.platilloId || !catalogo.activos.has(d.platilloId))
        throw invalida(`Elige un platillo activo del catálogo para "${n.nombreOriginal}"`);
      cambios.set(d.nombreNormalizado, {
        decision: 'ASOCIAR',
        platilloId: d.platilloId,
        nombreFinal: null,
      });
    } else {
      const nombre = limpiarTexto(d.nombreFinal ?? n.nombreOriginal);
      if (!nombre || nombre.length > 80)
        throw invalida('El nombre del platillo nuevo debe tener entre 1 y 80 caracteres');
      cambios.set(d.nombreNormalizado, {
        decision: 'CREAR',
        platilloId: null,
        nombreFinal: nombre,
      });
    }
  }
  // Los platillos nuevos no pueden chocar con el catálogo ni entre sí.
  const finales = new Set<string>();
  for (const n of nombres) {
    const c = cambios.get(n.nombreNormalizado) ?? n;
    if (c.decision !== 'CREAR') continue;
    const clave = normalizarNombreCatalogo(c.nombreFinal ?? n.nombreOriginal);
    if (catalogo.ocupados.has(clave))
      throw new Problema(
        409,
        'NOMBRE_EN_USO',
        `Ya existe un platillo o alias llamado "${c.nombreFinal ?? n.nombreOriginal}". Asócialo en lugar de crearlo`,
      );
    if (finales.has(clave))
      throw new Problema(
        422,
        'NOMBRE_DUPLICADO',
        `Dos platillos nuevos se llamarían igual: "${c.nombreFinal ?? n.nombreOriginal}"`,
      );
    finales.add(clave);
  }
  return cambios;
}

export const textoPendientes = (n: number) =>
  n === 1 ? 'Falta 1 platillo por resolver' : `Faltan ${n} platillos por resolver`;

/**
 * Al confirmar: crea los platillos nuevos (incompletos, con los tiempos de sus filas) y guarda
 * los nombres asociados como alias. Solo trabaja con los nombres de las semanas que se importan.
 * Devuelve el platillo de cada nombre normalizado y los contadores del reporte.
 */
export async function materializarPlatillos(
  tx: TransaccionHistorial,
  hogarId: string,
  importacionId: string,
  nombres: NombreImportado[],
  filasUsadas: Pick<FilaMenu, 'nombreNormalizado' | 'tiempo'>[],
) {
  const tiempos = new Map<string, Set<TiempoComida>>();
  for (const f of filasUsadas) {
    const t = tiempos.get(f.nombreNormalizado) ?? new Set<TiempoComida>();
    t.add(f.tiempo);
    tiempos.set(f.nombreNormalizado, t);
  }
  const ids = new Map<string, string>();
  let platillosCreados = 0;
  let aliasCreados = 0;
  const guardarAlias = async (n: NombreImportado, destino: string) => {
    const nuevo = await tx
      .insert(platilloAlias)
      .values({
        hogarId,
        platilloId: destino,
        alias: n.nombreOriginal,
        aliasNormalizado: n.nombreNormalizado,
        origen: 'IMPORTACION',
      })
      .onConflictDoNothing()
      .returning({ id: platilloAlias.id });
    aliasCreados += nuevo.length;
  };
  for (const n of nombres) {
    if (!tiempos.has(n.nombreNormalizado)) continue;
    if (n.decision === 'ASOCIAR') {
      ids.set(n.nombreNormalizado, n.platilloId!);
      if (!esAutomatica(n)) await guardarAlias(n, n.platilloId!);
      continue;
    }
    const nombre = n.nombreFinal ?? n.nombreOriginal;
    const normalizado = normalizarNombreCatalogo(nombre);
    const [creado] = await tx
      .insert(platillo)
      .values({
        hogarId,
        nombre,
        nombreNormalizado: normalizado,
        proteinaPrincipal: (n.proteinaPrincipal ?? 'OTRA') as ProteinaPrincipal,
      })
      .onConflictDoNothing()
      .returning({ id: platillo.id });
    if (!creado)
      throw new Problema(
        409,
        'CATALOGO_MODIFICADO',
        `El catálogo cambió: "${nombre}" ya existe. Cancela y vuelve a cargar el archivo`,
      );
    await tx
      .insert(platilloTiempo)
      .values(
        [...tiempos.get(n.nombreNormalizado)!].map((tiempo) => ({ platilloId: creado.id, tiempo })),
      );
    await tx
      .update(importacionPlatillo)
      .set({ platilloId: creado.id })
      .where(
        and(
          eq(importacionPlatillo.importacionId, importacionId),
          eq(importacionPlatillo.nombreNormalizado, n.nombreNormalizado),
        ),
      );
    platillosCreados++;
    ids.set(n.nombreNormalizado, creado.id);
    // El nombre escrito en el archivo se recuerda si difiere del que se creó.
    if (normalizado !== n.nombreNormalizado) await guardarAlias(n, creado.id);
  }
  return { ids, platillosCreados, aliasCreados };
}
