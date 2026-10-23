import type { Configuracion, TiempoComidaConfig } from '@menu/db';
import { Problema } from '../comun/problema';
import {
  VersionDesactualizadaError,
  type ConfiguracionLeida,
  type ConfiguracionRepositorio,
} from './configuracion.repositorio';
import {
  ConfiguracionService,
  filasDeTiempos,
  vistaConfiguracionHogar,
} from './configuracion.service';

const HOY = new Date('2026-10-22T15:00:00.000Z');
type Tiempo = 'DESAYUNO' | 'ALMUERZO' | 'CENA';

/** Configuración leída de la base con el presupuesto y los % activos indicados. */
function leida(
  presupuesto: string,
  activos: Partial<Record<Tiempo, string>>,
  version = 1,
): ConfiguracionLeida {
  return {
    configuracion: {
      id: 'c1',
      hogarId: 'h1',
      presupuestoSemanal: presupuesto,
      diaInicioSemana: 'DOMINGO',
      diaPlanificacion: 'DOMINGO',
      horaPlanificacion: 8,
      pesoPreferencia: '0.40',
      pesoNovedad: '0.25',
      pesoAhorro: '0.20',
      pesoAfinidad: '0.15',
      umbralSimilitud: '0.80',
      version,
      actualizadoPorId: null,
      createdAt: HOY,
      updatedAt: HOY,
    } as Configuracion,
    tiempos: (['DESAYUNO', 'ALMUERZO', 'CENA'] as const).map(
      (tiempo) =>
        ({
          id: tiempo,
          configuracionId: 'c1',
          tiempo,
          activo: activos[tiempo] !== undefined,
          porcentaje: activos[tiempo] ?? '0.00',
        }) as TiempoComidaConfig,
    ),
  };
}

/** Código y mensaje del `Problema` que lanza la promesa. */
async function problema(promesa: Promise<unknown>): Promise<[number, string, string]> {
  try {
    await promesa;
  } catch (error) {
    if (error instanceof Problema) return [error.getStatus(), error.codigo, error.detalle];
    throw error;
  }
  throw new Error('Se esperaba un Problema');
}

