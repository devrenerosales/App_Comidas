import { describe, expect, it } from 'vitest';
import { fechaHoraGuatemala } from './fechas';

describe('fechaHoraGuatemala', () => {
  it('muestra día/mes y hora de 24 horas en hora de Guatemala (UTC-6)', () => {
    expect(fechaHoraGuatemala('2026-11-02T15:10:00.000Z')).toBe('02/11 09:10');
    expect(fechaHoraGuatemala('2026-11-03T05:05:00.000Z')).toBe('02/11 23:05');
  });
});
