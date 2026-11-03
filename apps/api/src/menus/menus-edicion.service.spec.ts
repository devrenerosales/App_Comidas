import type { MenuSemanal } from '@menu/db';
import { Problema } from '../comun/problema';
import { MenusEdicionService } from './menus-edicion.service';
import type {
  DetalleConPlatillo,
  MenuCompleto,
  MenusRepositorio,
  PlatilloConTiempos,
} from './menus.repositorio';

const AHORA = new Date('2026-11-02T15:00:00.000Z');

const detalle = (
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
    origen: 'MOTOR',
    costoIncompleto: true,
    reglasAplicadas: [],
    ...extra,
  }) as DetalleConPlatillo;

/** CA-24.1: lunes Carne guisada, miércoles Pescado, jueves Pepián y viernes Spaghetti. */
const completo = (estado: MenuSemanal['estado'] = 'BORRADOR'): MenuCompleto => ({
  menu: { id: 'm1', estado } as MenuSemanal,
  tiempos: [],
  detalles: [
    detalle('lun', '2026-11-02', ['carne', 'Carne guisada', 'RES']),
    detalle('mie', '2026-11-04', ['pescado', 'Pescado frito', 'PESCADO']),
    detalle('jue', '2026-11-05', ['pepian', 'Pepián de pollo', 'POLLO']),
    detalle('vie', '2026-11-06', ['spaghetti', 'Spaghetti con carne', 'RES']),
    detalle('sab', '2026-11-07', null),
    detalle('dom-cena', '2026-11-01', ['caldo', 'Caldo de res', 'RES'], { tiempo: 'CENA' }),
  ],
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

const platillo = (extra: Partial<PlatilloConTiempos> = {}): PlatilloConTiempos => ({
  id: 'chile',
  nombre: 'Chile relleno',
  proteina: 'CERDO',
  activo: true,
  tiempos: ['ALMUERZO'],
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

describe('MenusEdicionService (CU-06.1, HU-24)', () => {
  const repo = {
    cargar: jest.fn(),
    cargarPorFecha: jest.fn(),
    platillo: jest.fn(),
    tiemposDe: jest.fn(),
    aplicarCambios: jest.fn(),
    ingredientesParaCosto: jest.fn(),
  };
  const servicio = new MenusEdicionService(repo as unknown as MenusRepositorio, () => AHORA);
  const cambios = () =>
    repo.aplicarCambios.mock.calls[0]![1] as { id: string; cambio: Record<string, unknown> }[];

  beforeEach(() => {
    jest.resetAllMocks();
    repo.cargar.mockResolvedValue(completo());
    repo.platillo.mockResolvedValue(platillo());
    repo.tiemposDe.mockResolvedValue(new Map());
    repo.aplicarCambios.mockResolvedValue(undefined);
    repo.ingredientesParaCosto.mockResolvedValue(new Map());
  });

  describe('lectura', () => {
    it('obtener devuelve la vista y un menú ajeno o inexistente es 404', async () => {
      await expect(servicio.obtener('h1', 'm1')).resolves.toMatchObject({ id: 'm1' });
      repo.cargar.mockResolvedValue(undefined);
      expect((await problema(servicio.obtener('h1', 'mx'))).getStatus()).toBe(404);
    });

    it('obtenerPorSemana devuelve el menú de esa fecha o 404 SIN_MENU', async () => {
      repo.cargarPorFecha.mockResolvedValue(completo('APROBADO'));
      await expect(servicio.obtenerPorSemana('h1', '2026-11-03')).resolves.toMatchObject({
        estado: 'APROBADO',
      });
      repo.cargarPorFecha.mockResolvedValue(undefined);
      const p = await problema(servicio.obtenerPorSemana('h1', '2026-11-03'));
      expect([p.getStatus(), p.codigo]).toEqual([404, 'SIN_MENU']);
    });
  });

  describe('costos', () => {
    it('CU-06.3 resume el costo y la diferencia con el presupuesto; menú ajeno es 404', async () => {
      const base = completo();
      repo.cargar.mockResolvedValue({
        ...base,
        menu: {
          ...base.menu,
          presupuestoSemanal: '245.00',
          costoEstimado: '229.50',
          costoIncompleto: false,
        } as MenuSemanal,
      });
      await expect(servicio.costos('h1', 'm1')).resolves.toMatchObject({
        total: '229.50',
        presupuesto: '245.00',
        diferencia: '15.50',
        excede: false,
      });
      repo.cargar.mockResolvedValue(undefined);
      expect((await problema(servicio.costos('h1', 'mx'))).getStatus()).toBe(404);
    });
  });

  describe('editar', () => {
    const editar = (extra: { confirmar?: boolean; platilloId?: string } = {}) =>
      servicio.editar('h1', 'u1', 'm1', 'mie', { platilloId: 'chile', ...extra });

    it('CA-24.2 elige otro platillo: queda fijado, del usuario y sin puntaje', async () => {
      await editar();
      expect(repo.aplicarCambios).toHaveBeenCalledTimes(1);
      expect(cambios()).toEqual([
        {
          id: 'mie',
          cambio: expect.objectContaining({
            platilloId: 'chile',
            fijado: true,
            origen: 'USUARIO',
            puntaje: null,
            factorPreferencia: null,
            costoEstimado: null,
            costoIncompleto: true,
            reglasAplicadas: [],
            modificadoPorId: 'u1',
            modificadoEn: AHORA,
          }),
        },
      ]);
    });

    it('CA-24.4 un menú aprobado es de solo lectura (409) y uno histórico también', async () => {
      repo.cargar.mockResolvedValue(completo('APROBADO'));
      const p = await problema(editar());
      expect([p.getStatus(), p.codigo]).toEqual([409, 'MENU_APROBADO']);
      repo.cargar.mockResolvedValue(completo('HISTORICO'));
      expect((await problema(editar())).codigo).toBe('SEMANA_HISTORICA');
      expect(repo.aplicarCambios).not.toHaveBeenCalled();
    });

    it('menú, comida o platillo inexistentes son 404 y un platillo inactivo es 422', async () => {
      repo.cargar.mockResolvedValue(undefined);
      expect((await problema(editar())).getStatus()).toBe(404);
      repo.cargar.mockResolvedValue(completo());
      expect(
        (
          await problema(servicio.editar('h1', 'u1', 'm1', 'nada', { platilloId: 'chile' }))
        ).getStatus(),
      ).toBe(404);
      repo.platillo.mockResolvedValue(undefined);
      expect((await problema(editar())).codigo).toBe('NO_ENCONTRADO');
      repo.platillo.mockResolvedValue(platillo({ activo: false }));
      expect((await problema(editar())).codigo).toBe('INACTIVO');
    });

    it('E1 un platillo que no aplica al tiempo se rechaza', async () => {
      repo.platillo.mockResolvedValue(platillo({ tiempos: ['CENA'] }));
      const p = await problema(editar());
      expect([p.getStatus(), p.codigo, p.detalle]).toEqual([
        422,
        'TIEMPO_NO_APLICABLE',
        'Chile relleno no aplica a Almuerzo',
      ]);
    });

    it('3a repetir proteína o platillo pide confirmar y, confirmado, registra la regla', async () => {
      repo.platillo.mockResolvedValue(
        platillo({ id: 'otra-res', nombre: 'Res en salsa', proteina: 'RES' }),
      );
      const p = await problema(
        servicio.editar('h1', 'u1', 'm1', 'jue', { platilloId: 'otra-res' }),
      );
      expect([p.getStatus(), p.codigo]).toEqual([409, 'CONFIRMACION_REQUERIDA']);
      expect(p.extensiones.advertencias).toEqual([
        expect.objectContaining({ codigo: 'RN02_PROTEINA_CONSECUTIVA' }),
      ]);
      expect(repo.aplicarCambios).not.toHaveBeenCalled();
      await servicio.editar('h1', 'u1', 'm1', 'jue', { platilloId: 'otra-res', confirmar: true });
      expect(cambios()[0]!.cambio.reglasAplicadas).toEqual(['RN02_CONFIRMADA']);
    });

    it('un platillo ya usado en la semana avisa RN-03 y lo registra al confirmar', async () => {
      repo.platillo.mockResolvedValue(
        platillo({ id: 'pescado', nombre: 'Pescado frito', proteina: 'PESCADO' }),
      );
      const p = await problema(servicio.editar('h1', 'u1', 'm1', 'lun', { platilloId: 'pescado' }));
      expect((p.extensiones.advertencias as { codigo: string }[])[0]!.codigo).toBe(
        'RN03_PLATILLO_REPETIDO',
      );
      await servicio.editar('h1', 'u1', 'm1', 'lun', { platilloId: 'pescado', confirmar: true });
      expect(cambios()[0]!.cambio.reglasAplicadas).toEqual(['RN03_CONFIRMADA']);
    });

    it('un espacio sin platillo también se puede llenar a mano', async () => {
      await servicio.editar('h1', 'u1', 'm1', 'sab', { platilloId: 'chile' });
      expect(cambios()[0]!.id).toBe('sab');
    });
  });

  describe('mover', () => {
    const mover = (origen: string, destino: string, confirmar?: boolean) =>
      servicio.mover('h1', 'u1', 'm1', {
        origenDetalleId: origen,
        destinoDetalleId: destino,
        confirmar,
      });
    const aplican = () =>
      repo.tiemposDe.mockResolvedValue(
        new Map([
          ['carne', ['ALMUERZO']],
          ['pepian', ['ALMUERZO']],
          ['pescado', ['ALMUERZO']],
          ['spaghetti', ['ALMUERZO']],
          ['caldo', ['ALMUERZO']],
        ]),
      );

    it('CA-24.1 intercambia lunes y jueves: avisa RN-02 y, confirmado, ambos quedan fijados', async () => {
      aplican();
      const p = await problema(mover('lun', 'jue'));
      expect([p.getStatus(), p.codigo]).toEqual([409, 'CONFIRMACION_REQUERIDA']);
      expect(p.extensiones.advertencias).toEqual([
        expect.objectContaining({
          mensaje: 'Proteína res repetida en días consecutivos (jueves y viernes)',
        }),
      ]);
      expect(repo.aplicarCambios).not.toHaveBeenCalled();

      await mover('lun', 'jue', true);
      const [origen, destino] = cambios();
      expect(origen).toMatchObject({
        id: 'lun',
        cambio: { platilloId: 'pepian', fijado: true, origen: 'USUARIO' },
      });
      expect(destino).toMatchObject({
        id: 'jue',
        cambio: { platilloId: 'carne', fijado: true, reglasAplicadas: ['RN02_CONFIRMADA'] },
      });
    });

    it('un intercambio sin conflictos se guarda sin pedir confirmación', async () => {
      aplican();
      await mover('lun', 'mie');
      expect(cambios()).toHaveLength(2);
    });

    it('mover a un espacio vacío deja el origen vacío y sin fijar', async () => {
      aplican();
      await mover('mie', 'sab');
      const [origen, destino] = cambios();
      expect(origen).toMatchObject({
        id: 'mie',
        cambio: { platilloId: null, fijado: false, puntaje: null, costoIncompleto: false },
      });
      expect(destino).toMatchObject({ id: 'sab', cambio: { platilloId: 'pescado', fijado: true } });
    });

    it('CA-24.3 mover a un tiempo donde no aplica se rechaza y no cambia nada', async () => {
      repo.cargar.mockResolvedValue({
        ...completo(),
        detalles: [
          detalle('caldo-alm', '2026-11-07', ['caldo', 'Caldo de res', 'RES']),
          detalle('sab-des', '2026-11-07', null, { tiempo: 'DESAYUNO' }),
        ],
      });
      repo.tiemposDe.mockResolvedValue(new Map([['caldo', ['ALMUERZO']]]));
      const p = await problema(mover('caldo-alm', 'sab-des'));
      expect([p.getStatus(), p.codigo, p.detalle]).toEqual([
        422,
        'TIEMPO_NO_APLICABLE',
        'Caldo de res no aplica a Desayuno',
      ]);
      expect(repo.aplicarCambios).not.toHaveBeenCalled();
    });

    it('al intercambiar entre tiempos el platillo del destino también debe aplicar al origen', async () => {
      repo.tiemposDe.mockResolvedValue(
        new Map([
          ['carne', ['ALMUERZO', 'CENA']],
          ['caldo', ['CENA']],
        ]),
      );
      const p = await problema(mover('lun', 'dom-cena'));
      expect(p.detalle).toBe('Caldo de res no aplica a Almuerzo');
    });

    it('un movimiento a sí mismo, desde un espacio vacío o con ids ajenos se rechaza', async () => {
      expect((await problema(mover('lun', 'lun'))).codigo).toBe('MOVIMIENTO_INVALIDO');
      expect((await problema(mover('sab', 'lun'))).codigo).toBe('SIN_PLATILLO');
      expect((await problema(mover('lun', 'nada'))).getStatus()).toBe(404);
      repo.cargar.mockResolvedValue(completo('APROBADO'));
      expect((await problema(mover('lun', 'jue'))).codigo).toBe('MENU_APROBADO');
    });
  });

  describe('fijar', () => {
    it('fija y desfija un espacio con platillo', async () => {
      await servicio.fijar('h1', 'u1', 'm1', 'lun', { fijado: true });
      expect(cambios()).toEqual([
        { id: 'lun', cambio: { fijado: true, modificadoPorId: 'u1', modificadoEn: AHORA } },
      ]);
      repo.aplicarCambios.mockClear();
      await servicio.fijar('h1', 'u1', 'm1', 'lun', { fijado: false });
      expect(cambios()[0]!.cambio.fijado).toBe(false);
    });

    it('un espacio sin platillo no se puede fijar y un menú aprobado tampoco', async () => {
      expect(
        (await problema(servicio.fijar('h1', 'u1', 'm1', 'sab', { fijado: true }))).codigo,
      ).toBe('SIN_PLATILLO');
      repo.cargar.mockResolvedValue(completo('APROBADO'));
      expect(
        (await problema(servicio.fijar('h1', 'u1', 'm1', 'lun', { fijado: true }))).codigo,
      ).toBe('MENU_APROBADO');
    });
  });

  describe('motivo (CU-05.4, HU-22)', () => {
    const PESOS = {
      pesoPreferencia: '0.40',
      pesoNovedad: '0.25',
      pesoAhorro: '0.20',
      pesoAfinidad: '0.15',
    };
    const FACTORES = {
      factorPreferencia: '0.9000',
      factorNovedad: '0.5000',
      factorAhorro: '0.2000',
      factorAfinidad: '0.7500',
    };
    const conMotivo = (extra: Partial<DetalleConPlatillo> = {}, menu = PESOS): MenuCompleto => ({
      menu: { id: 'm1', estado: 'BORRADOR', ...menu } as MenuSemanal,
      tiempos: [],
      detalles: [
        detalle('dom', '2026-11-01', ['pollo', 'Pollo en crema', 'POLLO'], {
          puntaje: '0.6375',
          costoEstimado: '28.00',
          costoIncompleto: false,
          ...FACTORES,
          ...extra,
        }),
        detalle('sab', '2026-11-07', null),
      ],
    });

    it('CA-22.1 devuelve factores, pesos usados, puntaje, costo y la razón principal', async () => {
      repo.cargar.mockResolvedValue(conMotivo());
      await expect(servicio.motivo('h1', 'm1', 'dom')).resolves.toEqual({
        detalleId: 'dom',
        fecha: '2026-11-01',
        tiempo: 'ALMUERZO',
        platillo: { id: 'pollo', nombre: 'Pollo en crema' },
        origen: 'MOTOR',
        puntaje: '0.6375',
        factores: {
          preferencia: '0.9000',
          novedad: '0.5000',
          ahorro: '0.2000',
          afinidad: '0.7500',
        },
        pesos: { preferencia: '0.40', novedad: '0.25', ahorro: '0.20', afinidad: '0.15' },
        costo: { estimado: '28.00', incompleto: false },
        reglasAplicadas: [],
        resumen: 'Sugerido sobre todo porque es de sus favoritos o está muy bien calificado',
      });
    });

    it('con costo incompleto el Ahorro neutro no se presenta como la razón', async () => {
      repo.cargar.mockResolvedValue(
        conMotivo({
          factorPreferencia: '0.1000',
          factorNovedad: '0.1000',
          factorAfinidad: '0.1000',
          factorAhorro: '0.5000',
          costoEstimado: null,
          costoIncompleto: true,
        }),
      );
      const m = await servicio.motivo('h1', 'm1', 'dom');
      expect(m.costo).toEqual({ estimado: null, incompleto: true });
      expect(m.resumen).not.toContain('cuesta menos');
    });

    it('CA-22.2 un platillo elegido por el usuario no trae factores ni pesos', async () => {
      repo.cargar.mockResolvedValue(
        conMotivo({
          origen: 'USUARIO',
          puntaje: null,
          factorPreferencia: null,
          factorNovedad: null,
          factorAhorro: null,
          factorAfinidad: null,
          costoEstimado: null,
          costoIncompleto: true,
        }),
      );
      await expect(servicio.motivo('h1', 'm1', 'dom')).resolves.toMatchObject({
        origen: 'USUARIO',
        puntaje: null,
        factores: null,
        pesos: null,
        resumen: 'Elegido por el usuario',
      });
    });

    it('CA-22.4 un reemplazo por presupuesto muestra su nota y las reglas aplicadas', async () => {
      repo.cargar.mockResolvedValue(
        conMotivo({
          origen: 'REEMPLAZO_PRESUPUESTO',
          notas: 'Q22.00 más barato',
          reglasAplicadas: ['REEMPLAZO_PRESUPUESTO'],
        }),
      );
      await expect(servicio.motivo('h1', 'm1', 'dom')).resolves.toMatchObject({
        reglasAplicadas: ['REEMPLAZO_PRESUPUESTO'],
        resumen: 'Reemplazo por presupuesto: Q22.00 más barato',
      });
    });

    it('un menú sin copia de pesos no los inventa', async () => {
      repo.cargar.mockResolvedValue(
        conMotivo({}, { pesoPreferencia: null } as unknown as typeof PESOS),
      );
      const m = await servicio.motivo('h1', 'm1', 'dom');
      expect(m.pesos).toBeNull();
      expect(m.resumen).toBe('Sugerido por el motor');
    });

    it('un menú ajeno, un espacio ajeno o un espacio vacío no tienen motivo', async () => {
      repo.cargar.mockResolvedValue(undefined);
      expect((await problema(servicio.motivo('h1', 'mx', 'dom'))).getStatus()).toBe(404);
      repo.cargar.mockResolvedValue(conMotivo());
      expect((await problema(servicio.motivo('h1', 'm1', 'otro'))).getStatus()).toBe(404);
      const vacio = await problema(servicio.motivo('h1', 'm1', 'sab'));
      expect(vacio.getStatus()).toBe(422);
      expect(vacio).toMatchObject({ codigo: 'SIN_PLATILLO' });
    });
  });

  describe('costos al cambiar (CU-06.1 paso 4, HU-21)', () => {
    const conSuma = (): MenuCompleto => ({
      ...completo(),
      menu: { id: 'm1', estado: 'BORRADOR', sumaFactoresPorcion: '4.00' } as MenuSemanal,
    });

    it('editar calcula el costo del platillo elegido con la Σ de factores del menú', async () => {
      repo.cargar.mockResolvedValue(conSuma());
      repo.ingredientesParaCosto.mockResolvedValue(new Map([['chile', conPrecio(26)]]));
      await servicio.editar('h1', 'u1', 'm1', 'vie', { platilloId: 'chile' });
      expect(repo.ingredientesParaCosto).toHaveBeenCalledWith('h1', ['chile']);
      expect(cambios()[0]!.cambio).toMatchObject({
        costoEstimado: '26.00',
        costoIncompleto: false,
        notas: null,
      });
    });

    it('un platillo sin precio o un menú sin Σ de factores queda con costo incompleto', async () => {
      repo.cargar.mockResolvedValue(conSuma());
      await servicio.editar('h1', 'u1', 'm1', 'vie', { platilloId: 'chile' });
      expect(cambios()[0]!.cambio).toMatchObject({ costoEstimado: null, costoIncompleto: true });

      repo.aplicarCambios.mockClear();
      repo.cargar.mockResolvedValue(completo());
      await servicio.editar('h1', 'u1', 'm1', 'vie', { platilloId: 'chile' });
      expect(cambios()[0]!.cambio).toMatchObject({ costoEstimado: null, costoIncompleto: true });
      expect(repo.ingredientesParaCosto).toHaveBeenCalledTimes(1);
    });

    it('mover lleva el costo del platillo al destino y deja vacío el origen sin costo', async () => {
      repo.cargar.mockResolvedValue(conSuma());
      repo.tiemposDe.mockResolvedValue(new Map([['carne', ['ALMUERZO']]]));
      repo.ingredientesParaCosto.mockResolvedValue(new Map([['carne', conPrecio(32)]]));
      await servicio.mover('h1', 'u1', 'm1', {
        origenDetalleId: 'lun',
        destinoDetalleId: 'sab',
        confirmar: true,
      });
      const porId = Object.fromEntries(cambios().map((c) => [c.id, c.cambio]));
      expect(porId.sab).toMatchObject({ platilloId: 'carne', costoEstimado: '32.00' });
      expect(porId.lun).toMatchObject({
        platilloId: null,
        costoEstimado: null,
        costoIncompleto: false,
      });
    });
  });
});
