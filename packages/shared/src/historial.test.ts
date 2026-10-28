import { describe, expect, it } from 'vitest';
import {
  esFechaCalendario,
  diasSemanaHistorica,
  validarCapturaHistorica,
  type CapturaHistorica,
} from './historial';

const datos: CapturaHistorica = {
  fechaInicio: '2025-04-06',
  detalles: [{ fecha: '2025-04-06', tiempo: 'ALMUERZO', platilloId: 'p1' }],
};
describe('HU-15 reglas históricas', () => {
  it.each(['2025-4-06', '2025-13-06', '2025-02-31', '0000-01-02'])(
    'rechaza fecha inexistente o mal formada %s',
    (f) => expect(esFechaCalendario(f)).toBe(false),
  );
  it('reconoce fechas reales y semanas que cruzan año o febrero bisiesto', () => {
    expect(esFechaCalendario('2028-02-29')).toBe(true);
    expect(diasSemanaHistorica('2026-12-27')[6]).toBe('2027-01-02');
    expect(diasSemanaHistorica('2028-02-27')[6]).toBe('2028-03-04');
  });
  it.each([undefined, null, '248.50', '99999.99'])(
    'acepta gasto opcional o válido %s',
    (gastoReal) => {
      expect(validarCapturaHistorica({ ...datos, gastoReal }, '2026-10-22')).toBeNull();
    },
  );
  it.each(['-50', '0', 'abc', '100000', '1.234'])('CA-15.4 rechaza gasto %s', (gastoReal) => {
    expect(validarCapturaHistorica({ ...datos, gastoReal }, '2026-10-22')?.codigo).toBe(
      'GASTO_INVALIDO',
    );
  });
  it.each(['malo', '2025-04-07'])('exige domingo válido %s', (fechaInicio) => {
    expect(validarCapturaHistorica({ ...datos, fechaInicio }, '2026-10-22')?.codigo).toBe(
      'INICIO_SEMANA_INVALIDO',
    );
  });
  it('CA-15.3 exige que la semana termine antes de hoy, incluso si hoy es sábado', () => {
    expect(
      validarCapturaHistorica({ ...datos, fechaInicio: '2026-10-18' }, '2026-10-22')?.codigo,
    ).toBe('SEMANA_NO_TERMINADA');
    expect(validarCapturaHistorica(datos, '2025-04-12')?.codigo).toBe('SEMANA_NO_TERMINADA');
  });
  it('exige al menos una comida, fechas dentro de la semana y espacios únicos', () => {
    expect(validarCapturaHistorica({ ...datos, detalles: [] }, '2026-10-22')?.codigo).toBe(
      'SIN_PLATILLOS',
    );
    expect(
      validarCapturaHistorica(
        { ...datos, detalles: [{ ...datos.detalles[0]!, fecha: '2025-04-13' }] },
        '2026-10-22',
      )?.codigo,
    ).toBe('FECHA_FUERA_DE_SEMANA');
    expect(
      validarCapturaHistorica(
        { ...datos, detalles: [...datos.detalles, ...datos.detalles] },
        '2026-10-22',
      )?.codigo,
    ).toBe('COMIDA_DUPLICADA');
  });
});
