import type { Comensal } from '@menu/db';
import type { Problema } from '../comun/problema';
import {
  NombreRepetidoError,
  UltimoComensalError,
  type ComensalesRepositorio,
} from './comensales.repositorio';
import { ComensalesService, totalesComensales, vistaComensal } from './comensales.service';

const fila = (nombre: string, extra: Partial<Comensal> = {}): Comensal =>
  ({
    id: `id-${nombre}`,
    hogarId: 'h1',
    nombre,
    nombreNormalizado: nombre.toLowerCase(),
    tipo: 'ADULTO',
    factorPorcion: '1.00',
    activo: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...extra,
  }) as Comensal;

const ROSALES = [fila('Rene'), fila('Ana'), fila('Diego')];

describe('vistaComensal y totalesComensales', () => {
  it('expone el factor con 2 decimales', () => {
    expect(vistaComensal(fila('Sofía', { tipo: 'NINO', factorPorcion: '0.5' }))).toEqual({
      id: 'id-Sofía',
      nombre: 'Sofía',
      tipo: 'NINO',
      factorPorcion: '0.50',
      activo: true,
    });
  });

  it('CA-03.5 cuenta adultos y niños activos; la suma solo usa factores (D-02)', () => {
    const lista = [...ROSALES, fila('Sofía', { tipo: 'NINO', factorPorcion: '0.50' })];
    expect(totalesComensales(lista)).toEqual({
      activos: 4,
      adultos: 3,
      ninos: 1,
      sumaFactores: '3.50',
    });
  });

  it('CA-03.2 los inactivos no cuentan', () => {
    const lista = [...ROSALES, fila('Abuela', { activo: false, factorPorcion: '2.00' })];
    expect(totalesComensales(lista)).toMatchObject({ activos: 3, sumaFactores: '3.00' });
  });
});

