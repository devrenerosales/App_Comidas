import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  FRECUENCIAS_DESPENSA,
  MENSAJES_DESPENSA,
  NOMBRE_FRECUENCIA,
  SEMANAS_POR_FRECUENCIA,
  cantidadValida,
  formatearCantidad,
  type FrecuenciaDespensa,
} from '@menu/shared';
import { mensajeDeError } from '../api';
import type { Producto } from '../api/catalogo';
import { useApiCatalogo } from '../api/contexto-catalogo';
import { useApiDespensa } from '../api/contexto-despensa';
import type { ProductoDespensa } from '../api/despensa';
import { Cargando } from '../auth/Cargando';
import { PaginaBase } from './PaginaBase';
import { etiquetaSemana } from './fechas';
import './acceso.css';
import './hogar.css';
import './semana.css';

const textoFrecuencia = (f: FrecuenciaDespensa): string => {
  const semanas = SEMANAS_POR_FRECUENCIA[f];
  return `${NOMBRE_FRECUENCIA[f]} (cada ${semanas === 1 ? 'semana' : `${semanas} semanas`})`;
};

function SelectorFrecuencia({
  id,
  valor,
  alCambiar,
}: {
  id: string;
  valor: FrecuenciaDespensa;
  alCambiar: (f: FrecuenciaDespensa) => void;
}) {
  return (
    <div className="mf-campo">
      <label htmlFor={id}>Frecuencia</label>
      <select
        id={id}
        value={valor}
        onChange={(e) => alCambiar(e.target.value as FrecuenciaDespensa)}
      >
        {FRECUENCIAS_DESPENSA.map((f) => (
          <option key={f} value={f}>
            {textoFrecuencia(f)}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Cuándo toca el producto: en la próxima lista o a partir de qué semana (CU-07.2 paso 3). */
function textoToca(d: ProductoDespensa): string {
  if (d.tocaEstaSemana) return 'Toca en la próxima lista';
  return d.proximaInclusion
    ? `Vuelve a tocar la semana del ${etiquetaSemana(d.proximaInclusion)}`
    : 'Toca en la próxima lista';
}

function FormularioEdicion({
  item,
  alGuardar,
  alCerrar,
}: {
  item: ProductoDespensa;
  alGuardar: (cambios: {
    cantidad: string;
    frecuencia: FrecuenciaDespensa;
    notas: string;
  }) => Promise<string | null>;
  alCerrar: () => void;
}) {
  const nombre = item.producto.nombre;
  const [cantidad, setCantidad] = useState(formatearCantidad(item.cantidad));
  const [frecuencia, setFrecuencia] = useState(item.frecuencia);
  const [notas, setNotas] = useState(item.notas ?? '');
  const [error, setError] = useState<string | null>(null);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (cantidadValida(cantidad) === null) {
      setError(MENSAJES_DESPENSA.cantidad);
      return;
    }
    const fallo = await alGuardar({ cantidad: cantidad.trim(), frecuencia, notas: notas.trim() });
    if (fallo) setError(fallo);
    else alCerrar();
  }

  return (
    <form onSubmit={(e) => void guardar(e)} aria-label={`Editar ${nombre}`} noValidate>
      <div className="mf-campo">
        <label htmlFor={`cantidad-${item.id}`}>Cantidad (presentaciones)</label>
        <input
          id={`cantidad-${item.id}`}
          inputMode="decimal"
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
        />
      </div>
      <SelectorFrecuencia
        id={`frecuencia-${item.id}`}
        valor={frecuencia}
        alCambiar={setFrecuencia}
      />
      <div className="mf-campo">
        <label htmlFor={`notas-${item.id}`}>Nota (opcional)</label>
        <input
          id={`notas-${item.id}`}
          maxLength={200}
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
        />
      </div>
      {error && (
        <p className="mf-exceso" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="mf-boton mf-boton--secundario">
        Guardar cambios
      </button>{' '}
      <button type="button" className="mf-enlace" onClick={alCerrar}>
        Cancelar
      </button>
    </form>
  );
}

/** Alta de un producto de despensa: se busca en el catálogo común y se elige cantidad y frecuencia. */
function AgregarADespensa({
  yaEnDespensa,
  alAgregar,
}: {
  yaEnDespensa: ReadonlySet<string>;
  alAgregar: (datos: {
    productoId: string;
    cantidad: string;
    frecuencia: FrecuenciaDespensa;
    notas: string;
  }) => Promise<string | null>;
}) {
  const catalogo = useApiCatalogo();
  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState<Producto[]>([]);
  const [productoId, setProductoId] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [frecuencia, setFrecuencia] = useState<FrecuenciaDespensa>('MENSUAL');
  const [notas, setNotas] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResultados([]);
      return;
    }
    let activo = true;
    const espera = setTimeout(() => {
      catalogo
        .listarProductos({ q: q.trim(), activo: 'true', tamano: 20 })
        .then((p) => {
          if (!activo) return;
          setResultados(p.datos.filter((x) => !yaEnDespensa.has(x.id)));
          setProductoId('');
        })
        .catch((e: unknown) => {
          if (activo) setError(mensajeDeError(e));
        });
    }, 250);
    return () => {
      activo = false;
      clearTimeout(espera);
    };
  }, [catalogo, q, yaEnDespensa]);

  async function agregar(e: FormEvent) {
    e.preventDefault();
    if (!productoId) {
      setError('Elige un producto del catálogo');
      return;
    }
    if (cantidadValida(cantidad) === null) {
      setError(MENSAJES_DESPENSA.cantidad);
      return;
    }
    const fallo = await alAgregar({
      productoId,
      cantidad: cantidad.trim(),
      frecuencia,
      notas: notas.trim(),
    });
    if (fallo) {
      setError(fallo);
      return;
    }
    setError(null);
    setQ('');
    setResultados([]);
    setProductoId('');
    setCantidad('1');
    setNotas('');
  }

  return (
    <form onSubmit={(e) => void agregar(e)} aria-label="Agregar a la despensa" noValidate>
      <h3>Agregar a la despensa</h3>
      <div className="mf-campo">
        <label htmlFor="despensa-buscar">Buscar producto</label>
        <input id="despensa-buscar" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {resultados.length > 0 && (
        <div className="mf-campo">
          <label htmlFor="despensa-producto">Producto</label>
          <select
            id="despensa-producto"
            value={productoId}
            onChange={(e) => setProductoId(e.target.value)}
          >
            <option value="">Elige un producto</option>
            {resultados.map((p) => (
              <option key={p.id} value={p.id}>
                {p.etiqueta}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="mf-campo">
        <label htmlFor="despensa-cantidad">Cantidad (presentaciones)</label>
        <input
          id="despensa-cantidad"
          inputMode="decimal"
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
        />
      </div>
      <SelectorFrecuencia id="despensa-frecuencia" valor={frecuencia} alCambiar={setFrecuencia} />
      <div className="mf-campo">
        <label htmlFor="despensa-notas">Nota (opcional)</label>
        <input
          id="despensa-notas"
          maxLength={200}
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
        />
      </div>
      {error && (
        <p className="mf-exceso" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="mf-boton">
        Agregar a la despensa
      </button>
    </form>
  );
}

/**
 * Despensa del hogar (CU-07.2, HU-29): los productos que se compran de forma recurrente. Al
 * aprobar el menú de una semana, la lista incluye los que tocan según su frecuencia.
 */
export default function Despensa() {
  const api = useApiDespensa();
  const [items, setItems] = useState<ProductoDespensa[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);

  const cargar = useCallback(() => {
    setError(null);
    api
      .listar()
      .then(setItems)
      .catch((e: unknown) => setError(mensajeDeError(e)));
  }, [api]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const yaEnDespensa = new Set((items ?? []).map((i) => i.producto.id));

  /** Devuelve el mensaje de error o null si se guardó. */
  async function agregar(datos: Parameters<typeof api.agregar>[0]): Promise<string | null> {
    try {
      const nuevo = await api.agregar({ ...datos, notas: datos.notas || undefined });
      setItems((actuales) =>
        [...(actuales ?? []), nuevo].sort((a, b) =>
          a.producto.nombre.localeCompare(b.producto.nombre, 'es'),
        ),
      );
      return null;
    } catch (e) {
      return mensajeDeError(e);
    }
  }

  async function guardar(
    id: string,
    cambios: { cantidad: string; frecuencia: FrecuenciaDespensa; notas: string },
  ): Promise<string | null> {
    try {
      const actualizado = await api.actualizar(id, cambios);
      setItems((actuales) => (actuales ?? []).map((i) => (i.id === id ? actualizado : i)));
      return null;
    } catch (e) {
      return mensajeDeError(e);
    }
  }

  async function quitar(id: string) {
    try {
      await api.quitar(id);
      setItems((actuales) => (actuales ?? []).filter((i) => i.id !== id));
    } catch (e) {
      setError(mensajeDeError(e));
    }
  }

  return (
    <PaginaBase titulo="Despensa">
      <div className="mf-hogar">
        <p>
          Los productos que compras cada cierto tiempo, como arroz, aceite o azúcar. La lista de
          cada semana incluye automáticamente los que tocan.
        </p>
        {error && (
          <div className="mf-alerta" role="alert">
            <p>{error}</p>
            <button type="button" className="mf-boton mf-boton--secundario" onClick={cargar}>
              Reintentar
            </button>
          </div>
        )}
        {!items ? (
          !error && <Cargando />
        ) : (
          <section aria-labelledby="titulo-despensa" className="mf-tarjeta">
            <h2 id="titulo-despensa">Tu despensa</h2>
            {items.length === 0 ? (
              <p>Todavía no hay productos en la despensa.</p>
            ) : (
              <ul className="mf-lista" aria-label="Productos de la despensa">
                {items.map((d) => (
                  <li key={d.id} className="mf-lista-item">
                    <strong>{d.producto.nombre}</strong>
                    <span>
                      Cantidad: {formatearCantidad(d.cantidad)} · {textoFrecuencia(d.frecuencia)}
                    </span>
                    <small className="mf-menu-costo">{d.producto.etiqueta}</small>
                    <small className={d.tocaEstaSemana ? 'mf-dia-marca' : 'mf-texto-suave'}>
                      {textoToca(d)}
                    </small>
                    {d.notas && <small className="mf-texto-suave">Nota: {d.notas}</small>}
                    {editando === d.id ? (
                      <FormularioEdicion
                        item={d}
                        alGuardar={(c) => guardar(d.id, c)}
                        alCerrar={() => setEditando(null)}
                      />
                    ) : (
                      <span className="mf-menu-acciones">
                        <button
                          type="button"
                          className="mf-enlace"
                          aria-label={`Editar ${d.producto.nombre}`}
                          onClick={() => setEditando(d.id)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="mf-enlace"
                          aria-label={`Quitar ${d.producto.nombre} de la despensa`}
                          onClick={() => void quitar(d.id)}
                        >
                          Quitar
                        </button>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <AgregarADespensa yaEnDespensa={yaEnDespensa} alAgregar={agregar} />
          </section>
        )}
        <p>
          <Link className="mf-enlace" to="/lista">
            Volver a la lista de compras
          </Link>
        </p>
      </div>
    </PaginaBase>
  );
}
