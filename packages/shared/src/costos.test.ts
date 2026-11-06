import { describe, expect, it } from 'vitest';
import { costosDelMenu, type MenuParaCostos } from './costos';

const PLATILLO = { id: 'p' };
const DIAS = [
  '2026-11-01',
  '2026-11-02',
  '2026-11-03',
  '2026-11-04',
  '2026-11-05',
  '2026-11-06',
  '2026-11-07',
];
const detalle = (
  fecha: string,
  costo: string | null,
  extra: Partial<MenuParaCostos['detalles'][number]> = {},
): MenuParaCostos['detalles'][number] => ({
  fecha,
  tiempo: 'ALMUERZO',
  platillo: PLATILLO,
  costoEstimado: costo,
  costoIncompleto: false,
  ...extra,
});
/** Almuerzo del documento (CA-26.1): Q28.00, 31.50, 38.00, 26.00, 42.00, 30.00 y 34.00. */
const ALMUERZOS = ['28.00', '31.50', '38.00', '26.00', '42.00', '30.00', '34.00'];
const solo = (costos: (string | null)[]) => costos.map((c, i) => detalle(DIAS[i]!, c));
const menuBase = (sobre: Partial<MenuParaCostos> = {}): MenuParaCostos => ({
  presupuestoSemanal: '245.00',
  costoEstimado: '229.50',
  costoIncompleto: false,
  tiempos: [
    {
      tiempo: 'ALMUERZO',
      presupuesto: '245.00',
      costoEstimado: '229.50',
      exceso: '0.00',
      estado: 'DENTRO_DEL_PRESUPUESTO',
    },
  ],
  detalles: solo(ALMUERZOS),
  ...sobre,
});

describe('costosDelMenu', () => {
  it('CA-26.1 total dentro del presupuesto con lo disponible', () => {
    const c = costosDelMenu(menuBase());
    expect(c).toMatchObject({
      total: '229.50',
      presupuesto: '245.00',
      diferencia: '15.50',
      excede: false,
      exceso: '0.00',
      costoIncompleto: false,
    });
    expect(c.porDia.map((d) => d.costo)).toEqual(ALMUERZOS);
    expect(c.porDia[0]).toEqual({
      fecha: '2026-11-01',
      costo: '28.00',
      incompleto: false,
      tiempos: [{ tiempo: 'ALMUERZO', costo: '28.00', incompleto: false }],
    });
  });

  it('CA-26.2 un tiempo excede aunque el total esté dentro', () => {
    const c = costosDelMenu(
      menuBase({
        presupuestoSemanal: '500.00',
        costoEstimado: '480.00',
        tiempos: [
          {
            tiempo: 'ALMUERZO',
            presupuesto: '300.00',
            costoEstimado: '310.00',
            exceso: '10.00',
            estado: 'EXCEDE',
          },
          {
            tiempo: 'CENA',
            presupuesto: '200.00',
            costoEstimado: '170.00',
            exceso: '0.00',
            estado: 'DENTRO_DEL_PRESUPUESTO',
          },
        ],
      }),
    );
    expect(c.excede).toBe(false);
    expect(c.diferencia).toBe('20.00');
    expect(c.porTiempo).toEqual([
      {
        tiempo: 'ALMUERZO',
        costo: '310.00',
        presupuesto: '300.00',
        exceso: '10.00',
        excede: true,
        estado: 'EXCEDE',
      },
      {
        tiempo: 'CENA',
        costo: '170.00',
        presupuesto: '200.00',
        exceso: '0.00',
        excede: false,
        estado: 'DENTRO_DEL_PRESUPUESTO',
      },
    ]);
  });

  it('CA-26.3 el día de un platillo con ingrediente sin precio queda incompleto', () => {
    const detalles = solo(ALMUERZOS);
    detalles[6] = detalle(DIAS[6]!, '34.00', { costoIncompleto: true });
    const c = costosDelMenu(menuBase({ detalles, costoIncompleto: true }));
    expect(c.costoIncompleto).toBe(true);
    expect(c.porDia[6]).toMatchObject({ costo: '34.00', incompleto: true });
    expect(c.porDia[5]!.incompleto).toBe(false);
  });

  it('CA-26.4 al cambiar un platillo el total pasa a Q248.50 y excede por Q3.50', () => {
    const c = costosDelMenu(
      menuBase({
        costoEstimado: '248.50',
        detalles: solo(['28.00', '31.50', '38.00', '45.00', '42.00', '30.00', '34.00']),
      }),
    );
    expect(c).toMatchObject({ total: '248.50', diferencia: '-3.50', excede: true, exceso: '3.50' });
    expect(c.porDia[3]!.costo).toBe('45.00');
  });

  it('E1 sin presupuesto muestra solo los costos', () => {
    const c = costosDelMenu(menuBase({ presupuestoSemanal: null }));
    expect(c).toMatchObject({
      total: '229.50',
      presupuesto: null,
      diferencia: null,
      excede: false,
      exceso: '0.00',
    });
  });

  it('sin ningún costo conocido no hay total ni diferencia', () => {
    const c = costosDelMenu(
      menuBase({
        costoEstimado: null,
        costoIncompleto: true,
        detalles: solo([null, null]),
      }),
    );
    expect(c).toMatchObject({ total: null, diferencia: null, excede: false });
    expect(c.porDia).toEqual([
      {
        fecha: '2026-11-01',
        costo: null,
        incompleto: true,
        tiempos: [{ tiempo: 'ALMUERZO', costo: null, incompleto: true }],
      },
      {
        fecha: '2026-11-02',
        costo: null,
        incompleto: true,
        tiempos: [{ tiempo: 'ALMUERZO', costo: null, incompleto: true }],
      },
    ]);
  });

  it('un espacio sin platillo no cuenta y varios tiempos de un día se suman en orden', () => {
    const c = costosDelMenu(
      menuBase({
        detalles: [
          detalle('2026-11-02', '12.25', { tiempo: 'CENA' }),
          detalle('2026-11-02', '30.00'),
          detalle('2026-11-01', null, { platillo: null }),
        ],
      }),
    );
    expect(c.porDia[0]).toEqual({
      fecha: '2026-11-01',
      costo: null,
      incompleto: false,
      tiempos: [{ tiempo: 'ALMUERZO', costo: null, incompleto: false }],
    });
    expect(c.porDia[1]).toMatchObject({ fecha: '2026-11-02', costo: '42.25', incompleto: false });
    expect(c.porDia[1]!.tiempos.map((t) => t.tiempo)).toEqual(['ALMUERZO', 'CENA']);
  });
});
