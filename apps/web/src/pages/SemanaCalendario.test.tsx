import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiConfiguracion } from '../api/configuracion';
import { ContextoApiConfiguracion } from '../api/contexto-configuracion';
import { ContextoApiMenus } from '../api/contexto-menus';
import type { ApiMenus, DetalleMenu, MenuGenerado, TiempoMenu } from '../api/menus';
import Semana from './Semana';

/** Almacenamiento en memoria: el de Node/jsdom no es fiable entre versiones. */
const almacen = new Map<string, string>();
const falso = {
  getItem: (k: string) => almacen.get(k) ?? null,
  setItem: (k: string, v: string) => void almacen.set(k, v),
  clear: () => almacen.clear(),
};
beforeEach(() => {
  almacen.clear();
  vi.stubGlobal('localStorage', falso);
});
afterEach(() => vi.unstubAllGlobals());

const DIAS = [
  '2026-11-01',
  '2026-11-02',
  '2026-11-03',
  '2026-11-04',
  '2026-11-05',
  '2026-11-06',
  '2026-11-07',
];

const espacio = (
  fecha: string,
  nombre: string | null,
  extra: Partial<DetalleMenu> = {},
): DetalleMenu => ({
  id: `${fecha}-${extra.tiempo ?? 'ALMUERZO'}`,
  fecha,
  tiempo: 'ALMUERZO',
  platillo: nombre ? { id: `p-${nombre}`, nombre, proteinaPrincipal: 'RES' } : null,
  fijado: false,
  origen: 'MOTOR',
  puntaje: null,
  costoEstimado: nombre ? '30.00' : null,
  costoIncompleto: false,
  reglasAplicadas: [],
  ...extra,
});

const tiempoDe = (
  tiempo: TiempoMenu['tiempo'],
  estado: TiempoMenu['estado'] = 'DENTRO_DEL_PRESUPUESTO',
): TiempoMenu => ({
  tiempo,
  porcentaje: '50.00',
  presupuesto: '250.00',
  costoEstimado: '210.00',
  exceso: estado === 'EXCEDE' ? '10.00' : '0.00',
  estado,
});

const menu = (extra: Partial<MenuGenerado> = {}): MenuGenerado => ({
  id: 'm1',
  fechaInicio: '2026-11-01',
  fechaFin: '2026-11-07',
  estado: 'BORRADOR',
  version: 1,
  presupuestoSemanal: '500.00',
  costoEstimado: '210.00',
  costoIncompleto: false,
  excede: null,
  aprobadoPor: null,
  aprobadoEn: null,
  listaId: null,
  tiempos: [tiempoDe('ALMUERZO')],
  detalles: DIAS.map((f, i) => espacio(f, `Platillo ${i + 1}`)),
  avisos: [],
  ...extra,
});

async function abrir(inicial: MenuGenerado) {
  const menus = {
    generar: vi.fn(),
    obtenerPorSemana: vi.fn().mockResolvedValue(inicial),
    editar: vi.fn(),
    mover: vi.fn().mockResolvedValue(inicial),
    fijar: vi.fn().mockResolvedValue(inicial),
    aprobar: vi.fn(),
    motivo: vi.fn().mockReturnValue(new Promise(() => {})),
    alternativa: vi.fn().mockResolvedValue(inicial),
  };
  const configuracion = {
    obtenerSemana: vi
      .fn()
      .mockResolvedValue({ proximaSemana: { desde: '2026-11-01', hasta: '2026-11-07' } }),
  };
  render(
    <MemoryRouter>
      <ContextoApiConfiguracion.Provider value={configuracion as unknown as ApiConfiguracion}>
        <ContextoApiMenus.Provider value={menus as unknown as ApiMenus}>
          <Semana />
        </ContextoApiMenus.Provider>
      </ContextoApiConfiguracion.Provider>
    </MemoryRouter>,
  );
  await screen.findByRole('group', { name: 'Vista del menú' });
  return { menus, user: userEvent.setup() };
}

const calendario = () => screen.getByRole('list', { name: 'Calendario de la semana' });
const boton = (nombre: string) =>
  within(screen.getByRole('group', { name: 'Vista del menú' })).getByRole('button', {
    name: nombre,
  });

