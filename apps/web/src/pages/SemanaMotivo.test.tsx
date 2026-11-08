import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { ApiConfiguracion } from '../api/configuracion';
import { ContextoApiConfiguracion } from '../api/contexto-configuracion';
import { ContextoApiMenus } from '../api/contexto-menus';
import type { ApiMenus, DetalleMenu, MenuGenerado, MotivoSugerencia } from '../api/menus';
import { ProblemaApi } from '../api/problema';
import Semana from './Semana';

const espacio = (id: string, fecha: string, nombre: string | null): DetalleMenu => ({
  id,
  fecha,
  tiempo: 'ALMUERZO',
  platillo: nombre ? { id: `p-${id}`, nombre, proteinaPrincipal: 'POLLO' } : null,
  fijado: false,
  origen: 'MOTOR',
  puntaje: null,
  costoEstimado: null,
  costoIncompleto: true,
  reglasAplicadas: [],
});

const menu = (estado: MenuGenerado['estado'] = 'BORRADOR'): MenuGenerado => ({
  id: 'm1',
  fechaInicio: '2026-11-01',
  fechaFin: '2026-11-07',
  estado,
  version: 1,
  presupuestoSemanal: '245.00',
  costoEstimado: null,
  costoIncompleto: true,
  excede: null,
  aprobadoPor: null,
  aprobadoEn: null,
  listaId: null,
  tiempos: [
    {
      tiempo: 'ALMUERZO',
      porcentaje: '100.00',
      presupuesto: '245.00',
      costoEstimado: null,
      exceso: '0.00',
      estado: 'COSTO_INCOMPLETO',
    },
  ],
  detalles: [
    espacio('dom', '2026-11-01', 'Pollo en crema'),
    espacio('mar', '2026-11-03', 'Chile relleno'),
    espacio('mie', '2026-11-04', null),
  ],
  avisos: [],
});

/** CA-22.1: Pollo en crema, 0.90 / 0.50 / 0.20 / 0.75 con pesos 0.40 / 0.25 / 0.20 / 0.15. */
const motivoDelMotor: MotivoSugerencia = {
  detalleId: 'dom',
  platillo: { id: 'p-dom', nombre: 'Pollo en crema' },
  origen: 'MOTOR',
  puntaje: '0.6375',
  factores: { preferencia: '0.9000', novedad: '0.5000', ahorro: '0.2000', afinidad: '0.7500' },
  pesos: { preferencia: '0.40', novedad: '0.25', ahorro: '0.20', afinidad: '0.15' },
  costo: { estimado: '28.00', incompleto: false },
  reglasAplicadas: [],
  resumen: 'Sugerido sobre todo porque es de sus favoritos o está muy bien calificado',
};

