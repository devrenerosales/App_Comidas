import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { mensajeDeError } from '../api';
import { useApiCatalogo } from '../api/contexto-catalogo';
import { useApiPreferencias } from '../api/contexto-preferencias';
import type { ElementoGusto, VistaGustos } from '../api/preferencias';
import { Cargando } from '../auth/Cargando';
import { PaginaBase } from './PaginaBase';
import { textoImpacto } from './gustos';
import './acceso.css';
import './catalogo.css';
import './hogar.css';

const MINIMO_BUSQUEDA = 2;
const MAXIMO_RESULTADOS = 8;

const ids = (lista: ElementoGusto[]) => lista.map((e) => e.id);
const mismos = (a: string[], b: string[]) =>
  a.length === b.length && [...a].sort().join() === [...b].sort().join();

interface BuscadorProps {
  id: string;
  etiqueta: string;
  ayuda: string;
  buscar: (texto: string) => Promise<ElementoGusto[]>;
  seleccionados: ElementoGusto[];
  verbo: string;
  onAgregar: (e: ElementoGusto) => void;
}

/** Caja de búsqueda con resultados que se agregan con un botón (CU-02.6 pasos 2 y 4). */
function Buscador({ id, etiqueta, ayuda, buscar, seleccionados, verbo, onAgregar }: BuscadorProps) {
  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState<ElementoGusto[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = texto.trim();
    if (q.length < MINIMO_BUSQUEDA) {
      setResultados([]);
      return;
    }
    let activo = true;
    setError(null);
    buscar(q)
      .then((r) => {
        if (activo) setResultados(r);
      })
      .catch((e: unknown) => {
        if (activo) setError(mensajeDeError(e));
      });
    return () => {
      activo = false;
    };
  }, [texto, buscar]);

  const elegidos = new Set(ids(seleccionados));
  const disponibles = resultados.filter((r) => !elegidos.has(r.id)).slice(0, MAXIMO_RESULTADOS);
  return (
    <div className="mf-campo">
      <label htmlFor={`buscar-${id}`}>{etiqueta}</label>
      <input
        id={`buscar-${id}`}
        type="search"
        value={texto}
        aria-describedby={`ayuda-${id}`}
        onChange={(e) => setTexto(e.target.value)}
      />
      <small id={`ayuda-${id}`}>{ayuda}</small>
      {error && (
        <p role="alert" className="mf-alerta">
          {error}
        </p>
      )}
      {disponibles.length > 0 && (
        <ul className="mf-resultados" aria-label={`Resultados de ${etiqueta.toLowerCase()}`}>
          {disponibles.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                className="mf-boton mf-boton--secundario"
                onClick={() => {
                  onAgregar(r);
                  setTexto('');
                }}
              >
                {verbo} {r.nombre}
              </button>
            </li>
          ))}
        </ul>
      )}
      {texto.trim().length >= MINIMO_BUSQUEDA && !error && disponibles.length === 0 && (
        <p className="mf-texto-suave">No hay resultados nuevos para «{texto.trim()}».</p>
      )}
    </div>
  );
}

