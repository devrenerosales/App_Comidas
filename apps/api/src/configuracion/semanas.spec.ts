import {
  aplicaDesde,
  fechaLocal,
  inicioProximaSemana,
  sumarDias,
  calendarioSemana,
  DIAS_SEMANA,
} from './semanas';

describe('semanas (America/Guatemala, CU-02.3 paso 3)', () => {
  it('CA-08.1 domingo por defecto y planificación sábado', () => {
    expect(calendarioSemana('2026-10-22', 'DOMINGO', 'SABADO', [])).toEqual({
      proximaSemana: { desde: '2026-10-25', hasta: '2026-10-31' },
      semanaTransicion: null,
      proximaPlanificacion: '2026-10-24',
    });
  });

  it('CA-08.2 conserva el aprobado y calcula la transición de un día', () => {
    expect(
      calendarioSemana('2026-10-22', 'LUNES', 'SABADO', [
        { fechaInicio: '2026-10-18', fechaFin: '2026-10-24' },
      ]),
    ).toEqual({
      proximaSemana: { desde: '2026-10-26', hasta: '2026-11-01' },
      semanaTransicion: { desde: '2026-10-25', hasta: '2026-10-25' },
      proximaPlanificacion: '2026-10-24',
    });
  });

  it.each(DIAS_SEMANA)('transición de cero a seis días al cambiar a %s', (dia) => {
    const resultado = calendarioSemana('2026-10-22', dia, 'DOMINGO', [
      { fechaInicio: '2026-10-18', fechaFin: '2026-10-24' },
    ]);
    expect(resultado.proximaSemana.hasta).toBe(sumarDias(resultado.proximaSemana.desde, 6));
    const largo =
      (Date.parse(resultado.proximaSemana.desde) - Date.parse('2026-10-25')) / 86_400_000;
    expect(largo).toBe(DIAS_SEMANA.indexOf(dia));
    if (largo)
      expect(resultado.semanaTransicion).toEqual({
        desde: '2026-10-25',
        hasta: sumarDias(resultado.proximaSemana.desde, -1),
      });
    else expect(resultado.semanaTransicion).toBeNull();
  });

  it('respeta el último aprobado futuro aunque llegue desordenado y omite históricos', () => {
    expect(
      calendarioSemana('2026-10-22', 'LUNES', 'DOMINGO', [
        { fechaInicio: '2026-11-01', fechaFin: '2026-11-07' },
        { fechaInicio: '2026-10-18', fechaFin: '2026-10-24' },
        { fechaInicio: '2026-10-11', fechaFin: '2026-10-17' },
      ]).proximaSemana,
    ).toEqual({ desde: '2026-11-09', hasta: '2026-11-15' });
  });

  it('cruza años y febrero bisiesto con semanas de siete días', () => {
    expect(calendarioSemana('2026-12-31', 'DOMINGO', 'DOMINGO', []).proximaSemana).toEqual({
      desde: '2027-01-03',
      hasta: '2027-01-09',
    });
    expect(calendarioSemana('2028-02-27', 'LUNES', 'LUNES', []).proximaSemana).toEqual({
      desde: '2028-02-28',
      hasta: '2028-03-05',
    });
  });
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