async function abrir(inicial: MenuGenerado, motivo = vi.fn().mockResolvedValue(motivoDelMotor)) {
  const menus = {
    generar: vi.fn(),
    obtenerPorSemana: vi.fn().mockResolvedValue(inicial),
    editar: vi.fn(),
    mover: vi.fn(),
    fijar: vi.fn(),
    aprobar: vi.fn(),
    motivo,
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
  await screen.findByRole('table', { name: 'Menú de la semana' });
  return { menus, motivo, user: userEvent.setup() };
}

const porQue = () => screen.getAllByRole('button', { name: /¿Por qué .*\?/ });
const panel = () => screen.getByRole('region', { name: /^Por qué / });

describe('HU-22 Ver el motivo de la sugerencia', () => {
  it('CA-22.1 muestra factores, pesos usados, puntaje y costo estimado', async () => {
    const { motivo, user } = await abrir(menu());

    await user.click(porQue()[0]!);

    expect(motivo).toHaveBeenCalledWith('m1', 'dom');
    const p = await screen.findByRole('heading', { name: '¿Por qué este platillo?' });
    expect(p).toBeVisible();
    const lista = within(panel()).getByRole('list', { name: 'Factores del puntaje' });
    expect(lista).toHaveTextContent('Preferencia 0.90 (peso 0.40)');
    expect(lista).toHaveTextContent('Novedad 0.50 (peso 0.25)');
    expect(lista).toHaveTextContent('Ahorro 0.20 (peso 0.20)');
    expect(lista).toHaveTextContent('Afinidad 0.75 (peso 0.15)');
    expect(within(lista).getByRole('meter', { name: 'Preferencia 0.90' })).toHaveValue(0.9);
    expect(within(panel()).getByText('0.6375')).toBeVisible();
    expect(within(panel()).getByText('Costo estimado Q28.00')).toBeVisible();
    expect(within(panel()).getByRole('status')).toHaveTextContent(
      'Sugerido sobre todo porque es de sus favoritos',
    );
  });

  it('CA-22.2 un platillo elegido por el usuario dice "Elegido por el usuario" sin factores', async () => {
    const usuario: MotivoSugerencia = {
      ...motivoDelMotor,
      detalleId: 'mar',
      platillo: { id: 'p-mar', nombre: 'Chile relleno' },
      origen: 'USUARIO',
      puntaje: null,
      factores: null,
      pesos: null,
      costo: { estimado: null, incompleto: true },
      resumen: 'Elegido por el usuario',
    };
    const { user } = await abrir(menu(), vi.fn().mockResolvedValue(usuario));

    await user.click(porQue()[1]!);

    expect(await within(panel()).findByText('Elegido por el usuario')).toBeVisible();
    expect(within(panel()).queryByRole('list', { name: 'Factores del puntaje' })).toBeNull();
    expect(
      within(panel()).getByText('Costo incompleto: todavía no hay precios para los ingredientes.'),
    ).toBeVisible();
  });

  it('CA-22.4 un reemplazo por presupuesto muestra su motivo y las reglas aplicadas', async () => {
    const reemplazo: MotivoSugerencia = {
      ...motivoDelMotor,
      origen: 'REEMPLAZO_PRESUPUESTO',
      reglasAplicadas: ['REEMPLAZO_PRESUPUESTO'],
      resumen: 'Reemplazo por presupuesto: Q22.00 más barato',
    };
    const { user } = await abrir(menu(), vi.fn().mockResolvedValue(reemplazo));

    await user.click(porQue()[0]!);

    expect(
      await within(panel()).findByText('Reemplazo por presupuesto: Q22.00 más barato'),
    ).toBeVisible();
    expect(within(panel()).getByText(/Reglas aplicadas: REEMPLAZO_PRESUPUESTO/)).toBeVisible();
  });

  it('un espacio sin platillo no ofrece "¿Por qué?"', async () => {
    await abrir(menu());
    expect(porQue()).toHaveLength(2);
  });

  it('también está disponible en un menú aprobado', async () => {
    const { user } = await abrir(menu('APROBADO'));
    await user.click(porQue()[0]!);
    expect(await screen.findByText('Costo estimado Q28.00')).toBeVisible();
  });

  it('cambiar de espacio carga su motivo y Cerrar oculta el panel', async () => {
    const { motivo, user } = await abrir(menu());
    await user.click(porQue()[0]!);
    await screen.findByText('Costo estimado Q28.00');

    await user.click(porQue()[1]!);
    await waitFor(() => expect(motivo).toHaveBeenLastCalledWith('m1', 'mar'));

    await user.click(within(panel()).getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('region', { name: /^Por qué / })).toBeNull();
  });

  it('si el servidor falla muestra el error en el panel', async () => {
    const motivo = vi
      .fn()
      .mockRejectedValue(
        new ProblemaApi({ status: 404, codigo: 'NO_ENCONTRADO', detail: 'La comida no existe.' }),
      );
    const { user } = await abrir(menu(), motivo);

    await user.click(porQue()[0]!);

    expect(await within(panel()).findByRole('alert')).toHaveTextContent('La comida no existe.');
  });

  it('muestra "Sin costo estimado" cuando el espacio no trae ni costo ni marca de incompleto', async () => {
    const sinCosto: MotivoSugerencia = {
      ...motivoDelMotor,
      costo: { estimado: null, incompleto: false },
    };
    const { user } = await abrir(menu(), vi.fn().mockResolvedValue(sinCosto));
    await user.click(porQue()[0]!);
    expect(await within(panel()).findByText('Sin costo estimado')).toBeVisible();
  });
});
