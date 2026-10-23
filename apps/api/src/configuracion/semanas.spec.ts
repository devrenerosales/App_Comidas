import { aplicaDesde, fechaLocal, inicioProximaSemana, sumarDias } from './semanas';

describe('semanas (America/Guatemala, CU-02.3 paso 3)', () => {
  it('fechaLocal usa la hora de Guatemala (UTC-6)', () => {
    expect(fechaLocal(new Date('2026-10-22T15:00:00.000Z'))).toBe('2026-10-22');
    // 03:00 UTC del 23 todavía es 21:00 del 22 en Guatemala.
    expect(fechaLocal(new Date('2026-10-23T03:00:00.000Z'))).toBe('2026-10-22');
  });

  it('sumarDias cruza meses', () => {
    expect(sumarDias('2026-10-31', 1)).toBe('2026-11-01');
    expect(sumarDias('2026-11-01', -1)).toBe('2026-10-31');
  });

  it('inicioProximaSemana: jueves 2026-10-22 con inicio domingo → 2026-10-25', () => {
    expect(inicioProximaSemana('2026-10-22', 'DOMINGO')).toBe('2026-10-25');
    expect(inicioProximaSemana('2026-10-22', 'LUNES')).toBe('2026-10-26');
    // Si hoy es el día de inicio, la próxima es la de la otra semana.
    expect(inicioProximaSemana('2026-10-25', 'DOMINGO')).toBe('2026-11-01');
    // Un día desconocido se trata como domingo.
    expect(inicioProximaSemana('2026-10-22', 'OTRO')).toBe('2026-10-25');
  });

  it('CA-07.2 aplicaDesde salta las semanas aprobadas consecutivas', () => {
    expect(aplicaDesde('2026-10-22', 'DOMINGO', [])).toBe('2026-10-25');
    expect(
      aplicaDesde('2026-10-22', 'DOMINGO', [{ fechaInicio: '2026-10-25', fechaFin: '2026-10-31' }]),
    ).toBe('2026-11-01');
    expect(
      aplicaDesde('2026-10-22', 'DOMINGO', [
        { fechaInicio: '2026-11-01', fechaFin: '2026-11-07' },
        { fechaInicio: '2026-10-25', fechaFin: '2026-10-31' },
      ]),
    ).toBe('2026-11-08');
    // La semana en curso aprobada o una aprobada no consecutiva no mueven el inicio.
    expect(
      aplicaDesde('2026-10-22', 'DOMINGO', [
        { fechaInicio: '2026-10-18', fechaFin: '2026-10-24' },
        { fechaInicio: '2026-11-08', fechaFin: '2026-11-14' },
      ]),
    ).toBe('2026-10-25');
  });
});
