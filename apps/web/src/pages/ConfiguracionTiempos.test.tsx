import { IonApp } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ApiAuth } from '../api/auth';
import type {
  ApiConfiguracion,
  ConfiguracionHogar,
  RespuestaVistaPrevia,
} from '../api/configuracion';
import { ContextoApiConfiguracion } from '../api/contexto-configuracion';
import { ContextoApiHogar } from '../api/contexto-hogar';
import type { ApiHogar } from '../api/hogar';
import { ProblemaApi } from '../api/problema';
import { ProveedorAuth } from '../auth/ProveedorAuth';
import { Rutas } from '../Rutas';
import {
  SESION_CON_HOGAR,
  SESION_MIEMBRO,
  apiFalsa,
  apiHogarFalsa,
  clienteFalso,
} from '../test/utilidades';

type Tiempo = 'DESAYUNO' | 'ALMUERZO' | 'CENA';

/** Configuración con el presupuesto y los % activos indicados (montos según RN-01). */
function configuracion(
  presupuesto: string,
  activos: Partial<Record<Tiempo, [string, string]>>,
  version = 1,
): ConfiguracionHogar {
  return {
    version,
    presupuestoSemanal: presupuesto,
    tiempos: (['DESAYUNO', 'ALMUERZO', 'CENA'] as const).map((tiempo) => ({
      tiempo,
      activo: activos[tiempo] !== undefined,
      porcentaje: activos[tiempo]?.[0] ?? '0.00',
      monto: activos[tiempo]?.[1] ?? '0.00',
    })),
    diaInicioSemana: 'DOMINGO',
    diaPlanificacion: 'DOMINGO',
    horaPlanificacion: 8,
    pesos: { preferencia: '0.40', novedad: '0.25', ahorro: '0.20', afinidad: '0.15' },
    actualizadoEn: '2026-10-22T15:00:00.000Z',
  };
}

const VISTA_VACIA: RespuestaVistaPrevia = {
  version: 1,
  presupuestoSemanal: '500.00',
  actual: [],
  nuevo: [],
  impacto: [],
  aplicaDesde: '2026-10-25',
  menusAprobadosConservados: [],
  borradoresADesactualizar: [],
};

function apiConfigFalsa(config: ConfiguracionHogar, extra: Partial<ApiConfiguracion> = {}) {
  return {
    obtener: vi.fn().mockResolvedValue(config),
    vistaPrevia: vi.fn().mockResolvedValue(VISTA_VACIA),
    guardarTiempos: vi.fn(),
    guardarPresupuesto: vi.fn(),
    ...extra,
  };
}

function abrir(apiConfig: ReturnType<typeof apiConfigFalsa>, sesion = SESION_CON_HOGAR) {
  window.history.replaceState({}, '', '/configuracion/tiempos');
  render(
    <IonApp>
      <ContextoApiHogar.Provider value={apiHogarFalsa() as unknown as ApiHogar}>
        <ContextoApiConfiguracion.Provider value={apiConfig as unknown as ApiConfiguracion}>
          <ProveedorAuth
            api={apiFalsa({ restaurar: vi.fn().mockResolvedValue(sesion) }) as unknown as ApiAuth}
            cliente={clienteFalso()}
          >
            <IonReactRouter>
              <Rutas />
            </IonReactRouter>
          </ProveedorAuth>
        </ContextoApiConfiguracion.Provider>
      </ContextoApiHogar.Provider>
    </IonApp>,
  );
  return { usuario: userEvent.setup(), apiConfig };
}

/** Fila de la tabla Actual → Nuevo de un tiempo. */
const fila = (tiempo: Tiempo) =>
  document.querySelector(`tr[data-tiempo="${tiempo}"]`) as HTMLTableRowElement;
const celdas = (tiempo: Tiempo) =>
  Array.from(fila(tiempo).querySelectorAll('td')).map((td) => td.textContent?.trim());

const SOLO_ALMUERZO_500 = configuracion('500.00', { ALMUERZO: ['100.00', '500.00'] });

