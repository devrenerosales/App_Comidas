import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { ApiConfiguracion } from '../api/configuracion';
import { ContextoApiConfiguracion } from '../api/contexto-configuracion';
import { ContextoApiMenus } from '../api/contexto-menus';
import type { ApiMenus, DetalleMenu, MenuGenerado, RespuestaAprobacion } from '../api/menus';
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

/** CA-25.1: menú Borrador de la semana 2026-11-01 con almuerzos asignados. */
const borrador = (extra: Partial<MenuGenerado> = {}): MenuGenerado => ({
  id: 'm1',
  fechaInicio: '2026-11-01',
  fechaFin: '2026-11-07',
  estado: 'BORRADOR',
  version: 4,
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
    espacio('lun', '2026-11-02', 'Carne guisada'),
    espacio('mar', '2026-11-03', 'Pepián de pollo'),
  ],
  avisos: [],
  ...extra,
});

const aprobado = (extra: Partial<MenuGenerado> = {}): MenuGenerado =>
  borrador({
    estado: 'APROBADO',
    version: 5,
    aprobadoPor: { id: 'u1', nombre: 'Ana' },
    aprobadoEn: '2026-11-02T15:10:00.000Z',
    listaId: 'l1',
    ...extra,
  });

const respuesta = (menu: MenuGenerado): RespuestaAprobacion => ({
  menu,
  excede: menu.excede,
  lista: { id: 'l1', version: 1, totalItems: 0, url: '/api/v1/listas/l1' },
});

const problema = (status: number, codigo: string, detail: string, extra = {}) =>
  new ProblemaApi({ status, codigo, detail, ...extra });

async function abrir(inicial: MenuGenerado, aprobar = vi.fn()) {
  const obtenerPorSemana = vi.fn().mockResolvedValue(inicial);
  const menus = {
    generar: vi.fn(),
    obtenerPorSemana,
    editar: vi.fn(),
    mover: vi.fn(),
    fijar: vi.fn(),
    aprobar,
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
  return { menus, user: userEvent.setup() };
}

const botonAprobar = () => screen.queryByRole('button', { name: 'Aprobar menú' });

describe('HU-25 Aprobar el menú de la semana', () => {
  it('CA-25.1 aprobar envía la versión vista y deja la grilla en solo lectura', async () => {
    const aprobar = vi.fn().mockResolvedValue(respuesta(aprobado()));
    const { user } = await abrir(borrador(), aprobar);

    await user.click(screen.getByRole('button', { name: 'Aprobar menú' }));

    expect(aprobar).toHaveBeenCalledWith('m1', 4);
    expect(
      await screen.findByText(/Menú aprobado\. La lista de compras de la semana quedó creada\./),
    ).toBeInTheDocument();
    expect(screen.getByText(/Aprobado por Ana el 02\/11 09:10\./)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Menú aprobado del 01/11 al 07/11' })).toBeVisible();
    expect(botonAprobar()).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Cambiar|Mover|Fijar/ })).not.toBeInTheDocument();
  });

  it('CA-25.2 con exceso muestra "Excede por Q" en rojo y aprueba sin pedir confirmación', async () => {
    const conExceso = borrador({
      excede: null,
      tiempos: [
        {
          tiempo: 'ALMUERZO',
          porcentaje: '100.00',
          presupuesto: '245.00',
          costoEstimado: '262.00',
          exceso: '17.00',
          estado: 'EXCEDE',
        },
      ],
    });
    const aprobar = vi.fn().mockResolvedValue(
      respuesta(
        aprobado({
          tiempos: conExceso.tiempos,
          excede: { monto: '17.00', texto: 'Excede por Q17.00' },
        }),
      ),
    );
    const { user } = await abrir(conExceso, aprobar);
    expect(screen.getByText('Excede por Q17.00')).toHaveClass('mf-exceso');

    await user.click(screen.getByRole('button', { name: 'Aprobar menú' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    await waitFor(() => expect(botonAprobar()).not.toBeInTheDocument());
    expect(aprobar).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText('Excede por Q17.00').length).toBeGreaterThan(0);
    screen.getAllByText('Excede por Q17.00').forEach((e) => expect(e).toHaveClass('mf-exceso'));
  });

  it('CA-25.3 con espacios vacíos muestra cuáles faltan y el menú sigue en Borrador', async () => {
    const aprobar = vi.fn().mockRejectedValue(
      problema(422, 'ESPACIOS_VACIOS', 'Asigna un platillo a: viernes cena', {
        espacios: [{ fecha: '2026-11-06', tiempo: 'CENA' }],
      }),
    );
    const { user } = await abrir(borrador(), aprobar);

    await user.click(screen.getByRole('button', { name: 'Aprobar menú' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Asigna un platillo a: viernes cena',
    );
    expect(screen.getByRole('heading', { name: 'Borrador del 01/11 al 07/11' })).toBeVisible();
    expect(botonAprobar()).toBeEnabled();
  });

  it('si otro miembro ya lo aprobó informa quién y muestra el menú aprobado (E3)', async () => {
    const aprobar = vi
      .fn()
      .mockRejectedValue(
        problema(409, 'MENU_YA_APROBADO', 'Ana aprobó este menú a las 09:10', { menuId: 'm1' }),
      );
    const { menus, user } = await abrir(borrador(), aprobar);
    menus.obtenerPorSemana.mockResolvedValue(aprobado());

    await user.click(screen.getByRole('button', { name: 'Aprobar menú' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Ana aprobó este menú a las 09:10');
    expect(
      await screen.findByRole('heading', { name: 'Menú aprobado del 01/11 al 07/11' }),
    ).toBeVisible();
    expect(botonAprobar()).not.toBeInTheDocument();
  });

  it('si el menú cambió de versión recarga el más reciente', async () => {
    const aprobar = vi
      .fn()
      .mockRejectedValue(problema(409, 'VERSION_DESACTUALIZADA', 'El menú cambió'));
    const { menus, user } = await abrir(borrador(), aprobar);
    menus.obtenerPorSemana.mockResolvedValue(borrador({ version: 5 }));

    await user.click(screen.getByRole('button', { name: 'Aprobar menú' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('El menú cambió');
    await waitFor(() => expect(menus.obtenerPorSemana).toHaveBeenCalledTimes(2));
    await user.click(screen.getByRole('button', { name: 'Aprobar menú' }));
    expect(aprobar).toHaveBeenLastCalledWith('m1', 5);
  });

  it('si no se puede recargar tras el conflicto conserva el menú que había', async () => {
    const aprobar = vi.fn().mockRejectedValue(problema(409, 'MENU_YA_APROBADO', 'Ya aprobado'));
    const { menus, user } = await abrir(borrador(), aprobar);
    menus.obtenerPorSemana.mockRejectedValue(problema(500, 'ERROR', 'Sin conexión'));

    await user.click(screen.getByRole('button', { name: 'Aprobar menú' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Ya aprobado');
    expect(screen.getByRole('heading', { name: 'Borrador del 01/11 al 07/11' })).toBeVisible();
  });

  it('un menú ya aprobado abre en solo lectura con quién y cuándo, sin botón de aprobar', async () => {
    await abrir(aprobado());
    expect(screen.getByText(/Este menú está aprobado: solo se puede consultar\./)).toBeVisible();
    expect(screen.getByText(/Aprobado por Ana el 02\/11 09:10\./)).toBeVisible();
    expect(botonAprobar()).not.toBeInTheDocument();
  });

  it('un menú histórico no se puede aprobar', async () => {
    await abrir(borrador({ estado: 'HISTORICO' }));
    expect(botonAprobar()).not.toBeInTheDocument();
  });
});
