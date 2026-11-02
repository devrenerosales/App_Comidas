import { describe, expect, it } from 'vitest';
import type { ProteinaPrincipal } from './catalogo';
import type { TiempoComida } from './enums';
import {
  asignarMenu,
  platillosFaltantes,
  textoFaltantes,
  type CandidatoMotor,
  type EntradaMotor,
} from './motor';

const FECHAS = [
  '2026-11-01',
  '2026-11-02',
  '2026-11-03',
  '2026-11-04',
  '2026-11-05',
  '2026-11-06',
  '2026-11-07',
];
const FACTORES = { preferencia: 0.5, novedad: 1, ahorro: 0.5, afinidad: 0 };

function candidato(
  id: string,
  proteina: ProteinaPrincipal,
  puntaje: number,
  extra: Partial<CandidatoMotor> = {},
): CandidatoMotor {
  return {
    id,
    nombre: `Platillo ${id}`,
    proteina,
    puntaje,
    factores: FACTORES,
    costo: null,
    ...extra,
  };
}

const ciclo: ProteinaPrincipal[] = ['POLLO', 'RES', 'CERDO', 'PESCADO', 'HUEVO'];
/** `n` platillos con proteínas rotadas y puntaje decreciente (el 1 es el mejor). */
const catalogo = (n: number) =>
  Array.from({ length: n }, (_, i) =>
    candidato(`p${i + 1}`, ciclo[i % ciclo.length]!, 1 - i / 100),
  );

const entrada = (extra: Partial<EntradaMotor> = {}): EntradaMotor => ({
  fechas: FECHAS,
  tiempos: ['ALMUERZO'],
  candidatos: { ALMUERZO: catalogo(25) },
  ...extra,
});

const ids = (r: ReturnType<typeof asignarMenu>, tiempo: TiempoComida = 'ALMUERZO') =>
  r.asignaciones.filter((a) => a.tiempo === tiempo).map((a) => a.candidato?.id ?? null);

