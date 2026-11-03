import type { MenuSemanal, MenuTiempo } from '@menu/db';
import type { UnidadConId } from '@menu/shared';
import { Problema } from '../comun/problema';
import { MenusAprobacionService } from './menus-aprobacion.service';
import type { DetalleConPlatillo, MenuCompleto, MenusRepositorio } from './menus.repositorio';

const AHORA = new Date('2026-11-02T15:10:00.000Z');

const espacio = (id: string, fecha: string, conPlatillo: boolean, tiempo = 'ALMUERZO') =>
  ({
    id,
    fecha,
    tiempo,
    platilloId: conPlatillo ? `p-${id}` : null,
    platilloNombre: conPlatillo ? `Platillo ${id}` : null,
    platilloProteina: conPlatillo ? 'POLLO' : null,
    fijado: false,
    origen: 'MOTOR',
    costoIncompleto: true,
    reglasAplicadas: [],
  }) as unknown as DetalleConPlatillo;

const tiempoMenu = (tiempo: string, exceso: string) =>
  ({
    tiempo,
    porcentaje: '50.00',
    presupuesto: '250.00',
    costoEstimado: null,
    exceso,
  }) as MenuTiempo;

const completo = (
  extra: Partial<MenuCompleto> = {},
  menu: Partial<MenuSemanal> = {},
): MenuCompleto => ({
  menu: {
    id: 'm1',
    fechaInicio: '2026-11-01',
    fechaFin: '2026-11-07',
    estado: 'BORRADOR',
    version: 4,
    aprobadoEn: null,
    ...menu,
  } as MenuSemanal,
  tiempos: [tiempoMenu('ALMUERZO', '0.00'), tiempoMenu('CENA', '0.00')],
  detalles: [espacio('a', '2026-11-02', true), espacio('b', '2026-11-03', true)],
  ...extra,
});

async function problema(promesa: Promise<unknown>): Promise<Problema> {
  try {
    await promesa;
  } catch (error) {
    if (error instanceof Problema) return error;
    throw error;
  }
  throw new Error('Se esperaba un Problema');
}

