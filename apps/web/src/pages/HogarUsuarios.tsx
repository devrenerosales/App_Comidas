import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import {
  EstadoInvitacion,
  LARGO_MAXIMO_CORREO,
  MedioInvitacion,
  MENSAJES_HOGAR,
  Rol,
} from '@menu/shared';
import {
  ProblemaApi,
  mensajeDeError,
  type Invitacion,
  type InvitacionCreada,
  type VistaHogar,
} from '../api';
import { useApiHogar } from '../api/contexto-hogar';
import { Cargando } from '../auth/Cargando';
import { useAuth } from '../auth/contexto';
import { CampoTexto } from './CampoTexto';
import { EnlaceInvitacion } from './EnlaceInvitacion';
import { PaginaBase } from './PaginaBase';
import { fechaHora } from './formato';
import './acceso.css';
import './hogar.css';

const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const NOMBRE_ROL: Readonly<Record<Rol, string>> = {
  ADMIN: 'Administrador',
  MIEMBRO: 'Miembro',
};

/**
 * Pantalla "Hogar y usuarios" (HU-02 · CU-01.2 pasos 3–5): miembros del hogar y, solo para el
 * administrador (RN-10), invitar por correo, crear un enlace para compartir y revocar
 * invitaciones pendientes. Los comensales llegan con HU-03.
 */
