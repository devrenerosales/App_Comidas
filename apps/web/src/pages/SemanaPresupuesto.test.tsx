import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { ApiConfiguracion } from '../api/configuracion';
import { ContextoApiConfiguracion } from '../api/contexto-configuracion';
import { ContextoApiMenus } from '../api/contexto-menus';
import type { ApiMenus, DetalleMenu, MenuGenerado, TiempoMenu } from '../api/menus';
import { ProblemaApi } from '../api/problema';
import Semana from './Semana';

const espacio = (id: string, fecha: string, nombre: string): DetalleMenu => ({
  id,
  fecha,
  tiempo: 'ALMUERZO',
  platillo: { id: `p-${id}`, nombre, proteinaPrincipal: 'RES' },
  fijado: false,
  origen: 'MOTOR',
  puntaje: null,
  costoEstimado: null,
  costoIncompleto: false,
  reglasAplicadas: [],
});

const tiempo = (extra: Partial<TiempoMenu>): TiempoMenu => ({
  tiempo: 'ALMUERZO',
  porcentaje: '100.00',
  presupuesto: '245.00',
  costoEstimado: null,
  exceso: '0.00',
  estado: 'COSTO_INCOMPLETO',
  ...extra,
});

const menu = (t: TiempoMenu, extra: Partial<MenuGenerado> = {}): MenuGenerado => ({
  id: 'm1',
  fechaInicio: '2026-11-01',
  fechaFin: '2026-11-07',
  estado: 'BORRADOR',
  version: 1,
  presupuestoSemanal: '245.00',
  costoEstimado: t.costoEstimado,
  costoIncompleto: t.estado === 'COSTO_INCOMPLETO',
  excede: null,
  aprobadoPor: null,
  aprobadoEn: null,
  listaId: null,
  tiempos: [t],
  detalles: [
    espacio('lun', '2026-11-02', 'Pepián de pollo'),
    espacio('mar', '2026-11-03', 'Caldo de res'),
  ],
  avisos: [],
  ...extra,
});

/** Abre una semana con menú ya guardado. */
async function abrir(inicial: MenuGenerado, editar = vi.fn()) {
  const menus = {
    generar: vi.fn(),
    obtenerPorSemana: vi.fn().mockResolvedValue(inicial),
    editar,
    mover: vi.fn(),
    fijar: vi.fn(),
    aprobar: vi.fn(),
    motivo: vi.fn(),
    alternativa: vi.fn(),
  };
  return montar(menus);
}

/** Abre una semana sin menú: hay que tocar "Sugerir menú". */
async function abrirSinMenu(generado: MenuGenerado, editar = vi.fn()) {
  const menus = {
    generar: vi.fn().mockResolvedValue(generado),
    obtenerPorSemana: vi
      .fn()
      .mockRejectedValue(new ProblemaApi({ status: 404, codigo: 'SIN_MENU', detail: 'Sin menú' })),
    editar,
    mover: vi.fn(),
    fijar: vi.fn(),
    aprobar: vi.fn(),
    motivo: vi.fn(),
    alternativa: vi.fn(),
  };
  const r = await montar(menus, false);
  await r.user.click(await screen.findByRole('button', { name: 'Sugerir menú' }));
  await screen.findByRole('table', { name: 'Menú de la semana' });
  return r;
}

async function montar(menus: Record<string, unknown>, esperarTabla = true) {
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
  if (esperarTabla) await screen.findByRole('table', { name: 'Menú de la semana' });
  return { menus: menus as Record<string, ReturnType<typeof vi.fn>>, user: userEvent.setup() };
}

const lista = () => screen.getByRole('list', { name: 'Presupuesto por tiempo' });