describe('Tiempos y presupuesto (HU-05, HU-06, HU-07)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('CA-05.1 de solo almuerzo a almuerzo + cena con Q500: Q300 y Q200 al aceptar la sugerida', async () => {
    const guardada = {
      ...configuracion('500.00', { ALMUERZO: ['60.00', '300.00'], CENA: ['40.00', '200.00'] }, 2),
      borradoresDesactualizados: [],
    };
    const { usuario, apiConfig } = abrir(
      apiConfigFalsa(SOLO_ALMUERZO_500, {
        guardarTiempos: vi.fn().mockResolvedValue(guardada),
      }),
    );
    await usuario.click(await screen.findByLabelText('Dos tiempos'));
    await usuario.click(screen.getByLabelText('Cena'));
    expect(screen.getByLabelText('Porcentaje de Almuerzo')).toHaveValue('60');
    expect(screen.getByLabelText('Porcentaje de Cena')).toHaveValue('40');
    expect(celdas('ALMUERZO')[1]).toContain('Q300');
    expect(celdas('CENA')).toEqual(['—', expect.stringContaining('Q200')]);
    expect(screen.getByText('Sin guardar')).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(apiConfig.vistaPrevia).toHaveBeenCalledWith({
      tiempos: ['ALMUERZO', 'CENA'],
      presupuestoSemanal: '500.00',
      distribucion: [
        { tiempo: 'ALMUERZO', porcentaje: '60' },
        { tiempo: 'CENA', porcentaje: '40' },
      ],
    });
    expect(
      await screen.findByRole('heading', { name: 'Confirma el cambio de tiempos' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/25 de octubre de 2026/)).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(apiConfig.guardarTiempos).toHaveBeenCalledWith({
      version: 1,
      presupuestoSemanal: '500.00',
      tiempos: [
        { tiempo: 'ALMUERZO', porcentaje: '60' },
        { tiempo: 'CENA', porcentaje: '40' },
      ],
    });
    expect(await screen.findByText('Configuración guardada.')).toBeInTheDocument();
  });

  it('CA-05.2 dos tiempos: desayuno y almuerzo con Q500 → Q145 y Q355', async () => {
    const { usuario } = abrir(apiConfigFalsa(SOLO_ALMUERZO_500));
    await usuario.click(await screen.findByLabelText('Dos tiempos'));
    await usuario.click(screen.getByLabelText('Desayuno'));
    expect(celdas('DESAYUNO')).toEqual(['—', expect.stringContaining('Q145')]);
    expect(celdas('ALMUERZO')[1]).toContain('Q355');
    expect(screen.getByLabelText('Porcentaje de Desayuno')).toHaveValue('29');
  });

  it('CA-05.3 dos tiempos con solo "Cena": "Selecciona exactamente dos tiempos" y sin vista previa', async () => {
    const { usuario, apiConfig } = abrir(apiConfigFalsa(SOLO_ALMUERZO_500));
    await usuario.click(await screen.findByLabelText('Dos tiempos'));
    await usuario.click(screen.getByLabelText('Almuerzo'));
    await usuario.click(screen.getByLabelText('Cena'));
    await usuario.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(screen.getByText('Selecciona exactamente dos tiempos')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Vista previa del reparto' })).toBeNull();
    expect(apiConfig.vistaPrevia).not.toHaveBeenCalled();
  });

  it('CA-05.4 el miembro ve la configuración en solo lectura y el aviso de RN-10', async () => {
    const { apiConfig } = abrir(
      apiConfigFalsa(
        configuracion('500.00', { ALMUERZO: ['60.00', '300.00'], CENA: ['40.00', '200.00'] }),
      ),
      SESION_MIEMBRO,
    );
    expect(
      await screen.findByText(/Solo el administrador puede cambiar los tiempos de comida/),
    ).toBeInTheDocument();
    expect(screen.getByText('60 % · Q300')).toBeInTheDocument();
    expect(screen.queryByLabelText('Desayuno')).toBeNull();
    expect(screen.queryByRole('button', { name: /Guardar/ })).toBeNull();
    expect(apiConfig.guardarTiempos).not.toHaveBeenCalled();
  });

  it('CA-06.1 tres tiempos: Q700 con 20/50/30 → Q140, Q350 y Q210 y guarda en %', async () => {
    const tres = configuracion('250.00', {
      DESAYUNO: ['20.00', '50.00'],
      ALMUERZO: ['50.00', '125.00'],
      CENA: ['30.00', '75.00'],
    });
    const { usuario, apiConfig } = abrir(
      apiConfigFalsa(tres, {
        guardarPresupuesto: vi.fn().mockResolvedValue({
          ...configuracion(
            '700.00',
            {
              DESAYUNO: ['20.00', '140.00'],
              ALMUERZO: ['50.00', '350.00'],
              CENA: ['30.00', '210.00'],
            },
            2,
          ),
          borradoresDesactualizados: [
            { id: 'm1', fechaInicio: '2026-11-01', fechaFin: '2026-11-07' },
          ],
        }),
      }),
    );
    const campo = await screen.findByLabelText('Presupuesto semanal en quetzales (Q)');
    await usuario.clear(campo);
    await usuario.type(campo, '700');
    expect(celdas('DESAYUNO')[1]).toContain('Q140');
    expect(celdas('ALMUERZO')[1]).toContain('Q350');
    expect(celdas('CENA')[1]).toContain('Q210');
    expect(screen.getByText('Suma 100 % · Q700')).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(apiConfig.guardarPresupuesto).toHaveBeenCalledWith({
      version: 1,
      presupuestoSemanal: '700',
      modo: 'PORCENTAJE',
      distribucion: [
        { tiempo: 'DESAYUNO', porcentaje: '20' },
        { tiempo: 'ALMUERZO', porcentaje: '50' },
        { tiempo: 'CENA', porcentaje: '30' },
      ],
    });
    expect(
      await screen.findByText(/1 menú en borrador quedó "Desactualizado"/),
    ).toBeInTheDocument();
  });

  it('CA-06.1 presupuesto inválido: "Ingresa un presupuesto mayor a Q0.00" y Guardar deshabilitado', async () => {
    const { usuario } = abrir(apiConfigFalsa(SOLO_ALMUERZO_500));
    const campo = await screen.findByLabelText('Presupuesto semanal en quetzales (Q)');
    await usuario.clear(campo);
    await usuario.type(campo, '0');
    expect(screen.getByText('Ingresa un presupuesto mayor a Q0.00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
  });

  it('CA-06.2 por monto: Q320 y Q180 de Q500 → 64 % y 36 %', async () => {
    const { usuario, apiConfig } = abrir(
      apiConfigFalsa(
        configuracion('500.00', { ALMUERZO: ['60.00', '300.00'], CENA: ['40.00', '200.00'] }),
        {
          guardarPresupuesto: vi.fn().mockResolvedValue({
            ...configuracion(
              '500.00',
              { ALMUERZO: ['64.00', '320.00'], CENA: ['36.00', '180.00'] },
              2,
            ),
            borradoresDesactualizados: [],
          }),
        },
      ),
    );
    await usuario.click(await screen.findByLabelText('Quetzales'));
    const almuerzo = screen.getByLabelText('Monto de Almuerzo en quetzales');
    expect(almuerzo).toHaveValue('300.00');
    await usuario.clear(almuerzo);
    await usuario.type(almuerzo, '320');
    const cena = screen.getByLabelText('Monto de Cena en quetzales');
    await usuario.clear(cena);
    await usuario.type(cena, '180');
    expect(celdas('ALMUERZO')[1]).toContain('64 %');
    expect(celdas('CENA')[1]).toContain('36 %');
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(apiConfig.guardarPresupuesto).toHaveBeenCalledWith(
      expect.objectContaining({
        modo: 'MONTO',
        distribucion: [
          { tiempo: 'ALMUERZO', monto: '320' },
          { tiempo: 'CENA', monto: '180' },
        ],
      }),
    );
    // Volver a porcentaje conserva el reparto guardado.
    await usuario.click(await screen.findByLabelText('Porcentaje'));
    expect(screen.getByLabelText('Porcentaje de Almuerzo')).toHaveValue('64');
  });

  it('CA-06.3 20 %, 50 % y 25 % → "Faltan 5 % por asignar" y Guardar deshabilitado', async () => {
    const { usuario } = abrir(
      apiConfigFalsa(
        configuracion('500.00', {
          DESAYUNO: ['20.00', '100.00'],
          ALMUERZO: ['50.00', '250.00'],
          CENA: ['30.00', '150.00'],
        }),
      ),
    );
    const cena = await screen.findByLabelText('Porcentaje de Cena');
    await usuario.clear(cena);
    await usuario.type(cena, '25');
    expect(screen.getByText('Faltan 5 % por asignar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
    await usuario.type(cena, 'x');
    expect(
      screen.getByText('Cada porcentaje debe estar entre 0 % y 100 % con hasta 2 decimales'),
    ).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Usar distribución sugerida' }));
    expect(cena).toHaveValue('30');
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled();
  });

  it('CA-06.4 montos Q320 + Q200 con Q500 → "Excede el presupuesto por Q20.00" y no se guarda', async () => {
    const { usuario, apiConfig } = abrir(
      apiConfigFalsa(
        configuracion('500.00', { ALMUERZO: ['60.00', '300.00'], CENA: ['40.00', '200.00'] }),
      ),
    );
    await usuario.click(await screen.findByLabelText('Quetzales'));
    const almuerzo = screen.getByLabelText('Monto de Almuerzo en quetzales');
    await usuario.clear(almuerzo);
    await usuario.type(almuerzo, '320');
    expect(screen.getByText('Excede el presupuesto por Q20.00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
    await usuario.type(almuerzo, 'q');
    expect(
      screen.getByText('Cada monto debe ser de Q0.00 o más con hasta 2 decimales'),
    ).toBeInTheDocument();
    expect(apiConfig.guardarPresupuesto).not.toHaveBeenCalled();
  });

  it('CA-07.1 de almuerzo 60 % (Q360) y cena 40 % (Q240) a tres tiempos: tabla Actual → Nuevo', async () => {
    const { usuario, apiConfig } = abrir(
      apiConfigFalsa(
        configuracion('600.00', { ALMUERZO: ['60.00', '360.00'], CENA: ['40.00', '240.00'] }),
        {
          vistaPrevia: vi.fn().mockResolvedValue({
            ...VISTA_VACIA,
            aplicaDesde: '2026-11-01',
            menusAprobadosConservados: [
              { id: 'm1', fechaInicio: '2026-10-25', fechaFin: '2026-10-31' },
            ],
          }),
        },
      ),
    );
    await usuario.click(await screen.findByLabelText(/Tres tiempos/));
    await usuario.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(celdas('DESAYUNO')).toEqual(['—', expect.stringContaining('Q120')]);
    expect(celdas('ALMUERZO')).toEqual([
      expect.stringContaining('Q360'),
      expect.stringContaining('Q300'),
    ]);
    expect(celdas('CENA')).toEqual([
      expect.stringContaining('Q240'),
      expect.stringContaining('Q180'),
    ]);
    // CA-07.2: el aprobado se conserva y lo nuevo aplica desde el 1 de noviembre.
    expect(await screen.findByText(/Menús aprobados que no cambian/)).toHaveTextContent(
      '25 de octubre de 2026',
    );
    expect(screen.getByText(/1 de noviembre de 2026/)).toBeInTheDocument();
    expect(apiConfig.guardarTiempos).not.toHaveBeenCalled();
    expect(apiConfig.guardarPresupuesto).not.toHaveBeenCalled();
  });

  it('CA-07.3 cancelar desde la vista previa: sigue con solo almuerzo y Q250', async () => {
    const { usuario, apiConfig } = abrir(
      apiConfigFalsa(configuracion('250.00', { ALMUERZO: ['100.00', '250.00'] })),
    );
    await usuario.click(await screen.findByLabelText('Dos tiempos'));
    await usuario.click(screen.getByLabelText('Cena'));
    expect(celdas('ALMUERZO')[1]).toContain('Q150');
    expect(celdas('CENA')[1]).toContain('Q100');
    await usuario.click(screen.getByRole('button', { name: 'Continuar' }));
    await screen.findByRole('heading', { name: 'Confirma el cambio de tiempos' });
    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByLabelText('Solo almuerzo')).toBeChecked();
    expect(screen.getByLabelText('Presupuesto semanal en quetzales (Q)')).toHaveValue('250.00');
    expect(fila('CENA')).toBeNull();
    expect(screen.queryByText('Sin guardar')).toBeNull();
    expect(apiConfig.guardarTiempos).not.toHaveBeenCalled();
  });

  it('CA-07.4 borrador futuro: se avisa que quedará "Desactualizado" y al confirmar se informa', async () => {
    const { usuario } = abrir(
      apiConfigFalsa(SOLO_ALMUERZO_500, {
        vistaPrevia: vi.fn().mockResolvedValue({
          ...VISTA_VACIA,
          borradoresADesactualizar: [
            { id: 'm2', fechaInicio: '2026-11-01', fechaFin: '2026-11-07' },
          ],
        }),
        guardarTiempos: vi.fn().mockResolvedValue({
          ...configuracion(
            '500.00',
            { ALMUERZO: ['60.00', '300.00'], CENA: ['40.00', '200.00'] },
            2,
          ),
          borradoresDesactualizados: [
            { id: 'm2', fechaInicio: '2026-11-01', fechaFin: '2026-11-07' },
            { id: 'm3', fechaInicio: '2026-11-08', fechaFin: '2026-11-14' },
          ],
        }),
      }),
    );
    await usuario.click(await screen.findByLabelText('Dos tiempos'));
    await usuario.click(screen.getByLabelText('Cena'));
    await usuario.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByText(/Se marcarán "Desactualizado"/)).toHaveTextContent(
      'Sus platillos no se cambian automáticamente.',
    );
    await usuario.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(
      await screen.findByText(/2 menús en borrador quedaron "Desactualizado"/),
    ).toBeInTheDocument();
  });

  it('CA-07.5 en la vista previa 20/50/30, almuerzo a 45 % → "Faltan 5 % por asignar" y Confirmar deshabilitado', async () => {
    const { usuario } = abrir(
      apiConfigFalsa(
        configuracion('600.00', { ALMUERZO: ['60.00', '360.00'], CENA: ['40.00', '240.00'] }),
      ),
    );
    await usuario.click(await screen.findByLabelText(/Tres tiempos/));
    await usuario.click(screen.getByRole('button', { name: 'Continuar' }));
    await screen.findByRole('heading', { name: 'Confirma el cambio de tiempos' });
    const almuerzo = screen.getByLabelText('Porcentaje de Almuerzo');
    await usuario.clear(almuerzo);
    await usuario.type(almuerzo, '45');
    expect(screen.getByText('Faltan 5 % por asignar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDisabled();
  });

  it('CA-07.1 E1 la configuración cambió: muestra el aviso y recarga', async () => {
    const conflicto = new ProblemaApi({
      status: 409,
      codigo: 'VERSION_DESACTUALIZADA',
      detail: 'La configuración cambió, revisa de nuevo',
    });
    const apiConfig = apiConfigFalsa(SOLO_ALMUERZO_500, {
      guardarPresupuesto: vi.fn().mockRejectedValue(conflicto),
    });
    const { usuario } = abrir(apiConfig);
    const campo = await screen.findByLabelText('Presupuesto semanal en quetzales (Q)');
    await usuario.clear(campo);
    await usuario.type(campo, '600');
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('La configuración cambió, revisa de nuevo')).toBeInTheDocument();
    await waitFor(() => expect(apiConfig.obtener).toHaveBeenCalledTimes(2));
  });

  it('muestra errores de la API al continuar o al cargar', async () => {
    const apiConfig = apiConfigFalsa(SOLO_ALMUERZO_500, {
      vistaPrevia: vi.fn().mockRejectedValue(new Error('caída')),
    });
    const { usuario } = abrir(apiConfig);
    await usuario.click(await screen.findByLabelText(/Tres tiempos/));
    await usuario.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Ocurrió un error inesperado');
  });

  it('error al cargar la configuración', async () => {
    abrir(
      apiConfigFalsa(SOLO_ALMUERZO_500, { obtener: vi.fn().mockRejectedValue(new Error('x')) }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Ocurrió un error inesperado');
  });

  it('la pestaña Configuración enlaza a Tiempos y presupuesto', async () => {
    window.history.replaceState({}, '', '/configuracion');
    render(
      <IonApp>
        <ContextoApiConfiguracion.Provider
          value={apiConfigFalsa(SOLO_ALMUERZO_500) as unknown as ApiConfiguracion}
        >
          <ProveedorAuth
            api={
              apiFalsa({
                restaurar: vi.fn().mockResolvedValue(SESION_CON_HOGAR),
              }) as unknown as ApiAuth
            }
            cliente={clienteFalso()}
          >
            <IonReactRouter>
              <Rutas />
            </IonReactRouter>
          </ProveedorAuth>
        </ContextoApiConfiguracion.Provider>
      </IonApp>,
    );
    const seccion = within(
      (await screen.findByRole('heading', { name: 'Tiempos de comida y presupuesto' }))
        .parentElement as HTMLElement,
    );
    expect(seccion.getByRole('link', { name: 'Tiempos y presupuesto' })).toHaveAttribute(
      'href',
      '/configuracion/tiempos',
    );
  });
});
