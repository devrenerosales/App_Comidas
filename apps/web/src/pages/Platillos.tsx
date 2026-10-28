import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MENSAJES_CATALOGO,
  NOMBRES_PROTEINA,
  ORDEN_TIEMPOS,
  ProteinaPrincipal,
  type TiempoComida,
} from '@menu/shared';
import { mensajeDeError } from '../api';
import type { FiltrosPlatillos, ResumenPlatillo } from '../api/catalogo';
import { useApiCatalogo } from '../api/contexto-catalogo';
import { Cargando } from '../auth/Cargando';
import { NOMBRES_TIEMPO } from './nombres-catalogo';
import { PaginaBase } from './PaginaBase';
import './acceso.css';
import './hogar.css';
import './catalogo.css';

type Estado = NonNullable<FiltrosPlatillos['estado']>;
const ESTADOS: readonly { valor: Estado; texto: string }[] = [
  { valor: 'ACTIVO', texto: 'Activos' },
  { valor: 'INCOMPLETO', texto: 'Incompletos' },
  { valor: 'INACTIVO', texto: 'Inactivos' },
];

/**
 * Catálogo > Platillos (HU-11 · CU-03.1): lista del hogar con búsqueda por texto (sin tildes),
 * filtros por tiempo de comida, proteína y estado, marca "Incompleto" y acceso a productos.
 */
export default function Platillos() {
  const api = useApiCatalogo();
  const [q, setQ] = useState('');
  const [tiempo, setTiempo] = useState<TiempoComida | ''>('');
  const [proteina, setProteina] = useState<ProteinaPrincipal | ''>('');
  const [estado, setEstado] = useState<Estado>('ACTIVO');
  const [platillos, setPlatillos] = useState<ResumenPlatillo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    const espera = setTimeout(() => {
      api
        .listarPlatillos({ q: q.trim(), tiempo, proteina, estado })
        .then((pagina) => {
          if (!vigente) return;
          setPlatillos(pagina.datos);
          setError(null);
        })
        .catch((e: unknown) => vigente && setError(mensajeDeError(e)));
    }, 250);
    return () => {
      vigente = false;
      clearTimeout(espera);
    };
  }, [api, q, tiempo, proteina, estado]);

  const texto = q.trim();
  return (
    <PaginaBase titulo="Platillos">
      <div className="mf-catalogo">
        <div className="mf-acciones" style={{ marginTop: 0, marginBottom: 16 }}>
          <Link className="mf-boton mf-boton--primario" to="/platillos/nuevo">
            Nuevo platillo
          </Link>
          <Link className="mf-boton mf-boton--secundario" to="/platillos/productos">
            Catálogo de productos
          </Link>
        </div>

        <div className="mf-campo">
          <label htmlFor="buscar-platillo">Buscar platillo</label>
          <input
            id="buscar-platillo"
            type="search"
            placeholder="Pepián, pollo, caldo…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="mf-filtros">
          <div className="mf-campo">
            <label htmlFor="filtro-tiempo">Tiempo de comida</label>
            <select
              id="filtro-tiempo"
              value={tiempo}
              onChange={(e) => setTiempo(e.target.value as TiempoComida | '')}
            >
              <option value="">Todos</option>
              {ORDEN_TIEMPOS.map((t) => (
                <option key={t} value={t}>
                  {NOMBRES_TIEMPO[t]}
                </option>
              ))}
            </select>
          </div>
          <div className="mf-campo">
            <label htmlFor="filtro-proteina">Proteína principal</label>
            <select
              id="filtro-proteina"
              value={proteina}
              onChange={(e) => setProteina(e.target.value as ProteinaPrincipal | '')}
            >
              <option value="">Todas</option>
              {Object.values(ProteinaPrincipal).map((p) => (
                <option key={p} value={p}>
                  {NOMBRES_PROTEINA[p]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mf-segmentos" role="group" aria-label="Estado de los platillos">
          {ESTADOS.map((e) => (
            <button
              key={e.valor}
              type="button"
              className="mf-boton mf-boton--secundario"
              aria-pressed={estado === e.valor}
              onClick={() => setEstado(e.valor)}
            >
              {e.texto}
            </button>
          ))}
        </div>

        {error && (
          <div className="mf-alerta" role="alert">
            <p>{error}</p>
          </div>
        )}
        {!platillos && !error && <Cargando />}
        {platillos && platillos.length === 0 && (
          <section className="mf-tarjeta" aria-live="polite">
            <p>{texto ? MENSAJES_CATALOGO.sinCoincidencias : 'Aún no hay platillos aquí.'}</p>
            {texto && (
              <Link
                className="mf-boton mf-boton--secundario"
                to={`/platillos/nuevo?nombre=${encodeURIComponent(texto)}`}
              >
                Crear «{texto}»
              </Link>
            )}
          </section>
        )}
        {platillos && platillos.length > 0 && (
          <section className="mf-tarjeta" aria-label="Lista de platillos">
            {platillos.map((p) => (
              <Link key={p.id} className="mf-item-catalogo" to={`/platillos/${p.id}`}>
                <span className="mf-item-catalogo__datos">
                  <strong>{p.nombre}</strong>
                  <span>
                    {p.tiempos.map((t) => NOMBRES_TIEMPO[t]).join(', ')} ·{' '}
                    {NOMBRES_PROTEINA[p.proteinaPrincipal]}
                    {p.etiquetas.length > 0 && ` · ${p.etiquetas.join(', ')}`}
                  </span>
                </span>
                <span className="mf-chips">
                  {p.incompleto && (
                    <span className="mf-chip mf-chip--incompleto">
                      {MENSAJES_CATALOGO.incompleto}
                    </span>
                  )}
                  {p.ingredientesInactivos > 0 && (
                    <span className="mf-chip mf-chip--incompleto">Ingrediente inactivo</span>
                  )}
                  {!p.activo && <span className="mf-chip mf-chip--inactivo">Inactivo</span>}
                </span>
              </Link>
            ))}
          </section>
        )}
      </div>
    </PaginaBase>
  );
}
