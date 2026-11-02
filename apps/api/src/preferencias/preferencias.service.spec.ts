import { Problema } from '../comun/problema';
import type { GuardarGustosDto } from './dto/preferencias.dto';
import type { PreferenciasRepositorio } from './preferencias.repositorio';
import { PreferenciasService, mensajeFavoritoExcluido } from './preferencias.service';
import type { ElementoGusto } from './preferencias.tipos';

const el = (id: string, nombre: string, activo = true): ElementoGusto => ({ id, nombre, activo });

async function problema(promesa: Promise<unknown>): Promise<[number, string]> {
  try {
    await promesa;
  } catch (error) {
    if (error instanceof Problema) return [error.getStatus(), error.codigo];
    throw error;
  }
  throw new Error('Se esperaba un Problema');
}

describe('PreferenciasService (HU-10)', () => {
  const repo = {
    excluidos: jest.fn(),
    favoritos: jest.fn(),
    productos: jest.fn(),
    platillos: jest.fn(),
    platillosConProductos: jest.fn(),
    guardar: jest.fn(),
  };
  const servicio = new PreferenciasService(repo as unknown as PreferenciasRepositorio);
  const dto = (ingredientesExcluidos: string[], favoritos: string[]): GuardarGustosDto => ({
    ingredientesExcluidos,
    favoritos,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    repo.excluidos.mockResolvedValue([]);
    repo.favoritos.mockResolvedValue([]);
    repo.productos.mockResolvedValue([]);
    repo.platillos.mockResolvedValue([]);
    repo.platillosConProductos.mockResolvedValue([]);
    repo.guardar.mockResolvedValue(undefined);
  });

  describe('mensajeFavoritoExcluido', () => {
    it('usa singular con un ingrediente y plural con varios', () => {
      expect(mensajeFavoritoExcluido('Chile relleno', ['Chile pimiento'])).toBe(
        'Chile relleno contiene un ingrediente excluido: Chile pimiento',
      );
      expect(mensajeFavoritoExcluido('Chile relleno', ['Chile pimiento', 'Queso'])).toBe(
        'Chile relleno contiene ingredientes excluidos: Chile pimiento, Queso',
      );
    });
  });

  describe('obtener', () => {
    it('devuelve lo guardado con su impacto y las advertencias de favoritos', async () => {
      repo.excluidos.mockResolvedValue([el('p1', 'Chile pimiento'), el('p2', 'Queso')]);
      repo.favoritos.mockResolvedValue([el('d1', 'Chile relleno'), el('d2', 'Caldo de res')]);
      repo.platillosConProductos.mockResolvedValue([
        { platilloId: 'd1', platilloNombre: 'Chile relleno', productoNombre: 'Chile pimiento' },
        { platilloId: 'd1', platilloNombre: 'Chile relleno', productoNombre: 'Queso' },
      ]);
      const vista = await servicio.obtener('h1');
      expect(repo.platillosConProductos).toHaveBeenCalledWith('h1', ['p1', 'p2']);
      expect(vista.impacto.platillosExcluidos).toEqual([
        { id: 'd1', nombre: 'Chile relleno', ingredientes: ['Chile pimiento', 'Queso'] },
      ]);
      expect(vista.advertencias).toEqual([
        {
          codigo: 'FAVORITO_CON_EXCLUIDO',
          platillo: { id: 'd1', nombre: 'Chile relleno' },
          ingredientes: ['Chile pimiento', 'Queso'],
          mensaje: 'Chile relleno contiene ingredientes excluidos: Chile pimiento, Queso',
        },
      ]);
    });
  });

  describe('guardar', () => {
    it('quita ids repetidos, ordena por nombre y reemplaza en el repositorio', async () => {
      repo.productos.mockResolvedValue([el('p1', 'Zanahoria'), el('p2', 'Apio')]);
      repo.platillos.mockResolvedValue([el('d1', 'Tamales')]);
      const vista = await servicio.guardar('h1', dto(['p1', 'p2', 'p1'], ['d1', 'd1']));
      expect(repo.productos).toHaveBeenCalledWith(['p1', 'p2']);
      expect(repo.guardar).toHaveBeenCalledWith('h1', ['p2', 'p1'], ['d1']);
      expect(vista.ingredientesExcluidos.map((e) => e.nombre)).toEqual(['Apio', 'Zanahoria']);
      expect(vista.advertencias).toEqual([]);
    });

    it('guardar listas vacías limpia todo', async () => {
      await servicio.guardar('h1', dto([], []));
      expect(repo.guardar).toHaveBeenCalledWith('h1', [], []);
    });

    it('un ingrediente que no existe es 404 y no guarda', async () => {
      repo.productos.mockResolvedValue([el('p1', 'Apio')]);
      expect(await problema(servicio.guardar('h1', dto(['p1', 'px'], [])))).toEqual([
        404,
        'NO_ENCONTRADO',
      ]);
      expect(repo.guardar).not.toHaveBeenCalled();
    });

    it('un platillo que no existe (o es de otro hogar) es 404', async () => {
      expect(await problema(servicio.guardar('h1', dto([], ['dx'])))).toEqual([
        404,
        'NO_ENCONTRADO',
      ]);
    });

    it('E1 agregar un ingrediente inactivo es 422 INACTIVO', async () => {
      repo.productos.mockResolvedValue([el('p1', 'Crema', false)]);
      expect(await problema(servicio.guardar('h1', dto(['p1'], [])))).toEqual([422, 'INACTIVO']);
      expect(repo.guardar).not.toHaveBeenCalled();
    });

    it('E1 agregar un platillo inactivo como favorito es 422 INACTIVO', async () => {
      repo.platillos.mockResolvedValue([el('d1', 'Sopa', false)]);
      expect(await problema(servicio.guardar('h1', dto([], ['d1'])))).toEqual([422, 'INACTIVO']);
    });

    it('conserva lo que ya estaba guardado aunque se haya inactivado después', async () => {
      repo.productos.mockResolvedValue([el('p1', 'Crema', false)]);
      repo.platillos.mockResolvedValue([el('d1', 'Sopa', false)]);
      repo.excluidos.mockResolvedValue([el('p1', 'Crema', false)]);
      repo.favoritos.mockResolvedValue([el('d1', 'Sopa', false)]);
      await servicio.guardar('h1', dto(['p1'], ['d1']));
      expect(repo.guardar).toHaveBeenCalledWith('h1', ['p1'], ['d1']);
    });
  });

  describe('vistaPrevia', () => {
    it('calcula el impacto sin guardar ni exigir elementos activos', async () => {
      repo.productos.mockResolvedValue([el('p1', 'Crema', false)]);
      repo.platillos.mockResolvedValue([el('d1', 'Pollo en crema')]);
      repo.platillosConProductos.mockResolvedValue([
        { platilloId: 'd1', platilloNombre: 'Pollo en crema', productoNombre: 'Crema' },
      ]);
      const vista = await servicio.vistaPrevia('h1', dto(['p1'], ['d1']));
      expect(repo.guardar).not.toHaveBeenCalled();
      expect(vista.advertencias).toHaveLength(1);
      expect(vista.impacto.platillosExcluidos).toHaveLength(1);
    });

    it('un id inexistente sigue siendo 404', async () => {
      expect(await problema(servicio.vistaPrevia('h1', dto(['px'], [])))).toEqual([
        404,
        'NO_ENCONTRADO',
      ]);
    });
  });
});