describe('Selector de vista Tabla / Calendario', () => {
  it('abre en tabla y el selector marca la vista activa', async () => {
    await abrir(menu());
    expect(boton('Tabla')).toHaveAttribute('aria-pressed', 'true');
    expect(boton('Calendario')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('list', { name: 'Calendario de la semana' })).not.toBeInTheDocument();
  });

  it('el calendario muestra una tarjeta por día con su platillo y costo', async () => {
    const { user } = await abrir(menu());
    await user.click(boton('Calendario'));

    expect(screen.queryByRole('table', { name: 'Menú de la semana' })).not.toBeInTheDocument();
    const dias = within(calendario()).getAllByRole('listitem');
    expect(dias).toHaveLength(7);
    expect(within(dias[0]!).getByRole('heading', { name: 'Domingo 01/11' })).toBeInTheDocument();
    expect(dias[0]).toHaveTextContent('Platillo 1');
    expect(dias[0]).toHaveTextContent('Q30.00');
    expect(within(dias[6]!).getByRole('heading', { name: 'Sábado 07/11' })).toBeInTheDocument();
    expect(boton('Calendario')).toHaveAttribute('aria-pressed', 'true');
  });

  it('recuerda la vista elegida y se puede volver a la tabla', async () => {
    const primera = await abrir(menu());
    await primera.user.click(boton('Calendario'));
    expect(almacen.get('mf.vistaSemana')).toBe('CALENDARIO');
    await primera.user.click(boton('Tabla'));
    expect(screen.getByRole('table', { name: 'Menú de la semana' })).toBeInTheDocument();
    expect(almacen.get('mf.vistaSemana')).toBe('TABLA');
  });

  it('con una vista guardada abre directo en calendario', async () => {
    almacen.set('mf.vistaSemana', 'CALENDARIO');
    const menus = {
      obtenerPorSemana: vi.fn().mockResolvedValue(menu()),
    };
    const configuracion = {
      obtenerSemana: vi
        .fn()
        .mockResolvedValue({ proximaSemana: { desde: '2026-11-01', hasta: '2026-11-07' } }),
    };
    render(
      <MemoryRouter>
        <ContextoApiConfiguracion.Provider value={configuracion as unknown as ApiConfiguracion}>
          <ContextoApiMenus.Provider value={menus as unknown as ApiMenus}>
            <Semana />
          </ContextoApiMenus.Provider>
        </ContextoApiConfiguracion.Provider>
      </MemoryRouter>,
    );
    expect(
      await screen.findByRole('list', { name: 'Calendario de la semana' }),
    ).toBeInTheDocument();
  });

  it('si el almacenamiento falla usa la tabla y no se rompe al elegir', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('bloqueado');
      },
    });
    const { user } = await abrir(menu());
    await user.click(boton('Calendario'));
    expect(calendario()).toBeInTheDocument();
  });
});

describe('Calendario del menú', () => {
  beforeEach(() => almacen.set('mf.vistaSemana', 'CALENDARIO'));

  it('marca fijados, ajustes por presupuesto, costo incompleto y espacios sin sugerencia', async () => {
    const detalles = [
      espacio(DIAS[0]!, 'Pollo en crema', { fijado: true }),
      espacio(DIAS[1]!, 'Carne guisada', { origen: 'REEMPLAZO_PRESUPUESTO' }),
      espacio(DIAS[2]!, 'Chile relleno', { costoIncompleto: true }),
      espacio(DIAS[3]!, null),
    ];
    await abrir(menu({ detalles }));
    const dias = within(calendario()).getAllByRole('listitem');
    expect(dias[0]).toHaveTextContent('Fijado');
    expect(dias[1]).toHaveTextContent('Ajustado al presupuesto');
    expect(dias[2]).toHaveTextContent('Q30.00*');
    expect(dias[3]).toHaveTextContent('Sin sugerencia');
  });

  it('con dos tiempos muestra cada tiempo, el costo del día y marca el que excede', async () => {
    const detalles = [
      espacio(DIAS[0]!, 'Pollo en crema'),
      espacio(DIAS[0]!, 'Caldo de frijol', { tiempo: 'CENA', costoEstimado: '12.50' }),
    ];
    await abrir(menu({ detalles, tiempos: [tiempoDe('ALMUERZO', 'EXCEDE'), tiempoDe('CENA')] }));
    const dia = within(calendario()).getByRole('listitem');
    expect(dia).toHaveTextContent('Día: Q42.50');
    expect(dia).toHaveTextContent('Almuerzo');
    expect(dia).toHaveTextContent('Cena');
    const [almuerzo, cena] = dia.querySelectorAll('.mf-dia-espacio');
    expect(almuerzo).toHaveClass('mf-dia-espacio--excede');
    expect(cena).not.toHaveClass('mf-dia-espacio--excede');
  });

  it('ofrece las mismas acciones: ¿Por qué?, fijar, otra opción, mover y arrastrar', async () => {
    const { menus, user } = await abrir(menu());

    await user.click(screen.getByRole('button', { name: '¿Por qué Domingo 01/11 almuerzo?' }));
    expect(menus.motivo).toHaveBeenCalledWith('m1', '2026-11-01-ALMUERZO');

    await user.click(screen.getByRole('button', { name: 'Fijar Domingo 01/11 almuerzo' }));
    expect(menus.fijar).toHaveBeenCalledWith('m1', '2026-11-01-ALMUERZO', true);

    await user.click(screen.getByRole('button', { name: 'Otra opción para Lunes 02/11 almuerzo' }));
    expect(menus.alternativa).toHaveBeenCalledWith('m1', '2026-11-02-ALMUERZO');

    await user.click(screen.getByRole('button', { name: 'Mover Domingo 01/11 almuerzo' }));
    expect(screen.getByRole('status')).toHaveTextContent('Elige el espacio de destino');
    await user.click(screen.getByRole('button', { name: 'Mover aquí a Martes 03/11 almuerzo' }));
    expect(menus.mover).toHaveBeenCalledWith('m1', {
      origenDetalleId: '2026-11-01-ALMUERZO',
      destinoDetalleId: '2026-11-03-ALMUERZO',
    });
  });

  it('en un menú aprobado se puede cambiar: hay botones de cambio', async () => {
    await abrir(menu({ estado: 'APROBADO' }));
    expect(screen.getAllByRole('button', { name: /^Cambiar/ }).length).toBeGreaterThan(0);
  });

  it('en un menú histórico es de solo lectura: sin botones de cambio y sin arrastre', async () => {
    await abrir(menu({ estado: 'HISTORICO' }));
    expect(screen.queryByRole('button', { name: /^Cambiar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Fijar/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^¿Por qué/ })).toHaveLength(7);
    for (const e of calendario().querySelectorAll('.mf-dia-espacio')) {
      expect(e).toHaveAttribute('draggable', 'false');
    }
  });
});
