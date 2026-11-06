import { describe, expect, it } from 'vitest';
import type { ProteinaPrincipal } from './catalogo';
import type { TiempoComida } from './enums';
import { advertenciasDePlan, nombreDiaSemana, type EspacioPlan } from './plan';

const espacio = (
  fecha: string,
  nombre: string | null,
  proteina: ProteinaPrincipal | null,
  tiempo: TiempoComida = 'ALMUERZO',
  platilloId: string | null = nombre,
): EspacioPlan => ({
  fecha,
  tiempo,
  platilloId: nombre === null ? null : platilloId,
  nombre,
  proteina,
});

describe('nombreDiaSemana', () => {
  it('devuelve el día en minúsculas con tilde', () => {
    expect(nombreDiaSemana('2026-11-01')).toBe('domingo');
    expect(nombreDiaSemana('2026-11-04')).toBe('miércoles');
    expect(nombreDiaSemana('2026-11-07')).toBe('sábado');
  });
});

describe('advertenciasDePlan (CU-06.1 3a, HU-24)', () => {
  it('CA-24.1 la carne guisada (res) el jueves junto a Spaghetti con carne (res) del viernes avisa RN-02', () => {
    const plan = [
      espacio('2026-11-02', 'Pepián de pollo', 'POLLO'),
      espacio('2026-11-04', 'Pescado frito', 'PESCADO'),
      espacio('2026-11-05', 'Carne guisada', 'RES'),
      espacio('2026-11-06', 'Spaghetti con carne', 'RES'),
    ];
    const r = advertenciasDePlan(plan, [
      { fecha: '2026-11-05', tiempo: 'ALMUERZO' },
      { fecha: '2026-11-02', tiempo: 'ALMUERZO' },
    ]);
    expect(r).toEqual([
      {
        codigo: 'RN02_PROTEINA_CONSECUTIVA',
        fecha: '2026-11-05',
        tiempo: 'ALMUERZO',
        mensaje: 'Proteína res repetida en días consecutivos (jueves y viernes)',
      },
    ]);
  });

  it('revisar ambos lados del par no duplica la advertencia', () => {
    const plan = [espacio('2026-11-05', 'A', 'RES'), espacio('2026-11-06', 'B', 'RES')];
    const r = advertenciasDePlan(plan, [
      { fecha: '2026-11-05', tiempo: 'ALMUERZO' },
      { fecha: '2026-11-06', tiempo: 'ALMUERZO' },
    ]);
    expect(r).toHaveLength(1);
  });

  it('avisa por el día anterior y por el siguiente cuando ambos repiten la proteína', () => {
    const plan = [
      espacio('2026-11-04', 'A', 'POLLO'),
      espacio('2026-11-05', 'B', 'POLLO'),
      espacio('2026-11-06', 'C', 'POLLO'),
    ];
    const r = advertenciasDePlan(plan, [{ fecha: '2026-11-05', tiempo: 'ALMUERZO' }]);
    expect(r.map((a) => a.mensaje)).toEqual([
      'Proteína pollo repetida en días consecutivos (miércoles y jueves)',
      'Proteína pollo repetida en días consecutivos (jueves y viernes)',
    ]);
  });

  it('la proteína "Otra", los vecinos de otro tiempo y los días no consecutivos no avisan', () => {
    const plan = [
      espacio('2026-11-04', 'A', 'OTRA'),
      espacio('2026-11-05', 'B', 'OTRA'),
      espacio('2026-11-05', 'C', 'RES', 'CENA'),
      espacio('2026-11-06', 'D', 'RES', 'ALMUERZO'),
      espacio('2026-11-07', 'E', 'RES'),
      espacio('2026-11-01', 'F', 'RES'),
    ];
    expect(
      advertenciasDePlan(plan, [
        { fecha: '2026-11-05', tiempo: 'ALMUERZO' },
        { fecha: '2026-11-05', tiempo: 'CENA' },
        { fecha: '2026-11-01', tiempo: 'ALMUERZO' },
      ]),
    ).toEqual([]);
  });

  it('RN-03 avisa cuando el platillo se repite en la semana y tiempo, una vez por platillo', () => {
    const plan = [
      espacio('2026-11-01', 'Pepián', 'POLLO', 'ALMUERZO', 'p1'),
      espacio('2026-11-03', 'Pepián', 'POLLO', 'ALMUERZO', 'p1'),
      espacio('2026-11-05', 'Pepián', 'POLLO', 'ALMUERZO', 'p1'),
      espacio('2026-11-03', 'Pepián', 'POLLO', 'CENA', 'p1'),
    ];
    const r = advertenciasDePlan(plan, [
      { fecha: '2026-11-03', tiempo: 'ALMUERZO' },
      { fecha: '2026-11-05', tiempo: 'ALMUERZO' },
    ]);
    expect(r).toEqual([
      {
        codigo: 'RN03_PLATILLO_REPETIDO',
        fecha: '2026-11-01',
        tiempo: 'ALMUERZO',
        mensaje: 'Pepián se repite en la semana (domingo, martes, jueves)',
      },
    ]);
  });

  it('un espacio vacío, inexistente o sin cambios que avisar no genera nada', () => {
    const plan = [espacio('2026-11-05', null, null), espacio('2026-11-06', 'A', 'RES')];
    expect(
      advertenciasDePlan(plan, [
        { fecha: '2026-11-05', tiempo: 'ALMUERZO' },
        { fecha: '2026-11-20', tiempo: 'ALMUERZO' },
        { fecha: '2026-11-06', tiempo: 'ALMUERZO' },
      ]),
    ).toEqual([]);
  });
});
