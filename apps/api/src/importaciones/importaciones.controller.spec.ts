import type { Response } from 'express';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ImportacionesController } from './importaciones.controller';
import type { ImportacionesRepositorio } from './importaciones.repositorio';
import {
  ArchivoDto,
  DecisionesDto,
  FilasDto,
  PlantillaDto,
  RevisionDto,
} from './importaciones.dto';

describe('Contrato de importaciones', () => {
  const repo = {
    crear: jest.fn().mockResolvedValue({ id: 'i1' }),
    obtener: jest.fn(),
    filas: jest.fn(),
    decidir: jest.fn(),
    confirmar: jest.fn(),
    cancelar: jest.fn(),
  };
  const hoy = new Date('2026-10-27T15:00:00Z');
  const ctrl = new ImportacionesController(repo as unknown as ImportacionesRepositorio, () => hoy);
  beforeEach(() => jest.clearAllMocks());
  it('no escribe sin archivo o cuando faltan columnas', async () => {
    await expect(ctrl.cargar('h1', 'u1', undefined, new ArchivoDto())).rejects.toMatchObject({
      codigo: 'ARCHIVO_REQUERIDO',
    });
    const buffer = Buffer.from('fecha,tiempo_comida\n2025-04-06,almuerzo');
    await expect(
      ctrl.cargar(
        'h1',
        'u1',
        { archivo: [{ buffer, originalname: 'menus.csv', size: buffer.length }] },
        new ArchivoDto(),
      ),
    ).rejects.toMatchObject({ codigo: 'COLUMNA_FALTANTE' });
    expect(repo.crear).not.toHaveBeenCalled();
  });
  it('carga solo filas validadas por el reloj local y el hogar autenticado', async () => {
    const buffer = Buffer.from('fecha,tiempo_comida,platillo\n2025-04-06,almuerzo,Sopa');
    const archivo = { buffer, originalname: 'menus.csv', size: buffer.length };
    await expect(
      ctrl.cargar('h1', 'u1', { archivo: [archivo] }, new ArchivoDto()),
    ).resolves.toEqual({ id: 'i1' });
    expect(repo.crear).toHaveBeenCalledWith(
      'h1',
      'u1',
      archivo,
      'CSV',
      [expect.objectContaining({ errores: [], platillo: 'Sopa' })],
      { origen: 'ARCHIVO', listas: [] },
    );
  });
  const csv = (texto: string) => {
    const buffer = Buffer.from(texto);
    return { buffer, originalname: 'a.csv', size: buffer.length };
  };
  const MENUS = csv('fecha,tiempo_comida,platillo\n2025-04-06,almuerzo,Sopa');
  const LISTAS = csv(
    'fecha,lista,tipo,producto,cantidad,unidad_compra\n2025-06-01,Despensa,despensa,Arroz,2,bolsa',
  );
  it('con origen cuaderno lee y valida el CSV de listas aparte', async () => {
    const datos = plainToInstance(ArchivoDto, { origen: 'CUADERNO' });
    await ctrl.cargar('h1', 'u1', { archivo: [MENUS], listas: [LISTAS] }, datos);
    expect(repo.crear).toHaveBeenCalledWith('h1', 'u1', MENUS, 'CSV', expect.any(Array), {
      origen: 'CUADERNO',
      listas: [expect.objectContaining({ producto: 'Arroz', tipo: 'DESPENSA', errores: [] })],
    });
  });
  it('rechaza las listas si la carga no es del cuaderno y no escribe', async () => {
    await expect(
      ctrl.cargar('h1', 'u1', { archivo: [MENUS], listas: [LISTAS] }, new ArchivoDto()),
    ).rejects.toMatchObject({ codigo: 'LISTAS_REQUIEREN_CUADERNO' });
    expect(repo.crear).not.toHaveBeenCalled();
  });
  it('rechaza un CSV de listas sin columnas obligatorias o en otro formato', async () => {
    const datos = plainToInstance(ArchivoDto, { origen: 'CUADERNO' });
    await expect(
      ctrl.cargar(
        'h1',
        'u1',
        { archivo: [MENUS], listas: [csv('fecha,lista\n2025-06-01,x')] },
        datos,
      ),
    ).rejects.toMatchObject({ codigo: 'COLUMNA_FALTANTE' });
    await expect(
      ctrl.cargar(
        'h1',
        'u1',
        { archivo: [MENUS], listas: [{ ...LISTAS, originalname: 'listas.pdf' }] },
        datos,
      ),
    ).rejects.toMatchObject({ codigo: 'FORMATO_NO_PERMITIDO' });
    expect(repo.crear).not.toHaveBeenCalled();
  });
  it.each(['csv', 'xlsx'] as const)(
    'descarga plantilla %s con nombre fijo y sin caché',
    async (formato) => {
      const res = { setHeader: jest.fn(), send: jest.fn() };
      await ctrl.plantilla({ formato, hoja: 'menus' }, res as unknown as Response);
      expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        `attachment; filename="plantilla-menus.${formato}"`,
      );
      expect(res.send).toHaveBeenCalledWith(expect.any(Buffer));
    },
  );
  it('descarga la plantilla de listas en CSV con su propio nombre', async () => {
    const res = { setHeader: jest.fn(), send: jest.fn() };
    await ctrl.plantilla({ formato: 'csv', hoja: 'listas' }, res as unknown as Response);
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="plantilla-listas.csv"',
    );
    expect(res.send.mock.calls[0]![0].toString()).toContain('unidad_compra');
  });
  it('propaga revisión, identidad y filtros a todas las operaciones', () => {
    ctrl.obtener('h1', 'i1');
    expect(repo.obtener).toHaveBeenCalledWith('h1', 'i1');
    const consulta = new FilasDto();
    ctrl.filas('h1', 'i1', consulta);
    expect(repo.filas).toHaveBeenCalledWith('h1', 'i1', consulta);
    const datos = {
      revision: 'r1',
      decisiones: [{ semanaInicio: '2025-04-06', decision: 'OMITIR' as const }],
    };
    ctrl.decidir('h1', 'i1', datos);
    expect(repo.decidir).toHaveBeenCalledWith('h1', 'i1', datos);
    ctrl.confirmar('h1', 'u1', 'i1', { revision: 'r1' });
    expect(repo.confirmar).toHaveBeenCalledWith('h1', 'u1', 'i1', 'r1', hoy);
    ctrl.cancelar('h1', 'i1', { revision: 'r1' });
    expect(repo.cancelar).toHaveBeenCalledWith('h1', 'i1', 'r1');
  });
  it('valida revisión UUID, paginación, origen y decisiones anidadas antes de mutar', async () => {
    expect(await validate(plainToInstance(RevisionDto, { revision: 'vieja' }))).toHaveLength(1);
    expect(
      await validate(
        plainToInstance(FilasDto, { pagina: '0', tamano: '101', soloErrores: 'otro' }),
      ),
    ).toHaveLength(3);
    expect(await validate(plainToInstance(ArchivoDto, { origen: 'CUADERNO' }))).toHaveLength(0);
    expect(await validate(plainToInstance(ArchivoDto, { origen: 'OTRO' }))).toHaveLength(1);
    expect(await validate(plainToInstance(PlantillaDto, { formato: 'pdf' }))).toHaveLength(1);
    const datos = plainToInstance(DecisionesDto, {
      revision: 'd4bf763c-1745-46f4-8e54-d9f55db18333',
      decisiones: [{ semanaInicio: '2025-04-06', decision: 'CREAR' }],
    });
    expect((await validate(datos))[0]!.children![0]!.children).not.toHaveLength(0);
  });
});
