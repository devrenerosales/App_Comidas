import type { MenuSemanal } from '@menu/db';
import { Problema } from '../comun/problema';
import type { PlatillosRepositorio } from '../catalogo/platillos.repositorio';
import type { ConfiguracionService } from '../configuracion/configuracion.service';
import type { PreferenciasRepositorio } from '../preferencias/preferencias.repositorio';
import {
  MenuDuplicadoError,
  type DetalleConPlatillo,
  type MenusRepositorio,
  type PlatilloActivo,
} from './menus.repositorio';
import { MenusService } from './menus.service';

const AHORA = new Date('2026-10-30T15:00:00.000Z');
const SEMANA = '2026-11-01';
const PROTEINAS = ['POLLO', 'RES', 'CERDO', 'PESCADO', 'HUEVO'] as const;

const config = (extra: Record<string, unknown> = {}) => ({
  version: 3,
  presupuestoSemanal: '500.00',
  diaInicioSemana: 'DOMINGO',
  pesos: { preferencia: '0.40', novedad: '0.25', ahorro: '0.20', afinidad: '0.15' },
  tiempos: [
    { tiempo: 'ALMUERZO', activo: true, porcentaje: '60.00', monto: '300.00' },
    { tiempo: 'CENA', activo: false, porcentaje: '0.00', monto: '0.00' },
    { tiempo: 'DESAYUNO', activo: false, porcentaje: '0.00', monto: '0.00' },
  ],
  ...extra,
});
const activos = (n: number, tiempo: PlatilloActivo['tiempo'] = 'ALMUERZO'): PlatilloActivo[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `${tiempo}-${i}`,
    nombre: `Platillo ${i}`,
    proteina: PROTEINAS[i % PROTEINAS.length]!,
    favorito: false,
    calificacionPromedio: null,
    tiempo,
  }));
const menuGuardado = (extra: Partial<MenuSemanal> = {}): MenuSemanal =>
  ({ id: 'm1', estado: 'BORRADOR', version: 4, ...extra }) as MenuSemanal;
const fijo = (extra: Partial<DetalleConPlatillo> = {}): DetalleConPlatillo =>
  ({
    id: 'f1',
    fecha: SEMANA,
    tiempo: 'ALMUERZO',
    platilloId: 'pepian',
    platilloNombre: 'Pepián',
    platilloProteina: 'POLLO',
    puntaje: '0.5000',
    factorPreferencia: '0.5000',
    factorNovedad: '1.0000',
    factorAhorro: '0.5000',
    factorAfinidad: '0.0000',
    costoEstimado: null,
    ...extra,
  }) as DetalleConPlatillo;

async function problema(promesa: Promise<unknown>): Promise<Problema> {
  try {
    await promesa;
  } catch (error) {
    if (error instanceof Problema) return error;
    throw error;
  }
  throw new Error('Se esperaba un Problema');
}

