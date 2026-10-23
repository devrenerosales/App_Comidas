import { useEffect, useMemo, useState } from 'react';
import {
  MENSAJES_CATALOGO,
  PORCIONES_BASE_MAXIMAS,
  PORCIONES_BASE_MINIMAS,
  convertirCantidad,
  escalarCantidad,
  formatearCantidad,
  redondear,
  unidadCompatible,
} from '@menu/shared';
import { ProblemaApi, mensajeDeError } from '../api';
import type { Categoria, DetallePlatillo, Producto, Unidad, VistaPrevia } from '../api/catalogo';
import { useApiCatalogo } from '../api/contexto-catalogo';
import { FormularioProducto } from './FormularioProducto';

/** Fila editable del editor. */
export interface FilaEditor {
  productoId: string;
  nombre: string;
  activo: boolean;
  /** Unidad de presentación del producto: define la magnitud permitida. */
  presentacion: Unidad;
  cantidad: string;
  unidadId: string;
}

interface Props {
  platillo: DetallePlatillo;
  unidades: Unidad[];
  categorias: Categoria[];
  alGuardar(platillo: DetallePlatillo): void;
}

const aFila = (i: DetallePlatillo['ingredientes'][number]): FilaEditor => ({
  productoId: i.producto.id,
  nombre: i.producto.nombre,
  activo: i.producto.activo,
  presentacion: i.producto.presentacionUnidad,
  cantidad: formatearCantidad(i.cantidad),
  unidadId: i.unidad.id,
});

const numero = (texto: string) => Number(texto.replace(',', '.'));

/**
 * Editor de ingredientes por porciones base (HU-12 · CU-03.2): buscador del catálogo, cantidad y
 * unidad compatible por ingrediente, creación de producto desde el buscador (3a) y vista previa
 * escalada con Σ factores (RN-07), que viene de los comensales y se puede ajustar.
 */
