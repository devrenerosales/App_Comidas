import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useHistory } from 'react-router-dom';
import {
  diasSemanaHistorica,
  esFechaCalendario,
  validarCapturaHistorica,
  ORDEN_TIEMPOS,
  type TiempoComida,
} from '@menu/shared';
import { useAuth } from '../auth/contexto';
import { useApiHistorial } from '../api/contexto-historial';
import { useApiCatalogo } from '../api/contexto-catalogo';
import type { ResumenPlatillo } from '../api/catalogo';
import type { DatosCapturarSemana } from '../api/historial';
import { ProblemaApi, mensajeDeError } from '../api';
import { CampoTexto } from './CampoTexto';
import { PaginaBase } from './PaginaBase';
import './acceso.css';
import './hogar.css';
import './historial.css';

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const TIEMPOS = { DESAYUNO: 'Desayuno', ALMUERZO: 'Almuerzo', CENA: 'Cena' };
const hoyGuatemala = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Guatemala',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
type Eleccion = Pick<ResumenPlatillo, 'id' | 'nombre'>;

export default function CapturarSemana() {
  const api = useApiHistorial();
  const catalogo = useApiCatalogo();
  const { hogar } = useAuth();
  const history = useHistory();
  const [inicio, setInicio] = useState('');
  const [gasto, setGasto] = useState('');
  const [notas, setNotas] = useState('');
  const [elegidos, setElegidos] = useState<Record<string, Eleccion>>({});
  const [editor, setEditor] = useState<{ dia: number; tiempo: TiempoComida } | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState<ResumenPlatillo[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [muchos, setMuchos] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, setPendiente] = useState<{
    datos: DatosCapturarSemana;
    version: number;
    gasto: string | null;
  } | null>(null);
  const buscador = useRef<HTMLElement>(null);
  useEffect(() => {
    if (editor) {
      buscador.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      buscador.current?.querySelector('input')?.focus();
    }
  }, [editor]);
  const dias =
    esFechaCalendario(inicio) && new Date(`${inicio}T00:00:00Z`).getUTCDay() === 0
      ? diasSemanaHistorica(inicio)
      : [];
  const bloqueado = ocupado || Boolean(pendiente);
  useEffect(() => {
    if (!editor) return;
    let activo = true;
    setBuscando(true);
    setErrorBusqueda(null);
    const timer = setTimeout(() => {
      catalogo
        .listarPlatillos({ q: busqueda.trim() })
        .then((r) => {
          if (activo) {
            setResultados(r.datos);
            setMuchos(r.paginacion.totalPaginas > 1);
          }
        })
        .catch((e: unknown) => {
          if (activo) setErrorBusqueda(mensajeDeError(e));
        })
        .finally(() => {
          if (activo) setBuscando(false);
        });
    }, 250);
    return () => {
      activo = false;
      clearTimeout(timer);
    };
  }, [catalogo, editor, busqueda]);
  function elegir(p: Eleccion) {
    if (!editor) return;
    setElegidos((anteriores) => ({ ...anteriores, [`${editor.dia}:${editor.tiempo}`]: p }));
    setEditor(null);
  }
  async function crearPlatillo() {
    if (!editor || !busqueda.trim()) return;
    setOcupado(true);
    setErrorBusqueda(null);
    try {
      elegir(await catalogo.crearPlatillo({ nombre: busqueda.trim(), tiempos: [editor.tiempo] }));
    } catch (e) {
      setErrorBusqueda(mensajeDeError(e));
    } finally {
      setOcupado(false);
    }
  }
  async function guardar(datos: DatosCapturarSemana) {
    setOcupado(true);
    setError(null);
    try {
      await api.capturar(datos);
      history.replace('/historial', {
        aviso: datos.reemplazar ? 'Semana histórica reemplazada' : 'Semana histórica guardada',
      });
    } catch (e) {
      if (e instanceof ProblemaApi && e.codigo === 'SEMANA_EXISTENTE') {
        const semana = e.cuerpo.semana as { version?: unknown; gastoReal?: unknown } | undefined;
        if (typeof semana?.version === 'number')
          setPendiente({
            datos,
            version: semana.version,
            gasto: typeof semana.gastoReal === 'string' ? semana.gastoReal : null,
          });
        else setError(mensajeDeError(e));
      } else {
        setPendiente(null);
        setError(mensajeDeError(e));
      }
    } finally {
      setOcupado(false);
    }
  }
  function enviar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const detalles = dias.flatMap((fecha, dia) =>
      ORDEN_TIEMPOS.flatMap((tiempo) => {
        const p = elegidos[`${dia}:${tiempo}`];
        return p ? [{ fecha, tiempo, platilloId: p.id }] : [];
      }),
    );
    const datos = {
      fechaInicio: inicio,
      detalles,
      ...(gasto.trim() ? { gastoReal: gasto.trim() } : {}),
      ...(notas.trim() ? { notas: notas.trim() } : {}),
    };
    const falla = validarCapturaHistorica(datos, hoyGuatemala());
    if (falla) {
      setError(falla.mensaje);
      return;
    }
    setEditor(null);
    void guardar(datos);
  }
  if (hogar?.rol !== 'ADMIN')
    return (
      <PaginaBase titulo="Capturar semana">
        <p role="alert">Solo el administrador puede capturar semanas históricas.</p>
        <Link to="/historial">Volver al historial</Link>
      </PaginaBase>
    );
  return (
    <PaginaBase titulo="Capturar semana pasada">
      <div className="mf-hogar">
        <Link className="mf-enlace" to="/historial">
          Volver al historial
        </Link>
        <p>
          Registra semanas de domingo a sábado. Puedes dejar comidas sin dato y usar los tres
          tiempos, independientemente de la configuración actual.
        </p>
        {error && (
          <p className="mf-alerta" role="alert">
            {error}
          </p>
        )}
        <form aria-label="Capturar semana histórica" noValidate onSubmit={enviar}>
          <fieldset disabled={bloqueado} className="mf-historial-campos">
            <legend>Datos de la semana</legend>
            <CampoTexto
              etiqueta="Domingo de inicio"
              type="date"
              required
              value={inicio}
              onChange={(e) => {
                setInicio(e.target.value);
                setEditor(null);
              }}
            />
            <CampoTexto
              etiqueta="Gasto semanal (Q), opcional"
              inputMode="decimal"
              value={gasto}
              onChange={(e) => setGasto(e.target.value)}
            />
            <CampoTexto
              etiqueta="Notas, opcional"
              maxLength={500}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
            />
            {!!dias.length && (
              <div className="mf-historial-tabla">
                <table>
                  <caption>Platillos de la semana</caption>
                  <thead>
                    <tr>
                      <th scope="col">Día</th>
                      {ORDEN_TIEMPOS.map((t) => (
                        <th scope="col" key={t}>
                          {TIEMPOS[t]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dias.map((fecha, dia) => (
                      <tr key={fecha}>
                        <th scope="row">
                          {DIAS[dia]}
                          <br />
                          <time dateTime={fecha}>{fecha}</time>
                        </th>
                        {ORDEN_TIEMPOS.map((tiempo) => {
                          const clave = `${dia}:${tiempo}`;
                          const p = elegidos[clave];
                          return (
                            <td key={tiempo}>
                              {p && <p>{p.nombre}</p>}
                              <button
                                type="button"
                                className="mf-boton mf-boton--secundario"
                                aria-label={`${p ? 'Cambiar' : 'Elegir'} ${TIEMPOS[tiempo]} ${DIAS[dia]}`}
                                onClick={() => {
                                  setBusqueda('');
                                  setResultados([]);
                                  setEditor({ dia, tiempo });
                                }}
                              >
                                {p ? 'Cambiar' : 'Elegir'}
                              </button>
                              {p && (
                                <button
                                  type="button"
                                  aria-label={`Quitar ${TIEMPOS[tiempo]} ${DIAS[dia]}`}
                                  onClick={() =>
                                    setElegidos((actual) => {
                                      const nuevos = { ...actual };
                                      delete nuevos[clave];
                                      return nuevos;
                                    })
                                  }
                                >
                                  Quitar
                                </button>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <button type="submit" className="mf-boton mf-boton--primario">
              {ocupado ? 'Guardando…' : 'Guardar semana histórica'}
            </button>
          </fieldset>
        </form>
        {editor && (
          <section ref={buscador} className="mf-tarjeta" aria-label="Elegir platillo">
            <h2>
              {DIAS[editor.dia]} · {TIEMPOS[editor.tiempo]}
            </h2>
            <CampoTexto
              etiqueta="Buscar platillo"
              value={busqueda}
              disabled={ocupado}
              onChange={(e) => setBusqueda(e.target.value)}
              maxLength={80}
            />
            {errorBusqueda && <p role="alert">{errorBusqueda}</p>}
            {buscando ? (
              <p role="status">Buscando platillos…</p>
            ) : (
              <ul>
                {resultados.map((p) => (
                  <li key={p.id}>
                    <button type="button" disabled={ocupado} onClick={() => elegir(p)}>
                      {p.nombre}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {muchos && <p>Hay más resultados. Escribe parte del nombre para afinar la búsqueda.</p>}
            {!buscando && !errorBusqueda && !resultados.length && <p>No hay coincidencias.</p>}
            {busqueda.trim() && (
              <button
                type="button"
                disabled={ocupado}
                className="mf-boton mf-boton--secundario"
                onClick={() => void crearPlatillo()}
              >
                Crear «{busqueda.trim()}» y usar
              </button>
            )}
            <p>
              Al crear un platillo se añade al catálogo, aunque después canceles la captura. Podrás
              completar sus ingredientes más adelante.
            </p>
            <button type="button" disabled={ocupado} onClick={() => setEditor(null)}>
              Cerrar buscador
            </button>
          </section>
        )}
        {pendiente && (
          <section className="mf-alerta" aria-label="Confirmar reemplazo">
            <h2>Esta semana ya está registrada</h2>
            <p>
              Se reemplazarán sus platillos, notas y gasto por los que acabas de capturar.
              {pendiente.gasto && ` El gasto registrado es Q${pendiente.gasto}.`}
            </p>
            <button
              type="button"
              className="mf-boton mf-boton--primario"
              disabled={ocupado}
              onClick={() =>
                void guardar({ ...pendiente.datos, reemplazar: true, version: pendiente.version })
              }
            >
              Reemplazar semana
            </button>
            <button type="button" disabled={ocupado} onClick={() => setPendiente(null)}>
              Cancelar reemplazo
            </button>
          </section>
        )}
      </div>
    </PaginaBase>
  );
}