describe('MenusService.generar (CU-05.1, HU-19)', () => {
  const repo = {
    menuDeSemana: jest.fn(),
    platillosActivos: jest.fn(),
    preparaciones: jest.fn(),
    fijados: jest.fn(),
    crear: jest.fn(),
    regenerar: jest.fn(),
    cargar: jest.fn(),
  };
  const configuracion = { obtener: jest.fn() };
  const platillos = { sumaFactores: jest.fn() };
  const preferencias = { platillosExcluidosParaMotor: jest.fn() };
  const servicio = new MenusService(
    repo as unknown as MenusRepositorio,
    configuracion as unknown as ConfiguracionService,
    platillos as unknown as PlatillosRepositorio,
    preferencias as unknown as PreferenciasRepositorio,
    () => AHORA,
  );
  const generar = (extra: { semana?: string; regenerar?: boolean } = {}) =>
    servicio.generar('h1', { semana: SEMANA, ...extra });

  beforeEach(() => {
    jest.resetAllMocks();
    configuracion.obtener.mockResolvedValue(config());
    repo.menuDeSemana.mockResolvedValue(undefined);
    repo.platillosActivos.mockResolvedValue(activos(25));
    repo.preparaciones.mockResolvedValue([]);
    repo.fijados.mockResolvedValue([]);
    repo.crear.mockResolvedValue('m1');
    repo.regenerar.mockResolvedValue(undefined);
    repo.cargar.mockResolvedValue({
      menu: {
        id: 'm1',
        fechaInicio: SEMANA,
        fechaFin: '2026-11-07',
        estado: 'BORRADOR',
        version: 1,
        excesoAlAprobar: null,
      },
      tiempos: [],
      detalles: [],
    });
    platillos.sumaFactores.mockResolvedValue(3.5);
    preferencias.platillosExcluidosParaMotor.mockResolvedValue(new Set());
  });

  it('crea el Borrador con 7 almuerzos, la copia de configuración y devuelve 201', async () => {
    const r = await generar();
    expect(r.creado).toBe(true);
    expect(repo.crear).toHaveBeenCalledTimes(1);
    const [hogar, inicio, datos, tiempos, detalles] = repo.crear.mock.calls[0]!;
    expect(hogar).toBe('h1');
    expect(inicio).toBe(SEMANA);
    expect(datos).toMatchObject({
      fechaFin: '2026-11-07',
      configuracionVersion: 3,
      presupuestoSemanal: '500.00',
      sumaFactoresPorcion: '3.50',
      pesoPreferencia: '0.40',
      pesoAfinidad: '0.15',
      costoEstimado: null,
      costoIncompleto: true,
      generadoEn: AHORA,
    });
    expect(tiempos).toEqual([
      {
        tiempo: 'ALMUERZO',
        porcentaje: '60.00',
        presupuesto: '300.00',
        costoEstimado: null,
        exceso: '0.00',
      },
    ]);
    expect(detalles).toHaveLength(7);
    expect(detalles[0]).toMatchObject({
      fecha: SEMANA,
      tiempo: 'ALMUERZO',
      costoEstimado: null,
      costoIncompleto: true,
    });
    expect(detalles[0].puntaje).toMatch(/^\d\.\d{4}$/);
    expect(new Set(detalles.map((d: { platilloId: string }) => d.platilloId)).size).toBe(7);
    expect(repo.regenerar).not.toHaveBeenCalled();
  });

  it('un espacio sin sugerencia se guarda vacío y sin costo incompleto', async () => {
    repo.platillosActivos.mockResolvedValue(
      activos(10).map((p) => ({ ...p, proteina: 'POLLO' as const })),
    );
    await generar();
    const detalles = repo.crear.mock.calls[0]![4] as {
      platilloId: string | null;
      puntaje: string | null;
      costoIncompleto: boolean;
    }[];
    const vacios = detalles.filter((d) => d.platilloId === null);
    expect(vacios.length).toBeGreaterThan(0);
    expect(vacios[0]).toMatchObject({ puntaje: null, costoIncompleto: false });
  });

  it('CONFIGURACION_INCOMPLETA sin tiempos activos o sin presupuesto', async () => {
    configuracion.obtener.mockResolvedValue(
      config({ tiempos: [{ tiempo: 'ALMUERZO', activo: false, porcentaje: '0', monto: '0' }] }),
    );
    expect((await problema(generar())).codigo).toBe('CONFIGURACION_INCOMPLETA');
    configuracion.obtener.mockResolvedValue(config({ presupuestoSemanal: '0.00' }));
    const p = await problema(generar());
    expect([p.getStatus(), p.codigo]).toEqual([422, 'CONFIGURACION_INCOMPLETA']);
  });

  it.each([
    ['2026-02-30', 'La semana no es una fecha válida.'],
    ['2026-11-02', 'La semana debe empezar el domingo.'],
  ])('SEMANA_INVALIDA para %s', async (semana, mensaje) => {
    const p = await problema(generar({ semana }));
    expect([p.getStatus(), p.codigo, p.detalle]).toEqual([422, 'SEMANA_INVALIDA', mensaje]);
  });

  it('CA-19.4 una semana aprobada se bloquea con 409 MENU_APROBADO', async () => {
    repo.menuDeSemana.mockResolvedValue(menuGuardado({ estado: 'APROBADO' }));
    const p = await problema(generar({ regenerar: true }));
    expect([p.getStatus(), p.codigo, p.detalle]).toEqual([
      409,
      'MENU_APROBADO',
      'Esta semana ya tiene un menú aprobado',
    ]);
    expect(p.extensiones).toEqual({ menuId: 'm1' });
    expect(repo.platillosActivos).not.toHaveBeenCalled();
  });

  it('una semana histórica se bloquea y un Borrador pide confirmar la regeneración', async () => {
    repo.menuDeSemana.mockResolvedValue(menuGuardado({ estado: 'HISTORICO' }));
    expect((await problema(generar())).codigo).toBe('SEMANA_HISTORICA');
    repo.menuDeSemana.mockResolvedValue(menuGuardado());
    const p = await problema(generar());
    expect([p.getStatus(), p.codigo]).toEqual([409, 'BORRADOR_EXISTENTE']);
  });

  it('CA-19.3 faltan platillos: 422 con el detalle y sin guardar nada', async () => {
    configuracion.obtener.mockResolvedValue(
      config({
        tiempos: [
          { tiempo: 'ALMUERZO', activo: true, porcentaje: '60.00', monto: '300.00' },
          { tiempo: 'CENA', activo: true, porcentaje: '40.00', monto: '200.00' },
        ],
      }),
    );
    repo.platillosActivos.mockResolvedValue([...activos(12), ...activos(7, 'CENA')]);
    const p = await problema(generar());
    expect([p.getStatus(), p.codigo, p.detalle]).toEqual([
      422,
      'FALTAN_PLATILLOS',
      'Faltan 3 platillos de Cena',
    ]);
    expect(p.extensiones).toEqual({ faltantes: [{ tiempo: 'CENA', cantidad: 3 }] });
    expect(repo.crear).not.toHaveBeenCalled();
  });

  it('los platillos con ingredientes excluidos no cuentan ni se asignan', async () => {
    preferencias.platillosExcluidosParaMotor.mockResolvedValue(new Set(['ALMUERZO-0']));
    repo.platillosActivos.mockResolvedValue(activos(10));
    const p = await problema(generar());
    expect(p.detalle).toBe('Faltan 1 platillo de Almuerzo');
    repo.platillosActivos.mockResolvedValue(activos(11));
    await generar();
    const ids = (repo.crear.mock.calls[0]![4] as { platilloId: string }[]).map((d) => d.platilloId);
    expect(ids).not.toContain('ALMUERZO-0');
  });

  it('regenerar conserva los fijados vigentes, descarta los de tiempos inactivos y devuelve 200', async () => {
    repo.menuDeSemana.mockResolvedValue(menuGuardado());
    repo.fijados.mockResolvedValue([
      fijo(),
      fijo({ id: 'f2', tiempo: 'CENA', fecha: '2026-11-02' }),
      fijo({ id: 'f3', fecha: '2026-12-25' }),
    ]);
    const r = await generar({ regenerar: true });
    expect(r.creado).toBe(false);
    expect(repo.crear).not.toHaveBeenCalled();
    const [menuId, version, , , conservar, nuevos] = repo.regenerar.mock.calls[0]!;
    expect([menuId, version, conservar]).toEqual(['m1', 4, ['f1']]);
    // 7 espacios menos el fijado del domingo.
    expect(nuevos).toHaveLength(6);
    expect(nuevos.map((d: { fecha: string }) => d.fecha)).not.toContain(SEMANA);
    const usados = nuevos.map((d: { platilloId: string }) => d.platilloId);
    expect(usados).not.toContain('pepian');
  });

  it('un fijado con costo conocido lo conserva como número', async () => {
    repo.menuDeSemana.mockResolvedValue(menuGuardado());
    repo.fijados.mockResolvedValue([fijo({ costoEstimado: '38.75' })]);
    await expect(generar({ regenerar: true })).resolves.toMatchObject({ creado: false });
  });

  it('si otro proceso creó el menú a la vez responde 409 y cualquier otro error se propaga', async () => {
    repo.crear.mockRejectedValue(new MenuDuplicadoError());
    expect((await problema(generar())).codigo).toBe('BORRADOR_EXISTENTE');
    repo.crear.mockRejectedValue(new Error('caída'));
    await expect(generar()).rejects.toThrow('caída');
  });

  it('con historial lejano mide Novedad desde la última semana con datos (D-19)', async () => {
    // Pesos que priorizan la preferencia para que el platillo favorito se asigne el primero.
    configuracion.obtener.mockResolvedValue(
      config({
        pesos: { preferencia: '0.70', novedad: '0.05', ahorro: '0.15', afinidad: '0.10' },
      }),
    );
    repo.platillosActivos.mockResolvedValue(
      activos(25).map((p, i) => ({ ...p, favorito: i === 0 })),
    );
    repo.preparaciones.mockResolvedValue([
      { platilloId: 'ALMUERZO-0', tiempo: 'ALMUERZO', fecha: '2026-05-22' },
    ]);
    await generar({ semana: '2026-11-22' });
    const detalles = repo.crear.mock.calls[0]![4] as {
      platilloId: string;
      factorNovedad: string;
    }[];
    // Referencia 2026-05-24 (domingo siguiente al historial): se preparó hace 2 días → novedad 0.
    // Medido desde la semana planificada (26 semanas) habría valido 1.
    expect(detalles.find((d) => d.platilloId === 'ALMUERZO-0')!.factorNovedad).toBe('0.0000');
    expect(detalles.some((d) => d.factorNovedad === '1.0000')).toBe(true);
  });
});
