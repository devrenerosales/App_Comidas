import { useEffect, useState } from 'react';
import { Link, useHistory, useParams } from 'react-router-dom';
import { MENSAJES_HOGAR } from '@menu/shared';
import { ProblemaApi, mensajeDeError, type InvitacionPublica } from '../api';
import { useApiHogar } from '../api/contexto-hogar';
import { Cargando } from '../auth/Cargando';
import { RUTA_INVITACION, useAuth } from '../auth/contexto';
import { PaginaAcceso } from './PaginaAcceso';
import { fechaHora } from './formato';
import './hogar.css';

type Estado =
  | { tipo: 'cargando' }
  | { tipo: 'no_valida'; mensaje: string }
  | { tipo: 'lista'; invitacion: InvitacionPublica };

/**
 * Pantalla "Aceptar invitación" en /invitacion/:token (HU-02 · CU-01.2 pasos 6–7). Sin sesión
 * pasa por "Iniciar sesión" o "Crear cuenta" y vuelve aquí; con sesión y sin hogar se une.
 */
export default function AceptarInvitacion() {
  const { token } = useParams<{ token: string }>();
  const { estado: sesion, hogar, entrarAlHogar } = useAuth();
  const api = useApiHogar();
  const history = useHistory();
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' });
  const [alerta, setAlerta] = useState<string | null>(null);
  const [uniendo, setUniendo] = useState(false);
  const volver = { desde: `${RUTA_INVITACION}${token}` };

  useEffect(() => {
    let activo = true;
    api
      .verInvitacion(token)
      .then((invitacion) => activo && setEstado({ tipo: 'lista', invitacion }))
      .catch((error: unknown) => {
        if (!activo) return;
        const mensaje =
          error instanceof ProblemaApi && error.status === 410
            ? MENSAJES_HOGAR.invitacionNoValida
            : mensajeDeError(error);
        setEstado({ tipo: 'no_valida', mensaje });
      });
    return () => {
      activo = false;
    };
  }, [api, token]);

  async function unirme() {
    setAlerta(null);
    setUniendo(true);
    try {
      const respuesta = await api.aceptarInvitacion(token);
      entrarAlHogar(respuesta.hogar);
      history.replace('/inicio');
    } catch (error) {
      setUniendo(false);
      if (error instanceof ProblemaApi && error.status === 410) {
        setEstado({ tipo: 'no_valida', mensaje: MENSAJES_HOGAR.invitacionNoValida });
        return;
      }
      setAlerta(mensajeDeError(error));
    }
  }

  if (estado.tipo === 'cargando' || sesion === 'cargando') return <Cargando />;

  if (estado.tipo === 'no_valida') {
    return (
      <PaginaAcceso
        titulo="Invitación"
        intro="Pide al administrador de tu hogar que te envíe una invitación nueva."
      >
        <div className="mf-alerta" role="alert">
          <p>{estado.mensaje}</p>
        </div>
        <Link className="mf-boton mf-boton--secundario" to={sesion === 'anonimo' ? '/login' : '/'}>
          {sesion === 'anonimo' ? 'Ir a iniciar sesión' : 'Ir al inicio'}
        </Link>
      </PaginaAcceso>
    );
  }

  const { invitacion } = estado;
  return (
    <PaginaAcceso
      titulo={`Únete a ${invitacion.hogarNombre}`}
      intro={`${invitacion.invitadoPor} te invitó a planificar juntos el menú y la lista de compras.`}
    >
      <p className="mf-texto-suave">
        La invitación sirve una sola vez y vence el {fechaHora(invitacion.venceEn)}.
        {invitacion.correo && ` Es para la cuenta ${invitacion.correo}.`}
      </p>
      {alerta && (
        <div className="mf-alerta" role="alert">
          <p>{alerta}</p>
        </div>
      )}
      {sesion === 'anonimo' && (
        <>
          <p>Para unirte, entra con tu cuenta o crea una nueva.</p>
          <div className="mf-acciones">
            <button
              type="button"
              className="mf-boton mf-boton--primario"
              onClick={() => history.push('/login', volver)}
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              className="mf-boton mf-boton--secundario"
              onClick={() => history.push('/registro', volver)}
            >
              Crear cuenta
            </button>
          </div>
        </>
      )}
      {sesion === 'autenticado' && hogar && (
        <>
          <div className="mf-alerta" role="alert">
            <p>{MENSAJES_HOGAR.yaTieneHogar}</p>
          </div>
          <Link className="mf-boton mf-boton--secundario" to="/inicio">
            Ir al inicio
          </Link>
        </>
      )}
      {sesion === 'autenticado' && !hogar && (
        <button
          type="button"
          className="mf-boton mf-boton--primario"
          onClick={unirme}
          disabled={uniendo}
        >
          {uniendo ? 'Uniéndote…' : `Unirme a ${invitacion.hogarNombre}`}
        </button>
      )}
    </PaginaAcceso>
  );
}
