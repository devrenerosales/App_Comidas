import { Problema } from '../comun/problema';
import type { VinculosRepositorio } from '../vinculos/vinculos.repositorio';
import { HistoricoPreciosService } from './historico-precios.service';
import type { ResumenPreciosRepositorio } from './resumen-precios.repositorio';

/** 24/10/2026, mediodía en Guatemala. */
const AHORA = new Date('2026-10-24T18:00:00Z');

const fila = (
  supermercado: string,
  precio: string,
  fecha: string,
  origen: 'AUTOMATICO' | 'MANUAL' | 'TICKET' = 'AUTOMATICO',
) => ({ supermercadoId: supermercado.toLowerCase(), supermercado, precio, fecha, origen });

async function problema(promesa: Promise<unknown>): Promise<Problema> {
  const error = await promesa.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(Problema);
  return error as Problema;
}

describe('HistoricoPreciosService (HU-37)', () => {
  const repo = { historico: jest.fn() };
  const productos = { producto: jest.fn() };
  const servicio = new HistoricoPreciosService(
    repo as unknown as ResumenPreciosRepositorio,
    productos as unknown as VinculosRepositorio,
    () => AHORA,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    productos.producto.mockResolvedValue({ id: 'p1', nombre: 'Pollo' });
  });

  it('CA-37.1 devuelve las series con sus variaciones (12 semanas por defecto)', async () => {
    repo.historico.mockResolvedValue([
      fila('Walmart', '20.00', '2026-10-10'),
      fila('Walmart', '21.00', '2026-10-17', 'MANUAL'),
      fila('Walmart', '22.00', '2026-10-24'),
    ]);
    const r = await servicio.obtener('h1', 'p1');
    expect(repo.historico).toHaveBeenCalledWith('h1', 'p1');
    expect(r).toMatchObject({ productoId: 'p1', semanas: 12 });
    expect(r.series).toHaveLength(1);
    expect(r.series[0]!.variacionAnterior.texto).toBe('+4.8 %');
    expect(r.series[0]!.variacionPeriodo.texto).toBe('+10.0 %');
    expect(r.series[0]!.puntos[1]).toEqual({
      fecha: '2026-10-17',
      precioNormalizado: '21.00',
      origen: 'MANUAL',
    });
  });

  it('2a con 4 semanas deja fuera lo más antiguo', async () => {
    repo.historico.mockResolvedValue([
      fila('Walmart', '10.00', '2026-08-30'),
      fila('Walmart', '20.00', '2026-10-10'),
      fila('Walmart', '22.00', '2026-10-24'),
    ]);
    const r = await servicio.obtener('h1', 'p1', '4');
    expect(r.semanas).toBe(4);
    expect(r.series[0]!.puntos).toHaveLength(2);
    expect(r.series[0]!.variacionPeriodo.texto).toBe('+10.0 %');
  });

  it('E1 sin precios devuelve la serie vacía', async () => {
    repo.historico.mockResolvedValue([]);
    expect((await servicio.obtener('h1', 'p1')).series).toEqual([]);
  });

  it.each(['8', 'abc', '', '0'])('un periodo inválido (%p) es 400 PERIODO_INVALIDO', async (v) => {
    const p = await problema(servicio.obtener('h1', 'p1', v));
    expect([p.getStatus(), p.codigo]).toEqual([400, 'PERIODO_INVALIDO']);
    expect(repo.historico).not.toHaveBeenCalled();
  });

  it('un producto inexistente es 404 NO_ENCONTRADO', async () => {
    productos.producto.mockResolvedValue(null);
    const p = await problema(servicio.obtener('h1', 'p1'));
    expect([p.getStatus(), p.codigo]).toEqual([404, 'NO_ENCONTRADO']);
  });
});
