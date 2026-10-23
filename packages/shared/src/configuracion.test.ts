import { describe, expect, it } from 'vitest';
import {
  CambioTiempo,
  MENSAJES_CONFIGURACION,
  OpcionTiempos,
  aCentavos,
  aCentesimas,
  aEnteroX100,
  calcularMontos,
  calcularMontosEnCentavos,
  deCentavos,
  esCombinacionValida,
  formatoPorcentaje,
  formatoQuetzales,
  normalizarTiempos,
  opcionDeTiempos,
  porcentajesActivos,
  porcentajesDesdeMontos,
  repartoDe,
  sumaCien,
  tiempoQueAbsorbe,
  tiemposDeOpcion,
  validarPresupuesto,
  validarSumaMontos,
  validarSumaPorcentajes,
  vistaPrevia,
  type ConfiguracionParaVistaPrevia,
} from './configuracion';
import { TiempoComida } from './enums';

const { DESAYUNO, ALMUERZO, CENA } = TiempoComida;

/** Configuración con los tiempos activos y sus porcentajes (los demás inactivos en 0). */
function config(
  presupuestoSemanal: string,
  activos: Partial<Record<TiempoComida, string>>,
): ConfiguracionParaVistaPrevia {
  return {
    presupuestoSemanal,
    tiempos: [DESAYUNO, ALMUERZO, CENA].map((tiempo) => ({
      tiempo,
      activo: activos[tiempo] !== undefined,
      porcentaje: activos[tiempo] ?? '0.00',
    })),
  };
}

describe('conversión de decimales a enteros (sin punto flotante)', () => {
  it.each([
    ['500', 50000],
    ['500.00', 50000],
    [' 12.5 ', 1250],
    ['0.01', 1],
    ['0', 0],
    [29, 2900],
    [0.1, 10],
    [33.33, 3333],
  ] as const)('aEnteroX100(%j) = %i', (entrada, esperado) => {
    expect(aEnteroX100(entrada)).toBe(esperado);
  });

  it.each(['', 'abc', '-1', '1.234', '1,5', '1e3', '1234567890'])('rechaza %j', (entrada) => {
    expect(aEnteroX100(entrada)).toBeNull();
  });

  it('rechaza números no finitos o negativos', () => {
    expect(aEnteroX100(Number.NaN)).toBeNull();
    expect(aEnteroX100(Number.POSITIVE_INFINITY)).toBeNull();
    expect(aEnteroX100(-5)).toBeNull();
  });

  it('deCentavos da 2 decimales y signo', () => {
    expect(deCentavos(50000)).toBe('500.00');
    expect(deCentavos(5)).toBe('0.05');
    expect(deCentavos(0)).toBe('0.00');
    expect(deCentavos(-6000)).toBe('-60.00');
    expect(aCentavos('248.50')).toBe(24850);
  });

  it('formatoQuetzales omite .00 salvo que se pida', () => {
    expect(formatoQuetzales(30000)).toBe('Q300');
    expect(formatoQuetzales(2050)).toBe('Q20.50');
    expect(formatoQuetzales(2000, true)).toBe('Q20.00');
  });

  it('formatoPorcentaje quita ceros sobrantes', () => {
    expect(formatoPorcentaje(500)).toBe('5');
    expect(formatoPorcentaje(1250)).toBe('12.5');
    expect(formatoPorcentaje(10000)).toBe('100');
    expect(formatoPorcentaje(2010)).toBe('20.1');
    expect(formatoPorcentaje(0)).toBe('0');
  });
});

