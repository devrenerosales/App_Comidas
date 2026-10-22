/** Endpoints del hogar e invitaciones (M01 · HU-02, api-contrato §2.1). */
import type { MedioInvitacion } from '@menu/shared';
import type { ClienteHttp } from './cliente';
import type {
  Invitacion,
  InvitacionCreada,
  InvitacionPublica,
  RespuestaUnionHogar,
  VistaHogar,
} from './tipos';

export interface DatosInvitar {
  medio: MedioInvitacion;
  correo?: string;
}

/** Codifica el token para la ruta (base64url ya es seguro, pero el enlace podría venir editado). */
const ruta = (token: string) => `/invitaciones/${encodeURIComponent(token)}`;

export function crearApiHogar(cliente: Pick<ClienteHttp, 'peticion' | 'establecerAcceso'>) {
  /** Crear y aceptar devuelven un token nuevo con `hogarId`: se usa desde ya. */
  const usarToken = (respuesta: RespuestaUnionHogar) => {
    cliente.establecerAcceso(respuesta.accessToken);
    return respuesta;
  };
  return {
    crearHogar: (nombre: string) =>
      cliente
        .peticion<RespuestaUnionHogar>('/hogares', { metodo: 'POST', cuerpo: { nombre } })
        .then(usarToken),
    obtenerHogar: () => cliente.peticion<VistaHogar>('/hogar'),
    invitar: (datos: DatosInvitar) =>
      cliente.peticion<InvitacionCreada>('/hogar/invitaciones', { metodo: 'POST', cuerpo: datos }),
    listarInvitaciones: () => cliente.peticion<Invitacion[]>('/hogar/invitaciones'),
    revocarInvitacion: (id: string) =>
      cliente.peticion<void>(`/hogar/invitaciones/${encodeURIComponent(id)}`, {
        metodo: 'DELETE',
      }),
    /** Público: no necesita sesión. */
    verInvitacion: (token: string) =>
      cliente.peticion<InvitacionPublica>(ruta(token), { autenticar: false }),
    aceptarInvitacion: (token: string) =>
      cliente
        .peticion<RespuestaUnionHogar>(`${ruta(token)}/aceptar`, { metodo: 'POST' })
        .then(usarToken),
  };
}

export type ApiHogar = ReturnType<typeof crearApiHogar>;
