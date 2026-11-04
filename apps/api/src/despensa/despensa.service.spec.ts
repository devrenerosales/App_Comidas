import { Problema } from '../comun/problema';
import type { ConfiguracionService } from '../configuracion/configuracion.service';
import { DespensaController } from './despensa.controller';
import type { DespensaRepositorio, FilaDespensa } from './despensa.repositorio';
import { DespensaService } from './despensa.service';
import { vistaDespensa } from './despensa.vista';

const fila = (extra: Partial<FilaDespensa> = {}): FilaDespensa => ({
  id: 'd1',
  productoId: 'p-arroz',
  nombre: 'Arroz',
  unidadCompra: 'bolsa',
  presentacionCantidad: '2.000',
  presentacionUnidad: 'lb',
  cantidad: '2.000',
  frecuencia: 'SEMANAL',
  ultimaInclusionSemana: '2026-10-18',
  notas: null,
  ...extra,
});

async function problema(promesa: Promise<unknown>): Promise<Problema> {
  try {
    await promesa;
  } catch (e) {
    return e as Problema;
  }
  throw new Error('Se esperaba un Problema');
}

describe('vistaDespensa (api-contrato §2.7)', () => {
  it('arma la etiqueta, cuándo vuelve a tocar y si toca en la semana de la lista', () => {
    expect(vistaDespensa(fila(), '2026-10-25')).toEqual({
      id: 'd1',
      producto: { id: 'p-arroz', nombre: 'Arroz', etiqueta: 'Arroz · bolsa 2 lb' },
      cantidad: '2.000',
      frecuencia: 'SEMANAL',
      ultimaInclusionSemana: '2026-10-18',
      proximaInclusion: '2026-10-25',
      tocaEstaSemana: true,
      notas: null,
    });
  });

  it('un mensual con 3 de 4 semanas no toca y uno sin inclusión previa toca sin fecha', () => {
    const mensual = vistaDespensa(
      fila({ frecuencia: 'MENSUAL', ultimaInclusionSemana: '2026-10-04' }),
      '2026-10-25',
    );
    expect(mensual).toMatchObject({ tocaEstaSemana: false, proximaInclusion: '2026-11-01' });
    expect(vistaDespensa(fila({ ultimaInclusionSemana: null }), '2026-10-25')).toMatchObject({
      tocaEstaSemana: true,
      proximaInclusion: null,
    });
  });
});

