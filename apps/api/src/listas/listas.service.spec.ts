import { Problema } from '../comun/problema';
import type { SincronizarListaDto } from './dto/listas.dto';
import type { ListasRepositorio } from './listas.repositorio';
import { ListasService } from './listas.service';

const completa = (version = 1) => ({
  id: 'l1',
  menuId: 'm1',
  version,
  fechaInicio: '2026-11-01',
  fechaFin: '2026-11-07',
  excesoAlAprobar: null,
  items: [],
  comidas: [],
});

const cambio = (n: number) => ({
  id: `c${n}`,
  itemId: 'i1',
  operacion: 'MARCAR_COMPRADO' as const,
  marcaTiempo: '2026-11-03T10:00:00.000Z',
});

async function problema(promesa: Promise<unknown>): Promise<Problema> {
  const error = await promesa.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(Problema);
  return error as Problema;
}

describe('ListasService (HU-28, HU-30)', () => {
  const repo = { cargar: jest.fn(), aplicarSync: jest.fn() };
  const HOY = new Date('2026-10-25T12:00:00.000Z');
  const servicio = new ListasService(repo as unknown as ListasRepositorio, () => HOY);

  beforeEach(() => jest.resetAllMocks());

  it('devuelve la lista del hogar', async () => {
    repo.cargar.mockResolvedValue(completa());
    await expect(servicio.obtener('h1', 'l1')).resolves.toMatchObject({ id: 'l1', total: 0 });
    expect(repo.cargar).toHaveBeenCalledWith('h1', 'l1', HOY);
  });

  it('una lista de otro hogar o inexistente es 404', async () => {
    repo.cargar.mockResolvedValue(undefined);
    expect((await problema(servicio.obtener('h1', 'lx'))).getStatus()).toBe(404);
  });

  describe('avance (CU-07.6)', () => {
    it('cuenta los ingredientes cubiertos de cada comida y el avance general', async () => {
      repo.cargar.mockResolvedValue({
        ...completa(),
        items: [
          {
            id: 'i1',
            productoNombre: 'Pollo',
            textoLibre: null,
            estado: 'COMPRADO',
            comidas: ['d1'],
          },
          {
            id: 'i2',
            productoNombre: 'Tomate',
            textoLibre: null,
            estado: 'PENDIENTE',
            comidas: ['d1'],
          },
          {
            id: 'i3',
            productoNombre: null,
            textoLibre: 'Tortillas',
            estado: 'YA_LO_TENGO',
            comidas: [],
          },
          { id: 'i4', productoNombre: null, textoLibre: null, estado: 'PENDIENTE', comidas: [] },
        ],
        comidas: [
          {
            menuDetalleId: 'd1',
            fecha: '2026-11-04',
            tiempo: 'ALMUERZO',
            platillo: { id: 'p1', nombre: 'Pepián de pollo' },
          },
        ],
      });

      const avance = await servicio.avance('h1', 'l1');

      expect(avance.general).toEqual({ cubiertos: 2, total: 4, porcentaje: 50 });
      expect(avance.comidas).toEqual([
        expect.objectContaining({
          menuDetalleId: 'd1',
          cubiertos: 1,
          total: 2,
          listaParaPreparar: false,
          pendientes: [{ itemId: 'i2', producto: 'Tomate' }],
        }),
      ]);
    });

    it('una lista de otro hogar o inexistente es 404', async () => {
      repo.cargar.mockResolvedValue(undefined);
      expect((await problema(servicio.avance('h1', 'lx'))).getStatus()).toBe(404);
    });
  });

  describe('sincronizar (CU-07.3)', () => {
    const dto = (cambios: unknown[]) => ({ cambios }) as unknown as SincronizarListaDto;

    it('aplica el lote y devuelve los resultados con la lista vigente y su versión', async () => {
      repo.aplicarSync.mockResolvedValue({
        resultados: [{ id: 'c1', resultado: 'APLICADO' }],
      });
      repo.cargar.mockResolvedValue(completa(2));

      const res = await servicio.sincronizar('h1', 'u1', 'l1', dto([cambio(1)]));

      expect(repo.aplicarSync).toHaveBeenCalledWith('h1', 'l1', 'u1', [cambio(1)]);
      expect(res).toMatchObject({
        version: 2,
        resultados: [{ id: 'c1', resultado: 'APLICADO' }],
        lista: { id: 'l1', total: 0 },
      });
    });

    it('un lote de más de 500 cambios es 422 y no se aplica', async () => {
      const grande = Array.from({ length: 501 }, (_, i) => cambio(i));
      const p = await problema(servicio.sincronizar('h1', 'u1', 'l1', dto(grande)));
      expect([p.getStatus(), p.codigo]).toEqual([422, 'LOTE_DEMASIADO_GRANDE']);
      expect(repo.aplicarSync).not.toHaveBeenCalled();
    });

    it('una lista de otro hogar es 404', async () => {
      repo.aplicarSync.mockResolvedValue(undefined);
      expect((await problema(servicio.sincronizar('h1', 'u1', 'lx', dto([])))).getStatus()).toBe(
        404,
      );
      expect(repo.cargar).not.toHaveBeenCalled();
    });

    it('si la lista desaparece entre la escritura y la lectura es 404', async () => {
      repo.aplicarSync.mockResolvedValue({ resultados: [] });
      repo.cargar.mockResolvedValue(undefined);
      expect((await problema(servicio.sincronizar('h1', 'u1', 'l1', dto([])))).getStatus()).toBe(
        404,
      );
    });
  });
});
