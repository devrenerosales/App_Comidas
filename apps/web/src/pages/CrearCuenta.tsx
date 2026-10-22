import { useState, type FormEvent } from 'react';
import { Link, useHistory, useLocation } from 'react-router-dom';
import {
  LARGO_MAXIMO_CORREO,
  LARGO_MAXIMO_NOMBRE,
  MENSAJE_POLITICA_CONTRASENA,
  cumplePoliticaContrasena,
} from '@menu/shared';
import { ProblemaApi, mensajeDeError } from '../api';
import { useAuth } from '../auth/contexto';
import { CampoTexto } from './CampoTexto';
import { PaginaAcceso } from './PaginaAcceso';

type Campo = 'nombre' | 'correo' | 'contrasena';
type Errores = Partial<Record<Campo, string>>;

const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validar(nombre: string, correo: string, contrasena: string): Errores {
  return {
    nombre: nombre.trim() ? undefined : 'Ingresa tu nombre',
    correo: CORREO_VALIDO.test(correo.trim()) ? undefined : 'Ingresa un correo válido',
    contrasena: cumplePoliticaContrasena(contrasena) ? undefined : MENSAJE_POLITICA_CONTRASENA,
  };
}

/** Pantalla "Crear cuenta" (HU-01 · CU-01.1 pasos 1–6). */
export default function CrearCuenta() {
  const { registrar } = useAuth();
  const history = useHistory();
  // Si viene de un enlace de invitación, al volver a "Iniciar sesión" conserva a dónde regresar.
  const location = useLocation<{ desde?: string } | undefined>();
  const desde = location.state?.desde;
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [errores, setErrores] = useState<Errores>({});
  const [alerta, setAlerta] = useState<string | null>(null);
  const [correoRegistrado, setCorreoRegistrado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    const nuevos = validar(nombre, correo, contrasena);
    setErrores(nuevos);
    setAlerta(null);
    setCorreoRegistrado(false);
    if (Object.values(nuevos).some(Boolean)) return;
    setEnviando(true);
    try {
      // Con la sesión iniciada, la ruta de visitante lleva a "Crear hogar" (CA-01.1).
      await registrar({ nombre: nombre.trim(), correo: correo.trim(), contrasena });
    } catch (error) {
      setEnviando(false);
      if (error instanceof ProblemaApi && error.codigo === 'CORREO_REGISTRADO') {
        setCorreoRegistrado(true);
        setAlerta(error.message);
        return;
      }
      if (error instanceof ProblemaApi && error.errores.length > 0) {
        setErrores({
          nombre: error.errorDe('nombre'),
          correo: error.errorDe('correo'),
          contrasena: error.errorDe('contrasena'),
        });
        return;
      }
      setAlerta(mensajeDeError(error));
    }
  }

  return (
    <PaginaAcceso
      titulo="Crear cuenta"
      intro="Crea tu cuenta para planificar el menú y las compras con tu familia."
      pie={
        <>
          ¿Ya tienes cuenta?{' '}
          <Link className="mf-enlace" to={{ pathname: '/login', state: location.state }}>
            Iniciar sesión
          </Link>
        </>
      }
    >
      <form noValidate onSubmit={enviar} aria-label="Crear cuenta">
        {alerta && (
          <div className="mf-alerta" role="alert">
            <p>{alerta}</p>
            {correoRegistrado && (
              <button
                type="button"
                className="mf-boton mf-boton--secundario"
                onClick={() => history.push('/login', { correo: correo.trim(), desde })}
              >
                Iniciar sesión
              </button>
            )}
          </div>
        )}
        <CampoTexto
          etiqueta="Nombre"
          name="nombre"
          autoComplete="given-name"
          maxLength={LARGO_MAXIMO_NOMBRE}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          error={errores.nombre}
          required
        />
        <CampoTexto
          etiqueta="Correo"
          type="email"
          name="correo"
          autoComplete="email"
          inputMode="email"
          maxLength={LARGO_MAXIMO_CORREO}
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          error={errores.correo}
          required
        />
        <CampoTexto
          etiqueta="Contraseña"
          type="password"
          name="contrasena"
          autoComplete="new-password"
          value={contrasena}
          onChange={(e) => setContrasena(e.target.value)}
          ayuda={
            errores.contrasena
              ? undefined
              : 'Mínimo 8 caracteres, con al menos una letra y un número.'
          }
          error={errores.contrasena}
          required
        />
        <button className="mf-boton mf-boton--primario" type="submit" disabled={enviando}>
          {enviando ? 'Creando cuenta…' : 'Crear cuenta'}
        </button>
      </form>
    </PaginaAcceso>
  );
}