describe('asignarMenu (CU-05.1, HU-19)', () => {
  it('CA-19.1 asigna 7 almuerzos sin repetir platillo ni proteína en días consecutivos', () => {
    const r = asignarMenu(entrada());
    expect(r.asignaciones).toHaveLength(7);
    expect(r.asignaciones.map((a) => a.fecha)).toEqual(FECHAS);
    const platillos = r.asignaciones.map((a) => a.candidato!.id);
    expect(new Set(platillos).size).toBe(7);
    for (let i = 1; i < 7; i++) {
      expect(r.asignaciones[i]!.candidato!.proteina).not.toBe(
        r.asignaciones[i - 1]!.candidato!.proteina,
      );
    }
    expect(r.avisos).toEqual([]);
    expect(r.asignaciones.every((a) => !a.fijado)).toBe(true);
  });

  it('prefiere el platillo de mayor puntaje que cumple las reglas', () => {
    const r = asignarMenu(entrada());
    expect(ids(r)).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7']);
  });

  it('salta al siguiente mejor cuando la proteína repetiría la del día anterior (RN-02)', () => {
    const lista = [
      candidato('a', 'POLLO', 0.9),
      candidato('b', 'POLLO', 0.8),
      candidato('c', 'RES', 0.7),
    ];
    const r = asignarMenu(entrada({ fechas: FECHAS.slice(0, 3), candidatos: { ALMUERZO: lista } }));
    expect(ids(r)).toEqual(['a', 'c', 'b']);
  });

  it('CA-19.2 conserva el fijado y el día siguiente no repite su proteína', () => {
    const pepian = candidato('pepian', 'POLLO', 0.1);
    const r = asignarMenu(
      entrada({
        tiempos: ['ALMUERZO', 'CENA'],
        candidatos: {
          ALMUERZO: [candidato('pollo1', 'POLLO', 0.99), ...catalogo(24)],
          CENA: catalogo(12),
        },
        fijados: [{ fecha: '2026-11-01', tiempo: 'ALMUERZO', candidato: pepian }],
      }),
    );
    expect(r.asignaciones).toHaveLength(14);
    const [domingo, lunes] = r.asignaciones;
    expect(domingo).toMatchObject({ fecha: '2026-11-01', fijado: true });
    expect(domingo!.candidato!.id).toBe('pepian');
    expect(lunes!.candidato!.proteina).not.toBe('POLLO');
    expect(r.asignaciones.filter((a) => a.fijado)).toHaveLength(1);
  });

  it('un fijado también limita al día anterior y cuenta como usado en la semana (RN-02, RN-03)', () => {
    const fijo = candidato('fijo', 'RES', 0.99);
    const lista = [
      fijo,
      candidato('res', 'RES', 0.95),
      candidato('pollo', 'POLLO', 0.9),
      candidato('cerdo', 'CERDO', 0.85),
    ];
    const r = asignarMenu(
      entrada({
        fechas: FECHAS.slice(0, 3),
        candidatos: { ALMUERZO: lista },
        fijados: [{ fecha: '2026-11-03', tiempo: 'ALMUERZO', candidato: fijo }],
      }),
    );
    // "fijo" (el mejor puntaje) no se vuelve a elegir (RN-03) y el día anterior al fijado no
    // puede ser RES (RN-02): domingo sí lo es, lunes cae en el siguiente que cumple.
    expect(ids(r)).toEqual(['res', 'pollo', 'fijo']);
  });

  it('los tiempos de comida se asignan de forma independiente', () => {
    const mismos = catalogo(10);
    const r = asignarMenu(
      entrada({
        tiempos: ['ALMUERZO', 'CENA'],
        candidatos: { ALMUERZO: mismos, CENA: mismos },
      }),
    );
    expect(ids(r, 'ALMUERZO')).toEqual(ids(r, 'CENA'));
  });

  it('E3 deja "Sin sugerencia" y avisa cuando ningún candidato cumple las reglas', () => {
    const r = asignarMenu(
      entrada({
        fechas: FECHAS.slice(0, 2),
        candidatos: { ALMUERZO: [candidato('a', 'POLLO', 0.9), candidato('b', 'POLLO', 0.8)] },
      }),
    );
    expect(ids(r)).toEqual(['a', null]);
    expect(r.avisos).toEqual([
      { codigo: 'SIN_SUGERENCIA', fecha: '2026-11-02', tiempo: 'ALMUERZO' },
    ]);
    expect(r.asignaciones[1]).toEqual({
      fecha: '2026-11-02',
      tiempo: 'ALMUERZO',
      candidato: null,
      fijado: false,
    });
  });

  it('tras un espacio vacío el día siguiente ya no tiene vecino con proteína que evitar', () => {
    const r = asignarMenu(
      entrada({
        fechas: FECHAS.slice(0, 3),
        candidatos: { ALMUERZO: [candidato('a', 'POLLO', 0.9), candidato('b', 'POLLO', 0.8)] },
      }),
    );
    expect(ids(r)).toEqual(['a', null, 'b']);
    expect(r.avisos).toHaveLength(1);
  });

  it('un tiempo sin candidatos queda todo "Sin sugerencia"', () => {
    const r = asignarMenu(entrada({ fechas: FECHAS.slice(0, 2), candidatos: {} }));
    expect(ids(r)).toEqual([null, null]);
    expect(r.avisos).toHaveLength(2);
  });

  it('la proteína "OTRA" no se compara para RN-02', () => {
    const r = asignarMenu(
      entrada({
        fechas: FECHAS.slice(0, 2),
        candidatos: { ALMUERZO: [candidato('a', 'OTRA', 0.9), candidato('b', 'OTRA', 0.8)] },
      }),
    );
    expect(ids(r)).toEqual(['a', 'b']);
  });

  it('5a desempata por menor costo y luego por nombre', () => {
    const lista = [
      candidato('c', 'POLLO', 0.5, { nombre: 'Zeta', costo: 30 }),
      candidato('d', 'RES', 0.5, { nombre: 'Beta', costo: 20 }),
      candidato('e', 'CERDO', 0.5, { nombre: 'Alfa', costo: 20 }),
      candidato('f', 'PESCADO', 0.5, { nombre: 'Sin precio', costo: null }),
    ];
    const r = asignarMenu(entrada({ fechas: FECHAS.slice(0, 4), candidatos: { ALMUERZO: lista } }));
    expect(ids(r)).toEqual(['e', 'd', 'c', 'f']);
  });

  it('no modifica los datos de entrada', () => {
    const lista = catalogo(10);
    const copia = JSON.stringify(lista);
    asignarMenu(entrada({ candidatos: { ALMUERZO: lista } }));
    expect(JSON.stringify(lista)).toBe(copia);
  });
});

describe('platillosFaltantes (CA-19.3)', () => {
  it('12 de almuerzo y 7 de cena: faltan 3 de cena', () => {
    const f = platillosFaltantes(['ALMUERZO', 'CENA'], { ALMUERZO: 12, CENA: 7 });
    expect(f).toEqual([{ tiempo: 'CENA', cantidad: 3 }]);
    expect(textoFaltantes(f, () => 'Cena')).toBe('Faltan 3 platillos de Cena');
  });

  it('un tiempo sin platillos pide el mínimo completo y 9 pide uno solo', () => {
    expect(platillosFaltantes(['ALMUERZO', 'CENA'], { ALMUERZO: 9 })).toEqual([
      { tiempo: 'ALMUERZO', cantidad: 1 },
      { tiempo: 'CENA', cantidad: 10 },
    ]);
    expect(
      textoFaltantes(
        [
          { tiempo: 'ALMUERZO', cantidad: 1 },
          { tiempo: 'CENA', cantidad: 10 },
        ],
        (t) => (t === 'ALMUERZO' ? 'Almuerzo' : 'Cena'),
      ),
    ).toBe('Faltan 1 platillo de Almuerzo. Faltan 10 platillos de Cena');
  });

  it('con suficientes platillos no falta ninguno y el mínimo es configurable', () => {
    expect(platillosFaltantes(['ALMUERZO'], { ALMUERZO: 10 })).toEqual([]);
    expect(platillosFaltantes(['ALMUERZO'], { ALMUERZO: 3 }, 5)).toEqual([
      { tiempo: 'ALMUERZO', cantidad: 2 },
    ]);
  });
});
