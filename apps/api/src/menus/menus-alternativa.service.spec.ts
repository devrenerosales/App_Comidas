import type { MenuSemanal, MenuTiempo } from '@menu/db';
import { Problema } from '../comun/problema';
import type { PreferenciasRepositorio } from '../preferencias/preferencias.repositorio';
import { MenusAlternativaService } from './menus-alternativa.service';
import type {
  DetalleConPlatillo,
  MenuCompleto,
  MenusRepositorio,
  PlatilloActivo,
} from './menus.repositorio';

const AHORA = new Date('2026-11-02T15:00:00.000Z');

const espacio = (
  id: string,
  fecha: string,
  platillo: [string, string, DetalleConPlatillo['platilloProteina']] | null,
  extra: Partial<DetalleConPlatillo> = {},
): DetalleConPlatillo =>
  ({
    id,
    fecha,
    tiempo: 'ALMUERZO',
    platilloId: platillo?.[0] ?? null,
    platilloNombre: platillo?.[1] ?? null,
    platilloProteina: platillo?.[2] ?? null,
    fijado: false,
    ...extra,
  }) as DetalleConPlatillo;

/** CA-23.1: lunes Carne guisada (res), martes Pescado frito (pescado) y miércoles Tortitas (res). */
const completo = (
  extra: Partial<MenuCompleto> = {},
  menu: Partial<MenuSemanal> = {},
): MenuCompleto => ({
  menu: {
    id: 'm1',
    estado: 'BORRADOR',
    fechaInicio: '2026-11-01',
    pesoPreferencia: '0.40',
    pesoNovedad: '0.25',
    pesoAhorro: '0.20',
    pesoAfinidad: '0.15',
    ...menu,
  } as MenuSemanal,
  tiempos: [{ tiempo: 'ALMUERZO', presupuesto: '245.00' } as MenuTiempo],
  detalles: [
    espacio('lun', '2026-11-02', ['carne', 'Carne guisada', 'RES']),
    espacio('mar', '2026-11-03', ['pescado', 'Pescado frito', 'PESCADO']),
    espacio('mie', '2026-11-04', ['tortitas', 'Tortitas de carne', 'RES']),
    espacio('jue', '2026-11-05', null),
  ],
  ...extra,
});

const LB = { codigo: 'lb', magnitud: 'MASA' as const, factorBase: 453.592 };
/** 1 lb en una presentación de 1 lb a `precio`: con Σ 4 el platillo cuesta `precio`. */
const conPrecio = (precio: number) => ({
  porcionesBase: 4,
  ingredientes: [
    {
      cantidad: 1,
      unidad: LB,
      presentacion: { cantidad: 1, unidad: LB },
      equivalencia: null,
      precioMediana: precio,
    },
  ],
});

const activo = (
  id: string,
  proteina: PlatilloActivo['proteina'],
  extra: Partial<PlatilloActivo> = {},
): PlatilloActivo => ({
  id,
  nombre: id,
  proteina,
  favorito: false,
  calificacionPromedio: null,
  tiempo: 'ALMUERZO',
  ...extra,
});

/** Favoritos primero: carne y tortitas (res) puntúan más que el pollo, y este más que el chile. */
const CATALOGO = [
  activo('carne', 'RES', { favorito: true }),
  activo('tortitas', 'RES', { favorito: true }),
  activo('pescado', 'PESCADO', { favorito: true }),
  activo('pollo', 'POLLO', { calificacionPromedio: '4.00' }),
  activo('chile', 'CERDO', { calificacionPromedio: '2.00' }),
  activo('desayuno', 'HUEVO', { tiempo: 'DESAYUNO', favorito: true }),
];

async function problema(promesa: Promise<unknown>): Promise<Problema> {
  try {
    await promesa;
  } catch (error) {
    if (error instanceof Problema) return error;
    throw error;
  }
  throw new Error('Se esperaba un Problema');
}