describe('calcularMontos (RN-01, redondeo a centavos)', () => {
  it('CA-05.1 Q500 con almuerzo 60 % y cena 40 % → Q300 y Q200', () => {
    expect(calcularMontos('500.00', { ALMUERZO: 60, CENA: 40 })).toEqual({
      ALMUERZO: '300.00',
      CENA: '200.00',
    });
  });

  it('CA-05.2 Q500 con desayuno 29 % y almuerzo 71 % → Q145 y Q355', () => {
    expect(calcularMontos('500', { DESAYUNO: '29', ALMUERZO: '71' })).toEqual({
      DESAYUNO: '145.00',
      ALMUERZO: '355.00',
    });
  });

  it('CA-06.1 Q700 con 20/50/30 → Q140.00, Q350.00 y Q210.00', () => {
    expect(calcularMontos('700', { DESAYUNO: '20.00', ALMUERZO: '50.00', CENA: '30.00' })).toEqual({
      DESAYUNO: '140.00',
      ALMUERZO: '350.00',
      CENA: '210.00',
    });
  });

  it('la diferencia de redondeo va al almuerzo y la suma es exacta', () => {
    // Q100 entre 33.33 / 33.33 / 33.34 → 33.33 + 33.33 + 33.34 = 100.00
    const montos = calcularMontos('100.00', {
      DESAYUNO: '33.33',
      ALMUERZO: '33.33',
      CENA: '33.34',
    });
    expect(montos).toEqual({ DESAYUNO: '33.33', ALMUERZO: '33.33', CENA: '33.34' });
    // Q0.10 con 29/71: 0.029 → 0.03 y 0.071 → 0.07; ajuste: 0.03 + 0.07 = 0.10 (sin ajuste).
    expect(calcularMontos('0.10', { DESAYUNO: 29, ALMUERZO: 71 })).toEqual({
      DESAYUNO: '0.03',
      ALMUERZO: '0.07',
    });
    // Q0.05 con 50/50 (desayuno+almuerzo): 0.025 → 0.03 cada uno = 0.06 → almuerzo absorbe −0.01.
    expect(calcularMontos('0.05', { DESAYUNO: 50, ALMUERZO: 50 })).toEqual({
      DESAYUNO: '0.03',
      ALMUERZO: '0.02',
    });
  });

  it('sin almuerzo, la diferencia va al tiempo de mayor porcentaje', () => {
    // Q0.05 con desayuno 40 % (0.02) y cena 60 % (0.03) → exacto.
    expect(calcularMontos('0.05', { DESAYUNO: 40, CENA: 60 })).toEqual({
      DESAYUNO: '0.02',
      CENA: '0.03',
    });
    // Q0.01 con 50/50 sin almuerzo: 0.005 → 0.01 cada uno = 0.02 → el desayuno (empate, primero) absorbe.
    expect(calcularMontos('0.01', { DESAYUNO: 50, CENA: 50 })).toEqual({
      DESAYUNO: '0.00',
      CENA: '0.01',
    });
  });

  it('si los porcentajes no suman 100 no reparte la diferencia', () => {
    expect(calcularMontos('500', { ALMUERZO: 50, CENA: 40 })).toEqual({
      ALMUERZO: '250.00',
      CENA: '200.00',
    });
  });

  it('sin tiempos devuelve un objeto vacío', () => {
    expect(calcularMontosEnCentavos(50000, {})).toEqual({});
  });

  it('lanza error con presupuesto o porcentaje no válidos', () => {
    expect(() => calcularMontos('abc', { ALMUERZO: 100 })).toThrow(RangeError);
    expect(() => calcularMontos('500', { ALMUERZO: '100.5' })).toThrow(/ALMUERZO/);
    expect(() => calcularMontos('500', { ALMUERZO: 'x' })).toThrow(RangeError);
  });

  it('tiempoQueAbsorbe: almuerzo, mayor porcentaje o ninguno', () => {
    expect(tiempoQueAbsorbe({ DESAYUNO: 9000, ALMUERZO: 1000 })).toBe(ALMUERZO);
    expect(tiempoQueAbsorbe({ DESAYUNO: 4000, CENA: 6000 })).toBe(CENA);
    expect(tiempoQueAbsorbe({ DESAYUNO: 6000, CENA: 4000 })).toBe(DESAYUNO);
    expect(tiempoQueAbsorbe({})).toBeUndefined();
  });

  it('aCentesimas lee texto y números', () => {
    expect(aCentesimas({ ALMUERZO: '60.00', CENA: 40 })).toEqual({ ALMUERZO: 6000, CENA: 4000 });
  });
});

