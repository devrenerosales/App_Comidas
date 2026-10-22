import type { Configuracion, TiempoComidaConfig } from '@menu/db';
import { Rol } from '@menu/shared';
import type { TokensService } from '../auth/tokens.service';
import { CONFIGURACION_POR_DEFECTO, tiemposPorDefecto } from './configuracion-por-defecto';
import { YaTieneHogarError, type HogarRepositorio } from './hogar.repositorio';
import { HogarService, vistaConfiguracion } from './hogar.service';

const AHORA = new Date('2026-10-22T15:00:00.000Z');

describe('configuración por defecto (CU-01.2 paso 2, supuesto de M01)', () => {
  it('solo almuerzo al 100 %, Q250, semana de domingo a sábado', () => {
    expect(CONFIGURACION_POR_DEFECTO).toEqual({
      presupuestoSemanal: '250.00',
      diaInicioSemana: 'DOMINGO',
      diaPlanificacion: 'DOMINGO',
      horaPlanificacion: 8,
    });
    expect(tiemposPorDefecto()).toEqual([
      { tiempo: 'DESAYUNO', activo: false, porcentaje: '0.00' },
      { tiempo: 'ALMUERZO', activo: true, porcentaje: '100.00' },
      { tiempo: 'CENA', activo: false, porcentaje: '0.00' },
    ]);
  });

  it('vistaConfiguracion ordena los tiempos desayuno → almuerzo → cena', () => {
    const config = {
      version: 1,
      presupuestoSemanal: '250.00',
      diaInicioSemana: 'DOMINGO',
      diaPlanificacion: 'DOMINGO',
      horaPlanificacion: 8,
    } as Configuracion;
    const tiempos = [
      { tiempo: 'CENA', activo: false, porcentaje: '0.00' },
      { tiempo: 'ALMUERZO', activo: true, porcentaje: '100.00' },
      { tiempo: 'DESAYUNO', activo: false, porcentaje: '0.00' },
    ] as TiempoComidaConfig[];
    expect(vistaConfiguracion(config, tiempos).tiempos.map((t) => t.tiempo)).toEqual([
      'DESAYUNO',
      'ALMUERZO',
      'CENA',
    ]);
  });
});

describe('HogarService', () => {
  const hogares = {
    membresiaDe: jest.fn(),
    crearConConfiguracion: jest.fn(),
    buscar: jest.fn(),
    miembros: jest.fn(),
    renombrar: jest.fn(),
  };
  const tokens = {
    firmarAcceso: jest.fn().mockReturnValue({
      token: 'nuevo-acceso',
      expiraEn: new Date('2026-10-22T15:15:00.000Z'),
    }),
  };
  const servicio = new HogarService(
    hogares as unknown as HogarRepositorio,
    tokens as unknown as TokensService,
    () => AHORA,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    hogares.membresiaDe.mockResolvedValue(null);
  });

  it('CA-02.1 crear: el creador queda ADMIN y recibe un token con hogarId', async () => {
    hogares.crearConConfiguracion.mockResolvedValue({
      hogar: { id: 'h1', nombre: 'Familia Rosales' },
      configuracion: { version: 1, ...CONFIGURACION_POR_DEFECTO },
      tiempos: tiemposPorDefecto(),
    });
    const res = await servicio.crear('u1', 'Familia Rosales');
    expect(hogares.crearConConfiguracion).toHaveBeenCalledWith('u1', 'Familia Rosales');
    expect(tokens.firmarAcceso).toHaveBeenCalledWith(
      { sub: 'u1', hogarId: 'h1', rol: Rol.ADMIN },
      AHORA,
    );
    expect(res).toMatchObject({
      hogar: { id: 'h1', nombre: 'Familia Rosales', rol: 'ADMIN' },
      rol: 'ADMIN',
      accessToken: 'nuevo-acceso',
      expiraEn: '2026-10-22T15:15:00.000Z',
      configuracion: { presupuestoSemanal: '250.00' },
    });
  });

  it('CA-02.1 con hogar → 409 YA_TIENE_HOGAR (antes de insertar y en carrera)', async () => {
    hogares.membresiaDe.mockResolvedValueOnce({ hogarId: 'h0', rol: Rol.MIEMBRO });
    await expect(servicio.crear('u1', 'X')).rejects.toMatchObject({ codigo: 'YA_TIENE_HOGAR' });
    expect(hogares.crearConConfiguracion).not.toHaveBeenCalled();

    hogares.crearConConfiguracion.mockRejectedValueOnce(new YaTieneHogarError());
    await expect(servicio.crear('u1', 'X')).rejects.toMatchObject({ codigo: 'YA_TIENE_HOGAR' });

    hogares.crearConConfiguracion.mockRejectedValueOnce(new Error('BD caída'));
    await expect(servicio.crear('u1', 'X')).rejects.toThrow('BD caída');
  });

  it('obtener devuelve miembros con fecha ISO; 404 si no existe', async () => {
    hogares.buscar.mockResolvedValueOnce({ id: 'h1', nombre: 'Familia Rosales' });
    hogares.miembros.mockResolvedValueOnce([
      { usuarioId: 'u1', nombre: 'Rene', correo: 'r@c.com', rol: 'ADMIN', desde: AHORA },
    ]);
    await expect(servicio.obtener('h1')).resolves.toEqual({
      id: 'h1',
      nombre: 'Familia Rosales',
      miembros: [
        {
          usuarioId: 'u1',
          nombre: 'Rene',
          correo: 'r@c.com',
          rol: 'ADMIN',
          desde: AHORA.toISOString(),
        },
      ],
    });
    hogares.buscar.mockResolvedValueOnce(undefined);
    await expect(servicio.obtener('hx')).rejects.toMatchObject({ codigo: 'NO_ENCONTRADO' });
  });

  it('renombrar; 404 si no existe', async () => {
    hogares.renombrar.mockResolvedValueOnce({ id: 'h1', nombre: 'Nuevo', extra: 1 });
    await expect(servicio.renombrar('h1', 'Nuevo')).resolves.toEqual({ id: 'h1', nombre: 'Nuevo' });
    hogares.renombrar.mockResolvedValueOnce(undefined);
    await expect(servicio.renombrar('hx', 'Nuevo')).rejects.toMatchObject({ status: 404 });
  });
});