/** Restricciones y gustos del hogar: ingredientes excluidos y platillos favoritos (HU-10). */
export default function ConfiguracionGustos() {
  const api = useApiPreferencias();
  const catalogo = useApiCatalogo();
  const [guardado, setGuardado] = useState<VistaGustos | null>(null);
  const [excluidos, setExcluidos] = useState<ElementoGusto[]>([]);
  const [favoritos, setFavoritos] = useState<ElementoGusto[]>([]);
  const [vista, setVista] = useState<VistaGustos | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  const pedido = useRef(0);

  function aplicar(v: VistaGustos) {
    setGuardado(v);
    setVista(v);
    setExcluidos(v.ingredientesExcluidos);
    setFavoritos(v.favoritos);
  }
  useEffect(() => {
    let activo = true;
    setError(null);
    api
      .obtener()
      .then((v) => {
        if (activo) aplicar(v);
      })
      .catch((e: unknown) => {
        if (activo) setError(mensajeDeError(e));
      });
    return () => {
      activo = false;
    };
  }, [api, intento]);

  const buscarProductos = useCallback(
    (q: string) =>
      catalogo
        .listarProductos({ q, activo: 'true', tamano: MAXIMO_RESULTADOS * 2 })
        .then((p) => p.datos.map((d) => ({ id: d.id, nombre: d.nombre, activo: d.activo }))),
    [catalogo],
  );
  const buscarPlatillos = useCallback(
    (q: string) =>
      catalogo
        .listarPlatillos({ q, estado: 'ACTIVO' })
        .then((p) => p.datos.map((d) => ({ id: d.id, nombre: d.nombre, activo: d.activo }))),
    [catalogo],
  );

  /** Recalcula el impacto con las listas nuevas, sin guardar (CU-02.6 pasos 3 y 4a). */
  async function actualizar(nuevosExcluidos: ElementoGusto[], nuevosFavoritos: ElementoGusto[]) {
    setExcluidos(nuevosExcluidos);
    setFavoritos(nuevosFavoritos);
    setMensaje(null);
    setError(null);
    const numero = ++pedido.current;
    try {
      const v = await api.vistaPrevia({
        ingredientesExcluidos: ids(nuevosExcluidos),
        favoritos: ids(nuevosFavoritos),
      });
      if (numero === pedido.current) setVista(v);
    } catch (e) {
      if (numero === pedido.current) setError(mensajeDeError(e));
    }
  }

  async function guardar() {
    setOcupado(true);
    setError(null);
    setMensaje(null);
    pedido.current += 1;
    try {
      aplicar(
        await api.guardar({ ingredientesExcluidos: ids(excluidos), favoritos: ids(favoritos) }),
      );
      setMensaje('Restricciones y gustos guardados.');
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setOcupado(false);
    }
  }

  const cambios =
    guardado !== null &&
    (!mismos(ids(excluidos), ids(guardado.ingredientesExcluidos)) ||
      !mismos(ids(favoritos), ids(guardado.favoritos)));
  const afectados = vista?.impacto.platillosExcluidos ?? [];
  const advertencias = vista?.advertencias ?? [];

  return (
    <PaginaBase titulo="Restricciones y gustos">
      <div className="mf-hogar">
        <Link className="mf-enlace" to="/configuracion">
          Volver a Configuración
        </Link>
        {error && (
          <div className="mf-alerta" role="alert">
            <p>{error}</p>
            {!guardado && (
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
        {!guardado ? (
          !error && <Cargando />
        ) : (
          <>
            {mensaje && <p role="status">{mensaje}</p>}
            <section aria-labelledby="titulo-excluidos">
              <h2 id="titulo-excluidos">Ingredientes que no comemos</h2>
              <p>El menú sugerido no incluirá los platillos que los lleven.</p>
              <Buscador
                id="ingrediente"
                etiqueta="Buscar ingrediente"
                ayuda="Escribe al menos 2 letras."
                buscar={buscarProductos}
                seleccionados={excluidos}
                verbo="Excluir"
                onAgregar={(e) => void actualizar([...excluidos, e], favoritos)}
              />
              {excluidos.length === 0 ? (
                <p className="mf-texto-suave">No hay ingredientes excluidos.</p>
              ) : (
                <ul className="mf-resultados" aria-label="Ingredientes excluidos">
                  {excluidos.map((e) => (
                    <li key={e.id}>
                      <span className="mf-chip">{e.nombre}</span>{' '}
                      <button
                        type="button"
                        className="mf-boton mf-boton--secundario"
                        onClick={() =>
                          void actualizar(
                            excluidos.filter((x) => x.id !== e.id),
                            favoritos,
                          )
                        }
                      >
                        Quitar {e.nombre}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {excluidos.length > 0 && (
                <p role="status" className="mf-aviso">
                  {afectados.length > 0
                    ? textoImpacto(afectados.map((a) => a.nombre))
                    : 'Ningún platillo lleva estos ingredientes todavía.'}
                </p>
              )}
            </section>
            <section aria-labelledby="titulo-favoritos">
              <h2 id="titulo-favoritos">Platillos favoritos</h2>
              <p>El motor les da la máxima preferencia al armar el menú.</p>
              <Buscador
                id="platillo"
                etiqueta="Buscar platillo"
                ayuda="Escribe al menos 2 letras."
                buscar={buscarPlatillos}
                seleccionados={favoritos}
                verbo="Marcar favorito"
                onAgregar={(f) => void actualizar(excluidos, [...favoritos, f])}
              />
              {favoritos.length === 0 ? (
                <p className="mf-texto-suave">No hay platillos favoritos.</p>
              ) : (
                <ul className="mf-resultados" aria-label="Platillos favoritos">
                  {favoritos.map((f) => (
                    <li key={f.id}>
                      <span className="mf-chip">{f.nombre}</span>{' '}
                      <button
                        type="button"
                        className="mf-boton mf-boton--secundario"
                        onClick={() =>
                          void actualizar(
                            excluidos,
                            favoritos.filter((x) => x.id !== f.id),
                          )
                        }
                      >
                        Quitar {f.nombre}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {advertencias.length > 0 && (
                <div className="mf-advertencia" role="status">
                  {advertencias.map((a) => (
                    <p key={a.platillo.id}>
                      {a.mensaje}. No se sugerirá mientras la exclusión exista.
                    </p>
                  ))}
                </div>
              )}
            </section>
            <button
              type="button"
              className="mf-boton mf-boton--primario"
              disabled={ocupado || !cambios}
              onClick={() => void guardar()}
            >
              {ocupado ? 'Guardando…' : 'Guardar'}
            </button>
          </>
        )}
      </div>
    </PaginaBase>
  );
}