describe('validación "suman 100 %" (CU-02.2 6a)', () => {
  it('CA-06.3 20 %, 50 % y 25 % → "Faltan 5 % por asignar"', () => {
    expect(validarSumaPorcentajes({ DESAYUNO: 20, ALMUERZO: 50, CENA: 25 })).toEqual({
      valido: false,
      suma: 9500,
      diferencia: 500,
      mensaje: 'Faltan 5 % por asignar',
    });
  });

  it('CA-07.5 almuerzo a 45 % en la vista previa 20/50/30 → "Faltan 5 % por asignar"', () => {
    expect(validarSumaPorcentajes({ DESAYUNO: 20, ALMUERZO: 45, CENA: 30 }).mensaje).toBe(
      'Faltan 5 % por asignar',
    );
  });

  it('sobrante con decimales → "Sobran 2.5 %"', () => {
    expect(validarSumaPorcentajes({ ALMUERZO: '62.5', CENA: '40' })).toMatchObject({
      valido: false,
      diferencia: -250,
      mensaje: 'Sobran 2.5 %',
    });
  });

  it('suma exacta con decimales es válida', () => {
    expect(validarSumaPorcentajes({ ALMUERZO: '64.00', CENA: '36.00' })).toEqual({
      valido: true,
      suma: 10000,
      diferencia: 0,
      mensaje: null,
    });
    expect(sumaCien({ DESAYUNO: '33.33', ALMUERZO: '33.33', CENA: '33.34' })).toBe(true);
    expect(sumaCien({ ALMUERZO: 99.99 })).toBe(false);
  });
});

describe('modo monto (CU-02.2 6b)', () => {
  it('CA-06.4 Q320 + Q200 con Q500 → "Excede el presupuesto por Q20.00"', () => {
    expect(validarSumaMontos('500', { ALMUERZO: '320', CENA: '200' })).toEqual({
      valido: false,
      suma: 52000,
      diferencia: -2000,
      mensaje: 'Excede el presupuesto por Q20.00',
    });
  });

  it('faltante → "Faltan Q20.00 por asignar"', () => {
    expect(validarSumaMontos('500', { ALMUERZO: '300', CENA: '180' }).mensaje).toBe(
      'Faltan Q20.00 por asignar',
    );
  });

  it('lanza error con presupuesto o monto no válidos', () => {
    expect(() => validarSumaMontos('-1', { ALMUERZO: '1' })).toThrow(RangeError);
    expect(() => validarSumaMontos('500', { ALMUERZO: '1.001' })).toThrow(/ALMUERZO/);
  });

  it('CA-06.2 Q320 y Q180 de Q500 → 64 % almuerzo y 36 % cena', () => {
    expect(porcentajesDesdeMontos('500', { ALMUERZO: '320', CENA: '180' })).toEqual({
      ALMUERZO: '64.00',
      CENA: '36.00',
    });
  });

  it('el redondeo del porcentaje va al almuerzo para sumar 100.00 %', () => {
    // 1/3 de Q1000 en cada tiempo: 33.33 % ×3 = 99.99 → almuerzo 33.34.
    expect(
      porcentajesDesdeMontos('1000', { DESAYUNO: '333.33', ALMUERZO: '333.33', CENA: '333.34' }),
    ).toEqual({ DESAYUNO: '33.33', ALMUERZO: '33.34', CENA: '33.33' });
    // Sin almuerzo absorbe el de mayor monto.
    expect(porcentajesDesdeMontos('3', { DESAYUNO: '1', CENA: '2' })).toEqual({
      DESAYUNO: '33.33',
      CENA: '66.67',
    });
  });

  it('lanza error si los montos no suman el presupuesto o el presupuesto es cero', () => {
    expect(() => porcentajesDesdeMontos('500', { ALMUERZO: '320', CENA: '200' })).toThrow(
      'Excede el presupuesto por Q20.00',
    );
    expect(() => porcentajesDesdeMontos('0', { ALMUERZO: '0' })).toThrow(
      MENSAJES_CONFIGURACION.presupuestoInvalido,
    );
  });
});

describe('validarPresupuesto (CU-02.2 E1)', () => {
  it.each(['', '0', '0.00', '-5', 'abc', '10.123', null, undefined] as const)(
    '%j → "Ingresa un presupuesto mayor a Q0.00"',
    (valor) => {
      expect(validarPresupuesto(valor)).toBe(MENSAJES_CONFIGURACION.presupuestoInvalido);
    },
  );

  it('acepta montos positivos con hasta 2 decimales y hasta Q99999.99', () => {
    expect(validarPresupuesto('500')).toBeNull();
    expect(validarPresupuesto('0.01')).toBeNull();
    expect(validarPresupuesto(99999.99)).toBeNull();
    expect(validarPresupuesto('100000')).toBe(MENSAJES_CONFIGURACION.presupuestoMaximo);
  });
});