describe('DespensaService y DespensaController (CU-07.2, HU-29)', () => {
  const repo = {
    listar: jest.fn(),
    buscar: jest.fn(),
    productoActivo: jest.fn(),
    buscarPorProducto: jest.fn(),
    crear: jest.fn(),
    reactivar: jest.fn(),
    actualizar: jest.fn(),
    inactivar: jest.fn(),
  };
  const configuracion = {
    obtener: jest.fn().mockResolvedValue({ proximaSemana: { desde: '2026-10-25' } }),
  };
  const servicio = new DespensaService(
    repo as unknown as DespensaRepositorio,
    configuracion as unknown as ConfiguracionService,
  );
  const controlador = new DespensaController(servicio);
  const nueva = { productoId: 'p-arroz', cantidad: '2', frecuencia: 'SEMANAL' as const };

  beforeEach(() => {
    jest.resetAllMocks();
    configuracion.obtener.mockResolvedValue({ proximaSemana: { desde: '2026-10-25' } });
    repo.buscar.mockResolvedValue(fila());
    repo.productoActivo.mockResolvedValue(true);
    repo.buscarPorProducto.mockResolvedValue(undefined);
    repo.crear.mockResolvedValue('d1');
    repo.actualizar.mockResolvedValue(true);
    repo.inactivar.mockResolvedValue(true);
  });

  it('lista la despensa con lo que toca en la semana de la próxima lista', async () => {
    repo.listar.mockResolvedValue([
      fila(),
      fila({ id: 'd2', ultimaInclusionSemana: '2026-10-25' }),
    ]);
    const r = await controlador.listar('h1');
    expect(r.map((d) => [d.id, d.tocaEstaSemana])).toEqual([
      ['d1', true],
      ['d2', false],
    ]);
    expect(configuracion.obtener).toHaveBeenCalledWith('h1');
  });

  it('CA-29.3 agrega un producto con la cantidad a 3 decimales y la nota recortada', async () => {
    const r = await controlador.crear('h1', { ...nueva, notas: '  Almuerzo ' });
    expect(repo.crear).toHaveBeenCalledWith('h1', 'p-arroz', {
      cantidad: '2.000',
      frecuencia: 'SEMANAL',
      notas: 'Almuerzo',
    });
    expect(r.id).toBe('d1');
  });

  it('CA-29.4 una cantidad inválida es 422 con su mensaje y no guarda', async () => {
    for (const cantidad of ['0', '-3', 'abc', '', undefined, ['2']]) {
      const e = await problema(servicio.crear('h1', { ...nueva, cantidad }));
      expect(e).toMatchObject({
        codigo: 'CANTIDAD_INVALIDA',
        detalle: 'La cantidad debe ser mayor que 0',
      });
      expect(e.getStatus()).toBe(422);
    }
    expect(repo.crear).not.toHaveBeenCalled();
  });

  it('un producto que no está activo en el catálogo es 422', async () => {
    repo.productoActivo.mockResolvedValue(false);
    const e = await problema(servicio.crear('h1', nueva));
    expect(e).toMatchObject({ codigo: 'PRODUCTO_INVALIDO' });
    expect(repo.crear).not.toHaveBeenCalled();
  });

  it('un producto ya activo en la despensa es 409 YA_EN_DESPENSA', async () => {
    repo.buscarPorProducto.mockResolvedValue({ id: 'd1', activo: true });
    const e = await problema(servicio.crear('h1', nueva));
    expect(e).toMatchObject({ codigo: 'YA_EN_DESPENSA' });
    expect(e.getStatus()).toBe(409);
  });

  it('un producto dado de baja se reactiva con los valores nuevos', async () => {
    repo.buscarPorProducto.mockResolvedValue({ id: 'd9', activo: false });
    repo.buscar.mockResolvedValue(fila({ id: 'd9' }));
    const r = await servicio.crear('h1', { ...nueva, notas: '   ' });
    expect(repo.reactivar).toHaveBeenCalledWith('d9', {
      cantidad: '2.000',
      frecuencia: 'SEMANAL',
      notas: null,
    });
    expect(repo.crear).not.toHaveBeenCalled();
    expect(r.id).toBe('d9');
  });

  it('actualiza solo lo que llega y devuelve la vista', async () => {
    await controlador.actualizar('h1', 'd1', { cantidad: 3, frecuencia: 'MENSUAL', notas: ' x ' });
    expect(repo.actualizar).toHaveBeenCalledWith('h1', 'd1', {
      cantidad: '3.000',
      frecuencia: 'MENSUAL',
      notas: 'x',
    });
    repo.actualizar.mockClear();
    await servicio.actualizar('h1', 'd1', { notas: '' });
    expect(repo.actualizar).toHaveBeenCalledWith('h1', 'd1', { notas: null });
  });

  it('un cuerpo vacío no escribe y un cambio inválido es 422', async () => {
    await servicio.actualizar('h1', 'd1', {});
    expect(repo.actualizar).not.toHaveBeenCalled();
    const e = await problema(servicio.actualizar('h1', 'd1', { cantidad: '0' }));
    expect(e).toMatchObject({ codigo: 'CANTIDAD_INVALIDA' });
  });

  it('actualizar o quitar algo que no existe es 404', async () => {
    repo.actualizar.mockResolvedValue(false);
    repo.inactivar.mockResolvedValue(false);
    repo.buscar.mockResolvedValue(undefined);
    expect(await problema(servicio.actualizar('h1', 'd1', { cantidad: '2' }))).toMatchObject({
      codigo: 'NO_ENCONTRADO',
    });
    expect(await problema(servicio.actualizar('h1', 'd1', {}))).toMatchObject({
      codigo: 'NO_ENCONTRADO',
    });
    const e = await problema(controlador.quitar('h1', 'd1'));
    expect(e).toMatchObject({ codigo: 'NO_ENCONTRADO' });
    expect(e.getStatus()).toBe(404);
  });

  it('quitar da de baja el producto', async () => {
    await expect(controlador.quitar('h1', 'd1')).resolves.toBeUndefined();
    expect(repo.inactivar).toHaveBeenCalledWith('h1', 'd1');
  });
});
