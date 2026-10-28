import { useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ProblemaApi, mensajeDeError } from '../api';
import { useAuth } from '../auth/contexto';
import { CampoTexto } from './CampoTexto';
import { PaginaAcceso } from './PaginaAcceso';

interface EstadoRuta {
  desde?: string;
  correo?: string;
}

const formatoHora = new Intl.DateTimeFormat('es-GT', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'America/Guatemala',
});

function mensajeLogin(error: unknown): string {
  if (error instanceof ProblemaApi && error.codigo === 'CUENTA_BLOQUEADA') {
    const hasta = error.cuerpo.bloqueadoHasta;
    if (typeof hasta === 'string') {
      return `${error.message} Podrás intentarlo de nuevo a las ${formatoHora.format(new Date(hasta))}.`;
    }
  }
  return mensajeDeError(error);
}

/** Pantalla "Iniciar sesión" (HU-01 · CU-01.1 pasos 7–9). */
export default function IniciarSesion() {
  const { iniciarSesion } = useAuth();
  const location = useLocation<EstadoRuta | undefined>();
  const [correo, setCorreo] = useState(location.state?.correo ?? '');
  const [contrasena, setContrasena] = useState('');
  const [errores, setErrores] = useState<{ correo?: string; contrasena?: string }>({});
  const [alerta, setAlerta] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    const nuevos = {
      correo: correo.trim() ? undefined : 'Ingresa tu correo',
      contrasena: contrasena ? undefined : 'Ingresa tu contraseña',
    };
    setErrores(nuevos);
    setAlerta(null);
    if (nuevos.correo || nuevos.contrasena) return;
    setEnviando(true);
    try {
      // Al iniciar sesión, la ruta de visitante redirige a "Crear hogar" o a Inicio.
      await iniciarSesion(correo.trim(), contrasena);
    } catch (error) {
      setAlerta(mensajeLogin(error));
      setEnviando(false);
    }
  }

  return (
    <PaginaAcceso
      titulo="Iniciar sesión"
      intro="Entra para ver el menú de la semana y la lista de compras de tu hogar."
      pie={
        <>
          ¿Aún no tienes cuenta?{' '}
          <Link className="mf-enlace" to={{ pathname: '/registro', state: location.state }}>
            Crear cuenta
          </Link>
        </>
      }
    >
      <form noValidate onSubmit={enviar} aria-label="Iniciar sesión">
        {alerta && (
          <div className="mf-alerta" role="alert">
            <p>{alerta}</p>
          </div>
        )}
        <CampoTexto
          etiqueta="Correo"
          type="email"
          name="correo"
          autoComplete="email"
          inputMode="email"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          error={errores.correo}
          required
        />
        <CampoTexto
          etiqueta="Contraseña"
          type="password"
          name="contrasena"
          autoComplete="current-password"
          value={contrasena}
          onChange={(e) => setContrasena(e.target.value)}
          error={errores.contrasena}
          required
        />
        <button className="mf-boton mf-boton--primario" type="submit" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
        <p>
          <Link className="mf-enlace" to="/recuperar">
            ¿Olvidaste tu contraseña?
          </Link>
        </p>
      </form>
    </PaginaAcceso>
  );
}