describe('opciones de tiempos (CU-02.1)', () => {
  it('normalizarTiempos ordena y quita duplicados', () => {
    expect(normalizarTiempos([CENA, ALMUERZO, CENA])).toEqual([ALMUERZO, CENA]);
  });

  it.each([
    [[ALMUERZO], true],
    [[ALMUERZO, CENA], true],
    [[DESAYUNO, ALMUERZO], true],
    [[DESAYUNO, CENA], true],
    [[CENA, DESAYUNO, ALMUERZO], true],
    [[], false],
    [[DESAYUNO], false],
    [[CENA], false],
    [[ALMUERZO, ALMUERZO], false],
  ] as const)('esCombinacionValida(%j) = %s', (tiempos, esperado) => {
    expect(esCombinacionValida(tiempos)).toBe(esperado);
  });

  it('opcionDeTiempos', () => {
    expect(opcionDeTiempos([ALMUERZO])).toBe(OpcionTiempos.SOLO_ALMUERZO);
    expect(opcionDeTiempos([DESAYUNO, CENA])).toBe(OpcionTiempos.DOS_TIEMPOS);
    expect(opcionDeTiempos([DESAYUNO, ALMUERZO, CENA])).toBe(OpcionTiempos.TRES_TIEMPOS);
    expect(opcionDeTiempos([CENA])).toBeNull();
  });

  it('CA-05.1 solo almuerzo y tres tiempos', () => {
    expect(tiemposDeOpcion(OpcionTiempos.SOLO_ALMUERZO, [CENA])).toEqual({
      valido: true,
      tiempos: [ALMUERZO],
    });
    expect(tiemposDeOpcion(OpcionTiempos.TRES_TIEMPOS)).toEqual({
      valido: true,
      tiempos: [DESAYUNO, ALMUERZO, CENA],
    });
  });

  it('CA-05.2 dos tiempos: desayuno y almuerzo', () => {
    expect(tiemposDeOpcion(OpcionTiempos.DOS_TIEMPOS, [ALMUERZO, DESAYUNO])).toEqual({
      valido: true,
      tiempos: [DESAYUNO, ALMUERZO],
    });
  });

  it('CA-05.3 dos tiempos con solo "Cena" → "Selecciona exactamente dos tiempos"', () => {
    const esperado = { valido: false, mensaje: 'Selecciona exactamente dos tiempos' };
    expect(tiemposDeOpcion(OpcionTiempos.DOS_TIEMPOS, [CENA])).toEqual(esperado);
    expect(tiemposDeOpcion(OpcionTiempos.DOS_TIEMPOS, [DESAYUNO, ALMUERZO, CENA])).toEqual(
      esperado,
    );
    expect(tiemposDeOpcion(OpcionTiempos.DOS_TIEMPOS)).toEqual(esperado);
  });
});

