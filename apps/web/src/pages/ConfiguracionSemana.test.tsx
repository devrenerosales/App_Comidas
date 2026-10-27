import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ContextoAuth, type ValorAuth } from '../auth/contexto';
import { ContextoApiConfiguracion } from '../api/contexto-configuracion';
import type { ApiConfiguracion, ConfiguracionSemana as Configuracion } from '../api/configuracion';
import { ProblemaApi } from '../api/problema';
import ConfiguracionSemana from './ConfiguracionSemana';

const CONFIG: Configuracion = {
  version: 1,
  presupuestoSemanal: '250.00',
  tiempos: [],
  diaInicioSemana: 'DOMINGO',
  diaPlanificacion: 'DOMINGO',
  horaPlanificacion: 8,
  pesos: { preferencia: '0.40', novedad: '0.25', ahorro: '0.20', afinidad: '0.15' },
  actualizadoEn: '2026-10-22T15:00:00Z',
  proximaSemana: { desde: '2026-10-25', hasta: '2026-10-31' },
  semanaTransicion: null,
  proximaPlanificacion: '2026-10-25',
};
const PREVIA = {
  version: 1,
  proximaSemana: { desde: '2026-10-26', hasta: '2026-11-01' },
  semanaTransicion: { desde: '2026-10-25', hasta: '2026-10-25' },
  proximaPlanificacion: '2026-10-24',
};

function abrir(extra = {}, rol = 'ADMIN') {
  const api = {
    obtenerSemana: vi.fn().mockResolvedValue(CONFIG),
    vistaPreviaSemana: vi.fn().mockResolvedValue(PREVIA),
    guardarSemana: vi
      .fn()
      .mockResolvedValue({
        ...CONFIG,
        ...PREVIA,
        version: 2,
        diaInicioSemana: 'LUNES',
        diaPlanificacion: 'SABADO',
      }),
    ...extra,
  };
  render(
    <MemoryRouter>
      <ContextoAuth.Provider value={{ hogar: { id: 'h1', rol } } as ValorAuth}>
        <ContextoApiConfiguracion.Provider value={api as unknown as ApiConfiguracion}>
          <ConfiguracionSemana />
        </ContextoApiConfiguracion.Provider>
      </ContextoAuth.Provider>
    </MemoryRouter>,
  );
  return { api, user: userEvent.setup() };
}

describe('HU-08 Configurar la semana', () => {
  it('CA-08.1 muestra domingo por defecto y las fechas de la próxima semana', async () => {
    abrir();
    expect(await screen.findByLabelText('Día de inicio de semana')).toHaveValue('DOMINGO');
    expect(screen.getByLabelText('Día de planificación')).toHaveValue('DOMINGO');
    expect(screen.getAllByText('25 de octubre de 2026')).toHaveLength(2);
    expect(screen.getByText('31 de octubre de 2026')).toBeInTheDocument();
  });

  it('CA-08.2 y CA-08.3 muestra la transición y guarda después de la vista previa', async () => {
    const { api, user } = abrir();
    await user.selectOptions(await screen.findByLabelText('Día de inicio de semana'), 'LUNES');
    await user.selectOptions(screen.getByLabelText('Día de planificación'), 'SABADO');
    expect(screen.queryByRole('button', { name: 'Guardar semana' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ver fechas' }));
    expect(await screen.findByText('Semana de transición:')).toBeInTheDocument();
    expect(screen.getByText('24 de octubre de 2026')).toBeInTheDocument();
    expect(api.guardarSemana).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Guardar semana' }));
    expect(api.guardarSemana).toHaveBeenCalledWith({
      version: 1,
      diaInicioSemana: 'LUNES',
      diaPlanificacion: 'SABADO',
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Configuración de semana guardada');
  });

  it('CA-08.4 un miembro solo puede consultar', async () => {
    const { api } = abrir({}, 'MIEMBRO');
    expect(await screen.findByLabelText('Día de inicio de semana')).toBeDisabled();
    expect(screen.getByLabelText('Día de planificación')).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Solo el administrador');
    expect(screen.queryByRole('button', { name: 'Ver fechas' })).not.toBeInTheDocument();
    expect(api.guardarSemana).not.toHaveBeenCalled();
  });

  it('un cambio en los selectores invalida la vista previa anterior', async () => {
    const { user } = abrir();
    await user.click(await screen.findByRole('button', { name: 'Ver fechas' }));
    await screen.findByRole('button', { name: 'Guardar semana' });
    await user.selectOptions(screen.getByLabelText('Día de inicio de semana'), 'MARTES');
    expect(screen.queryByRole('button', { name: 'Guardar semana' })).not.toBeInTheDocument();
  });

  it('recarga la configuración si otro administrador guardó primero', async () => {
    const obtenerSemana = vi
      .fn()
      .mockResolvedValueOnce(CONFIG)
      .mockResolvedValue({ ...CONFIG, version: 2, diaInicioSemana: 'MARTES' });
    const { api, user } = abrir({
      obtenerSemana,
      guardarSemana: vi
        .fn()
        .mockRejectedValue(
          new ProblemaApi({
            status: 409,
            codigo: 'VERSION_DESACTUALIZADA',
            detail: 'La configuración cambió. Revisa los valores actuales.',
          }),
        ),
    });
    await user.click(await screen.findByRole('button', { name: 'Ver fechas' }));
    await user.click(await screen.findByRole('button', { name: 'Guardar semana' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('La configuración cambió');
    await waitFor(() =>
      expect(screen.getByLabelText('Día de inicio de semana')).toHaveValue('MARTES'),
    );
    expect(api.obtenerSemana).toHaveBeenCalledTimes(2);
  });

  it('permite reintentar una carga fallida', async () => {
    const { user } = abrir({
      obtenerSemana: vi
        .fn()
        .mockRejectedValueOnce(ProblemaApi.sinConexion())
        .mockResolvedValue(CONFIG),
    });
    await user.click(await screen.findByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByLabelText('Día de inicio de semana')).toHaveValue('DOMINGO');
  });

  it('muestra un conflicto con un menú sin perder los días elegidos', async () => {
    const { user } = abrir({
      guardarSemana: vi
        .fn()
        .mockRejectedValue(
          new ProblemaApi({
            status: 409,
            codigo: 'SEMANA_EN_CONFLICTO',
            detail: 'Hay un menú en las fechas de transición.',
          }),
        ),
    });
    await user.selectOptions(await screen.findByLabelText('Día de inicio de semana'), 'LUNES');
    await user.click(screen.getByRole('button', { name: 'Ver fechas' }));
    await user.click(await screen.findByRole('button', { name: 'Guardar semana' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Hay un menú');
    expect(screen.getByLabelText('Día de inicio de semana')).toHaveValue('LUNES');
  });
});
