import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProblemaApi } from '../api/problema';
import {
  HOGAR_ROSALES,
  INVITACION_CORREO,
  INVITACION_ENLACE,
  SESION_CON_HOGAR,
  SESION_MIEMBRO,
  apiFalsa,
  apiHogarFalsa,
  clienteFalso,
  renderizarApp,
  sinEnlace,
} from '../test/utilidades';

const RUTA = '/configuracion/hogar';
const comoAdmin = () => apiFalsa({ restaurar: vi.fn().mockResolvedValue(SESION_CON_HOGAR) });

function abrir(apiHogar = apiHogarFalsa(), api = comoAdmin()) {
  return renderizarApp(RUTA, api, clienteFalso(), apiHogar);
}

async function invitarPorCorreo(correo: string) {
  const usuario = userEvent.setup();
  await usuario.type(await screen.findByLabelText('Correo de la persona a invitar'), correo);
  await usuario.click(screen.getByRole('button', { name: 'Enviar invitación por correo' }));
  return usuario;
}

describe('Hogar y usuarios (HU-02)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(navigator, 'share');
  });

  it('CA-02.1 lista los miembros con su rol', async () => {
    const apiHogar = apiHogarFalsa({
      obtenerHogar: vi.fn().mockResolvedValue({
        ...HOGAR_ROSALES,
        miembros: [
          ...HOGAR_ROSALES.miembros,
          {
            usuarioId: 'u2',
            nombre: 'Ana',
            correo: 'ana@correo.com',
            rol: 'MIEMBRO',
            desde: '2026-10-22T16:00:00.000Z',
          },
        ],
      }),
    });
    abrir(apiHogar);
    const lista = within(
      (await screen.findByRole('heading', { name: 'Miembros de Familia Rosales' }))
        .parentElement as HTMLElement,
    );
    expect(lista.getByText('Rene')).toBeInTheDocument();
    expect(lista.getByText('Administrador')).toBeInTheDocument();
    expect(lista.getByText('ana@correo.com')).toBeInTheDocument();
    expect(lista.getByText('Miembro')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Gestionar comensales' })).toHaveAttribute(
      'href',
      '/configuracion/comensales',
    );
  });

  it('CA-02.1 invito a "ana@correo.com" por correo: confirma el envío y queda pendiente', async () => {
    const apiHogar = apiHogarFalsa({
      listarInvitaciones: vi
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValue([sinEnlace(INVITACION_CORREO)]),
    });
    abrir(apiHogar);
    expect(await screen.findByText('No hay invitaciones pendientes.')).toBeInTheDocument();
    await invitarPorCorreo(' ana@correo.com ');
    expect(apiHogar.invitar).toHaveBeenCalledWith({ medio: 'CORREO', correo: 'ana@correo.com' });
    expect(await screen.findByRole('status')).toHaveTextContent(
      /Enviamos la invitación a ana@correo.com. Vence el jueves, 29 de octubre/,
    );
    const pendientes = within(
      screen.getByRole('heading', { name: 'Invitaciones pendientes' }).parentElement as HTMLElement,
    );
    expect(await pendientes.findByText('ana@correo.com')).toBeInTheDocument();
    expect(screen.getByLabelText('Correo de la persona a invitar')).toHaveValue('');
  });

  it('CA-02.1 correo mal escrito: no llama a la API', async () => {
    const { apiHogar } = abrir();
    await invitarPorCorreo('ana-correo');
    expect(await screen.findByText('Ingresa un correo válido')).toBeInTheDocument();
    expect(apiHogar.invitar).not.toHaveBeenCalled();
  });

  it('CU-01.2 5c: si ya es miembro muestra "Ya es miembro" en el campo', async () => {
    const apiHogar = apiHogarFalsa({
      invitar: vi
        .fn()
        .mockRejectedValue(
          new ProblemaApi({ status: 409, codigo: 'YA_ES_MIEMBRO', detail: 'Ya es miembro' }),
        ),
    });
    abrir(apiHogar);
    await invitarPorCorreo('rene@correo.com');
    expect(await screen.findByText('Ya es miembro')).toBeInTheDocument();
    expect(screen.getByLabelText('Correo de la persona a invitar')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  it('CU-01.2: error de validación del correo desde la API', async () => {
    const apiHogar = apiHogarFalsa({
      invitar: vi.fn().mockRejectedValue(
        new ProblemaApi({
          status: 422,
          codigo: 'CORREO_INVALIDO',
          detail: 'Ingresa un correo válido',
          errores: [{ campo: 'correo', mensaje: 'Ingresa un correo válido (API)' }],
        }),
      ),
    });
    abrir(apiHogar);
    await invitarPorCorreo('ana@correo.com');
    expect(await screen.findByText('Ingresa un correo válido (API)')).toBeInTheDocument();
  });

  it('CU-01.2 E2: si el correo no salió, ofrece copiar el enlace', async () => {
    const apiHogar = apiHogarFalsa({
      invitar: vi.fn().mockResolvedValue({ ...INVITACION_CORREO, correoEnviado: false }),
      listarInvitaciones: vi
        .fn()
        .mockResolvedValue([{ ...sinEnlace(INVITACION_CORREO), correoEnviado: false }]),
    });
    abrir(apiHogar);
    await invitarPorCorreo('ana@correo.com');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos enviar el correo. Copia el enlace y compártelo tú.',
    );
    expect(screen.getByLabelText('Enlace de invitación')).toHaveValue(INVITACION_CORREO.enlace);
    expect(await screen.findByText(/correo no enviado/)).toBeInTheDocument();
  });

  it('CA-02.2 creo un enlace para compartir: copiar, compartir y WhatsApp', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    const apiHogar = apiHogarFalsa({ invitar: vi.fn().mockResolvedValue(INVITACION_ENLACE) });
    abrir(apiHogar);
    const usuario = userEvent.setup();
    const copiar = vi.spyOn(navigator.clipboard, 'writeText');
    await usuario.click(await screen.findByRole('button', { name: 'Crear enlace para compartir' }));
    expect(apiHogar.invitar).toHaveBeenCalledWith({ medio: 'ENLACE' });
    expect(await screen.findByLabelText('Enlace de invitación')).toHaveValue(
      INVITACION_ENLACE.enlace,
    );
    expect(screen.getByText(/Sirve una sola vez y vence el/)).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Copiar enlace' }));
    expect(copiar).toHaveBeenCalledWith(INVITACION_ENLACE.enlace);
    expect(await screen.findByText('Enlace copiado')).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Compartir…' }));
    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({ url: INVITACION_ENLACE.enlace, title: 'Menú Familiar' }),
    );

    const whatsapp = screen.getByRole('link', { name: 'Enviar por WhatsApp' });
    expect(whatsapp.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/\?text=/);
    expect(decodeURIComponent(whatsapp.getAttribute('href') as string)).toContain(
      `Familia Rosales en Menú Familiar para planificar juntos el menú de la semana: ${INVITACION_ENLACE.enlace}`,
    );
    expect(whatsapp).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('CA-02.2 sin Web Share API ni portapapeles: queda WhatsApp y copiar a mano', async () => {
    const apiHogar = apiHogarFalsa({ invitar: vi.fn().mockResolvedValue(INVITACION_ENLACE) });
    abrir(apiHogar);
    const usuario = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denegado'));
    await usuario.click(await screen.findByRole('button', { name: 'Crear enlace para compartir' }));
    expect(screen.queryByRole('button', { name: 'Compartir…' })).not.toBeInTheDocument();
    await usuario.click(await screen.findByRole('button', { name: 'Copiar enlace' }));
    expect(await screen.findByText(/selecciona el enlace y cópialo/)).toBeInTheDocument();
  });

  it('CA-02.2 compartir cancelado no rompe la pantalla', async () => {
    Object.defineProperty(navigator, 'share', {
      value: vi.fn().mockRejectedValue(new DOMException('cancelado', 'AbortError')),
      configurable: true,
    });
    abrir(apiHogarFalsa({ invitar: vi.fn().mockResolvedValue(INVITACION_ENLACE) }));
    const usuario = userEvent.setup();
    await usuario.click(await screen.findByRole('button', { name: 'Crear enlace para compartir' }));
    await usuario.click(await screen.findByRole('button', { name: 'Compartir…' }));
    expect(screen.getByLabelText('Enlace de invitación')).toBeInTheDocument();
  });

  it('CA-02.3 revocar una invitación pendiente (con confirmación)', async () => {
    const apiHogar = apiHogarFalsa({
      listarInvitaciones: vi
        .fn()
        .mockResolvedValueOnce([
          sinEnlace(INVITACION_ENLACE),
          { ...sinEnlace(INVITACION_CORREO), id: 'i9', estado: 'USADA' },
        ])
        .mockResolvedValue([]),
    });
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValue(true);
    abrir(apiHogar);
    const usuario = userEvent.setup();
    const boton = await screen.findByRole('button', {
      name: 'Revocar invitación: Enlace para compartir',
    });
    // Solo se listan las vigentes.
    expect(screen.getAllByRole('button', { name: /Revocar invitación/ })).toHaveLength(1);
    await usuario.click(boton);
    expect(apiHogar.revocarInvitacion).not.toHaveBeenCalled();
    await usuario.click(boton);
    expect(confirmar).toHaveBeenCalledTimes(2);
    expect(apiHogar.revocarInvitacion).toHaveBeenCalledWith('i2');
    expect(await screen.findByText('Invitación revocada.')).toBeInTheDocument();
    expect(await screen.findByText('No hay invitaciones pendientes.')).toBeInTheDocument();
  });

  it('CA-02.3 revocar el enlace recién creado lo oculta; un error se muestra', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const apiHogar = apiHogarFalsa({
      invitar: vi.fn().mockResolvedValue(INVITACION_ENLACE),
      listarInvitaciones: vi.fn().mockResolvedValue([sinEnlace(INVITACION_ENLACE)]),
      revocarInvitacion: vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValue(
          new ProblemaApi({
            status: 404,
            codigo: 'NO_ENCONTRADO',
            detail: 'La invitación no existe.',
          }),
        ),
    });
    abrir(apiHogar);
    const usuario = userEvent.setup();
    await usuario.click(await screen.findByRole('button', { name: 'Crear enlace para compartir' }));
    await screen.findByLabelText('Enlace de invitación');
    const revocar = () =>
      usuario.click(
        screen.getByRole('button', { name: 'Revocar invitación: Enlace para compartir' }),
      );
    await revocar();
    await waitFor(() => expect(screen.queryByLabelText('Enlace de invitación')).toBeNull());
    await revocar();
    expect(await screen.findByRole('alert')).toHaveTextContent('La invitación no existe.');
  });

  it('RN-10 un Miembro ve el hogar pero no las acciones de administrador', async () => {
    const apiHogar = apiHogarFalsa();
    abrir(apiHogar, apiFalsa({ restaurar: vi.fn().mockResolvedValue(SESION_MIEMBRO) }));
    expect(
      await screen.findByRole('heading', { name: 'Miembros de Familia Rosales' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Solo el administrador del hogar puede invitar a más personas.'),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Correo de la persona a invitar')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Crear enlace para compartir' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Invitaciones pendientes' })).toBeNull();
    expect(apiHogar.listarInvitaciones).not.toHaveBeenCalled();
  });

  it('errores de carga e inesperados se muestran en español', async () => {
    const apiHogar = apiHogarFalsa({
      obtenerHogar: vi.fn().mockRejectedValue(new Error('x')),
    });
    abrir(apiHogar);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ocurrió un error inesperado. Intenta de nuevo más tarde.',
    );
  });

  it('un error al invitar por enlace se muestra como alerta', async () => {
    const apiHogar = apiHogarFalsa({
      invitar: vi.fn().mockRejectedValue(
        new ProblemaApi({
          status: 403,
          codigo: 'SOLO_ADMINISTRADOR',
          detail: 'Solo el administrador del hogar puede hacer esta acción',
        }),
      ),
    });
    abrir(apiHogar);
    await userEvent
      .setup()
      .click(await screen.findByRole('button', { name: 'Crear enlace para compartir' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Solo el administrador del hogar puede hacer esta acción',
    );
  });

  it('se llega desde Configuración → "Hogar y usuarios"', async () => {
    renderizarApp('/configuracion', comoAdmin());
    expect(await screen.findByText('Familia Rosales · Administrador')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('link', { name: 'Hogar y usuarios' }));
    await waitFor(() => expect(window.location.pathname).toBe(RUTA));
  });
});
