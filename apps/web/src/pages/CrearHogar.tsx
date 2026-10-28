import { useState, type FormEvent } from 'react';
import { useHistory } from 'react-router-dom';
import { LARGO_MAXIMO_NOMBRE_HOGAR, MENSAJES_HOGAR } from '@menu/shared';
import { ProblemaApi, mensajeDeError } from '../api';
import { useApiHogar } from '../api/contexto-hogar';
import { useAuth } from '../auth/contexto';
import { BotonCerrarSesion } from './BotonCerrarSesion';
import { CampoTexto } from './CampoTexto';
import { PaginaAcceso } from './PaginaAcceso';

/** Ruta a la que se va tras crear el hogar para invitar a la familia (CU-01.2 paso 3). */
export const RUTA_HOGAR = '/configuracion/hogar';

/** Pantalla "Crear hogar" (HU-02 · CU-01.2 pasos 1–2). */
export default function CrearHogar() {
  const { usuario, entrarAlHogar } = useAuth();
  const api = useApiHogar();
  const history = useHistory();
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [alerta, setAlerta] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setAlerta(null);
    const limpio = nombre.trim().replace(/\s+/g, ' ');
    if (!limpio) {
      setError(MENSAJES_HOGAR.nombreObligatorio);
      return;
    }
    setError(undefined);
    setEnviando(true);
    try {
      const respuesta = await api.crearHogar(limpio);
      entrarAlHogar(respuesta.hogar);
      history.replace(RUTA_HOGAR, { recienCreado: true });
    } catch (e) {
      setEnviando(false);
      if (e instanceof ProblemaApi && e.errorDe('nombre')) {
        setError(e.errorDe('nombre'));
        return;
      }
      setAlerta(mensajeDeError(e));
    }
  }

  return (
    <PaginaAcceso
      titulo="Crear hogar"
      intro={`¡Hola, ${usuario?.nombre ?? ''}! Crea tu hogar para planificar el menú y las compras con tu familia.`}
      pie={<BotonCerrarSesion />}
    >
      <form noValidate onSubmit={enviar} aria-label="Crear hogar">
        {alerta && (
          <div className="mf-alerta" role="alert">
            <p>{alerta}</p>
          </div>
        )}
        <CampoTexto
          etiqueta="Nombre del hogar"
          name="nombre"
          placeholder="Familia Rosales"
          autoComplete="off"
          maxLength={LARGO_MAXIMO_NOMBRE_HOGAR}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          ayuda={
            error
              ? undefined
              : 'Empezamos con solo almuerzo, presupuesto de Q250 a la semana y semana de domingo a sábado. Puedes cambiarlo después.'
          }
          error={error}
          required
        />
        <button className="mf-boton mf-boton--primario" type="submit" disabled={enviando}>
          {enviando ? 'Creando hogar…' : 'Crear hogar'}
        </button>
      </form>
      <p className="mf-acceso__nota">
        ¿Te invitaron a un hogar? Abre el enlace que te enviaron por correo o WhatsApp.
      </p>
    </PaginaAcceso>
  );
}
