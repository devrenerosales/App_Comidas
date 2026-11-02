import type { MenuSemanal, MenuTiempo } from '@menu/db';
import type { DetalleConPlatillo, MenuCompleto } from './menus.repositorio';
import { vistaMenu } from './menus.vista';

const menu = (extra: Partial<MenuSemanal> = {}): MenuSemanal =>
  ({
    id: 'm1',
    fechaInicio: '2026-11-01',
    fechaFin: '2026-11-07',
    estado: 'BORRADOR',
    desactualizado: false,
    version: 2,
    presupuestoSemanal: '500.00',
    sumaFactoresPorcion: '3.50',
    pesoPreferencia: '0.40',
    pesoNovedad: '0.25',
    pesoAhorro: '0.20',
    pesoAfinidad: '0.15',
    costoEstimado: null,
    costoIncompleto: true,
    excesoAlAprobar: null,
    ...extra,
  }) as MenuSemanal;
const tiempo = (t: MenuTiempo['tiempo'], extra: Partial<MenuTiempo> = {}): MenuTiempo =>
  ({
    id: `t-${t}`,
    menuId: 'm1',
    tiempo: t,
    porcentaje: '50.00',
    presupuesto: '250.00',
    costoEstimado: null,
    exceso: '0.00',
    intentosAjuste: 0,
    ...extra,
  }) as MenuTiempo;
const detalle = (
  id: string,
  fecha: string,
  t: DetalleConPlatillo['tiempo'],
  extra: Partial<DetalleConPlatillo> = {},
): DetalleConPlatillo =>
  ({
    id,
    fecha,
    tiempo: t,
    platilloId: 'p1',
    platilloNombre: 'Pollo en crema',
    platilloProteina: 'POLLO',
    fijado: false,
    origen: 'MOTOR',
    puntaje: '0.6375',
    factorPreferencia: '0.9000',
    factorNovedad: '0.5000',
    factorAhorro: '0.2000',
    factorAfinidad: '0.7500',
    costoEstimado: null,
    costoIncompleto: true,
    reglasAplicadas: [],
    ...extra,
  }) as DetalleConPlatillo;

describe('vistaMenu (api-contrato §3.1)', () => {
  it('arma la cabecera, los pesos, los tiempos y los detalles ordenados', () => {
    const completo: MenuCompleto = {
      menu: menu(),
      tiempos: [tiempo('CENA'), tiempo('ALMUERZO')],
      detalles: [
        detalle('d3', '2026-11-02', 'ALMUERZO'),
        detalle('d2', '2026-11-01', 'CENA'),
        detalle('d1', '2026-11-01', 'ALMUERZO'),
      ],
    };
    const v = vistaMenu(completo);
    expect(v).toMatchObject({
      id: 'm1',
      estado: 'BORRADOR',
      version: 2,
      presupuestoSemanal: '500.00',
      pesos: { preferencia: '0.40', novedad: '0.25', ahorro: '0.20', afinidad: '0.15' },
      excede: null,
      avisos: [],
    });
    expect(v.tiempos.map((t) => t.tiempo)).toEqual(['ALMUERZO', 'CENA']);
    expect(v.tiempos[0]).toMatchObject({ estado: 'COSTO_INCOMPLETO', intentosAjuste: 0 });
    expect(v.detalles.map((d) => d.id)).toEqual(['d1', 'd2', 'd3']);
    expect(v.detalles[0]).toMatchObject({
      platillo: { id: 'p1', nombre: 'Pollo en crema', proteinaPrincipal: 'POLLO' },
      puntaje: '0.6375',
      factores: { preferencia: '0.9000', novedad: '0.5000', ahorro: '0.2000', afinidad: '0.7500' },
    });
  });

  it('un espacio sin platillo genera el aviso SIN_SUGERENCIA y no trae platillo ni factores', () => {
    const v = vistaMenu({
      menu: menu(),
      tiempos: [tiempo('ALMUERZO')],
      detalles: [
        detalle('d1', '2026-11-06', 'ALMUERZO', {
          platilloId: null,
          platilloNombre: null,
          platilloProteina: null,
          puntaje: null,
          factorPreferencia: null,
          costoIncompleto: false,
        }),
      ],
    });
    expect(v.detalles[0]).toMatchObject({ platillo: null, factores: null, puntaje: null });
    expect(v.avisos).toEqual([
      {
        codigo: 'SIN_SUGERENCIA',
        fecha: '2026-11-06',
        tiempo: 'ALMUERZO',
        mensaje: 'Ningún platillo cumple RN-02 y RN-03 para este día',
      },
    ]);
  });

  it('un menú sin copia de pesos no los inventa y el exceso produce el texto rojo (RN-11)', () => {
    const v = vistaMenu({
      menu: menu({ pesoPreferencia: null, excesoAlAprobar: '12.40' }),
      tiempos: [
        tiempo('ALMUERZO', { costoEstimado: '293.15', exceso: '0.00' }),
        tiempo('CENA', { costoEstimado: '219.25', exceso: '19.25' }),
      ],
      detalles: [],
    });
    expect(v.pesos).toBeNull();
    expect(v.excede).toEqual({ monto: '12.40', texto: 'Excede por Q12.40' });
    expect(v.tiempos.map((t) => t.estado)).toEqual(['DENTRO_DEL_PRESUPUESTO', 'EXCEDE']);
  });

  it('un menú aprobado trae quién y cuándo lo aprobó y su lista de compras (HU-25)', () => {
    const v = vistaMenu({
      menu: menu({ estado: 'APROBADO', aprobadoEn: new Date('2026-11-02T15:10:00.000Z') }),
      tiempos: [],
      detalles: [],
      aprobadoPor: { id: 'u1', nombre: 'Ana' },
      listaId: 'l1',
    });
    expect(v.aprobadoPor).toEqual({ id: 'u1', nombre: 'Ana' });
    expect(v.aprobadoEn).toBe('2026-11-02T15:10:00.000Z');
    expect(v.listaId).toBe('l1');
  });

  it('un Borrador no trae aprobador, fecha de aprobación ni lista', () => {
    const v = vistaMenu({ menu: menu({ aprobadoEn: null }), tiempos: [], detalles: [] });
    expect(v).toMatchObject({ aprobadoPor: null, aprobadoEn: null, listaId: null });
  });

  it('el estado del tiempo distingue dentro, excede e incompleto (HU-21, D-18)', () => {
    const conPlatillo = (id: string, t: DetalleConPlatillo['tiempo'], incompleto: boolean) =>
      detalle(id, '2026-11-02', t, { costoIncompleto: incompleto });
    const v = vistaMenu({
      menu: menu(),
      tiempos: [
        tiempo('DESAYUNO', { costoEstimado: '100.00', exceso: '0.00' }),
        tiempo('ALMUERZO', { costoEstimado: '300.00', exceso: '0.00' }),
        tiempo('CENA', { costoEstimado: '260.00', exceso: '10.00' }),
      ],
      detalles: [
        conPlatillo('d', 'DESAYUNO', false),
        conPlatillo('a', 'ALMUERZO', true),
        conPlatillo('c', 'CENA', true),
      ],
    });
    expect(Object.fromEntries(v.tiempos.map((t) => [t.tiempo, t.estado]))).toEqual({
      DESAYUNO: 'DENTRO_DEL_PRESUPUESTO',
      // Con un platillo sin costo no se puede afirmar que está dentro del presupuesto.
      ALMUERZO: 'COSTO_INCOMPLETO',
      // Si lo conocido ya pasa del presupuesto, excede aunque falten precios.
      CENA: 'EXCEDE',
    });
  });
});
