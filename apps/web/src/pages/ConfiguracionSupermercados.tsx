import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { mensajeDeError } from '../api';
import { useApiCatalogo } from '../api/contexto-catalogo';
import { useApiSupermercados } from '../api/contexto-supermercados';
import type {
  MarcaElegida,
  SupermercadoPreferido,
  VistaMarcasProducto,
} from '../api/supermercados';
import { Cargando } from '../auth/Cargando';
import { PaginaBase } from './PaginaBase';
import { textoPrecio } from './supermercados';
import './acceso.css';
import './catalogo.css';
import './hogar.css';

const MINIMO_BUSQUEDA = 2;
const MAXIMO_RESULTADOS = 8;
const CUALQUIERA = '';
const SIN_PREFERIDO = 'Debes tener al menos un supermercado preferido';

interface ProductoBuscado {
  id: string;
  nombre: string;
}

/** Supermercados donde compra el hogar y marca preferida por producto (CU-02.5, HU-09). */
export default function ConfiguracionSupermercados() {
  const api = useApiSupermercados();
  const catalogo = useApiCatalogo();
  const [supermercados, setSupermercados] = useState<SupermercadoPreferido[] | null>(null);
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const [elegidas, setElegidas] = useState<MarcaElegida[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [errorSupermercados, setErrorSupermercados] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [intento, setIntento] = useState(0);

  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState<ProductoBuscado[]>([]);
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null);
  const [producto, setProducto] = useState<VistaMarcasProducto | null>(null);
  const [marcaElegida, setMarcaElegida] = useState(CUALQUIERA);
  const [errorMarca, setErrorMarca] = useState<string | null>(null);
  const [mensajeMarca, setMensajeMarca] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;
    setError(null);
    Promise.all([api.supermercados(), api.marcasElegidas()])
      .then(([lista, marcas]) => {
        if (!activo) return;
        setSupermercados(lista);
        setMarcadas(new Set(lista.filter((s) => s.preferido).map((s) => s.supermercadoId)));
        setElegidas(marcas);
      })
      .catch((e: unknown) => {
        if (activo) setError(mensajeDeError(e));
      });
    return () => {
      activo = false;
    };
  }, [api, intento]);

  const buscar = useCallback(
    (q: string) =>
      catalogo
        .listarProductos({ q, activo: 'true', tamano: MAXIMO_RESULTADOS * 2 })
        .then((p) => p.datos.map((d) => ({ id: d.id, nombre: d.nombre }))),
    [catalogo],
  );

  useEffect(() => {
    const q = texto.trim();
    if (q.length < MINIMO_BUSQUEDA) {
      setResultados([]);
      return;
    }
    let activo = true;
    setErrorBusqueda(null);
    buscar(q)
      .then((r) => {
        if (activo) setResultados(r.slice(0, MAXIMO_RESULTADOS));
      })
      .catch((e: unknown) => {
        if (activo) setErrorBusqueda(mensajeDeError(e));
      });
    return () => {
      activo = false;
    };
  }, [texto, buscar]);

  const guardado = new Set(
    (supermercados ?? []).filter((s) => s.preferido).map((s) => s.supermercadoId),
  );
  const cambios = marcadas.size !== guardado.size || [...marcadas].some((id) => !guardado.has(id));

  function alternar(id: string) {
    const nuevas = new Set(marcadas);
    if (nuevas.has(id)) nuevas.delete(id);
    else nuevas.add(id);
    setMarcadas(nuevas);
    setErrorSupermercados(null);
    setMensaje(null);
  }

  async function guardarSupermercados() {
    setMensaje(null);
    if (marcadas.size === 0) {
      setErrorSupermercados(SIN_PREFERIDO);
      return;
    }
    setOcupado(true);
    setErrorSupermercados(null);
    try {
      const lista = await api.guardarSupermercados([...marcadas]);
      setSupermercados(lista);
      setMarcadas(new Set(lista.filter((s) => s.preferido).map((s) => s.supermercadoId)));
      setMensaje('Supermercados guardados.');
    } catch (e) {
      setErrorSupermercados(mensajeDeError(e));
    } finally {
      setOcupado(false);
    }
  }

  async function abrirProducto(p: ProductoBuscado) {
    setErrorMarca(null);
    setMensajeMarca(null);
    setTexto('');
    try {
      const vista = await api.marcasDeProducto(p.id);
      setProducto(vista);
      setMarcaElegida(vista.marcaPreferida ?? CUALQUIERA);
    } catch (e) {
      setProducto(null);
      setErrorMarca(mensajeDeError(e));
    }
  }

  async function guardarMarca(productoId: string, marca: string) {
    setOcupado(true);
    setErrorMarca(null);
    setMensajeMarca(null);
    try {
      const vista = await api.guardarMarca(productoId, marca === CUALQUIERA ? null : marca);
      setProducto((actual) => (actual?.productoId === productoId ? vista : actual));
      setMarcaElegida(vista.marcaPreferida ?? CUALQUIERA);
      setElegidas(await api.marcasElegidas());
      setMensajeMarca(
        vista.marcaPreferida
          ? `Marca preferida de ${vista.producto}: ${vista.marcaPreferida}.`
          : `${vista.producto} vuelve a cualquier marca.`,
      );
    } catch (e) {
      setErrorMarca(mensajeDeError(e));
    } finally {
      setOcupado(false);
    }
  }

  const hoy = new Date();

  return (
    <PaginaBase titulo="Supermercados y marcas">
      <div className="mf-hogar">
        <Link className="mf-enlace" to="/configuracion">
          Volver a Configuración
        </Link>
        {error && (
          <div className="mf-alerta" role="alert">
            <p>{error}</p>
            {!supermercados && (
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
        {!supermercados ? (
          !error && <Cargando />
        ) : (
          <>
            <section aria-labelledby="titulo-supermercados">
              <h2 id="titulo-supermercados">Dónde compras</h2>
              <p>La compra sugerida busca el precio más bajo solo en estos supermercados.</p>
              {mensaje && <p role="status">{mensaje}</p>}
              <fieldset className="mf-campo">
                <legend>Supermercados preferidos</legend>
                {supermercados.map((s) => (
                  <label key={s.supermercadoId} className="mf-casilla">
                    <input
                      type="checkbox"
                      checked={marcadas.has(s.supermercadoId)}
                      onChange={() => alternar(s.supermercadoId)}
                    />{' '}
                    {s.nombre}
                  </label>
                ))}
              </fieldset>
              {errorSupermercados && (
                <p role="alert" className="mf-alerta">
                  {errorSupermercados}
                </p>
              )}
              <button
                type="button"
                className="mf-boton mf-boton--primario"
                disabled={ocupado || !cambios}
                onClick={() => void guardarSupermercados()}
              >
                {ocupado ? 'Guardando…' : 'Guardar supermercados'}
              </button>
            </section>

            <section aria-labelledby="titulo-marcas">
              <h2 id="titulo-marcas">Marca preferida</h2>
              <p>Elige la marca que prefieres de cada producto; sin elegir, vale cualquiera.</p>
              <div className="mf-campo">
                <label htmlFor="buscar-producto">Buscar producto</label>
                <input
                  id="buscar-producto"
                  type="search"
                  value={texto}
                  aria-describedby="ayuda-producto"
                  onChange={(e) => setTexto(e.target.value)}
                />
                <small id="ayuda-producto">Escribe al menos 2 letras.</small>
                {errorBusqueda && (
                  <p role="alert" className="mf-alerta">
                    {errorBusqueda}
                  </p>
                )}
                {resultados.length > 0 && (
                  <ul className="mf-resultados" aria-label="Resultados de producto">
                    {resultados.map((r) => (
                      <li key={r.id}>
                        <button
                          type="button"
                          className="mf-boton mf-boton--secundario"
                          onClick={() => void abrirProducto(r)}
                        >
                          Elegir {r.nombre}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {texto.trim().length >= MINIMO_BUSQUEDA &&
                  !errorBusqueda &&
                  resultados.length === 0 && (
                    <p className="mf-texto-suave">No hay resultados para «{texto.trim()}».</p>
                  )}
              </div>

              {errorMarca && (
                <p role="alert" className="mf-alerta">
                  {errorMarca}
                </p>
              )}
              {mensajeMarca && <p role="status">{mensajeMarca}</p>}

              {producto && (
                <div aria-label={`Marcas de ${producto.producto}`} role="group">
                  <h3>{producto.producto}</h3>
                  {producto.marcas.length === 0 ? (
                    <p className="mf-texto-suave">
                      Sin marcas vinculadas. Cuando el producto se vincule con los productos de cada
                      supermercado podrás elegir su marca aquí.
                    </p>
                  ) : (
                    <>
                      <fieldset className="mf-campo">
                        <legend>Marca de {producto.producto}</legend>
                        <label className="mf-casilla">
                          <input
                            type="radio"
                            name="marca"
                            checked={marcaElegida === CUALQUIERA}
                            onChange={() => setMarcaElegida(CUALQUIERA)}
                          />{' '}
                          Cualquier marca
                        </label>
                        {producto.marcas.map((m) => (
                          <div key={m.marca}>
                            <label className="mf-casilla">
                              <input
                                type="radio"
                                name="marca"
                                checked={marcaElegida === m.marca}
                                onChange={() => setMarcaElegida(m.marca)}
                              />{' '}
                              {m.marca}
                            </label>
                            <ul className="mf-texto-suave">
                              {m.presentaciones.map((p) => (
                                <li key={`${p.supermercado}-${p.presentacion}`}>
                                  {p.supermercado} · {p.presentacion} ·{' '}
                                  {textoPrecio(p.ultimoPrecio, hoy)}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </fieldset>
                      <button
                        type="button"
                        className="mf-boton mf-boton--primario"
                        disabled={
                          ocupado || marcaElegida === (producto.marcaPreferida ?? CUALQUIERA)
                        }
                        onClick={() => void guardarMarca(producto.productoId, marcaElegida)}
                      >
                        {ocupado ? 'Guardando…' : 'Guardar marca'}
                      </button>
                    </>
                  )}
                </div>
              )}

              <h3>Marcas elegidas</h3>
              {elegidas.length === 0 ? (
                <p className="mf-texto-suave">Todavía no elegiste ninguna marca preferida.</p>
              ) : (
                <ul className="mf-resultados" aria-label="Marcas elegidas">
                  {elegidas.map((e) => (
                    <li key={e.productoId}>
                      <span className="mf-chip">
                        {e.producto}: {e.marca}
                      </span>{' '}
                      <button
                        type="button"
                        className="mf-boton mf-boton--secundario"
                        disabled={ocupado}
                        onClick={() => void guardarMarca(e.productoId, CUALQUIERA)}
                      >
                        Quitar marca de {e.producto}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </PaginaBase>
  );
}
