import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { ApiConfiguracion } from '../api/configuracion';
import { ContextoApiConfiguracion } from '../api/contexto-configuracion';
import { ContextoApiMenus } from '../api/contexto-menus';
import type { ApiMenus, DetalleMenu, MenuGenerado, TiempoMenu } from '../api/menus';
import Semana from './Semana';

const DIAS = [
  '2026-11-01',
  '2026-11-02',
  '2026-11-03',
  '2026-11-04',
  '2026-11-05',
  '2026-11-06',
  '2026-11-07',
];
/** Almuerzos de CA-26.1. */
const PLATOS: [string, string | null][] = [
  ['Pollo en crema', '28.00'],
  ['Carne guisada', '31.50'],
  ['Pescado frito', '38.00'],
  ['Tortitas de carne', '26.00'],
  ['Pepián de pollo', '42.00'],
  ['Spaghetti con carne', '30.00'],
  ['Chile relleno', '34.00'],
];

const espacio = (
  fecha: string,
  nombre: string,
  costo: string | null,
  extra: Partial<DetalleMenu> = {},
): DetalleMenu => ({
  id: `${fecha}-${extra.tiempo ?? 'ALMUERZO'}`,
  fecha,
  tiempo: 'ALMUERZO',
  platillo: { id: `p-${nombre}`, nombre, proteinaPrincipal: 'RES' },
  fijado: false,
  origen: 'MOTOR',
  puntaje: null,
  costoEstimado: costo,
  costoIncompleto: false,
  reglasAplicadas: [],
  ...extra,
});

const almuerzos = (platos = PLATOS) => platos.map(([n, c], i) => espacio(DIAS[i]!, n, c));

const tiempoDe = (
  tiempo: TiempoMenu['tiempo'],
  presupuesto: string,
  costo: string | null,
  exceso = '0.00',
): TiempoMenu => ({
  tiempo,
  porcentaje: '100.00',
  presupuesto,
  costoEstimado: costo,
  exceso,
  estado:
    exceso !== '0.00' ? 'EXCEDE' : costo === null ? 'COSTO_INCOMPLETO' : 'DENTRO_DEL_PRESUPUESTO',
});

const menu = (extra: Partial<MenuGenerado> = {}): MenuGenerado => ({
  id: 'm1',
  fechaInicio: '2026-11-01',
  fechaFin: '2026-11-07',
  estado: 'BORRADOR',
  version: 1,
  presupuestoSemanal: '245.00',
  costoEstimado: '229.50',
  costoIncompleto: false,
  excede: null,
  aprobadoPor: null,
  aprobadoEn: null,
  listaId: null,
  tiempos: [tiempoDe('ALMUERZO', '245.00', '229.50')],
  detalles: almuerzos(),
  avisos: [],
  ...extra,
});