export default function HogarUsuarios() {
  const { hogar: sesionHogar } = useAuth();
  const api = useApiHogar();
  const location = useLocation<{ recienCreado?: boolean } | undefined>();
  const esAdmin = sesionHogar?.rol === Rol.ADMIN;

  const [hogar, setHogar] = useState<VistaHogar | null>(null);
  const [pendientes, setPendientes] = useState<Invitacion[]>([]);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [correo, setCorreo] = useState('');
  const [errorCorreo, setErrorCorreo] = useState<string | undefined>();
  const [alerta, setAlerta] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(
    location.state?.recienCreado
      ? '¡Listo! Tu hogar está creado. Ahora invita a tu familia por correo o con un enlace.'
      : null,
  );
  const [creada, setCreada] = useState<InvitacionCreada | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const cargarPendientes = useCallback(async () => {
    if (!esAdmin) return;
    const lista = await api.listarInvitaciones();
    setPendientes(lista.filter((i) => i.estado === EstadoInvitacion.VIGENTE));
  }, [api, esAdmin]);

  useEffect(() => {
    let activo = true;
    Promise.all([api.obtenerHogar(), cargarPendientes()])
      .then(([vista]) => activo && setHogar(vista))
      .catch((error: unknown) => activo && setErrorCarga(mensajeDeError(error)));
    return () => {
      activo = false;
    };
  }, [api, cargarPendientes]);

  async function invitar(medio: MedioInvitacion) {
    setAlerta(null);
    setAviso(null);
    setCreada(null);
    if (medio === MedioInvitacion.CORREO) {
      const limpio = correo.trim();
      if (!CORREO_VALIDO.test(limpio)) {
        setErrorCorreo('Ingresa un correo válido');
        return;
      }
      setErrorCorreo(undefined);
    }
    setOcupado(true);
    try {
      const nueva = await api.invitar(
        medio === MedioInvitacion.CORREO ? { medio, correo: correo.trim() } : { medio },
      );
      if (medio === MedioInvitacion.CORREO) {
        if (nueva.correoEnviado) {
          setAviso(
            `Enviamos la invitación a ${nueva.correo}. Vence el ${fechaHora(nueva.venceEn)}.`,
          );
        } else {
          setAlerta(MENSAJES_HOGAR.correoNoEnviado);
          setCreada(nueva);
        }
        setCorreo('');
      } else {
        setCreada(nueva);
      }
      await cargarPendientes();
    } catch (error) {
      if (error instanceof ProblemaApi && error.codigo === 'YA_ES_MIEMBRO') {
        setErrorCorreo(error.message);
      } else if (error instanceof ProblemaApi && error.errorDe('correo')) {
        setErrorCorreo(error.errorDe('correo'));
      } else {
        setAlerta(mensajeDeError(error));
      }
    } finally {
      setOcupado(false);
    }
  }

  async function revocar(invitacion: Invitacion) {
    if (!window.confirm('¿Revocar esta invitación? El enlace dejará de funcionar.')) return;
    setAlerta(null);
    try {
      await api.revocarInvitacion(invitacion.id);
      if (creada?.id === invitacion.id) setCreada(null);
      setAviso('Invitación revocada.');
      await cargarPendientes();
    } catch (error) {
      setAlerta(mensajeDeError(error));
    }
  }

  function enviarCorreo(evento: FormEvent) {
    evento.preventDefault();
    void invitar(MedioInvitacion.CORREO);
  }

  if (!hogar && !errorCarga) {
    return (
      <PaginaBase titulo="Hogar y usuarios">
        <Cargando />
      </PaginaBase>
    );
  }

  return (
    <PaginaBase titulo="Hogar y usuarios">
      <div className="mf-hogar">
        {errorCarga && (
          <div className="mf-alerta" role="alert">
            <p>{errorCarga}</p>
          </div>
        )}
        {aviso && (
          <div className="mf-aviso" role="status">
            <p>{aviso}</p>
          </div>
        )}
        {alerta && (
          <div className="mf-alerta" role="alert">
            <p>{alerta}</p>
          </div>
        )}

        {hogar && (
          <section className="mf-tarjeta" aria-labelledby="titulo-miembros">
            <h2 id="titulo-miembros">Miembros de {hogar.nombre}</h2>
            <ul className="mf-lista">
              {hogar.miembros.map((m) => (
                <li key={m.usuarioId}>
                  <span className="mf-lista__datos">
                    <strong>{m.nombre}</strong>
                    <span>{m.correo}</span>
                  </span>
                  <span
                    className={
                      m.rol === Rol.ADMIN ? 'mf-etiqueta' : 'mf-etiqueta mf-etiqueta--miembro'
                    }
                  >
                    {NOMBRE_ROL[m.rol]}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {hogar && esAdmin && (
          <section className="mf-tarjeta" aria-labelledby="titulo-invitar">
            <h2 id="titulo-invitar">Invitar a tu familia</h2>
            <form noValidate onSubmit={enviarCorreo} aria-label="Invitar por correo">
              <CampoTexto
                etiqueta="Correo de la persona a invitar"
                type="email"
                name="correo"
                autoComplete="email"
                inputMode="email"
                placeholder="ana@correo.com"
                maxLength={LARGO_MAXIMO_CORREO}
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                error={errorCorreo}
              />
              <button className="mf-boton mf-boton--primario" type="submit" disabled={ocupado}>
                {ocupado ? 'Enviando…' : 'Enviar invitación por correo'}
              </button>
            </form>
            <p className="mf-separador">o</p>
            <button
              type="button"
              className="mf-boton mf-boton--secundario"
              style={{ width: '100%' }}
              onClick={() => void invitar(MedioInvitacion.ENLACE)}
              disabled={ocupado}
            >
              Crear enlace para compartir
            </button>
            {creada && (
              <EnlaceInvitacion
                enlace={creada.enlace}
                hogarNombre={hogar.nombre}
                vence={fechaHora(creada.venceEn)}
              />
            )}
          </section>
        )}

        {hogar && esAdmin && (
          <section className="mf-tarjeta" aria-labelledby="titulo-pendientes">
            <h2 id="titulo-pendientes">Invitaciones pendientes</h2>
            {pendientes.length === 0 ? (
              <p className="mf-texto-suave">No hay invitaciones pendientes.</p>
            ) : (
              <ul className="mf-lista">
                {pendientes.map((inv) => {
                  const destino = inv.correo ?? 'Enlace para compartir';
                  return (
                    <li key={inv.id}>
                      <span className="mf-lista__datos">
                        <strong>{destino}</strong>
                        <span>
                          Vence el {fechaHora(inv.venceEn)}
                          {inv.medio === MedioInvitacion.CORREO &&
                            !inv.correoEnviado &&
                            ' · correo no enviado'}
                        </span>
                      </span>
                      <button
                        type="button"
                        className="mf-boton mf-boton--peligro"
                        aria-label={`Revocar invitación: ${destino}`}
                        onClick={() => void revocar(inv)}
                      >
                        Revocar
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        {hogar && !esAdmin && (
          <p className="mf-texto-suave">
            Solo el administrador del hogar puede invitar a más personas.
          </p>
        )}

        <section className="mf-tarjeta" aria-labelledby="titulo-comensales">
          <h2 id="titulo-comensales">Comensales</h2>
          <p className="mf-texto-suave">
            Próximamente: registra quiénes comen en casa y su porción.
          </p>
        </section>
      </div>
    </PaginaBase>
  );
}