describe('ConfiguracionService', () => {
  const repo = { leer: jest.fn(), menusFuturos: jest.fn(), guardar: jest.fn() };
  const servicio = new ConfiguracionService(repo as unknown as ConfiguracionRepositorio, () => HOY);

  beforeEach(() => {
    jest.clearAllMocks();
    repo.menusFuturos.mockResolvedValue([]);
    repo.guardar.mockImplementation(
      (
        _h: string,
        version: number,
        cambios: {
          presupuestoSemanal?: string;
          tiempos?: { tiempo: Tiempo; activo: boolean; porcentaje: string }[];
        },
      ) => {
        const activos: Partial<Record<Tiempo, string>> = {};
        for (const t of cambios.tiempos ?? []) if (t.activo) activos[t.tiempo] = t.porcentaje;
        return Promise.resolve({
          ...leida(
            cambios.presupuestoSemanal ?? '500.00',
            cambios.tiempos ? activos : { ALMUERZO: '100.00' },
            version + 1,
          ),
          borradoresDesactualizados: [],
        });
      },
    );
  });

  it('vistaConfiguracionHogar expone montos (RN-01) y pesos en texto decimal', () => {
    const vista = vistaConfiguracionHogar(leida('500.00', { ALMUERZO: '60.00', CENA: '40.00' }));
    expect(vista.tiempos).toEqual([
      { tiempo: 'DESAYUNO', activo: false, porcentaje: '0.00', monto: '0.00' },
      { tiempo: 'ALMUERZO', activo: true, porcentaje: '60.00', monto: '300.00' },
      { tiempo: 'CENA', activo: true, porcentaje: '40.00', monto: '200.00' },
    ]);
    expect(vista.pesos).toEqual({
      preferencia: '0.40',
      novedad: '0.25',
      ahorro: '0.20',
      afinidad: '0.15',
    });
    expect(vista.actualizadoEn).toBe(HOY.toISOString());
  });

  it('filasDeTiempos deja siempre las tres filas, inactivas en 0', () => {
    expect(filasDeTiempos({ CENA: '40.00', ALMUERZO: '60.00' })).toEqual([
      { tiempo: 'DESAYUNO', activo: false, porcentaje: '0.00' },
      { tiempo: 'ALMUERZO', activo: true, porcentaje: '60.00' },
      { tiempo: 'CENA', activo: true, porcentaje: '40.00' },
    ]);
  });

  it('404 si el hogar no tiene configuración', async () => {
    repo.leer.mockResolvedValue(null);
    expect(await problema(servicio.obtener('h1'))).toEqual([
      404,
      'NO_ENCONTRADO',
      expect.any(String),
    ]);
  });

  it('CA-07.1 vista previa con menús futuros: aprobados conservados y borradores a desactualizar', async () => {
    repo.leer.mockResolvedValue(leida('600.00', { ALMUERZO: '60.00', CENA: '40.00' }));
    repo.menusFuturos.mockResolvedValue([
      { id: 'm1', fechaInicio: '2026-10-25', fechaFin: '2026-10-31', estado: 'APROBADO' },
      { id: 'm2', fechaInicio: '2026-11-01', fechaFin: '2026-11-07', estado: 'BORRADOR' },
    ]);
    const vista = await servicio.vistaPrevia('h1', { tiempos: ['CENA', 'DESAYUNO', 'ALMUERZO'] });
    expect(repo.menusFuturos).toHaveBeenCalledWith('h1', '2026-10-22');
    expect(vista.nuevo.map((r) => r.monto)).toEqual(['120.00', '300.00', '180.00']);
    expect(vista.aplicaDesde).toBe('2026-11-01');
    expect(vista.menusAprobadosConservados).toEqual([
      { id: 'm1', fechaInicio: '2026-10-25', fechaFin: '2026-10-31' },
    ]);
    expect(vista.borradoresADesactualizar).toEqual([
      { id: 'm2', fechaInicio: '2026-11-01', fechaFin: '2026-11-07' },
    ]);
    expect(repo.guardar).not.toHaveBeenCalled();
  });

  it('CA-05.3 / CA-07.5 errores de la vista previa', async () => {
    repo.leer.mockResolvedValue(leida('500.00', { ALMUERZO: '100.00' }));
    expect((await problema(servicio.vistaPrevia('h1', { tiempos: ['CENA'] })))[1]).toBe(
      'COMBINACION_TIEMPOS_INVALIDA',
    );
    expect(
      await problema(
        servicio.vistaPrevia('h1', {
          tiempos: ['DESAYUNO', 'ALMUERZO', 'CENA'],
          distribucion: [
            { tiempo: 'DESAYUNO', porcentaje: '20' },
            { tiempo: 'ALMUERZO', porcentaje: '45' },
            { tiempo: 'CENA', porcentaje: '30' },
          ],
        }),
      ),
    ).toEqual([422, 'PORCENTAJES_NO_SUMAN_100', 'Faltan 5 % por asignar']);
    expect(
      (
        await problema(
          servicio.vistaPrevia('h1', { tiempos: ['ALMUERZO'], presupuestoSemanal: '0' }),
        )
      )[1],
    ).toBe('PRESUPUESTO_INVALIDO');
    expect(
      (
        await problema(
          servicio.vistaPrevia('h1', {
            tiempos: ['ALMUERZO'],
            distribucion: [{ tiempo: 'ALMUERZO', porcentaje: 'cien' }],
          }),
        )
      )[1],
    ).toBe('DISTRIBUCION_INVALIDA');
  });

  it('CA-05.1 guardar tiempos normaliza porcentajes y guarda las tres filas', async () => {
    repo.leer.mockResolvedValue(leida('500.00', { ALMUERZO: '100.00' }));
    const res = await servicio.guardarTiempos('h1', 'u1', {
      version: 1,
      tiempos: [
        { tiempo: 'CENA', porcentaje: '40' },
        { tiempo: 'ALMUERZO', porcentaje: '60.0' },
      ],
    });
    expect(repo.guardar).toHaveBeenCalledWith(
      'h1',
      1,
      { tiempos: filasDeTiempos({ ALMUERZO: '60.00', CENA: '40.00' }) },
      'u1',
      '2026-10-22',
    );
    expect(res.version).toBe(2);
  });

  it('CU-02.3 E1 versión distinta o cambiada en paralelo → 409 VERSION_DESACTUALIZADA', async () => {
    repo.leer.mockResolvedValue(leida('500.00', { ALMUERZO: '100.00' }, 2));
    const cuerpo = { version: 1, tiempos: [{ tiempo: 'ALMUERZO' as const, porcentaje: '100' }] };
    expect(await problema(servicio.guardarTiempos('h1', 'u1', cuerpo))).toEqual([
      409,
      'VERSION_DESACTUALIZADA',
      'La configuración cambió, revisa de nuevo',
    ]);
    repo.leer.mockResolvedValue(leida('500.00', { ALMUERZO: '100.00' }, 1));
    repo.guardar.mockRejectedValueOnce(new VersionDesactualizadaError());
    expect(
      (
        await problema(
          servicio.guardarPresupuesto('h1', 'u1', { version: 1, presupuestoSemanal: '600' }),
        )
      )[0],
    ).toBe(409);
    repo.guardar.mockRejectedValueOnce(new Error('caída'));
    await expect(
      servicio.guardarPresupuesto('h1', 'u1', { version: 1, presupuestoSemanal: '600' }),
    ).rejects.toThrow('caída');
  });

  it('sin cambios no escribe ni sube la versión', async () => {
    repo.leer.mockResolvedValue(leida('500.00', { ALMUERZO: '100.00' }));
    const res = await servicio.guardarTiempos('h1', 'u1', {
      version: 1,
      presupuestoSemanal: '500',
      tiempos: [{ tiempo: 'ALMUERZO', porcentaje: '100' }],
    });
    expect(repo.guardar).not.toHaveBeenCalled();
    expect(res).toMatchObject({ version: 1, borradoresDesactualizados: [] });
  });

  it('CA-06.2 presupuesto por monto convierte a porcentaje', async () => {
    repo.leer.mockResolvedValue(leida('500.00', { ALMUERZO: '60.00', CENA: '40.00' }));
    await servicio.guardarPresupuesto('h1', 'u1', {
      version: 1,
      presupuestoSemanal: '500',
      modo: 'MONTO',
      distribucion: [
        { tiempo: 'ALMUERZO', monto: '320' },
        { tiempo: 'CENA', monto: '180' },
      ],
    });
    expect(repo.guardar.mock.calls[0][2]).toEqual({
      tiempos: filasDeTiempos({ ALMUERZO: '64.00', CENA: '36.00' }),
    });
  });

  it('CA-06.3 / CA-06.4 errores del presupuesto', async () => {
    repo.leer.mockResolvedValue(leida('500.00', { ALMUERZO: '60.00', CENA: '40.00' }));
    const base = { version: 1, presupuestoSemanal: '500' };
    expect(
      await problema(
        servicio.guardarPresupuesto('h1', 'u1', {
          ...base,
          modo: 'MONTO',
          distribucion: [
            { tiempo: 'ALMUERZO', monto: '320' },
            { tiempo: 'CENA', monto: '200' },
          ],
        }),
      ),
    ).toEqual([422, 'MONTOS_NO_SUMAN_PRESUPUESTO', 'Excede el presupuesto por Q20.00']);
    expect(
      (
        await problema(
          servicio.guardarPresupuesto('h1', 'u1', {
            ...base,
            modo: 'MONTO',
            distribucion: [
              { tiempo: 'ALMUERZO', monto: '320.001' },
              { tiempo: 'CENA', monto: '180' },
            ],
          }),
        )
      )[1],
    ).toBe('DISTRIBUCION_INVALIDA');
    expect(
      (
        await problema(
          servicio.guardarPresupuesto('h1', 'u1', {
            ...base,
            modo: 'MONTO',
            distribucion: [{ tiempo: 'ALMUERZO', monto: '500' }],
          }),
        )
      )[1],
    ).toBe('DISTRIBUCION_INVALIDA');
    expect(
      await problema(
        servicio.guardarPresupuesto('h1', 'u1', {
          ...base,
          distribucion: [
            { tiempo: 'ALMUERZO', porcentaje: '60' },
            { tiempo: 'CENA', porcentaje: '35' },
          ],
        }),
      ),
    ).toEqual([422, 'PORCENTAJES_NO_SUMAN_100', 'Faltan 5 % por asignar']);
    expect(
      (
        await problema(servicio.guardarPresupuesto('h1', 'u1', { ...base, presupuestoSemanal: '' }))
      )[2],
    ).toBe('Ingresa un presupuesto mayor a Q0.00');
  });
});