describe('HU-21 Estado del presupuesto por tiempo', () => {
  it('CA-21.1 dentro del presupuesto muestra el costo y lo que queda disponible', async () => {
    await abrir(menu(tiempo({ costoEstimado: '229.50', estado: 'DENTRO_DEL_PRESUPUESTO' })));
    expect(lista()).toHaveTextContent(
      'Almuerzo: presupuesto Q245.00 · costo Q229.50 · Dentro del presupuesto (Q15.50 disponibles)',
    );
    expect(screen.queryByText(/Excede por/)).not.toBeInTheDocument();
  });

  it('CA-21.3 si excede muestra el costo y "Excede por Q" en rojo', async () => {
    await abrir(menu(tiempo({ costoEstimado: '205.00', exceso: '55.00', estado: 'EXCEDE' }), {}));
    expect(lista()).toHaveTextContent('costo Q205.00');
    expect(within(lista()).getByText('Excede por Q55.00')).toHaveClass('mf-exceso');
  });

  it('con costo incompleto no afirma que está dentro del presupuesto', async () => {
    await abrir(menu(tiempo({ costoEstimado: '120.00', estado: 'COSTO_INCOMPLETO' })));
    expect(lista()).toHaveTextContent('costo conocido Q120.00 (incompleto)');
    expect(lista()).not.toHaveTextContent('Dentro del presupuesto');
  });

  it('sin ningún costo conocido solo muestra el presupuesto', async () => {
    await abrir(menu(tiempo({})));
    expect(lista()).toHaveTextContent(/^Almuerzo: presupuesto Q245\.00$/);
  });
});

describe('HU-21 Alternativas más baratas (CU-05.3 E1)', () => {
  const excedido = (): MenuGenerado =>
    menu(
      tiempo({
        costoEstimado: '205.00',
        exceso: '55.00',
        estado: 'EXCEDE',
        alternativas: [
          {
            fecha: '2026-11-03',
            platillos: [
              { id: 'tortitas', nombre: 'Tortitas de carne', costo: '26.00' },
              { id: 'spaghetti', nombre: 'Spaghetti con carne', costo: '30.00' },
            ],
          },
        ],
      }),
    );

  it('tras sugerir un menú excedido ofrece hasta 3 alternativas más baratas por día', async () => {
    await abrirSinMenu(excedido());
    const panel = screen.getByRole('region', { name: 'Alternativas más baratas' });
    expect(within(panel).getByText(/Martes 03\/11 almuerzo/)).toBeVisible();
    expect(
      within(panel).getByRole('button', { name: 'Usar Tortitas de carne (Q26.00)' }),
    ).toBeVisible();
    expect(
      within(panel).getByRole('button', { name: 'Usar Spaghetti con carne (Q30.00)' }),
    ).toBeVisible();
  });

  it('usar una alternativa cambia ese día y cierra la lista', async () => {
    const editar = vi
      .fn()
      .mockResolvedValue(
        menu(tiempo({ costoEstimado: '181.00', estado: 'DENTRO_DEL_PRESUPUESTO' })),
      );
    const { user } = await abrirSinMenu(excedido(), editar);

    await user.click(screen.getByRole('button', { name: 'Usar Tortitas de carne (Q26.00)' }));

    expect(editar).toHaveBeenCalledWith('m1', 'mar', { platilloId: 'tortitas' });
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Alternativas más baratas' })).toBeNull(),
    );
    expect(lista()).toHaveTextContent('Dentro del presupuesto (Q64.00 disponibles)');
  });

  it('un menú que cumple no ofrece alternativas más baratas', async () => {
    await abrirSinMenu(menu(tiempo({ costoEstimado: '229.50', estado: 'DENTRO_DEL_PRESUPUESTO' })));
    expect(screen.queryByRole('region', { name: 'Alternativas más baratas' })).toBeNull();
  });

  it('al reabrir la semana ya no se ofrecen (solo vienen al generar)', async () => {
    const reabierto = excedido();
    reabierto.tiempos = reabierto.tiempos.map((t) => ({ ...t, alternativas: undefined }));
    await abrir(reabierto);
    expect(screen.queryByRole('region', { name: 'Alternativas más baratas' })).toBeNull();
  });
});