export function EditorIngredientes({ platillo, unidades, categorias, alGuardar }: Props) {
  const api = useApiCatalogo();
  const [porciones, setPorciones] = useState(String(platillo.porcionesBase));
  const [filas, setFilas] = useState<FilaEditor[]>(() => platillo.ingredientes.map(aFila));
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [alerta, setAlerta] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState<Producto[] | null>(null);
  const [creando, setCreando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [vista, setVista] = useState<VistaPrevia | null>(null);
  const [suma, setSuma] = useState('');

  const porUnidad = useMemo(() => new Map(unidades.map((u) => [u.id, u])), [unidades]);

  useEffect(() => {
    let vigente = true;
    api
      .vistaPrevia(platillo.id)
      .then((v) => {
        if (!vigente) return;
        setVista(v);
        setSuma(formatearCantidad(v.sumaFactores));
      })
      .catch(() => undefined);
    return () => {
      vigente = false;
    };
  }, [api, platillo.id]);

  useEffect(() => {
    const texto = busqueda.trim();
    if (!texto) {
      setResultados(null);
      return;
    }
    let vigente = true;
    const espera = setTimeout(() => {
      api
        .listarProductos({ q: texto, activo: 'true', tamano: 8 })
        .then((p) => vigente && setResultados(p.datos))
        .catch((e: unknown) => vigente && setAlerta(mensajeDeError(e)));
    }, 250);
    return () => {
      vigente = false;
      clearTimeout(espera);
    };
  }, [api, busqueda]);

  /** CU-03.2 paso 3 y E3: agrega el producto o propone sumar si ya está. */
  function agregar(producto: Producto) {
    setAviso(null);
    const existente = filas.find((f) => f.productoId === producto.id);
    if (existente) {
      setAviso(
        `${producto.nombre} ya está en el platillo: ajusta su cantidad en lugar de agregarlo otra vez.`,
      );
    } else {
      setFilas([
        ...filas,
        {
          productoId: producto.id,
          nombre: producto.nombre,
          activo: producto.activo,
          presentacion: producto.presentacion.unidad,
          cantidad: '',
          unidadId: producto.presentacion.unidad.id,
        },
      ]);
    }
    setBusqueda('');
    setCreando(false);
  }

  function cambiar(indice: number, cambio: Partial<FilaEditor>) {
    setFilas(filas.map((f, i) => (i === indice ? { ...f, ...cambio } : f)));
  }

  /** Cambiar la unidad convierte la cantidad si ambas son convertibles (g ↔ lb, ml ↔ taza). */
  function cambiarUnidad(indice: number, unidadId: string) {
    const fila = filas[indice] as FilaEditor;
    const de = porUnidad.get(fila.unidadId);
    const a = porUnidad.get(unidadId);
    const convertida =
      de && a && fila.cantidad ? convertirCantidad(numero(fila.cantidad), de, a) : null;
    cambiar(indice, {
      unidadId,
      cantidad: convertida === null ? fila.cantidad : formatearCantidad(redondear(convertida, 3)),
    });
  }

  function validar(): Record<string, string> {
    const nuevos: Record<string, string> = {};
    const p = Number(porciones);
    if (!Number.isInteger(p) || p < PORCIONES_BASE_MINIMAS || p > PORCIONES_BASE_MAXIMAS) {
      nuevos.porcionesBase = MENSAJES_CATALOGO.porcionesInvalidas;
    }
    filas.forEach((f, i) => {
      if (!(numero(f.cantidad) > 0)) {
        nuevos[`ingredientes.${i}.cantidad`] = MENSAJES_CATALOGO.cantidadInvalida;
      }
      const unidad = porUnidad.get(f.unidadId);
      if (unidad && !unidadCompatible(unidad, f.presentacion)) {
        nuevos[`ingredientes.${i}.unidadId`] = MENSAJES_CATALOGO.unidadIncompatible(
          unidad.codigo,
          f.presentacion.codigo,
        );
      }
    });
    return nuevos;
  }

  async function guardar() {
    setAlerta(null);
    setAviso(null);
    const nuevos = validar();
    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0) return;
    setOcupado(true);
    try {
      const res = await api.guardarIngredientes(
        platillo.id,
        Number(porciones),
        filas.map((f) => ({
          productoId: f.productoId,
          cantidad: String(numero(f.cantidad)),
          unidadId: f.unidadId,
        })),
      );
      setVista(res.vistaPrevia);
      setSuma(formatearCantidad(res.vistaPrevia.sumaFactores));
      setAviso('Ingredientes guardados.');
      alGuardar(res);
    } catch (error) {
      if (error instanceof ProblemaApi && error.errores.length > 0) {
        setErrores(Object.fromEntries(error.errores.map((e) => [e.campo, e.mensaje])));
        setAlerta(error.message);
      } else {
        setAlerta(mensajeDeError(error));
      }
    } finally {
      setOcupado(false);
    }
  }

  const sumaNumero = numero(suma);
  const porcionesGuardadas = vista?.porcionesBase ?? platillo.porcionesBase;
  const texto = busqueda.trim();

  return (
    <section className="mf-tarjeta" aria-labelledby="titulo-ingredientes">
      <h2 id="titulo-ingredientes">Ingredientes</h2>
      {alerta && (
        <div className="mf-alerta" role="alert">
          <p>{alerta}</p>
        </div>
      )}
      {aviso && (
        <div className="mf-aviso" role="status">
          <p>{aviso}</p>
        </div>
      )}
      <div className="mf-campo">
        <label htmlFor="porciones-base">Porciones base</label>
        <input
          id="porciones-base"
          type="number"
          inputMode="numeric"
          min={PORCIONES_BASE_MINIMAS}
          max={PORCIONES_BASE_MAXIMAS}
          value={porciones}
          aria-invalid={errores.porcionesBase ? true : undefined}
          aria-describedby="porciones-ayuda"
          onChange={(e) => setPorciones(e.target.value)}
        />
        <p id="porciones-ayuda" className="mf-campo__ayuda">
          Las cantidades son para este número de porciones (de 1 a 20).
        </p>
        {errores.porcionesBase && <p className="mf-campo__error">{errores.porcionesBase}</p>}
      </div>

      {filas.length === 0 && (
        <p className="mf-texto-suave">
          Sin ingredientes: el platillo queda «{MENSAJES_CATALOGO.incompleto}» y no tiene costo
          estimado.
        </p>
      )}
      {filas.map((f, i) => {
        const compatibles = unidades.filter((u) => unidadCompatible(u, f.presentacion));
        const errorCantidad = errores[`ingredientes.${i}.cantidad`];
        const errorUnidad =
          errores[`ingredientes.${i}.unidadId`] ?? errores[`ingredientes.${i}.productoId`];
        return (
          <div key={f.productoId} className="mf-ingrediente">
            <span className="mf-ingrediente__nombre">
              {f.nombre}
              {!f.activo && (
                <span className="mf-chip mf-chip--incompleto" style={{ marginLeft: 8 }}>
                  Inactivo
                </span>
              )}
            </span>
            <div className="mf-campo">
              <label htmlFor={`cantidad-${i}`}>Cantidad de {f.nombre}</label>
              <input
                id={`cantidad-${i}`}
                inputMode="decimal"
                value={f.cantidad}
                aria-invalid={errorCantidad ? true : undefined}
                aria-describedby={errorCantidad ? `cantidad-${i}-error` : undefined}
                onChange={(e) => cambiar(i, { cantidad: e.target.value })}
              />
            </div>
            <div className="mf-campo">
              <label htmlFor={`unidad-${i}`}>Unidad de {f.nombre}</label>
              <select
                id={`unidad-${i}`}
                value={f.unidadId}
                aria-invalid={errorUnidad ? true : undefined}
                onChange={(e) => cambiarUnidad(i, e.target.value)}
              >
                {compatibles.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.codigo}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="mf-boton mf-boton--peligro"
              aria-label={`Quitar ${f.nombre}`}
              onClick={() => setFilas(filas.filter((_, j) => j !== i))}
            >
              Quitar
            </button>
            {errorCantidad && (
              <p
                id={`cantidad-${i}-error`}
                className="mf-campo__error"
                style={{ gridColumn: '1 / -1' }}
              >
                {errorCantidad}
              </p>
            )}
            {errorUnidad && (
              <p className="mf-campo__error" style={{ gridColumn: '1 / -1' }}>
                {errorUnidad}
              </p>
            )}
          </div>
        );
      })}

      <div className="mf-campo" style={{ marginTop: 16 }}>
        <label htmlFor="buscar-producto">Agregar ingrediente del catálogo</label>
        <input
          id="buscar-producto"
          type="search"
          placeholder="Pollo, tomate, crema…"
          value={busqueda}
          onChange={(e) => {
            setBusqueda(e.target.value);
            setCreando(false);
          }}
        />
      </div>
      {resultados && (
        <ul className="mf-resultados" aria-label="Productos encontrados">
          {resultados.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="mf-boton mf-boton--secundario"
                onClick={() => agregar(p)}
              >
                Agregar {p.etiqueta}
              </button>
            </li>
          ))}
          {!creando && texto && (
            <li>
              <button
                type="button"
                className="mf-boton mf-boton--secundario"
                onClick={() => setCreando(true)}
              >
                Crear producto «{texto}»
              </button>
            </li>
          )}
        </ul>
      )}
      {creando && (
        <FormularioProducto
          unidades={unidades}
          categorias={categorias}
          nombreInicial={texto}
          alGuardar={agregar}
          alCancelar={() => setCreando(false)}
        />
      )}

      <div className="mf-acciones">
        <button
          type="button"
          className="mf-boton mf-boton--primario"
          disabled={ocupado}
          onClick={() => void guardar()}
        >
          {ocupado ? 'Guardando…' : 'Guardar ingredientes'}
        </button>
      </div>

      {vista && vista.ingredientes.length > 0 && (
        <section
          aria-labelledby="titulo-vista-previa"
          className="mf-vista-previa"
          style={{ marginTop: 20 }}
        >
          <h2 id="titulo-vista-previa">Cantidades para tu hogar</h2>
          <div className="mf-campo">
            <label htmlFor="suma-factores">Porciones a preparar (Σ factores)</label>
            <input
              id="suma-factores"
              type="number"
              inputMode="decimal"
              min={0.25}
              step={0.25}
              value={suma}
              aria-describedby="suma-ayuda"
              onChange={(e) => setSuma(e.target.value)}
            />
            <p id="suma-ayuda" className="mf-campo__ayuda">
              {vista.origen === 'PORCIONES_BASE'
                ? 'Aún no hay comensales activos: se muestran las porciones base.'
                : 'Suma de los factores de porción de los comensales activos (RN-07).'}
            </p>
          </div>
          <ul className="mf-lista">
            {vista.ingredientes.map((i) => (
              <li key={i.productoId}>
                <span>{i.nombre}</span>
                <strong>
                  {sumaNumero > 0
                    ? formatearCantidad(
                        escalarCantidad(i.cantidadBase, porcionesGuardadas, sumaNumero),
                      )
                    : formatearCantidad(i.cantidadEscalada)}{' '}
                  {i.unidad}
                </strong>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