describe('MenusAprobacionService (CU-06.2, HU-25)', () => {
  const repo = { cargar: jest.fn(), aprobar: jest.fn(), ingredientesParaLista: jest.fn() };
  const servicio = new MenusAprobacionService(repo as unknown as MenusRepositorio, () => AHORA);
  const datos = () => repo.aprobar.mock.calls[0]![3] as Record<string, unknown>;

  beforeEach(() => {
    jest.resetAllMocks();
    repo.cargar.mockResolvedValue(completo());
    repo.aprobar.mockResolvedValue({ id: 'l1', version: 1 });
    repo.ingredientesParaLista.mockResolvedValue(new Map());
  });

  it('aprueba el Borrador con usuario, fecha y exceso 0 si todo está dentro (CA-25.1)', async () => {
    const respuesta = await servicio.aprobar('h1', 'u1', 'm1', { version: 4 });
    expect(repo.aprobar).toHaveBeenCalledWith('h1', 'm1', 4, expect.any(Object));
    expect(datos()).toEqual({
      usuarioId: 'u1',
      aprobadoEn: AHORA,
      excesoAlAprobar: '0.00',
      items: [],
    });
    expect(respuesta.excede).toBeNull();
    expect(respuesta.lista).toEqual({
      id: 'l1',
      version: 1,
      totalItems: 0,
      itemsMenu: 0,
      itemsDespensa: 0,
      sinConversion: 0,
      url: '/api/v1/listas/l1',
    });
  });

  it('aprueba con exceso sin pedir confirmación y registra la suma de los tiempos (CA-25.2)', async () => {
    repo.cargar
      .mockResolvedValueOnce(
        completo({ tiempos: [tiempoMenu('ALMUERZO', '17.00'), tiempoMenu('CENA', '2.55')] }),
      )
      .mockResolvedValueOnce(
        completo({}, { estado: 'APROBADO', excesoAlAprobar: '19.55', version: 5 }),
      );
    const respuesta = await servicio.aprobar('h1', 'u1', 'm1', { version: 4 });
    expect(datos().excesoAlAprobar).toBe('19.55');
    expect(respuesta.excede).toEqual({ monto: '19.55', texto: 'Excede por Q19.55' });
  });

  describe('consolidación de la lista (CU-07.1, HU-28)', () => {
    const LB = { id: 'u-lb', codigo: 'lb', magnitud: 'MASA' as const, factorBase: 453.592 };
    const CDTA = {
      id: 'u-cdta',
      codigo: 'cucharadita',
      magnitud: 'VOLUMEN' as const,
      factorBase: 5,
    };
    const G = { id: 'u-g', codigo: 'g', magnitud: 'MASA' as const, factorBase: 1 };
    const ingrediente = (
      productoId: string,
      cantidad: number,
      unidad: UnidadConId,
      presentacion: { cantidad: number; unidad: UnidadConId },
    ) => ({ productoId, cantidad, porcionesBase: 4, unidad, presentacion, equivalencia: null });

    it('CA-28.1 suma el mismo producto de dos platillos con la Σ congelada del menú', async () => {
      repo.cargar.mockResolvedValue(completo({}, { sumaFactoresPorcion: '6.00' }));
      repo.ingredientesParaLista.mockResolvedValue(
        new Map([
          [
            'p-a',
            {
              porcionesBase: 4,
              ingredientes: [ingrediente('pollo', 2, LB, { cantidad: 1, unidad: LB })],
            },
          ],
          [
            'p-b',
            {
              porcionesBase: 4,
              ingredientes: [ingrediente('pollo', 2.5, LB, { cantidad: 1, unidad: LB })],
            },
          ],
        ]),
      );

      const respuesta = await servicio.aprobar('h1', 'u1', 'm1', { version: 4 });

      expect(repo.ingredientesParaLista).toHaveBeenCalledWith(['p-a', 'p-b']);
      const items = datos().items as Record<string, unknown>[];
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        productoId: 'pollo',
        cantidadRequerida: 6.75,
        cantidadComprar: 7,
        sinConversion: false,
        origenes: [
          { menuDetalleId: 'a', cantidadRequerida: 3 },
          { menuDetalleId: 'b', cantidadRequerida: 3.75 },
        ],
      });
      expect(respuesta.lista).toMatchObject({ totalItems: 1, itemsMenu: 1, sinConversion: 0 });
    });

    it('CA-28.3 un ingrediente sin conversión se agrega marcado y el resto sale normal', async () => {
      repo.cargar.mockResolvedValue(completo({}, { sumaFactoresPorcion: '4.00' }));
      repo.ingredientesParaLista.mockResolvedValue(
        new Map([
          [
            'p-a',
            {
              porcionesBase: 4,
              ingredientes: [
                ingrediente('oregano', 1, CDTA, { cantidad: 10, unidad: G }),
                ingrediente('pollo', 2, LB, { cantidad: 1, unidad: LB }),
              ],
            },
          ],
        ]),
      );

      const respuesta = await servicio.aprobar('h1', 'u1', 'm1', { version: 4 });

      const items = datos().items as { productoId: string; sinConversion: boolean }[];
      expect(items.map((i) => [i.productoId, i.sinConversion])).toEqual([
        ['oregano', true],
        ['pollo', false],
      ]);
      expect(respuesta.lista).toMatchObject({ totalItems: 2, sinConversion: 1 });
    });

    it('si el menú no tiene Σ de factores no escala (cantidades en 0) y no falla', async () => {
      repo.cargar.mockResolvedValue(completo({}, { sumaFactoresPorcion: null }));
      repo.ingredientesParaLista.mockResolvedValue(
        new Map([
          [
            'p-a',
            {
              porcionesBase: 4,
              ingredientes: [ingrediente('pollo', 2, LB, { cantidad: 1, unidad: LB })],
            },
          ],
        ]),
      );
      await servicio.aprobar('h1', 'u1', 'm1', { version: 4 });
      expect((datos().items as { cantidadComprar: number }[])[0]!.cantidadComprar).toBe(1);
    });
  });

  it('un menú de otro hogar o inexistente es 404', async () => {
    repo.cargar.mockResolvedValue(undefined);
    expect((await problema(servicio.aprobar('h1', 'u1', 'mx', { version: 4 }))).getStatus()).toBe(
      404,
    );
    expect(repo.aprobar).not.toHaveBeenCalled();
  });

  it('con espacios vacíos responde 422 y señala cuáles, sin aprobar (CA-25.3)', async () => {
    repo.cargar.mockResolvedValue(
      completo({
        detalles: [
          espacio('a', '2026-11-02', true),
          espacio('v', '2026-11-06', false, 'CENA'),
          espacio('l', '2026-11-03', false),
        ],
      }),
    );
    const error = await problema(servicio.aprobar('h1', 'u1', 'm1', { version: 4 }));
    expect(error.getStatus()).toBe(422);
    expect(error).toMatchObject({
      codigo: 'ESPACIOS_VACIOS',
      detalle: 'Asigna un platillo a: martes almuerzo, viernes cena',
      extensiones: {
        espacios: [
          { fecha: '2026-11-03', tiempo: 'ALMUERZO' },
          { fecha: '2026-11-06', tiempo: 'CENA' },
        ],
      },
    });
    expect(repo.aprobar).not.toHaveBeenCalled();
  });

  it('si ya está aprobado informa quién y a qué hora (E3)', async () => {
    repo.cargar.mockResolvedValue(
      completo(
        { aprobadoPor: { id: 'u2', nombre: 'Ana' } },
        { estado: 'APROBADO', aprobadoEn: AHORA },
      ),
    );
    const error = await problema(servicio.aprobar('h1', 'u1', 'm1', { version: 4 }));
    expect(error.getStatus()).toBe(409);
    expect(error).toMatchObject({
      codigo: 'MENU_YA_APROBADO',
      detalle: 'Ana aprobó este menú a las 09:10',
      extensiones: { menuId: 'm1' },
    });
  });

  it('sin hora ni aprobador usa un texto genérico', async () => {
    repo.cargar.mockResolvedValue(completo({}, { estado: 'APROBADO' }));
    const error = await problema(servicio.aprobar('h1', 'u1', 'm1', { version: 4 }));
    expect(error.detalle).toBe('Otro miembro ya aprobó este menú');
  });

  it('una semana histórica no se aprueba', async () => {
    repo.cargar.mockResolvedValue(completo({}, { estado: 'HISTORICO' }));
    const error = await problema(servicio.aprobar('h1', 'u1', 'm1', { version: 4 }));
    expect(error).toMatchObject({ codigo: 'SEMANA_HISTORICA' });
    expect(error.getStatus()).toBe(409);
  });

  it('una versión distinta a la guardada es VERSION_DESACTUALIZADA', async () => {
    const error = await problema(servicio.aprobar('h1', 'u1', 'm1', { version: 3 }));
    expect(error).toMatchObject({ codigo: 'VERSION_DESACTUALIZADA' });
    expect(error.getStatus()).toBe(409);
    expect(repo.aprobar).not.toHaveBeenCalled();
  });

  it('si otro miembro aprobó entre la lectura y la escritura informa que ya está aprobado', async () => {
    repo.aprobar.mockResolvedValue(undefined);
    repo.cargar
      .mockResolvedValueOnce(completo())
      .mockResolvedValueOnce(completo({}, { estado: 'APROBADO', aprobadoEn: AHORA }));
    const error = await problema(servicio.aprobar('h1', 'u1', 'm1', { version: 4 }));
    expect(error).toMatchObject({ codigo: 'MENU_YA_APROBADO' });
  });

  it('si el Borrador cambió de versión entre la lectura y la escritura lo informa', async () => {
    repo.aprobar.mockResolvedValue(undefined);
    const error = await problema(servicio.aprobar('h1', 'u1', 'm1', { version: 4 }));
    expect(error).toMatchObject({ codigo: 'VERSION_DESACTUALIZADA' });
  });
});
