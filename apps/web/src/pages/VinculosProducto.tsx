import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { factorVinculo, formatearCantidad, mensajeUnidadNoConvertible } from '@menu/shared';
import { mensajeDeError } from '../api';
import type { Producto, Unidad } from '../api/catalogo';
import { useApiCatalogo } from '../api/contexto-catalogo';
import { useApiPrecios } from '../api/contexto-precios';
import { useApiVinculos } from '../api/contexto-vinculos';
import type { ResumenPrecio as DatosResumen } from '../api/precios';
import { ProblemaApi } from '../api/problema';
import type { DatosVinculo, SupermercadoCatalogo, Vinculo } from '../api/vinculos';
import { Cargando } from '../auth/Cargando';
import { PaginaBase } from './PaginaBase';
import { ResumenPrecio } from './ResumenPrecio';
import { fechaCompleta } from './supermercados';
import './acceso.css';
import './catalogo.css';
import './hogar.css';

const VINCULO_ACTIVO_EXISTE = 'VINCULO_ACTIVO_EXISTE';

/** "Q12.50 · 20/10/2026", o "Sin precio registrado". */
const textoUltimoPrecio = (p: Vinculo['ultimoPrecio']): string =>
  p ? `Q${p.precio} · ${fechaCompleta(p.fecha)}` : 'Sin precio registrado';

interface FormularioEdicionProps {
  vinculo: Vinculo;
  requiereEnlace: boolean;
  ocupado: boolean;
  onGuardar: (cambios: {
    nombreTienda: string;
    marca: string | null;
    url: string | null;
    sku: string | null;
  }) => void;
  onCancelar: () => void;
}

