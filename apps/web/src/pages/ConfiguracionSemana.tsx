import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ProblemaApi, mensajeDeError } from '../api';
import { useApiConfiguracion } from '../api/contexto-configuracion';
import type {
  CalendarioSemana,
  ConfiguracionSemana as Configuracion,
  DiaSemana,
} from '../api/configuracion';
import { useAuth } from '../auth/contexto';
import { Cargando } from '../auth/Cargando';
import { PaginaBase } from './PaginaBase';
import './acceso.css';
import './hogar.css';
import './configuracion.css';

const DIAS: [DiaSemana, string][] = [
  ['LUNES', 'Lunes'],
  ['MARTES', 'Martes'],
  ['MIERCOLES', 'Miércoles'],
  ['JUEVES', 'Jueves'],
  ['VIERNES', 'Viernes'],
  ['SABADO', 'Sábado'],
  ['DOMINGO', 'Domingo'],
];
const formato = new Intl.DateTimeFormat('es-GT', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const fecha = (dia: string) => formato.format(new Date(`${dia}T00:00:00Z`));

function Calendario({ datos, hora }: { datos: CalendarioSemana; hora: number }) {
  return (
    <section aria-label="Fechas de la semana" className="mf-tarjeta">
      {datos.semanaTransicion && (
        <p>
          <strong>Semana de transición: </strong>
          <time dateTime={datos.semanaTransicion.desde}>{fecha(datos.semanaTransicion.desde)}</time>
          {datos.semanaTransicion.desde !== datos.semanaTransicion.hasta && (
            <>
              {' '}
              al{' '}
              <time dateTime={datos.semanaTransicion.hasta}>
                {fecha(datos.semanaTransicion.hasta)}
              </time>
            </>
          )}
          . Es una semana corta para conservar los menús aprobados.
        </p>
      )}
      <p>
        <strong>Próxima semana: </strong>
        <time dateTime={datos.proximaSemana.desde}>{fecha(datos.proximaSemana.desde)}</time>
        {' al '}
        <time dateTime={datos.proximaSemana.hasta}>{fecha(datos.proximaSemana.hasta)}</time>.
      </p>
      <p>
        <strong>Próxima planificación: </strong>
        <time dateTime={datos.proximaPlanificacion}>{fecha(datos.proximaPlanificacion)}</time>
        {' a las '}
        {String(hora).padStart(2, '0')}:00 (hora de Guatemala).
      </p>
    </section>
  );
}

export default function ConfiguracionSemana() {
  const api = useApiConfiguracion();
  const { hogar } = useAuth();
  const admin = hogar?.rol === 'ADMIN';
  const [config, setConfig] = useState<Configuracion | null>(null);
  const [inicio, setInicio] = useState<DiaSemana>('DOMINGO');
  const [planificacion, setPlanificacion] = useState<DiaSemana>('DOMINGO');
  const [previa, setPrevia] = useState<CalendarioSemana | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  function aplicar(c: Configuracion) {
    setConfig(c);
    setInicio(c.diaInicioSemana as DiaSemana);
    setPlanificacion(c.diaPlanificacion as DiaSemana);
    setPrevia(null);
  }
  useEffect(() => {
    let activo = true;
    setError(null);
    api
      .obtenerSemana()
      .then((c) => {
        if (activo) aplicar(c);
      })
      .catch((e: unknown) => {
        if (activo) setError(mensajeDeError(e));
      });
    return () => {
      activo = false;
    };
  }, [api, intento]);

  async function ejecutar(guardar: boolean) {
    if (!config || !admin) return;
    setOcupado(true);
    setError(null);
    setMensaje(null);
    const datos = {
      version: config.version,
      diaInicioSemana: inicio,
      diaPlanificacion: planificacion,
    };
    try {
      if (guardar) {
        aplicar(await api.guardarSemana(datos));
        setMensaje('Configuración de semana guardada');
      } else setPrevia(await api.vistaPreviaSemana(datos));
    } catch (e) {
      setError(mensajeDeError(e));
      if (e instanceof ProblemaApi && e.codigo === 'VERSION_DESACTUALIZADA') {
        setPrevia(null);
        try {
          aplicar(await api.obtenerSemana());
        } catch {
          /* Conserva el aviso y permite reintentar. */
        }
      }
    } finally {
      setOcupado(false);
    }
  }
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    void ejecutar(false);
  };
  const cambio = () => {
    setPrevia(null);
    setMensaje(null);
  };
  return (
    <PaginaBase titulo="Configurar la semana">
      <div className="mf-hogar">
        <Link className="mf-enlace" to="/configuracion">
          Volver a Configuración
        </Link>
        {error && (
          <div className="mf-alerta" role="alert">
            <p>{error}</p>
            {!config && (
              <button
                type="button"
                className="mf-boton mf-boton--secundario"
                onClick={() => setIntento((n) => n + 1)}
              >
                Reintentar
              </button>
            )}
          </div>
        )}
        {!config ? (
          !error && <Cargando />
        ) : (
          <>
            {!admin && <p role="status">Solo el administrador puede cambiar esta configuración</p>}
            {mensaje && <p role="status">{mensaje}</p>}
            <form onSubmit={enviar} aria-label="Configuración de semana">
              <div className="mf-campo">
                <label htmlFor="dia-inicio">Día de inicio de semana</label>
                <select
                  id="dia-inicio"
                  value={inicio}
                  disabled={!admin || ocupado}
                  onChange={(e) => {
                    setInicio(e.target.value as DiaSemana);
                    cambio();
                  }}
                >
                  {DIAS.map(([valor, nombre]) => (
                    <option key={valor} value={valor}>
                      {nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mf-campo">
                <label htmlFor="dia-planificacion">Día de planificación</label>
                <select
                  id="dia-planificacion"
                  value={planificacion}
                  disabled={!admin || ocupado}
                  onChange={(e) => {
                    setPlanificacion(e.target.value as DiaSemana);
                    cambio();
                  }}
                >
                  {DIAS.map(([valor, nombre]) => (
                    <option key={valor} value={valor}>
                      {nombre}
                    </option>
                  ))}
                </select>
              </div>
              {admin && (
                <button type="submit" className="mf-boton mf-boton--secundario" disabled={ocupado}>
                  {ocupado ? 'Procesando…' : 'Ver fechas'}
                </button>
              )}
            </form>
            <h2>{previa ? 'Vista previa' : 'Calendario vigente'}</h2>
            <Calendario datos={previa ?? config} hora={config.horaPlanificacion} />
            {previa && admin && (
              <button
                type="button"
                className="mf-boton mf-boton--primario"
                disabled={ocupado}
                onClick={() => void ejecutar(true)}
              >
                Guardar semana
              </button>
            )}
            <p>
          Los menús aprobados conservan sus fechas y contenido. Los borradores futuros quedan
          desactualizados si cambia el inicio de semana. El día de planificación se usará
              para los recordatorios cuando estén disponibles.
            </p>
          </>
        )}
      </div>
    </PaginaBase>
  );
}
