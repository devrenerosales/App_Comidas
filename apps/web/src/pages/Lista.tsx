import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ProblemaApi, mensajeDeError } from '../api';
import { useApiConfiguracion } from '../api/contexto-configuracion';
import { useApiListas } from '../api/contexto-listas';
import { useApiMenus } from '../api/contexto-menus';
import type { ItemLista, ListaCompras } from '../api/listas';
import type { MenuGenerado } from '../api/menus';
import { Cargando } from '../auth/Cargando';
import { PaginaBase } from './PaginaBase';
import { etiquetaSemana, sumarDiasFecha } from './fechas';
import './acceso.css';
import './hogar.css';
import './semana.css';

/** Semanas que se ofrecen a partir de la que sigue al último menú aprobado: las ya aprobadas y las próximas. */
const SEMANAS_ANTERIORES = 8;
const SEMANAS_SIGUIENTES = 4;

/** "7 lb" cuando se compra por libra, "3 × bolsa 2 lb" cuando la presentación trae más contenido. */
function textoCompra(i: ItemLista): string {
  const p = i.presentacion;
  if (!p) return i.cantidadComprar;
  if (p.cantidad === '1' && p.unidadCompra === p.unidad) return `${i.cantidadComprar} ${p.unidad}`;
  return `${i.cantidadComprar} × ${p.texto}`;
}

function FilaItem({ item }: { item: ItemLista }) {
  const requerida = item.cantidadRequerida;
  return (
    <li className="mf-lista-item">
      <strong>{item.producto.nombre}</strong>
      <span>Comprar: {textoCompra(item)}</span>
      {requerida && (
        <small className="mf-menu-costo">
          Requerido: {requerida.cantidad} {requerida.unidad}
          {item.equivalente && ` (≈ ${item.equivalente.cantidad} ${item.equivalente.unidad})`}
        </small>
      )}
      {item.sinConversion && <small className="mf-dia-marca">Sin conversión</small>}
    </li>
  );
}

/**
 * Lista de compras de la semana (CU-07.1, HU-28): los ingredientes del menú aprobado sumados por
 * producto y en la unidad en que se compran. Un menú sin aprobar todavía no tiene lista.
 */
export default function Lista() {
  const configuracion = useApiConfiguracion();
  const menus = useApiMenus();
  const listas = useApiListas();
  const [semanas, setSemanas] = useState<string[] | null>(null);
  const [semana, setSemana] = useState('');
  const [menu, setMenu] = useState<MenuGenerado | null>(null);
  const [sinMenu, setSinMenu] = useState(false);
  const [lista, setLista] = useState<ListaCompras | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let activo = true;
    setError(null);
    configuracion
      .obtenerSemana()
      .then((c) => {
        if (!activo) return;
        const desde = c.proximaSemana.desde;
        setSemanas(
          Array.from({ length: SEMANAS_ANTERIORES + SEMANAS_SIGUIENTES }, (_, i) =>
            sumarDiasFecha(desde, (i - SEMANAS_ANTERIORES) * 7),
          ),
        );
        // Abre la semana más reciente ya planificada, que suele ser la que se está comprando.
        setSemana(sumarDiasFecha(desde, -7));
      })
      .catch((e: unknown) => {
        if (activo) setError(mensajeDeError(e));
      });
    return () => {
      activo = false;
    };
  }, [configuracion, intento]);

  // Al elegir una semana se abre su menú y, si está aprobado, su lista.
  useEffect(() => {
    if (!semana) return;
    let activo = true;
    setMenu(null);
    setSinMenu(false);
    setLista(null);
    setError(null);
    menus
      .obtenerPorSemana(semana)
      .then(async (m) => {
        if (!activo) return;
        setMenu(m);
        if (m.listaId) {
          const l = await listas.obtener(m.listaId);
          if (activo) setLista(l);
        }
      })
      .catch((e: unknown) => {
        if (!activo) return;
        if (e instanceof ProblemaApi && e.codigo === 'SIN_MENU') setSinMenu(true);
        else setError(mensajeDeError(e));
      });
    return () => {
      activo = false;
    };
  }, [menus, listas, semana, intento]);

  return (
    <PaginaBase titulo="Lista de compras">
      <div className="mf-hogar">
        {error && (
          <div className="mf-alerta" role="alert">
            <p>{error}</p>
            <button
              type="button"
              className="mf-boton mf-boton--secundario"
              onClick={() => setIntento((n) => n + 1)}
            >
              Reintentar
            </button>
          </div>
        )}
        {!semanas ? (
          !error && <Cargando />
        ) : (
          <div className="mf-campo">
            <label htmlFor="semana-lista">Semana</label>
            <select id="semana-lista" value={semana} onChange={(e) => setSemana(e.target.value)}>
              {semanas.map((s) => (
                <option key={s} value={s}>
                  {etiquetaSemana(s)}
                </option>
              ))}
            </select>
          </div>
        )}
        {sinMenu && (
          <p role="status">
            Esta semana todavía no tiene menú.{' '}
            <Link className="mf-enlace" to="/semana">
              Ir a Semana
            </Link>
          </p>
        )}
        {menu && menu.estado === 'BORRADOR' && (
          <p role="status">
            Aprueba el menú para generar la lista.{' '}
            <Link className="mf-enlace" to="/semana">
              Ir a Semana
            </Link>
          </p>
        )}
        {lista && (
          <section aria-labelledby="titulo-lista" className="mf-tarjeta">
            <h2 id="titulo-lista">Lista del {etiquetaSemana(lista.semana.desde)}</h2>
            {lista.excede && <p className="mf-exceso">{lista.excede.texto}</p>}
            <p>
              {lista.comprados} de {lista.total} productos
            </p>
            {lista.sinConversion > 0 && (
              <p className="mf-texto-suave">
                Hay productos sin conversión de unidades: revisa cuánto comprar de ellos.
              </p>
            )}
            {lista.items.length === 0 ? (
              <p>
                Los platillos de este menú todavía no tienen ingredientes, así que no hay productos
                que comprar.
              </p>
            ) : (
              <ul className="mf-lista" aria-label="Productos de la lista">
                {lista.items.map((i) => (
                  <FilaItem key={i.id} item={i} />
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </PaginaBase>
  );
}