describe('MenusAlternativaService (CU-05.5, HU-23)', () => {
  const repo = {
    cargar: jest.fn(),
    platillosActivos: jest.fn(),
    preparaciones: jest.fn(),
    alternativasMostradas: jest.fn(),
    aplicarCambios: jest.fn(),
    ingredientesParaCosto: jest.fn(),
  };
  const preferencias = { platillosExcluidosParaMotor: jest.fn() };
  const servicio = new MenusAlternativaService(
    repo as unknown as MenusRepositorio,
    preferencias as unknown as PreferenciasRepositorio,
    () => AHORA,
  );
  const pedir = (detalleId = 'mar') => servicio.alternativa('h1', 'u1', 'm1', detalleId);
  const aplicado = () =>
    repo.aplicarCambios.mock.calls[0] as [
      string,
      { id: string; cambio: Record<string, unknown> }[],
      { detalleId: string; platilloId: string }[],
    ];

  beforeEach(() => {
    jest.resetAllMocks();
    repo.cargar.mockResolvedValue(completo());
    repo.platillosActivos.mockResolvedValue(CATALOGO);
    repo.preparaciones.mockResolvedValue([]);
    repo.alternativasMostradas.mockResolvedValue([]);
    repo.aplicarCambios.mockResolvedValue(undefined);
    repo.ingredientesParaCosto.mockResolvedValue(new Map());
    preferencias.platillosExcluidosParaMotor.mockResolvedValue(new Set());
  });

  it('CA-23.1 cambia solo el martes por el mejor que no es de res ni de pescado ni está en la semana', async () => {
    await expect(pedir()).resolves.toMatchObject({ id: 'm1' });

    const [menuId, cambios, mostradas] = aplicado();
    expect(menuId).toBe('m1');
    expect(cambios).toHaveLength(1);
    expect(cambios[0]).toMatchObject({
      id: 'mar',
      cambio: {
        platilloId: 'pollo',
        fijado: false,
        origen: 'ALTERNATIVA',
        costoEstimado: null,
        costoIncompleto: true,
        reglasAplicadas: [],
        modificadoPorId: 'u1',
        modificadoEn: AHORA,
      },
    });
    expect(cambios[0]!.cambio.puntaje).toMatch(/^\d\.\d{4}$/);
    expect(cambios[0]!.cambio.factorPreferencia).toBe('0.7500');
    expect(mostradas).toEqual([
      { detalleId: 'mar', platilloId: 'pollo' },
      { detalleId: 'mar', platilloId: 'pescado' },
    ]);
  });

  it('no ofrece platillos con ingredientes excluidos ni de otro tiempo de comida', async () => {
    preferencias.platillosExcluidosParaMotor.mockResolvedValue(new Set(['pollo']));
    await pedir();
    expect(aplicado()[1][0]!.cambio.platilloId).toBe('chile');
  });

  it('no vuelve a ofrecer las alternativas ya mostradas para el espacio', async () => {
    repo.alternativasMostradas.mockResolvedValue(['pollo']);
    await pedir();
    expect(aplicado()[1][0]!.cambio.platilloId).toBe('chile');
    expect(repo.alternativasMostradas).toHaveBeenCalledWith('mar');
  });

  it('CA-23.3 si no queda ningún candidato avisa y no cambia nada', async () => {
    repo.alternativasMostradas.mockResolvedValue(['pollo', 'chile']);
    const error = await problema(pedir());
    expect(error.getStatus()).toBe(422);
    expect(error).toMatchObject({
      codigo: 'SIN_ALTERNATIVAS',
      detalle: 'No hay más alternativas para este día',
    });
    expect(repo.aplicarCambios).not.toHaveBeenCalled();
  });

  it('un espacio vacío también puede recibir una alternativa y solo registra la nueva', async () => {
    await pedir('jue');
    const [, cambios, mostradas] = aplicado();
    expect(cambios[0]).toMatchObject({ id: 'jue', cambio: { platilloId: 'pollo' } });
    expect(mostradas).toEqual([{ detalleId: 'jue', platilloId: 'pollo' }]);
  });

  it('un menú sin copia de pesos o sin tiempo guardado usa los valores por defecto', async () => {
    repo.cargar.mockResolvedValue(completo({ tiempos: [] }, { pesoPreferencia: null }));
    await pedir();
    expect(aplicado()[1][0]!.cambio.platilloId).toBe('pollo');
  });

  it('CA-23.4 un espacio fijado no admite alternativa (409 ESPACIO_FIJADO)', async () => {
    repo.cargar.mockResolvedValue(
      completo({
        detalles: [
          espacio('mar', '2026-11-03', ['pescado', 'Pescado frito', 'PESCADO'], { fijado: true }),
        ],
      }),
    );
    const error = await problema(pedir());
    expect(error.getStatus()).toBe(409);
    expect(error).toMatchObject({ codigo: 'ESPACIO_FIJADO' });
    expect(repo.aplicarCambios).not.toHaveBeenCalled();
  });

  it('un menú aprobado o histórico no admite alternativas (E3)', async () => {
    repo.cargar.mockResolvedValue(completo({}, { estado: 'APROBADO' }));
    expect(await problema(pedir())).toMatchObject({ codigo: 'MENU_APROBADO' });
    repo.cargar.mockResolvedValue(completo({}, { estado: 'HISTORICO' }));
    expect(await problema(pedir())).toMatchObject({ codigo: 'SEMANA_HISTORICA' });
    expect(repo.aplicarCambios).not.toHaveBeenCalled();
  });

  it('un menú o un espacio inexistente es 404', async () => {
    repo.cargar.mockResolvedValue(undefined);
    expect((await problema(pedir())).getStatus()).toBe(404);
    repo.cargar.mockResolvedValue(completo());
    expect((await problema(pedir('otro'))).getStatus()).toBe(404);
  });

  it('con precios la alternativa lleva su costo y el Ahorro lo usa', async () => {
    repo.cargar.mockResolvedValue(completo({}, { sumaFactoresPorcion: '4.00' }));
    repo.ingredientesParaCosto.mockResolvedValue(
      new Map([
        ['pollo', conPrecio(20)],
        ['chile', conPrecio(50)],
      ]),
    );
    await pedir();
    const [, cambios] = aplicado();
    expect(cambios[0]!.cambio).toMatchObject({
      platilloId: 'pollo',
      costoEstimado: '20.00',
      costoIncompleto: false,
      notas: null,
    });
    expect(repo.ingredientesParaCosto).toHaveBeenCalledWith(
      'h1',
      expect.arrayContaining(['pollo']),
    );
  });
});
