import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { NOMBRES_TIPO_PRODUCTO, TipoProducto } from '@menu/shared';
import { mensajeDeError } from '../api';
import type { Categoria, Producto, Unidad } from '../api/catalogo';
import { useApiCatalogo } from '../api/contexto-catalogo';
import { useAuth } from '../auth/contexto';
import { Cargando } from '../auth/Cargando';
import { FormularioProducto } from './FormularioProducto';
import { PaginaBase } from './PaginaBase';
import './acceso.css';
import './hogar.css';
import './catalogo.css';

/**
 * Catálogo > Productos (HU-13 · CU-03.3): catálogo común a todos los hogares (D-05) con
 * búsqueda, filtros por tipo y categoría y "Nuevo producto". Inactivar y reactivar solo los ve
 * el administrador del sistema.
 */
export default function Productos() {
  const api = useApiCatalogo();
  const { usuario } = useAuth();
  const esAdminSistema = Boolean(usuario?.esAdminSistema);
  const [q, setQ] = useState('');
  const [tipo, setTipo] = useState<TipoProducto | ''>('');
  const [categoria, setCategoria] = useState('');
  const [verInactivos, setVerInactivos] = useState(false);
  const [productos, setProductos] = useState<Producto[] | null>(null);
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [creando, setCreando] = useState(false);
  const [alerta, setAlerta] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.listarUnidades(), api.listarCategorias()])
      .then(([u, c]) => {
        setUnidades(u);
        setCategorias(c);
      })
      .catch((e: unknown) => setAlerta(mensajeDeError(e)));
  }, [api]);

  const cargar = useCallback(
    () =>
      api
        .listarProductos({
          q: q.trim(),
          tipo,
          categoria,
          activo: verInactivos ? 'false' : 'true',
          tamano: 100,
        })
        .then((p) => setProductos(p.datos))
        .catch((e: unknown) => setAlerta(mensajeDeError(e))),
    [api, q, tipo, categoria, verInactivos],
  );

  useEffect(() => {
    const espera = setTimeout(() => void cargar(), 250);
    return () => clearTimeout(espera);
  }, [cargar]);

  async function cambiarActivo(p: Producto) {
    setAlerta(null);
    try {
      if (p.activo) {
        const r = await api.inactivarProducto(p.id);
        const usados = r.platillosAfectados.map((x) => x.nombre).join(', ');
        setAviso(
          usados
            ? `${p.nombre} inactivado. Lo usan: ${usados}; verás la advertencia en esos platillos.`
            : `${p.nombre} inactivado.`,
        );
      } else {
        await api.reactivarProducto(p.id);
        setAviso(`${p.nombre} reactivado.`);
      }
      await cargar();
    } catch (error) {
      setAlerta(mensajeDeError(error));
    }
  }

  return (
    <PaginaBase titulo="Productos">
      <div className="mf-catalogo">
        <p style={{ margin: '0 0 12px' }}>
          <Link className="mf-enlace" to="/platillos">
            ← Volver a platillos
          </Link>
        </p>
        {aviso && (
          <div className="mf-aviso" role="status">
            <p>{aviso}</p>
          </div>
        )}
        {alerta && (
          <div className="mf-alerta" role="alert">
            <p>{alerta}</p>
          </div>
        )}
        {!creando && (
          <div className="mf-acciones" style={{ marginTop: 0, marginBottom: 16 }}>
            <button
              type="button"
              className="mf-boton mf-boton--primario"
              disabled={categorias.length === 0}
              onClick={() => setCreando(true)}
            >
              Nuevo producto
            </button>
          </div>
        )}
        {creando && (
          <FormularioProducto
            unidades={unidades}
            categorias={categorias}
            nombreInicial={q.trim()}
            alGuardar={(p) => {
              setCreando(false);
              setAviso(`Guardado: ${p.etiqueta}`);
              void cargar();
            }}
            alCancelar={() => setCreando(false)}
            alAbrirExistente={() => setCreando(false)}
          />
        )}

        <div className="mf-campo" style={{ marginTop: 16 }}>
          <label htmlFor="buscar-producto-catalogo">Buscar producto</label>
          <input
            id="buscar-producto-catalogo"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="mf-filtros">
          <div className="mf-campo">
            <label htmlFor="filtro-tipo">Tipo</label>
            <select
              id="filtro-tipo"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoProducto | '')}
            >
              <option value="">Todos</option>
              <option value={TipoProducto.INGREDIENTE}>{NOMBRES_TIPO_PRODUCTO.INGREDIENTE}</option>
              <option value={TipoProducto.DESPENSA}>{NOMBRES_TIPO_PRODUCTO.DESPENSA}</option>
            </select>
          </div>
          <div className="mf-campo">
            <label htmlFor="filtro-categoria">Categoría</label>
            <select
              id="filtro-categoria"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
            >
              <option value="">Todas</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.codigo}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>
        <label className="mf-opcion" style={{ marginBottom: 12 }}>
          <input
            type="checkbox"
            checked={verInactivos}
            onChange={(e) => setVerInactivos(e.target.checked)}
          />
          Ver inactivos
        </label>

        {!productos && <Cargando />}
        {productos && productos.length === 0 && <p className="mf-texto-suave">Sin coincidencias</p>}
        {productos && productos.length > 0 && (
          <section className="mf-tarjeta" aria-label="Lista de productos">
            {productos.map((p) => (
              <div key={p.id} className="mf-item-catalogo">
                <span className="mf-item-catalogo__datos">
                  <strong>{p.etiqueta}</strong>
                  <span>
                    {p.categoria.nombre} · {NOMBRES_TIPO_PRODUCTO[p.tipo]}
                    {!p.activo && ' · Inactivo'}
                  </span>
                </span>
                {esAdminSistema && (
                  <button
                    type="button"
                    className={
                      p.activo ? 'mf-boton mf-boton--peligro' : 'mf-boton mf-boton--secundario'
                    }
                    aria-label={`${p.activo ? 'Inactivar' : 'Reactivar'} ${p.nombre}`}
                    onClick={() => void cambiarActivo(p)}
                  >
                    {p.activo ? 'Inactivar' : 'Reactivar'}
                  </button>
                )}
              </div>
            ))}
          </section>
        )}
      </div>
    </PaginaBase>
  );
}