async function abrir(inicial: MenuGenerado, fijar = vi.fn()) {
  const menus = {
    generar: vi.fn(),
    obtenerPorSemana: vi.fn().mockResolvedValue(inicial),
    editar: vi.fn(),
    mover: vi.fn(),
    fijar,
    aprobar: vi.fn(),
    motivo: vi.fn(),
    alternativa: vi.fn(),
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
  return userEvent.setup();
}

const resumen = () => screen.getByRole('region', { name: 'Costo del menú' });
const barra = () => within(resumen()).getByRole('progressbar');

describe('HU-26 Costo estimado vs. presupuesto', () => {
  it('CA-26.1 total dentro del presupuesto en verde con lo disponible y el costo de cada día', async () => {
    await abrir(menu());
    expect(resumen()).toHaveTextContent('Total: Q229.50 de Q245.00');
    expect(within(resumen()).getByText('Disponible Q15.50')).toHaveClass('mf-costo-ok');
    expect(barra()).toHaveClass('mf-barra--cumple');
    expect(barra()).toHaveAttribute('max', '245');
    expect(barra()).toHaveAttribute('value', '229.5');
    const tabla = screen.getByRole('table', { name: 'Menú de la semana' });
    const filas = within(tabla).getAllByRole('row');
    expect(filas[1]).toHaveTextContent('Pollo en crema Q28.00');
    expect(filas[7]).toHaveTextContent('Chile relleno Q34.00');
    expect(screen.queryByText(/Excede por/)).not.toBeInTheDocument();
  });

  it('CA-26.2 un tiempo excede en rojo aunque el total esté dentro', async () => {
    const detalles = [
      espacio(DIAS[0]!, 'Pollo en crema', '310.00'),
      espacio(DIAS[0]!, 'Caldo de frijol', '170.00', { tiempo: 'CENA' }),
    ];
    await abrir(
      menu({
        presupuestoSemanal: '500.00',
        costoEstimado: '480.00',
        tiempos: [
          tiempoDe('ALMUERZO', '300.00', '310.00', '10.00'),
          tiempoDe('CENA', '200.00', '170.00'),
        ],
        detalles,
      }),
    );
    const porTiempo = screen.getByRole('list', { name: 'Presupuesto por tiempo' });
    expect(within(porTiempo).getByText('Excede por Q10.00')).toHaveClass('mf-exceso');
    expect(porTiempo).toHaveTextContent('Cena: presupuesto Q200.00 · costo Q170.00');
    expect(within(porTiempo).getByText(/Dentro del presupuesto/)).toHaveClass('mf-costo-ok');
    expect(resumen()).toHaveTextContent('Total: Q480.00 de Q500.00');
    expect(within(resumen()).getByText('Disponible Q20.00')).toBeInTheDocument();
    expect(barra()).toHaveClass('mf-barra--cumple');
    // Con dos tiempos cada día suma lo suyo.
    expect(screen.getByRole('rowheader', { name: /Domingo 01\/11/ })).toHaveTextContent(
      'Día: Q480.00',
    );
  });

  it('CA-26.3 un platillo con ingrediente sin precio marca su costo con * y avisa', async () => {
    const detalles = almuerzos();
    detalles[6] = espacio(DIAS[6]!, 'Chile relleno', '34.00', { costoIncompleto: true });
    await abrir(menu({ detalles, costoIncompleto: true }));
    const tabla = screen.getByRole('table', { name: 'Menú de la semana' });
    expect(within(tabla).getAllByRole('row')[7]).toHaveTextContent('Chile relleno Q34.00*');
    expect(within(tabla).getAllByRole('row')[6]).not.toHaveTextContent('*');
    expect(resumen()).toHaveTextContent('* Costo incompleto: hay ingredientes sin precio');
    expect(resumen()).toHaveTextContent('Total: Q229.50* de Q245.00');
  });

  it('CA-26.4 al cambiar el menú el total se recalcula y pasa a rojo con "Excede por"', async () => {
    const cambiado = menu({
      costoEstimado: '248.50',
      detalles: almuerzos(
        PLATOS.map(([n, c], i) => (i === 3 ? ['Caldo de res', '45.00'] : [n, c])),
      ),
      tiempos: [tiempoDe('ALMUERZO', '245.00', '248.50', '3.50')],
    });
    const fijar = vi.fn().mockResolvedValue(cambiado);
    const user = await abrir(menu(), fijar);
    expect(resumen()).toHaveTextContent('Total: Q229.50 de Q245.00');

    await user.click(screen.getAllByRole('button', { name: /^Fijar / })[0]!);

    expect(await within(resumen()).findByText('Excede por Q3.50')).toHaveClass('mf-exceso');
    expect(resumen()).toHaveTextContent('Total: Q248.50 de Q245.00');
    expect(barra()).toHaveClass('mf-barra--excede');
    expect(within(resumen()).queryByText(/Disponible/)).not.toBeInTheDocument();
  });

  it('E1 sin presupuesto muestra solo el costo y el enlace a Configuración', async () => {
    await abrir(menu({ presupuestoSemanal: null }));
    expect(resumen()).toHaveTextContent('Costo estimado: Q229.50');
    expect(within(resumen()).getByRole('link', { name: 'Ir a Configuración' })).toHaveAttribute(
      'href',
      '/configuracion',
    );
    expect(within(resumen()).queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('sin ningún costo conocido lo dice y no muestra barra', async () => {
    await abrir(
      menu({
        costoEstimado: null,
        costoIncompleto: true,
        tiempos: [tiempoDe('ALMUERZO', '245.00', null)],
        detalles: almuerzos(PLATOS.map(([n]) => [n, null])),
      }),
    );
    expect(resumen()).toHaveTextContent('Todavía no hay costos conocidos para este menú.');
    expect(within(resumen()).queryByRole('progressbar')).not.toBeInTheDocument();
  });
});