describe('ComensalesService', () => {
  const repo = {
    listar: jest.fn(),
    buscarPorNombre: jest.fn(),
    crear: jest.fn(),
    actualizar: jest.fn(),
    inactivar: jest.fn(),
    reactivar: jest.fn(),
  };
  const servicio = new ComensalesService(repo as unknown as ComensalesRepositorio);

  const fallo = async (promesa: Promise<unknown>): Promise<Problema> => {
    try {
      await promesa;
    } catch (error) {
      return error as Problema;
    }
    throw new Error('Se esperaba un error');
  };

  beforeEach(() => {
    jest.resetAllMocks();
    repo.listar.mockImplementation(async (_h: string, todos: boolean) =>
      todos ? [...ROSALES, fila('Abuela', { activo: false })] : ROSALES,
    );
  });

  it('listar sin inactivos filtra y los totales son de los activos', async () => {
    const res = await servicio.listar('h1', false);
    expect(res.comensales).toHaveLength(3);
    expect(res.totales.sumaFactores).toBe('3.00');
    const todos = await servicio.listar('h1', true);
    expect(todos.comensales).toHaveLength(4);
    expect(todos.totales.activos).toBe(3);
  });

  it('totalPorciones da la Σ factores de activos para HU-12 y HU-28', async () => {
    await expect(servicio.totalPorciones('h1')).resolves.toBe(3);
    expect(repo.listar).toHaveBeenCalledWith('h1', false);
  });

  it('CA-03.1 crear sugiere factor 1.00 y etiqueta ADULTO', async () => {
    repo.crear.mockResolvedValue(fila('Abuela Carmen'));
    const res = await servicio.crear('h1', { nombre: 'Abuela Carmen' });
    expect(repo.crear).toHaveBeenCalledWith('h1', {
      nombre: 'Abuela Carmen',
      tipo: 'ADULTO',
      factorPorcion: '1.00',
    });
    expect(res.comensal.nombre).toBe('Abuela Carmen');
  });

  it('CA-03.5 crear con niño y 0.5 guarda "0.50"', async () => {
    repo.crear.mockResolvedValue(fila('Sofía', { tipo: 'NINO', factorPorcion: '0.50' }));
    await servicio.crear('h1', { nombre: 'Sofía', tipo: 'NINO', factorPorcion: 0.5 });
    expect(repo.crear).toHaveBeenCalledWith('h1', {
      nombre: 'Sofía',
      tipo: 'NINO',
      factorPorcion: '0.50',
    });
  });

  it('CA-03.3 nombre repetido → 409 NOMBRE_REPETIDO con el estado del existente', async () => {
    repo.crear.mockRejectedValue(new NombreRepetidoError());
    repo.buscarPorNombre.mockResolvedValue(fila('Ana'));
    const error = await fallo(servicio.crear('h1', { nombre: 'ana' }));
    expect(error.getStatus()).toBe(409);
    expect(error.getResponse()).toMatchObject({
      codigo: 'NOMBRE_REPETIDO',
      detail: 'Ya existe un comensal con ese nombre',
      comensalId: 'id-Ana',
      activo: true,
    });
  });

  it('CA-03.3 si el repetido ya no se encuentra, igual responde 409 sin extensión', async () => {
    repo.crear.mockRejectedValue(new NombreRepetidoError());
    repo.buscarPorNombre.mockResolvedValue(undefined);
    const error = await fallo(servicio.crear('h1', { nombre: 'Ana' }));
    expect(error.getResponse()).not.toHaveProperty('comensalId');
  });

  it('otros errores del repositorio se propagan', async () => {
    const caida = new Error('caída');
    repo.crear.mockRejectedValue(caida);
    await expect(servicio.crear('h1', { nombre: 'Ana' })).rejects.toBe(caida);
    repo.inactivar.mockRejectedValue(caida);
    await expect(servicio.inactivar('h1', 'x')).rejects.toBe(caida);
  });

  it('CA-03.5 editar solo aplica los campos enviados y formatea el factor', async () => {
    repo.actualizar.mockResolvedValue(fila('Diego', { factorPorcion: '1.75' }));
    await servicio.editar('h1', 'id-Diego', { factorPorcion: '1.75' });
    expect(repo.actualizar).toHaveBeenCalledWith('h1', 'id-Diego', { factorPorcion: '1.75' });
    await servicio.editar('h1', 'id-Diego', { nombre: 'Diego R.', tipo: 'NINO' });
    expect(repo.actualizar).toHaveBeenLastCalledWith('h1', 'id-Diego', {
      nombre: 'Diego R.',
      tipo: 'NINO',
    });
  });

  it('CA-03.3 editar a un nombre repetido → 409; uno sin nombre también se traduce', async () => {
    repo.actualizar.mockRejectedValue(new NombreRepetidoError());
    expect((await fallo(servicio.editar('h1', 'id-Diego', { nombre: 'Ana' }))).getStatus()).toBe(
      409,
    );
    expect((await fallo(servicio.editar('h1', 'id-Diego', {}))).getStatus()).toBe(409);
    expect(repo.buscarPorNombre).toHaveBeenCalledTimes(1);
  });

  it('RNF-06 editar, inactivar o reactivar un comensal de otro hogar → 404', async () => {
    repo.actualizar.mockResolvedValue(undefined);
    repo.inactivar.mockResolvedValue(undefined);
    repo.reactivar.mockResolvedValue(undefined);
    for (const p of [
      servicio.editar('h2', 'id-Diego', { nombre: 'X' }),
      servicio.inactivar('h2', 'id-Diego'),
      servicio.reactivar('h2', 'id-Diego'),
    ]) {
      expect((await fallo(p)).getResponse()).toMatchObject({
        status: 404,
        codigo: 'NO_ENCONTRADO',
      });
    }
  });

  it('CA-03.2 inactivar devuelve el comensal inactivo y los totales', async () => {
    repo.inactivar.mockResolvedValue(fila('Diego', { activo: false }));
    const res = await servicio.inactivar('h1', 'id-Diego');
    expect(res.comensal.activo).toBe(false);
  });

  it('CA-03.2 CU-01.3 E2: el último activo → 422 ULTIMO_COMENSAL', async () => {
    repo.inactivar.mockRejectedValue(new UltimoComensalError());
    const error = await fallo(servicio.inactivar('h1', 'id-Rene'));
    expect(error.getResponse()).toMatchObject({
      status: 422,
      codigo: 'ULTIMO_COMENSAL',
      detail: 'Debe quedar al menos un comensal activo en el hogar',
    });
  });

  it('reactivar devuelve el comensal activo', async () => {
    repo.reactivar.mockResolvedValue(fila('Abuela'));
    await expect(servicio.reactivar('h1', 'id-Abuela')).resolves.toMatchObject({
      comensal: { activo: true },
    });
  });
});
