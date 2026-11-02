import { describe, expect, it } from 'vitest';
import type { ProteinaPrincipal } from './catalogo';
import { siguienteAlternativa, type CandidatoMotor, type EspacioVecino } from './motor';

const FACTORES = { preferencia: 0.5, novedad: 0.5, ahorro: 0.5, afinidad: 0.5 };
const candidato = (
  id: string,
  proteina: ProteinaPrincipal,
  puntaje: number,
  nombre = id,
): CandidatoMotor => ({ id, nombre, proteina, puntaje, factores: FACTORES, costo: null });
const vecino = (
  fecha: string,
  platilloId: string | null,
  proteina: ProteinaPrincipal | null,
): EspacioVecino => ({ fecha, platilloId, proteina });

/** CA-23.1: lunes Carne guisada (res), martes (se pide otra), miércoles Tortitas de carne (res). */
const SEMANA = [
  vecino('2026-11-02', 'carne', 'RES'),
  vecino('2026-11-04', 'tortitas', 'RES'),
  vecino('2026-11-03', 'pescado', 'PESCADO'),
];
const SEMANA_SIN_MARTES = SEMANA.filter((o) => o.fecha !== '2026-11-03');
const CANDIDATOS = [
  candidato('carne', 'RES', 0.9),
  candidato('tortitas', 'RES', 0.8),
  candidato('pescado', 'PESCADO', 0.7),
  candidato('caldo', 'RES', 0.65),
  candidato('pollo', 'POLLO', 0.6),
  candidato('chile', 'CERDO', 0.5),
];

const pedir = (extra: Partial<Parameters<typeof siguienteAlternativa>[0]> = {}) =>
  siguienteAlternativa({
    fecha: '2026-11-03',
    candidatos: CANDIDATOS,
    excluidos: ['pescado'],
    otros: SEMANA_SIN_MARTES,
    ...extra,
  });

describe('siguienteAlternativa (CU-05.5, HU-23)', () => {
  it('CA-23.1 elige el mejor que no es de res ni está en la semana ni es el actual', () => {
    expect(pedir()?.id).toBe('pollo');
  });

  it('no repite platillos ya en la semana y tiempo (RN-03)', () => {
    const otros = [...SEMANA_SIN_MARTES, vecino('2026-11-06', 'pollo', 'POLLO')];
    expect(pedir({ otros })?.id).toBe('chile');
  });

  it('descarta la misma proteína del día anterior y del siguiente (RN-02)', () => {
    const candidatos = [
      candidato('res', 'RES', 0.9),
      candidato('pollo', 'POLLO', 0.8),
      candidato('cerdo', 'CERDO', 0.7),
    ];
    const sin = { candidatos, excluidos: [] };
    expect(pedir({ ...sin, otros: [vecino('2026-11-02', 'x', 'RES')] })?.id).toBe('pollo');
    expect(pedir({ ...sin, otros: [vecino('2026-11-04', 'x', 'RES')] })?.id).toBe('pollo');
    expect(
      pedir({
        ...sin,
        otros: [vecino('2026-11-02', 'x', 'RES'), vecino('2026-11-04', 'y', 'POLLO')],
      })?.id,
    ).toBe('cerdo');
  });

  it('una proteína de un día lejano no cuenta para RN-02', () => {
    expect(
      pedir({
        otros: [vecino('2026-11-06', 'x', 'RES')],
        excluidos: ['carne', 'tortitas', 'pescado'],
      })?.id,
    ).toBe('caldo');
  });

  it('no vuelve a ofrecer las alternativas ya mostradas', () => {
    expect(pedir({ excluidos: ['pescado', 'pollo'] })?.id).toBe('chile');
  });

  it('la proteína OTRA no se compara con los días vecinos', () => {
    const candidatos = [candidato('otro', 'OTRA', 0.9), candidato('pollo', 'POLLO', 0.1)];
    const otros = [vecino('2026-11-02', 'x', 'OTRA'), vecino('2026-11-04', 'y', 'OTRA')];
    expect(pedir({ candidatos, otros, excluidos: [] })?.id).toBe('otro');
  });

  it('un espacio vecino vacío no restringe nada', () => {
    const otros = [vecino('2026-11-02', null, null), vecino('2026-11-04', null, null)];
    expect(pedir({ otros, excluidos: [] })?.id).toBe('carne');
  });

  it('CA-23.3 si no queda ningún candidato devuelve null', () => {
    const candidatos = [candidato('pescado', 'PESCADO', 0.7), candidato('carne', 'RES', 0.9)];
    expect(pedir({ candidatos })).toBeNull();
    expect(pedir({ candidatos: [] })).toBeNull();
  });

  it('en un empate de puntaje gana el más barato y luego el orden alfabético', () => {
    const candidatos = [
      candidato('b', 'POLLO', 0.6, 'Bistec'),
      candidato('a', 'CERDO', 0.6, 'Adobo'),
    ];
    expect(pedir({ candidatos, excluidos: [], otros: [] })?.nombre).toBe('Adobo');
  });
});
