import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { cumplePoliticaContrasena, MENSAJE_POLITICA_CONTRASENA } from '@menu/shared';
import { apiAuth, mensajeDeError, ProblemaApi } from '../api';
import type { ApiAuth } from '../api/auth';
import { CampoTexto } from './CampoTexto';
import { PaginaAcceso } from './PaginaAcceso';

export default function RestablecerContrasena({
  api = apiAuth,
}: {
  api?: Pick<ApiAuth, 'restablecer' | 'validarRecuperacion'>;
}) {
  const { token } = useParams<{ token: string }>();
  const [contrasena, setContrasena] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [terminado, setTerminado] = useState(false);
  const [invalido, setInvalido] = useState(!/^[A-Za-z0-9_-]{43}$/.test(token));
  const [error, setError] = useState<string | null>(null);
  const [validando, setValidando] = useState(true);
  const [vigente, setVigente] = useState(false);
  useEffect(() => {
    let activo = true;
    setTerminado(false);
    setError(null);
    setVigente(false);
    setContrasena('');
    setConfirmacion('');
    const formatoValido = /^[A-Za-z0-9_-]{43}$/.test(token);
    setInvalido(!formatoValido);
    setValidando(formatoValido);
    if (formatoValido) {
      api
        .validarRecuperacion(token)
        .then(() => {
          if (activo) setVigente(true);
        })
        .catch((e: unknown) => {
          if (!activo) return;
          if (e instanceof ProblemaApi && e.codigo === 'ENLACE_NO_VALIDO') setInvalido(true);
          else setError(mensajeDeError(e));
        })
        .finally(() => {
          if (activo) setValidando(false);
        });
    }
    return () => {
      activo = false;
    };
  }, [token, api]);
  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setError(null);
    if (!cumplePoliticaContrasena(contrasena)) {
      setError(MENSAJE_POLITICA_CONTRASENA);
      return;
    }
    if (contrasena !== confirmacion) {
      setError('Las contraseñas no coinciden');
      return;
    }
    setEnviando(true);
    try {
      await api.restablecer(token, contrasena, confirmacion);
      setTerminado(true);
    } catch (e) {
      if (e instanceof ProblemaApi && e.codigo === 'ENLACE_NO_VALIDO') setInvalido(true);
      else setError(mensajeDeError(e));
    } finally {
      setEnviando(false);
    }
  }
  return (
    <PaginaAcceso
      titulo={terminado ? 'Contraseña actualizada' : 'Nueva contraseña'}
      intro={
        terminado
          ? 'Tus sesiones anteriores se cerraron. Inicia sesión con tu nueva contraseña.'
          : 'Elige una contraseña para recuperar el acceso a tu cuenta.'
      }
      pie={
        <Link className="mf-enlace" to="/login">
          Iniciar sesión
        </Link>
      }
    >
      {validando ? (
        <p role="status">Comprobando enlace…</p>
      ) : invalido ? (
        <div role="alert">
          <p>El enlace no es válido, solicita uno nuevo</p>
          <Link className="mf-enlace" to="/recuperar">
            Solicitar otro enlace
          </Link>
        </div>
      ) : (
        !terminado &&
        (!vigente ? (
          <p role="alert">{error}</p>
        ) : (
          <form noValidate onSubmit={enviar} aria-label="Restablecer contraseña">
            {error && (
              <p role="alert" className="mf-alerta">
                {error}
              </p>
            )}
            <CampoTexto
              etiqueta="Nueva contraseña"
              type="password"
              autoComplete="new-password"
              required
              ayuda={MENSAJE_POLITICA_CONTRASENA}
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
            />
            <CampoTexto
              etiqueta="Confirmar contraseña"
              type="password"
              autoComplete="new-password"
              required
              value={confirmacion}
              onChange={(e) => setConfirmacion(e.target.value)}
            />
            <button className="mf-boton mf-boton--primario" disabled={enviando} type="submit">
              {enviando ? 'Guardando…' : 'Guardar contraseña'}
            </button>
          </form>
        ))
      )}
    </PaginaAcceso>
  );
}