/** Edita nombre en tienda, marca, URL o SKU; la presentación no se edita (se reemplaza). */
function FormularioEdicion({
  vinculo,
  requiereEnlace,
  ocupado,
  onGuardar,
  onCancelar,
}: FormularioEdicionProps) {
  const [nombreTienda, setNombreTienda] = useState(vinculo.nombreTienda);
  const [marca, setMarca] = useState(vinculo.marca ?? '');
  const [url, setUrl] = useState(vinculo.url ?? '');
  const [sku, setSku] = useState(vinculo.sku ?? '');
  const nombre = vinculo.supermercado.nombre;
  return (
    <form
      aria-label={`Editar vínculo de ${nombre}`}
      onSubmit={(e) => {
        e.preventDefault();
        onGuardar({
          nombreTienda,
          marca: marca.trim() || null,
          url: url.trim() || null,
          sku: sku.trim() || null,
        });
      }}
    >
      <div className="mf-campo">
        <label htmlFor={`edit-nombre-${vinculo.id}`}>Nombre en la tienda</label>
        <input
          id={`edit-nombre-${vinculo.id}`}
          value={nombreTienda}
          onChange={(e) => setNombreTienda(e.target.value)}
        />
      </div>
      <div className="mf-campo">
        <label htmlFor={`edit-marca-${vinculo.id}`}>Marca</label>
        <input
          id={`edit-marca-${vinculo.id}`}
          value={marca}
          onChange={(e) => setMarca(e.target.value)}
        />
      </div>
      {requiereEnlace && (
        <>
          <div className="mf-campo">
            <label htmlFor={`edit-url-${vinculo.id}`}>URL del producto</label>
            <input
              id={`edit-url-${vinculo.id}`}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          <div className="mf-campo">
            <label htmlFor={`edit-sku-${vinculo.id}`}>SKU</label>
            <input
              id={`edit-sku-${vinculo.id}`}
              value={sku}
              onChange={(e) => setSku(e.target.value)}
            />
          </div>
        </>
      )}
      <div className="mf-acciones">
        <button type="submit" className="mf-boton mf-boton--primario" disabled={ocupado}>
          Guardar cambios
        </button>
        <button type="button" className="mf-boton mf-boton--secundario" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

/** Vínculos de un producto con su equivalente en cada supermercado (CU-08.2, HU-35). */
export default function VinculosProducto() {
  const { id: productoId = '' } = useParams<{ id: string }>();
  const catalogo = useApiCatalogo();
  const api = useApiVinculos();
  const apiPrecios = useApiPrecios();
  const [producto, setProducto] = useState<Producto | null>(null);
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [supermercados, setSupermercados] = useState<SupermercadoCatalogo[]>([]);
  const [vinculos, setVinculos] = useState<Vinculo[] | null>(null);
  /** `undefined` = todavía no se sabe o no se pudo leer; `null` = sin precio. */
  const [resumen, setResumen] = useState<DatosResumen | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [errorFormulario, setErrorFormulario] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [intento, setIntento] = useState(0);

  const [supermercadoId, setSupermercadoId] = useState('');
  const [nombreTienda, setNombreTienda] = useState('');
  const [marca, setMarca] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [unidadId, setUnidadId] = useState('');
  const [url, setUrl] = useState('');
  const [sku, setSku] = useState('');
  const [conflicto, setConflicto] = useState<{ datos: DatosVinculo; existente: Vinculo } | null>(
    null,
  );
  const [editando, setEditando] = useState<string | null>(null);

  const cargarResumen = useCallback(
    () =>
      apiPrecios
        .resumen(productoId)
        .then(setResumen)
        .catch(() => setResumen(undefined)),
    [apiPrecios, productoId],
  );

  const cargarVinculos = useCallback(
    () => api.listar(productoId).then(setVinculos).then(cargarResumen),
    [api, productoId, cargarResumen],
  );

  useEffect(() => {
    let activo = true;
    setError(null);
    Promise.all([
      catalogo.obtenerProducto(productoId),
      catalogo.listarUnidades(),
      api.supermercados(),
      api.listar(productoId),
    ])
      .then(([p, u, s, v]) => {
        if (!activo) return;
        setProducto(p);
        setUnidades(u);
        setSupermercados(s);
        setVinculos(v);
        setUnidadId(p.presentacion.unidad.id);
        setSupermercadoId((actual) => actual || (s[0]?.id ?? ''));
        void cargarResumen();
      })
      .catch((e: unknown) => {
        if (activo) setError(mensajeDeError(e));
      });
    return () => {
      activo = false;
    };
  }, [catalogo, api, productoId, intento, cargarResumen]);

  const elegido = supermercados.find((s) => s.id === supermercadoId);
  const unidadElegida = unidades.find((u) => u.id === unidadId);

  /** CU-08.2 pasos 3 y 4 en pantalla: el factor, o el motivo si no se puede convertir. */
  const factor = useMemo(() => {
    if (!producto || !unidadElegida || cantidad.trim() === '') return null;
    return factorVinculo(
      { cantidad: cantidad.replace(',', '.'), unidad: unidadElegida },
      { cantidad: producto.presentacion.cantidad, unidad: producto.presentacion.unidad },
    );
  }, [producto, unidadElegida, cantidad]);
  const noConvertible = cantidad.trim() !== '' && unidadElegida !== undefined && factor === null;

  function datosDelFormulario(): DatosVinculo {
    const datos: DatosVinculo = {
      supermercadoId,
      nombreTienda: nombreTienda.trim(),
      presentacionCantidad: cantidad.trim().replace(',', '.'),
      presentacionUnidadId: unidadId,
    };
    if (marca.trim()) datos.marca = marca.trim();
    if (elegido?.requiereEnlace) {
      if (url.trim()) datos.url = url.trim();
      if (sku.trim()) datos.sku = sku.trim();
    }
    return datos;
  }

  function limpiarFormulario() {
    setNombreTienda('');
    setMarca('');
    setCantidad('');
    setUrl('');
    setSku('');
  }

  async function guardar(datos: DatosVinculo, reemplazar: boolean) {
    setOcupado(true);
    setErrorFormulario(null);
    setMensaje(null);
    try {
      await api.crear(productoId, datos, reemplazar);
      setConflicto(null);
      limpiarFormulario();
      await cargarVinculos();
      setMensaje(reemplazar ? 'Vínculo reemplazado.' : 'Vínculo guardado.');
    } catch (e) {
      if (e instanceof ProblemaApi && e.codigo === VINCULO_ACTIVO_EXISTE) {
        setConflicto({ datos, existente: e.cuerpo.vinculoExistente as Vinculo });
      } else {
        setErrorFormulario(mensajeDeError(e));
      }
    } finally {
      setOcupado(false);
    }
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    void guardar(datosDelFormulario(), false);
  }

  async function editar(
    vinculo: Vinculo,
    cambios: { nombreTienda: string; marca: string | null; url: string | null; sku: string | null },
  ) {
    setOcupado(true);
    setErrorFormulario(null);
    setMensaje(null);
    try {
      await api.actualizar(vinculo.id, cambios);
      setEditando(null);
      await cargarVinculos();
      setMensaje(`Vínculo de ${vinculo.supermercado.nombre} actualizado.`);
    } catch (e) {
      setErrorFormulario(mensajeDeError(e));
    } finally {
      setOcupado(false);
    }
  }

  const requiereEnlace = (id: string) => supermercados.find((s) => s.id === id)?.requiereEnlace;

  return (
    <PaginaBase titulo={producto ? `Supermercados de ${producto.nombre}` : 'Supermercados'}>
      <div className="mf-catalogo">
        <p style={{ margin: '0 0 12px' }}>
          <Link className="mf-enlace" to="/platillos/productos">
            ← Volver a productos
          </Link>
        </p>
        {error && (
          <div className="mf-alerta" role="alert">
            <p>{error}</p>
            {!producto && (
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
        {!producto || !vinculos ? (
          !error && <Cargando />
        ) : (
          <>
            <p>
              Presentación de compra: <strong>{producto.etiqueta}</strong>. Cada supermercado puede
              venderlo en otra presentación; la app lo ajusta para comparar precios.
            </p>
            {resumen !== undefined && <ResumenPrecio resumen={resumen} />}
            {mensaje && <p role="status">{mensaje}</p>}
            <p>
              <Link
                className="mf-boton mf-boton--secundario"
                to={`/platillos/productos/${productoId}/precio`}
              >
                Registrar precio
              </Link>{' '}
              <Link
                className="mf-boton mf-boton--secundario"
                to={`/platillos/productos/${productoId}/historial-precios`}
              >
                Historial de precios
              </Link>
            </p>

            <h2>Vínculos</h2>
            {vinculos.length === 0 ? (
              <p className="mf-texto-suave">Todavía no está vinculado con ningún supermercado.</p>
            ) : (
              <section className="mf-tarjeta" aria-label="Vínculos">
                {vinculos.map((v) => (
                  <div key={v.id} className="mf-item-catalogo">
                    <span className="mf-item-catalogo__datos">
                      <strong>
                        {v.supermercado.nombre} · {v.nombreTienda}
                        {!v.activo && ' (reemplazado)'}
                      </strong>
                      <span>
                        {[
                          v.marca,
                          `Presentación ${v.presentacion.texto}`,
                          `Factor ${v.factor}`,
                          v.sku && `SKU ${v.sku}`,
                          `Último precio: ${textoUltimoPrecio(v.ultimoPrecio)}`,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                      {v.url && <span>{v.url}</span>}
                      {editando === v.id && (
                        <FormularioEdicion
                          vinculo={v}
                          requiereEnlace={Boolean(requiereEnlace(v.supermercado.id))}
                          ocupado={ocupado}
                          onGuardar={(c) => void editar(v, c)}
                          onCancelar={() => setEditando(null)}
                        />
                      )}
                    </span>
                    {v.activo && editando !== v.id && (
                      <button
                        type="button"
                        className="mf-boton mf-boton--secundario"
                        aria-label={`Editar vínculo de ${v.supermercado.nombre}`}
                        onClick={() => {
                          setEditando(v.id);
                          setErrorFormulario(null);
                        }}
                      >
                        Editar
                      </button>
                    )}
                  </div>
                ))}
              </section>
            )}

            <h2>Vincular supermercado</h2>
            {errorFormulario && (
              <p role="alert" className="mf-alerta">
                {errorFormulario}
              </p>
            )}
            {conflicto && (
              <div className="mf-advertencia" role="alertdialog" aria-label="Reemplazar vínculo">
                <p>
                  {producto.nombre} ya tiene un vínculo activo en{' '}
                  {conflicto.existente.supermercado.nombre} ({conflicto.existente.nombreTienda}). Si
                  lo reemplazas, el anterior queda inactivo y conserva su histórico de precios.
                </p>
                <div className="mf-acciones">
                  <button
                    type="button"
                    className="mf-boton mf-boton--primario"
                    disabled={ocupado}
                    onClick={() => void guardar(conflicto.datos, true)}
                  >
                    Reemplazar
                  </button>
                  <button
                    type="button"
                    className="mf-boton mf-boton--secundario"
                    onClick={() => setConflicto(null)}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
            <form onSubmit={enviar} aria-label="Vincular supermercado">
              <div className="mf-campo">
                <label htmlFor="vinculo-supermercado">Supermercado</label>
                <select
                  id="vinculo-supermercado"
                  value={supermercadoId}
                  onChange={(e) => setSupermercadoId(e.target.value)}
                >
                  {supermercados.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mf-campo">
                <label htmlFor="vinculo-nombre">Nombre en la tienda</label>
                <input
                  id="vinculo-nombre"
                  value={nombreTienda}
                  onChange={(e) => setNombreTienda(e.target.value)}
                />
              </div>
              <div className="mf-campo">
                <label htmlFor="vinculo-marca">Marca (opcional)</label>
                <input
                  id="vinculo-marca"
                  value={marca}
                  onChange={(e) => setMarca(e.target.value)}
                />
              </div>
              <div className="mf-campo">
                <label htmlFor="vinculo-cantidad">Cantidad de la presentación</label>
                <input
                  id="vinculo-cantidad"
                  inputMode="decimal"
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                />
              </div>
              <div className="mf-campo">
                <label htmlFor="vinculo-unidad">Unidad</label>
                <select
                  id="vinculo-unidad"
                  value={unidadId}
                  onChange={(e) => setUnidadId(e.target.value)}
                >
                  {unidades.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nombre} ({u.codigo})
                    </option>
                  ))}
                </select>
              </div>
              {noConvertible && (
                <p role="alert" className="mf-alerta">
                  {mensajeUnidadNoConvertible(producto.presentacion.unidad.nombre)}
                </p>
              )}
              {factor !== null && (
                <p className="mf-texto-suave">
                  Esa presentación equivale a {formatearCantidad(factor)} veces la tuya (
                  {producto.etiqueta}); los precios se ajustan con ese factor.
                </p>
              )}
              {elegido?.requiereEnlace ? (
                <>
                  <p className="mf-texto-suave">
                    {elegido.nombre} se consulta automáticamente: indica la URL o el SKU del
                    producto.
                  </p>
                  <div className="mf-campo">
                    <label htmlFor="vinculo-url">URL del producto</label>
                    <input id="vinculo-url" value={url} onChange={(e) => setUrl(e.target.value)} />
                  </div>
                  <div className="mf-campo">
                    <label htmlFor="vinculo-sku">SKU</label>
                    <input id="vinculo-sku" value={sku} onChange={(e) => setSku(e.target.value)} />
                  </div>
                </>
              ) : (
                elegido && (
                  <p className="mf-texto-suave">
                    {elegido.nombre} no se consulta automáticamente: no hace falta URL ni SKU.
                  </p>
                )
              )}
              <button
                type="submit"
                className="mf-boton mf-boton--primario"
                disabled={ocupado || !supermercadoId || !nombreTienda.trim() || noConvertible}
              >
                {ocupado ? 'Guardando…' : 'Vincular'}
              </button>
            </form>
          </>
        )}
      </div>
    </PaginaBase>
  );
}