describe('vistaPrevia (CU-02.3)', () => {
  it('CA-07.1 de almuerzo 60 % + cena 40 % con Q600 a tres tiempos', () => {
    const vista = vistaPrevia(config('600.00', { ALMUERZO: '60.00', CENA: '40.00' }), [
      DESAYUNO,
      ALMUERZO,
      CENA,
    ]);
    expect(vista.valida).toBe(true);
    expect(vista.mensaje).toBeNull();
    expect(vista.presupuestoSemanal).toBe('600.00');
    expect(vista.actual).toEqual([
      { tiempo: ALMUERZO, porcentaje: '60.00', monto: '360.00' },
      { tiempo: CENA, porcentaje: '40.00', monto: '240.00' },
    ]);
    expect(vista.impacto).toEqual([
      {
        tiempo: DESAYUNO,
        cambio: CambioTiempo.AGREGADO,
        actual: null,
        nuevo: { porcentaje: '20.00', monto: '120.00' },
        diferenciaMonto: '120.00',
      },
      {
        tiempo: ALMUERZO,
        cambio: CambioTiempo.MODIFICADO,
        actual: { porcentaje: '60.00', monto: '360.00' },
        nuevo: { porcentaje: '50.00', monto: '300.00' },
        diferenciaMonto: '-60.00',
      },
      {
        tiempo: CENA,
        cambio: CambioTiempo.MODIFICADO,
        actual: { porcentaje: '40.00', monto: '240.00' },
        nuevo: { porcentaje: '30.00', monto: '180.00' },
        diferenciaMonto: '-60.00',
      },
    ]);
  });

  it('CA-07.3 de solo almuerzo Q250 a almuerzo + cena: Q150 y Q100', () => {
    const vista = vistaPrevia(config('250.00', { ALMUERZO: '100.00' }), [ALMUERZO, CENA]);
    expect(vista.nuevo).toEqual([
      { tiempo: ALMUERZO, porcentaje: '60.00', monto: '150.00' },
      { tiempo: CENA, porcentaje: '40.00', monto: '100.00' },
    ]);
  });

  it('propone siempre la distribución por defecto (no conserva % personalizados)', () => {
    const vista = vistaPrevia(config('500.00', { ALMUERZO: '64.00', CENA: '36.00' }), [
      DESAYUNO,
      ALMUERZO,
      CENA,
    ]);
    expect(vista.nuevo.map((r) => r.porcentaje)).toEqual(['20.00', '50.00', '30.00']);
  });

  it('marca tiempos quitados y sin cambio', () => {
    const vista = vistaPrevia(
      config('500.00', { DESAYUNO: '20.00', ALMUERZO: '50.00', CENA: '30.00' }),
      [ALMUERZO],
    );
    expect(vista.impacto.map((i) => [i.tiempo, i.cambio, i.diferenciaMonto])).toEqual([
      [DESAYUNO, CambioTiempo.QUITADO, '-100.00'],
      [ALMUERZO, CambioTiempo.MODIFICADO, '250.00'],
      [CENA, CambioTiempo.QUITADO, '-150.00'],
    ]);
    const igual = vistaPrevia(config('500.00', { ALMUERZO: '100.00' }), [ALMUERZO]);
    expect(igual.impacto).toEqual([
      {
        tiempo: ALMUERZO,
        cambio: CambioTiempo.SIN_CAMBIO,
        actual: { porcentaje: '100.00', monto: '500.00' },
        nuevo: { porcentaje: '100.00', monto: '500.00' },
        diferenciaMonto: '0.00',
      },
    ]);
  });

  it('usa el presupuesto indicado en lugar del vigente', () => {
    const vista = vistaPrevia(config('250.00', { ALMUERZO: '100.00' }), [ALMUERZO, CENA], '500');
    expect(vista.presupuestoSemanal).toBe('500.00');
    expect(vista.nuevo.map((r) => r.monto)).toEqual(['300.00', '200.00']);
    expect(vista.actual).toEqual([{ tiempo: ALMUERZO, porcentaje: '100.00', monto: '250.00' }]);
  });

  it('CA-07.5 ajuste que no suma 100 %: vista no válida con "Faltan 5 % por asignar"', () => {
    const vista = vistaPrevia(
      config('600.00', { ALMUERZO: '60.00', CENA: '40.00' }),
      [DESAYUNO, ALMUERZO, CENA],
      undefined,
      { DESAYUNO: 20, ALMUERZO: 45, CENA: 30 },
    );
    expect(vista.valida).toBe(false);
    expect(vista.mensaje).toBe('Faltan 5 % por asignar');
    expect(vista.nuevo.find((r) => r.tiempo === ALMUERZO)?.monto).toBe('270.00');
  });

  it('ajuste válido se respeta', () => {
    const vista = vistaPrevia(
      config('500.00', { ALMUERZO: '100.00' }),
      [ALMUERZO, CENA],
      undefined,
      { ALMUERZO: '64', CENA: '36' },
    );
    expect(vista.valida).toBe(true);
    expect(vista.nuevo.map((r) => r.monto)).toEqual(['320.00', '180.00']);
  });

  it('lanza error con combinación inválida, ajuste de otros tiempos o presupuesto inválido', () => {
    const actual = config('500.00', { ALMUERZO: '100.00' });
    expect(() => vistaPrevia(actual, [CENA])).toThrow(MENSAJES_CONFIGURACION.combinacionInvalida);
    expect(() => vistaPrevia(actual, [ALMUERZO, CENA], undefined, { ALMUERZO: 100 })).toThrow(
      MENSAJES_CONFIGURACION.distribucionIncompleta,
    );
    expect(() => vistaPrevia(actual, [ALMUERZO], 'x')).toThrow(RangeError);
  });

  it('repartoDe y porcentajesActivos', () => {
    expect(porcentajesActivos(config('1', { ALMUERZO: '60.00', CENA: '40.00' }).tiempos)).toEqual({
      ALMUERZO: '60.00',
      CENA: '40.00',
    });
    expect(() => repartoDe('0.001', { ALMUERZO: 100 })).toThrow(RangeError);
  });
});
