import { describe, expect, it } from 'vitest';
import { GASTO_MAXIMO, MENSAJES_GASTO, compararGasto, validarGasto } from './gasto-real';

describe('validarGasto (CU-06.4 E1)', () => {
  it('acepta montos positivos con hasta 2 decimales', () => {
    expect(validarGasto('238.75')).toEqual({ ok: true, valor: 238.75 });
    expect(validarGasto(' 120 ')).toEqual({ ok: true, valor: 120 });
    expect(validarGasto(251.4)).toEqual({ ok: true, valor: 251.4 });
    expect(validarGasto('120.550')).toEqual({ ok: true, valor: 120.55 });
    expect(validarGasto(GASTO_MAXIMO)).toEqual({ ok: true, valor: GASTO_MAXIMO });
    expect(validarGasto('0.01')).toEqual({ ok: true, valor: 0.01 });
  });

  it('CA-27.3 rechaza 0 y negativos', () => {
    for (const malo of ['0', '-15.00', '0.00', 0, -1]) {
      expect(validarGasto(malo)).toEqual({ ok: false, mensaje: MENSAJES_GASTO.noPositivo });
    }
  });

  it('CA-27.3 rechaza más de 2 decimales', () => {
    expect(validarGasto('120.555')).toEqual({ ok: false, mensaje: MENSAJES_GASTO.decimales });
    expect(validarGasto(1.234)).toEqual({ ok: false, mensaje: MENSAJES_GASTO.decimales });
  });

  it('rechaza lo que no es un número y lo que pasa del máximo', () => {
    for (const malo of ['', '   ', 'abc', '12,50', '1e3', null, undefined]) {
      expect(validarGasto(malo)).toEqual({ ok: false, mensaje: MENSAJES_GASTO.invalido });
    }
    expect(validarGasto('100000')).toEqual({ ok: false, mensaje: MENSAJES_GASTO.maximo });
  });
});

describe('compararGasto (CA-27.1 y CA-27.2)', () => {
  it('CA-27.1 Q238.75 frente a Q229.50 estimado y Q245.00 de presupuesto', () => {
    expect(compararGasto('238.75', '229.50', '245.00')).toEqual({
      frenteAlEstimado: { monto: '9.25', texto: 'Q9.25 más que lo estimado' },
      frenteAlPresupuesto: { monto: '-6.25', texto: 'Q6.25 por debajo del presupuesto' },
    });
  });

  it('CA-27.2 corregido a Q251.40 queda por encima del presupuesto', () => {
    const r = compararGasto('251.40', '229.50', '245.00');
    expect(r.frenteAlEstimado?.texto).toBe('Q21.90 más que lo estimado');
    expect(r.frenteAlPresupuesto).toEqual({
      monto: '6.40',
      texto: 'Q6.40 por encima del presupuesto',
    });
  });

  it('gastar menos que lo estimado o justo lo estimado', () => {
    expect(compararGasto('200.00', '229.50', null).frenteAlEstimado?.texto).toBe(
      'Q29.50 menos que lo estimado',
    );
    const igual = compararGasto('245.00', '245.00', '245.00');
    expect(igual.frenteAlEstimado).toEqual({ monto: '0.00', texto: 'Igual a lo estimado' });
    expect(igual.frenteAlPresupuesto).toEqual({ monto: '0.00', texto: 'Justo en el presupuesto' });
  });

  it('sin costo estimado o sin presupuesto no compara con eso', () => {
    expect(compararGasto('100.00', null, null)).toEqual({
      frenteAlEstimado: null,
      frenteAlPresupuesto: null,
    });
  });
});
