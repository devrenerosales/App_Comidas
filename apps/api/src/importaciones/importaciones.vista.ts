import type { MenuSemanal } from '@menu/db';
import { diasSemanaHistorica } from '@menu/shared';
import type { FilaMenu, InstantaneaSemana } from './importaciones.tipos';

export function planificarSemanas(filas: FilaMenu[], existentes: MenuSemanal[]) {
  return [...new Set(filas.flatMap((f) => (f.semanaInicio ? [f.semanaInicio] : [])))]
    .sort()
    .map((inicio) => {
      const fin = diasSemanaHistorica(inicio)[6]!;
      const coincidencias = existentes.filter((s) => s.fechaInicio <= fin && s.fechaFin >= inicio);
      const anterior = coincidencias[0];
      const instantanea: InstantaneaSemana | null = anterior
        ? {
            id: anterior.id,
            version: anterior.version,
            estado: anterior.estado,
            gastoReal: anterior.gastoReal,
            fechaInicio: anterior.fechaInicio,
            fechaFin: anterior.fechaFin,
            protegida:
              coincidencias.length !== 1 ||
              anterior.fechaInicio !== inicio ||
              anterior.estado !== 'HISTORICO',
          }
        : null;
      return {
        semanaInicio: inicio,
        yaExiste: !!anterior,
        decision: anterior ? ('OMITIR' as const) : ('CREAR' as const),
        gastoSemana: filas.find((f) => f.semanaInicio === inicio && f.gasto)?.gasto ?? null,
        instantanea,
      };
    });
}

export function resolverNombres(
  filas: FilaMenu[],
  canonicos: { id: string; nombreNormalizado: string }[],
  aliases: { platilloId: string; aliasNormalizado: string }[],
) {
  const nombres = new Map(aliases.map((a) => [a.aliasNormalizado, a.platilloId]));
  for (const c of canonicos) nombres.set(c.nombreNormalizado, c.id);
  return [
    ...new Map(
      filas
        .filter(
          (f) =>
            f.platillo.length > 0 && f.platillo.length <= 80 && f.nombreNormalizado.length <= 80,
        )
        .map((f) => [f.nombreNormalizado, f]),
    ).values(),
  ].map((f) => ({
    nombreOriginal: f.platillo,
    nombreNormalizado: f.nombreNormalizado,
    proteinaPrincipal: f.proteinaPrincipal,
    platilloId: nombres.get(f.nombreNormalizado) ?? null,
    decision: nombres.has(f.nombreNormalizado) ? ('ASOCIAR' as const) : ('PENDIENTE' as const),
  }));
}
