import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ContextoAuth, type ValorAuth } from '../auth/contexto';
import { ContextoApiConfiguracion } from '../api/contexto-configuracion';
import type { ApiConfiguracion, ConfiguracionHogar } from '../api/configuracion';
import { ProblemaApi } from '../api/problema';
import ConfiguracionPesos from './ConfiguracionPesos';

const CONFIG: ConfiguracionHogar = {
  version: 1,
  presupuestoSemanal: '245.00',
  tiempos: [],
  diaInicioSemana: 'DOMINGO',
  diaPlanificacion: 'DOMINGO',
  horaPlanificacion: 8,
  pesos: { preferencia: '0.40', novedad: '0.25', ahorro: '0.20', afinidad: '0.15' },
  actualizadoEn: '2026-10-30T15:00:00Z',
};

function abrir(extra = {}, rol = 'ADMIN') {
  const api = {
    obtener: vi.fn().mockResolvedValue(CONFIG),
    guardarPesosMotor: vi.fn().mockResolvedValue({
      ...CONFIG,
      version: 2,
      pesos: { preferencia: '0.30', novedad: '0.30', ahorro: '0.25', afinidad: '0.15' },
    }),
    ...extra,
  };
  render(
    <MemoryRouter>
      <ContextoAuth.Provider value={{ hogar: { id: 'h1', rol } } as ValorAuth}>
        <ContextoApiConfiguracion.Provider value={api as unknown as ApiConfiguracion}>
          <ConfiguracionPesos />
        </ContextoApiConfiguracion.Provider>
      </ContextoAuth.Provider>
    </MemoryRouter>,
  );
  return { api, user: userEvent.setup() };
}

const cambiar = async (
  user: ReturnType<typeof userEvent.setup>,
  etiqueta: string,
  valor: string,
) => {
  const campo = await screen.findByLabelText(etiqueta);
  await user.clear(campo);
  await user.type(campo, valor);
};

describe('HU-20 Pesos del motor', () => {
  it('muestra los pesos vigentes con la suma en 1.00 y Guardar habilitado', async () => {
    abrir();
    expect(await screen.findByLabelText('Preferencia')).toHaveValue('0.40');
    expect(screen.getByLabelText('Novedad')).toHaveValue('0.25');
    expect(screen.getByLabelText('Ahorro')).toHaveValue('0.20');
    expect(screen.getByLabelText('Afinidad')).toHaveValue('0.15');
    expect(screen.getByText('1.00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled();
  });

  it('CA-20.3 una suma de 1.10 muestra el mensaje y deshabilita Guardar', async () => {
    const { user } = abrir();
    await cambiar(user, 'Preferencia', '0.50');
    expect(
      await screen.findByText('Los pesos deben sumar 1.00 (suma actual 1.10)'),
    ).toBeInTheDocument();
    expect(screen.getByText('1.10')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
  });

  it('un peso vacío o fuera de rango no se puede guardar y la suma no se calcula', async () => {
    const { user } = abrir();
    await cambiar(user, 'Novedad', 'x');
    expect(await screen.findByText('Cada peso debe estar entre 0.00 y 1.00')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
    await user.clear(screen.getByLabelText('Novedad'));
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
  });

  it('guarda los pesos con la versión vigente y avisa que se aplican al próximo menú', async () => {
    const { api, user } = abrir();
    await cambiar(user, 'Preferencia', '0.30');
    await cambiar(user, 'Novedad', '0.30');
    await cambiar(user, 'Ahorro', '0.25');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() =>
      expect(api.guardarPesosMotor).toHaveBeenCalledWith({
        version: 1,
        preferencia: '0.30',
        novedad: '0.30',
        ahorro: '0.25',
        afinidad: '0.15',
      }),
    );
    expect(await screen.findByText(/Pesos guardados/)).toBeInTheDocument();
  });

  it('restaurar valores por defecto vuelve a 0.40 / 0.25 / 0.20 / 0.15', async () => {
    const { user } = abrir();
    await cambiar(user, 'Preferencia', '0.10');
    await user.click(screen.getByRole('button', { name: 'Restaurar valores por defecto' }));
    expect(screen.getByLabelText('Preferencia')).toHaveValue('0.40');
    expect(screen.getByText('1.00')).toBeInTheDocument();
  });

  it('CA-20.4 un miembro ve los pesos sin poder cambiarlos', async () => {
    abrir({}, 'MIEMBRO');
    expect(await screen.findByLabelText('Preferencia')).toBeDisabled();
    expect(screen.getByText('Solo el administrador puede cambiar los pesos')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument();
  });

  it('versión desactualizada: muestra el aviso y recarga la configuración vigente', async () => {
    const obtener = vi
      .fn()
      .mockResolvedValueOnce(CONFIG)
      .mockResolvedValueOnce({
        ...CONFIG,
        version: 3,
        pesos: { preferencia: '0.25', novedad: '0.25', ahorro: '0.25', afinidad: '0.25' },
      });
    const guardarPesosMotor = vi.fn().mockRejectedValue(
      new ProblemaApi({
        status: 409,
        codigo: 'VERSION_DESACTUALIZADA',
        detail: 'La configuración cambió, revisa de nuevo',
      }),
    );
    const { user } = abrir({ obtener, guardarPesosMotor });
    await cambiar(user, 'Preferencia', '0.30');
    await cambiar(user, 'Ahorro', '0.30');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('La configuración cambió, revisa de nuevo')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Preferencia')).toHaveValue('0.25'));
  });

  it('si la recarga tras el conflicto falla conserva el aviso', async () => {
    const obtener = vi.fn().mockResolvedValueOnce(CONFIG).mockRejectedValueOnce(new Error('caída'));
    const guardarPesosMotor = vi
      .fn()
      .mockRejectedValue(
        new ProblemaApi({ status: 409, codigo: 'VERSION_DESACTUALIZADA', detail: 'Cambió' }),
      );
    const { user } = abrir({ obtener, guardarPesosMotor });
    await cambiar(user, 'Preferencia', '0.30');
    await cambiar(user, 'Ahorro', '0.30');
    await cambiar(user, 'Afinidad', '0.15');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Cambió')).toBeInTheDocument();
  });

  it('un error del servidor se muestra y se puede reintentar la carga inicial', async () => {
    const obtener = vi
      .fn()
      .mockRejectedValueOnce(
        new ProblemaApi({ status: 500, codigo: 'ERROR', detail: 'Falló el servidor' }),
      )
      .mockResolvedValueOnce(CONFIG);
    const { user } = abrir({ obtener });
    expect(await screen.findByText('Falló el servidor')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByLabelText('Preferencia')).toHaveValue('0.40');
  });

  it('un error al guardar distinto del conflicto se muestra sin recargar', async () => {
    const guardarPesosMotor = vi
      .fn()
      .mockRejectedValue(
        new ProblemaApi({ status: 422, codigo: 'PESOS_INVALIDOS', detail: 'Pesos inválidos' }),
      );
    const { api, user } = abrir({ guardarPesosMotor });
    await cambiar(user, 'Preferencia', '0.30');
    await cambiar(user, 'Ahorro', '0.30');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Pesos inválidos')).toBeInTheDocument();
    expect(api.obtener).toHaveBeenCalledTimes(1);
  });
});
