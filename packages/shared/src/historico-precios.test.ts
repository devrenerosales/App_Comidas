import { describe, expect, it } from 'vitest';
import { seriesDePrecios, variacionPorcentual, type PrecioHistorico } from './historico-precios';

const HOY = '2026-10-24';

const p = (
  supermercado: string,
  precio: string,
  fecha: string,
  origen: PrecioHistorico['origen'] = 'AUTOMATICO',
): PrecioHistorico => ({
  supermercadoId: supermercado.toLowerCase(),
  supermercado,
  precio,
  fecha,
  origen,
});

describe('variacionPorcentual', () => {
  it('sube: 21 → 22 es +4.8 %', () => {
    expect(variacionPorcentual('21.00', '22.00')).toEqual({
      porcentaje: 4.8,
      texto: '+4.8 %',
      tendencia: 'SUBE',
    });
  });

  it('baja: 7.00 → 6.30 es −10.0 % con signo menos tipográfico', () => {
    expect(variacionPorcentual('7.00', '6.30')).toEqual({
      porcentaje: -10,
      texto: '−10.0 %',
      tendencia: 'BAJA',
    });
  });

  it('igual es 0.0 % y una diferencia mínima también redondea a 0.0 %', () => {
    expect(variacionPorcentual('5.00', '5.00')).toMatchObject({
      texto: '0.0 %',
      tendencia: 'IGUAL',
    });
    expect(variacionPorcentual('1000.00', '1000.01').texto).toBe('0.0 %');
  });

  it('redondea la mitad alejándola de cero, sin errores de punto flotante', () => {
    // 0.05 / 4.00 = 1.25 % → 1.3 %; y en baja −1.3 %.
    expect(variacionPorcentual('4.00', '4.05').texto).toBe('+1.3 %');
    expect(variacionPorcentual('4.00', '3.95').texto).toBe('−1.3 %');
  });

  it('un anterior de 0 no se puede comparar', () => {
    expect(variacionPorcentual(0, '5.00')).toEqual({
      porcentaje: null,
      texto: '—',
      tendencia: null,
    });
  });
});

describe('seriesDePrecios (HU-37)', () => {
  it('CA-37.1 tres precios en Walmart: +4.8 % vs. anterior y +10.0 % en el periodo', () => {
    const [walmart] = seriesDePrecios(
      [
        p('Walmart', '22.00', '2026-10-24'),
        p('Walmart', '20.00', '2026-10-10'),
        p('Walmart', '21.00', '2026-10-17'),
      ],
      HOY,
    );
    expect(walmart!.puntos.map((x) => [x.fecha, x.precioNormalizado])).toEqual([
      ['2026-10-10', '20.00'],
      ['2026-10-17', '21.00'],
      ['2026-10-24', '22.00'],
    ]);
    expect(walmart!.variacionAnterior.texto).toBe('+4.8 %');
    expect(walmart!.variacionPeriodo.texto).toBe('+10.0 %');
  });

  it('CA-37.2 baja en Paiz con indicador de baja', () => {
    const [paiz] = seriesDePrecios([p('Paiz', '7.00', '2026-10-17'), p('Paiz', '6.30', HOY)], HOY);
    expect(paiz!.variacionAnterior).toMatchObject({ texto: '−10.0 %', tendencia: 'BAJA' });
  });

  it('CA-37.3 un solo precio: las variaciones son "—"', () => {
    const [fresh] = seriesDePrecios([p('Super Fresh', '12.90', HOY)], HOY);
    expect(fresh!.puntos).toHaveLength(1);
    expect(fresh!.variacionAnterior.texto).toBe('—');
    expect(fresh!.variacionPeriodo.texto).toBe('—');
  });

  it('2a el periodo de 4 semanas recalcula la variación del periodo', () => {
    const precios = [
      p('Walmart', '10.00', '2026-08-30'),
      p('Walmart', '20.00', '2026-10-10'),
      p('Walmart', '22.00', HOY),
    ];
    const [en12] = seriesDePrecios(precios, HOY, 12);
    const [en4] = seriesDePrecios(precios, HOY, 4);
    expect(en12!.variacionPeriodo.texto).toBe('+120.0 %');
    expect(en4!.puntos).toHaveLength(2);
    expect(en4!.variacionPeriodo.texto).toBe('+10.0 %');
  });

  it('un supermercado sin precios en el periodo no aparece', () => {
    const series = seriesDePrecios(
      [p('Walmart', '20.00', HOY), p('Paiz', '19.00', '2026-05-01')],
      HOY,
    );
    expect(series.map((s) => s.supermercado.nombre)).toEqual(['Walmart']);
  });

  it('separa los supermercados, en orden alfabético, y conserva el origen', () => {
    const series = seriesDePrecios(
      [
        p('Walmart', '20.00', HOY, 'MANUAL'),
        p('La Torre', '21.00', HOY, 'TICKET'),
        p('Paiz', '19.00', HOY),
      ],
      HOY,
    );
    expect(series.map((s) => s.supermercado.nombre)).toEqual(['La Torre', 'Paiz', 'Walmart']);
    expect(series.map((s) => s.puntos[0]!.origen)).toEqual(['TICKET', 'AUTOMATICO', 'MANUAL']);
  });

  it('con dos precios el mismo día respeta el orden de llegada', () => {
    const [w] = seriesDePrecios([p('Walmart', '20.00', HOY), p('Walmart', '21.00', HOY)], HOY);
    expect(w!.puntos.map((x) => x.precioNormalizado)).toEqual(['20.00', '21.00']);
    expect(w!.variacionAnterior.texto).toBe('+5.0 %');
  });

  it('E1 sin precios devuelve una lista vacía', () => {
    expect(seriesDePrecios([], HOY)).toEqual([]);
  });
});
