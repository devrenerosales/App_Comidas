import type { Configuracion, TiempoComidaConfig } from '@menu/db';
import { Problema } from '../comun/problema';
import {
  VersionDesactualizadaError,
  type ConfiguracionLeida,
  type ConfiguracionRepositorio,
} from './configuracion.repositorio';
import { ConfiguracionService } from './configuracion.service';

const HOY = new Date('2026-10-30T15:00:00.000Z');

function leida(version = 1, pesos = ['0.40', '0.25', '0.20', '0.15']): ConfiguracionLeida {
  return {
    configuracion: {
      id: 'c1',
      hogarId: 'h1',
      presupuestoSemanal: '245.00',
      diaInicioSemana: 'DOMINGO',
      diaPlanificacion: 'DOMINGO',
      horaPlanificacion: 8,
      pesoPreferencia: pesos[0],
      pesoNovedad: pesos[1],
      pesoAhorro: pesos[2],
      pesoAfinidad: pesos[3],
      version,
      updatedAt: HOY,
    } as unknown as Configuracion,
    tiempos: [
      { id: 'a', configuracionId: 'c1', tiempo: 'ALMUERZO', activo: true, porcentaje: '100.00' },
    ] as TiempoComidaConfig[],
  };
}

async function problema(promesa: Promise<unknown>): Promise<[number, string, string]> {
  try {
    await promesa;
  } catch (error) {
    if (error instanceof Problema) return [error.getStatus(), error.codigo, error.detalle];
    throw error;
  }
  throw new Error('Se esperaba un Problema');
}

describe('ConfiguracionService.guardarPesosMotor (HU-20)', () => {
  const repo = { leer: jest.fn(), guardarPesos: jest.fn() };
  const servicio = new ConfiguracionService(repo as unknown as ConfiguracionRepositorio, () => HOY);
  const dto = (
    p: Partial<Record<'preferencia' | 'novedad' | 'ahorro' | 'afinidad', string>> = {},
  ) => ({
    version: 1,
    preferencia: '0.30',
    novedad: '0.30',
    ahorro: '0.25',
    afinidad: '0.15',
    ...p,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    repo.leer.mockResolvedValue(leida());
    repo.guardarPesos.mockImplementation((_h: string, version: number) =>
      Promise.resolve(leida(version + 1, ['0.30', '0.30', '0.25', '0.15'])),
    );
  });

  it('guarda pesos válidos y devuelve la configuración con la versión nueva', async () => {
    const res = await servicio.guardarPesosMotor('h1', 'u1', dto());
    expect(repo.guardarPesos).toHaveBeenCalledWith(
      'h1',
      1,
      { preferencia: '0.30', novedad: '0.30', ahorro: '0.25', afinidad: '0.15' },
      'u1',
    );
    expect(res.version).toBe(2);
    expect(res.pesos).toEqual({
      preferencia: '0.30',
      novedad: '0.30',
      ahorro: '0.25',
      afinidad: '0.15',
    });
  });

  it('acepta pesos sin ceros a la derecha y los guarda con 2 decimales', async () => {
    await servicio.guardarPesosMotor(
      'h1',
      'u1',
      dto({ preferencia: '0.3', novedad: '0.3', ahorro: '0.25', afinidad: '0.15' }),
    );
    expect(repo.guardarPesos.mock.calls[0][2]).toEqual({
      preferencia: '0.30',
      novedad: '0.30',
      ahorro: '0.25',
      afinidad: '0.15',
    });
  });

  it('CA-20.3: suma distinta de 1.00 → 422 con la suma actual', async () => {
    expect(
      await problema(
        servicio.guardarPesosMotor(
          'h1',
          'u1',
          dto({ preferencia: '0.50', novedad: '0.25', ahorro: '0.20', afinidad: '0.15' }),
        ),
      ),
    ).toEqual([422, 'PESOS_INVALIDOS', 'Los pesos deben sumar 1.00 (suma actual 1.10)']);
    expect(repo.guardarPesos).not.toHaveBeenCalled();
  });

  it.each(['abc', '', '-0.1', '1.5', '0.123', '2', '1.01'])(
    'rechaza el peso "%s" por formato o rango',
    async (valor) => {
      const [estado, codigo] = await problema(
        servicio.guardarPesosMotor('h1', 'u1', dto({ preferencia: valor })),
      );
      expect([estado, codigo]).toEqual([422, 'PESOS_INVALIDOS']);
      expect(repo.guardarPesos).not.toHaveBeenCalled();
    },
  );

  it('sin cambios no escribe ni sube la versión', async () => {
    const res = await servicio.guardarPesosMotor('h1', 'u1', {
      version: 1,
      preferencia: '0.4',
      novedad: '0.25',
      ahorro: '0.2',
      afinidad: '0.15',
    });
    expect(repo.guardarPesos).not.toHaveBeenCalled();
    expect(res.version).toBe(1);
  });

  it('versión desactualizada → 409, antes de validar o en la escritura', async () => {
    expect(
      (await problema(servicio.guardarPesosMotor('h1', 'u1', { ...dto(), version: 7 })))[0],
    ).toBe(409);
    repo.guardarPesos.mockRejectedValueOnce(new VersionDesactualizadaError());
    expect((await problema(servicio.guardarPesosMotor('h1', 'u1', dto())))[1]).toBe(
      'VERSION_DESACTUALIZADA',
    );
  });

  it('propaga errores inesperados de la base', async () => {
    repo.guardarPesos.mockRejectedValueOnce(new Error('caída'));
    await expect(servicio.guardarPesosMotor('h1', 'u1', dto())).rejects.toThrow('caída');
  });
});
