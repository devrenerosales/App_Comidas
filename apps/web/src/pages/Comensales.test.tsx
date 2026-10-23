import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProblemaApi } from '../api/problema';
import {
  ROSALES,
  apiComensalesFalsa,
  comensal,
  lista,
  renderizarConComensales,
} from '../test/comensales';
import { SESION_CON_HOGAR, SESION_MIEMBRO } from '../test/utilidades';

const RUTA = '/configuracion/comensales';
const MENSAJE_FACTOR = 'El factor debe estar entre 0.25 y 2.0 en pasos de 0.25';

function abrirComoAdmin(api = apiComensalesFalsa()) {
  return renderizarConComensales(RUTA, SESION_CON_HOGAR, api);
}

const total = async () =>
  (await screen.findByRole('heading', { name: 'Total de porciones' })).nextElementSibling;

/** El aviso de éxito (los valores del stepper también son `status` por ser `<output>`). */
const aviso = async () =>
  (await screen.findByText(/./, { selector: '.mf-aviso p' })) as HTMLElement;

const tarjetaDe = (nombre: string) =>
  within(screen.getByText(nombre, { selector: 'strong' }).closest('li') as HTMLElement);

describe('Comensales (HU-03)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('CA-03.1 agrego a "Abuela Carmen" sin cambiar el factor: se envía 1.0 y el total pasa a 4.0', async () => {
    const con4 = [...ROSALES, comensal('Abuela Carmen')];
    const api = apiComensalesFalsa({
      listar: vi.fn().mockResolvedValueOnce(lista(ROSALES)).mockResolvedValue(lista(con4)),
    });
    abrirComoAdmin(api);
    expect(await total()).toHaveTextContent('3.0');
    expect(api.listar).toHaveBeenCalledWith(true);

    const usuario = userEvent.setup();
    const form = within(screen.getByRole('form', { name: 'Agregar comensal' }));
    expect(form.getByRole('group', { name: 'Porción del nuevo comensal' })).toHaveTextContent(
      '1.0',
    );
    await usuario.type(form.getByLabelText('Nombre del comensal'), '  Abuela  Carmen ');
    await usuario.click(form.getByRole('button', { name: 'Agregar comensal' }));

    expect(api.crear).toHaveBeenCalledWith({
      nombre: 'Abuela Carmen',
      tipo: 'ADULTO',
      factorPorcion: '1.00',
    });
    expect(await aviso()).toHaveTextContent('Agregamos a Abuela Carmen con porción 1.0.');
    expect(await total()).toHaveTextContent('4.0');
    expect(screen.getByText(/4 comensales/)).toBeInTheDocument();
    expect(form.getByLabelText('Nombre del comensal')).toHaveValue('');
  });

  it('CA-03.1 sin comensales invita a agregar al menos uno', async () => {
    abrirComoAdmin(apiComensalesFalsa({ listar: vi.fn().mockResolvedValue(lista([])) }));
    expect(
      await screen.findByText(
        'Aún no hay comensales. Agrega al menos uno para calcular las porciones.',
      ),
    ).toBeInTheDocument();
    expect(await total()).toHaveTextContent('0.0');
  });

  it('CA-03.2 quito a "Diego" y confirmo: se inactiva y quedan 3 activos', async () => {
    const cuatro = [...ROSALES, comensal('Abuela Carmen')];
    const sinDiego = cuatro.map((c) => (c.nombre === 'Diego' ? { ...c, activo: false } : c));
    const api = apiComensalesFalsa({
      listar: vi.fn().mockResolvedValueOnce(lista(cuatro)).mockResolvedValue(lista(sinDiego)),
    });
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValue(true);
    abrirComoAdmin(api);
    const usuario = userEvent.setup();

    await usuario.click(await screen.findByRole('button', { name: 'Quitar a Diego' }));
    expect(confirmar).toHaveBeenCalledWith(
      '¿Quitar a Diego? Dejará de contar en las porciones del hogar.',
    );
    expect(api.inactivar).not.toHaveBeenCalled();

    await usuario.click(screen.getByRole('button', { name: 'Quitar a Diego' }));
    expect(api.inactivar).toHaveBeenCalledWith('c-Diego');
    expect(await aviso()).toHaveTextContent('Diego ya no cuenta en las porciones.');
    expect(await total()).toHaveTextContent('3.0');
    const quitados = within(
      screen.getByRole('heading', { name: 'Quitados' }).parentElement as HTMLElement,
    );
    expect(quitados.getByText('Diego')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Quitar a Diego' })).not.toBeInTheDocument();
  });

  it('CA-03.2 "Volver a agregar" reactiva a un comensal quitado', async () => {
    const conDiegoQuitado = [comensal('Rene'), comensal('Diego', { activo: false })];
    const api = apiComensalesFalsa({ listar: vi.fn().mockResolvedValue(lista(conDiegoQuitado)) });
    abrirComoAdmin(api);
    await userEvent
      .setup()
      .click(await screen.findByRole('button', { name: 'Volver a agregar a Diego' }));
    expect(api.reactivar).toHaveBeenCalledWith('c-Diego');
    expect(await aviso()).toHaveTextContent('Diego vuelve a contar.');
  });

  it('CA-03.2 CU-01.3 E2: no deja quitar al último comensal activo', async () => {
    const api = apiComensalesFalsa({
      listar: vi.fn().mockResolvedValue(lista([comensal('Rene')])),
    });
    const confirmar = vi.spyOn(window, 'confirm');
    abrirComoAdmin(api);
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Quitar a Rene' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Debe quedar al menos un comensal activo en el hogar',
    );
    expect(confirmar).not.toHaveBeenCalled();
    expect(api.inactivar).not.toHaveBeenCalled();
  });

  it('CA-03.2 si la API rechaza la baja muestra su mensaje', async () => {
    const api = apiComensalesFalsa({
      inactivar: vi.fn().mockRejectedValue(
        new ProblemaApi({
          status: 422,
          codigo: 'ULTIMO_COMENSAL',
          detail: 'Debe quedar al menos un comensal activo en el hogar',
        }),
      ),
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    abrirComoAdmin(api);
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Quitar a Ana' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Debe quedar al menos un comensal activo en el hogar',
    );
  });

  it('CA-03.3 agregar otro "Ana": "Ya existe un comensal con ese nombre" y no se guarda', async () => {
    const api = apiComensalesFalsa();
    abrirComoAdmin(api);
    const usuario = userEvent.setup();
    const form = within(await screen.findByRole('form', { name: 'Agregar comensal' }));
    await usuario.type(form.getByLabelText('Nombre del comensal'), ' ANA ');
    await usuario.click(form.getByRole('button', { name: 'Agregar comensal' }));
    expect(form.getByLabelText('Nombre del comensal')).toHaveAccessibleDescription(
      'Ya existe un comensal con ese nombre',
    );
    expect(api.crear).not.toHaveBeenCalled();
  });

  it('CA-03.3 la respuesta 409 de la API se muestra en el campo nombre', async () => {
    const api = apiComensalesFalsa({
      crear: vi.fn().mockRejectedValue(
        new ProblemaApi({
          status: 409,
          codigo: 'NOMBRE_REPETIDO',
          detail: 'Ya existe un comensal con ese nombre',
        }),
      ),
    });
    abrirComoAdmin(api);
    const usuario = userEvent.setup();
    const form = within(await screen.findByRole('form', { name: 'Agregar comensal' }));
    await usuario.type(form.getByLabelText('Nombre del comensal'), 'Luisa');
    await usuario.click(form.getByRole('button', { name: 'Agregar comensal' }));
    expect(await form.findByText('Ya existe un comensal con ese nombre')).toBeInTheDocument();
  });

  it('CA-03.3 si el repetido está quitado ofrece volver a agregarlo', async () => {
    const api = apiComensalesFalsa({
      listar: vi
        .fn()
        .mockResolvedValue(lista([comensal('Rene'), comensal('Diego', { activo: false })])),
    });
    abrirComoAdmin(api);
    const usuario = userEvent.setup();
    const form = within(await screen.findByRole('form', { name: 'Agregar comensal' }));
    await usuario.type(form.getByLabelText('Nombre del comensal'), 'diego');
    await usuario.click(form.getByRole('button', { name: 'Agregar comensal' }));
    expect(form.getByText(/Diego está quitado/)).toBeInTheDocument();
    await usuario.click(form.getByRole('button', { name: 'Volver a agregar a Diego' }));
    expect(api.reactivar).toHaveBeenCalledWith('c-Diego');
    expect(api.crear).not.toHaveBeenCalled();
  });

  it('CA-03.3 CU-01.3 E1: nombre vacío → "Ingresa el nombre del comensal"', async () => {
    const api = apiComensalesFalsa();
    abrirComoAdmin(api);
    const form = within(await screen.findByRole('form', { name: 'Agregar comensal' }));
    await userEvent.setup().click(form.getByRole('button', { name: 'Agregar comensal' }));
    expect(form.getByText('Ingresa el nombre del comensal')).toBeInTheDocument();
    expect(api.crear).not.toHaveBeenCalled();
  });

  it('CA-03.4 un Miembro ve los comensales y el total en solo lectura', async () => {
    const api = apiComensalesFalsa({
      listar: vi
        .fn()
        .mockResolvedValue(
          lista([...ROSALES, comensal('Sofía', { tipo: 'NINO', factorPorcion: '0.50' })]),
        ),
    });
    renderizarConComensales(RUTA, SESION_MIEMBRO, api);
    expect(await total()).toHaveTextContent('3.5');
    expect(api.listar).toHaveBeenCalledWith(false);
    expect(screen.getByText('Niño · porción 0.5')).toBeInTheDocument();
    expect(
      screen.getByText('Solo el administrador puede modificar comensales.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Subir porción/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Quitar a/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Agregar comensal' })).not.toBeInTheDocument();
  });

  it('CA-03.4 desde "Hogar y usuarios" el Miembro llega a "Ver comensales"', async () => {
    renderizarConComensales('/configuracion/hogar', SESION_MIEMBRO);
    expect(await screen.findByRole('link', { name: 'Ver comensales' })).toHaveAttribute(
      'href',
      '/configuracion/comensales',
    );
  });

  it('CA-03.5 agrego a "Sofía" niño con 0.5: se envía NINO y 0.50 y el total es 3.5', async () => {
    const sofia = comensal('Sofía', { tipo: 'NINO', factorPorcion: '0.50' });
    const api = apiComensalesFalsa({
      listar: vi
        .fn()
        .mockResolvedValueOnce(lista(ROSALES))
        .mockResolvedValue(lista([...ROSALES, sofia])),
    });
    abrirComoAdmin(api);
    const usuario = userEvent.setup();
    const form = within(await screen.findByRole('form', { name: 'Agregar comensal' }));
    await usuario.type(form.getByLabelText('Nombre del comensal'), 'Sofía');
    await usuario.click(form.getByLabelText('Niño'));
    const bajar = form.getByRole('button', { name: 'Bajar porción del nuevo comensal' });
    await usuario.click(bajar);
    await usuario.click(bajar);
    expect(form.getByRole('group', { name: 'Porción del nuevo comensal' })).toHaveTextContent(
      '0.5',
    );
    await usuario.click(form.getByRole('button', { name: 'Agregar comensal' }));
    expect(api.crear).toHaveBeenCalledWith({
      nombre: 'Sofía',
      tipo: 'NINO',
      factorPorcion: '0.50',
    });
    expect(await total()).toHaveTextContent('3.5');
    expect(screen.getByText(/4 comensales · 1 niño/)).toBeInTheDocument();
  });

  it('CA-03.5 el stepper ajusta el total al instante y "Guardar cambios" envía el factor', async () => {
    const api = apiComensalesFalsa();
    abrirComoAdmin(api);
    const usuario = userEvent.setup();
    const subir = await screen.findByRole('button', { name: 'Subir porción de Diego' });
    await usuario.click(subir);
    expect(await total()).toHaveTextContent('3.25');
    expect(screen.getByText('Sin guardar')).toBeInTheDocument();
    expect(tarjetaDe('Diego').getByRole('group', { name: 'Porción de Diego' })).toHaveTextContent(
      '1.25',
    );

    await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(api.editar).toHaveBeenCalledTimes(1);
    expect(api.editar).toHaveBeenCalledWith('c-Diego', { factorPorcion: '1.25' });
    expect(await aviso()).toHaveTextContent('Cambios guardados.');
    await waitFor(() => expect(screen.queryByText('Sin guardar')).not.toBeInTheDocument());
  });

  it('CA-03.5 "Descartar" vuelve a los factores guardados', async () => {
    abrirComoAdmin();
    const usuario = userEvent.setup();
    await usuario.click(await screen.findByRole('button', { name: 'Bajar porción de Ana' }));
    expect(await total()).toHaveTextContent('2.75');
    await usuario.click(screen.getByRole('button', { name: 'Descartar' }));
    expect(await total()).toHaveTextContent('3.0');
  });

  it('CA-03.5 CU-01.3 2a: editar nombre y etiqueta de "Diego"', async () => {
    const api = apiComensalesFalsa();
    abrirComoAdmin(api);
    const usuario = userEvent.setup();
    await usuario.click(await screen.findByRole('button', { name: 'Editar a Diego' }));
    const form = within(screen.getByRole('form', { name: 'Editar a Diego' }));
    const campo = form.getByLabelText('Nombre');
    await usuario.clear(campo);
    await usuario.click(form.getByRole('button', { name: 'Guardar' }));
    expect(form.getByText('Ingresa el nombre del comensal')).toBeInTheDocument();
    await usuario.type(campo, 'Rene');
    await usuario.click(form.getByRole('button', { name: 'Guardar' }));
    expect(form.getByText('Ya existe un comensal con ese nombre')).toBeInTheDocument();
    await usuario.clear(campo);
    await usuario.type(campo, 'Diego R.');
    await usuario.click(form.getByLabelText('Niño'));
    await usuario.click(form.getByRole('button', { name: 'Guardar' }));
    expect(api.editar).toHaveBeenCalledWith('c-Diego', { nombre: 'Diego R.', tipo: 'NINO' });
    expect(await aviso()).toHaveTextContent('Cambios guardados.');
  });

  it('CA-03.5 editar: cancelar no guarda y un 409 de la API se muestra en el campo', async () => {
    const api = apiComensalesFalsa({
      editar: vi.fn().mockRejectedValue(
        new ProblemaApi({
          status: 409,
          codigo: 'NOMBRE_REPETIDO',
          detail: 'Ya existe un comensal con ese nombre',
        }),
      ),
    });
    abrirComoAdmin(api);
    const usuario = userEvent.setup();
    await usuario.click(await screen.findByRole('button', { name: 'Editar a Ana' }));
    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('form', { name: 'Editar a Ana' })).not.toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Editar a Ana' }));
    await usuario.type(screen.getByLabelText('Nombre'), 'ita');
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Ya existe un comensal con ese nombre')).toBeInTheDocument();
  });

  it('CA-03.6 el stepper no baja de 0.25 ni sube de 2.0', async () => {
    abrirComoAdmin(
      apiComensalesFalsa({
        listar: vi
          .fn()
          .mockResolvedValue(
            lista([
              comensal('Bebé', { factorPorcion: '0.25' }),
              comensal('Tío', { factorPorcion: '2.00' }),
            ]),
          ),
      }),
    );
    expect(await screen.findByRole('button', { name: 'Bajar porción de Bebé' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Subir porción de Bebé' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Subir porción de Tío' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Subir porción de Tío' })).toHaveClass(
      'mf-stepper__boton',
    );
  });

  it(`CA-03.6 si la API responde FACTOR_INVALIDO muestra "${MENSAJE_FACTOR}"`, async () => {
    const error = new ProblemaApi({
      status: 422,
      codigo: 'FACTOR_INVALIDO',
      detail: MENSAJE_FACTOR,
    });
    const api = apiComensalesFalsa({
      editar: vi.fn().mockRejectedValue(error),
      crear: vi.fn().mockRejectedValue(error),
    });
    abrirComoAdmin(api);
    const usuario = userEvent.setup();
    await usuario.click(await screen.findByRole('button', { name: 'Subir porción de Diego' }));
    await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(MENSAJE_FACTOR);
    // El borrador se conserva para corregirlo.
    expect(screen.getByText('Sin guardar')).toBeInTheDocument();

    const form = within(screen.getByRole('form', { name: 'Agregar comensal' }));
    await usuario.type(form.getByLabelText('Nombre del comensal'), 'Tío');
    await usuario.click(form.getByRole('button', { name: 'Agregar comensal' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(MENSAJE_FACTOR);
  });

  it('muestra el error si no se puede cargar la lista o agregar', async () => {
    abrirComoAdmin(
      apiComensalesFalsa({ listar: vi.fn().mockRejectedValue(ProblemaApi.sinConexion()) }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Necesitas conexión para iniciar sesión',
    );
  });

  it('un error inesperado al agregar muestra el mensaje genérico', async () => {
    abrirComoAdmin(apiComensalesFalsa({ crear: vi.fn().mockRejectedValue(new Error('x')) }));
    const usuario = userEvent.setup();
    const form = within(await screen.findByRole('form', { name: 'Agregar comensal' }));
    await usuario.type(form.getByLabelText('Nombre del comensal'), 'Tío');
    await usuario.click(form.getByRole('button', { name: 'Agregar comensal' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Ocurrió un error inesperado');
  });
});
