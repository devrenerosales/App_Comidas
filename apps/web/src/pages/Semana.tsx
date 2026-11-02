import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ORDEN_TIEMPOS } from '@menu/shared';
import { ProblemaApi, mensajeDeError } from '../api';
import { useApiConfiguracion } from '../api/contexto-configuracion';
import { useApiMenus } from '../api/contexto-menus';
import type { MenuGenerado } from '../api/menus';
import { Cargando } from '../auth/Cargando';
import { PaginaBase } from './PaginaBase';
import { etiquetaDia, etiquetaSemana, sumarDiasFecha } from './fechas';
import { NOMBRES_TIEMPO } from './nombres-catalogo';
import './acceso.css';
import './hogar.css';
import './semana.css';

/** Cuántas semanas futuras se ofrecen para sugerir. */
const SEMANAS_OFRECIDAS = 4;

/** Plan de la semana: pide la sugerencia del motor y muestra la grilla día × tiempo (HU-19). */
export default function Semana() {
  const configuracion = useApiConfiguracion();
  const menus = useApiMenus();
  const [semanas, setSemanas] = useState<string[] | null>(null);
  const [semana, setSemana] = useState('');
  const [menu, setMenu] = useState<MenuGenerado | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [faltan, setFaltan] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
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
          Array.from({ length: SEMANAS_OFRECIDAS }, (_, i) => sumarDiasFecha(desde, i * 7)),
        );
        setSemana(desde);
      })
      .catch((e: unknown) => {
        if (activo) setError(mensajeDeError(e));
      });
    return () => {
      activo = false;
    };
  }, [configuracion, intento]);

  async function sugerir(regenerar: boolean) {
    setOcupado(true);
    setError(null);
    setFaltan(false);
    setConfirmar(false);
    try {
      setMenu(await menus.generar({ semana, ...(regenerar ? { regenerar: true } : {}) }));
    } catch (e) {
      if (e instanceof ProblemaApi && e.codigo === 'BORRADOR_EXISTENTE') setConfirmar(true);
      else {
        setError(mensajeDeError(e));
        setFaltan(e instanceof ProblemaApi && e.codigo === 'FALTAN_PLATILLOS');
      }
    } finally {
      setOcupado(false);
    }
  }

  const fechas = menu ? [...new Set(menu.detalles.map((d) => d.fecha))] : [];
  const tiempos = menu ? ORDEN_TIEMPOS.filter((t) => menu.tiempos.some((x) => x.tiempo === t)) : [];

  return (
    <PaginaBase titulo="Semana">
      <div className="mf-hogar">
        {error && (
          <div className="mf-alerta" role="alert">
            <p>{error}</p>
            {faltan && (
              <Link className="mf-enlace" to="/platillos">
                Ir al catálogo de platillos
              </Link>
            )}
            {!semanas && (
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
        {!semanas ? (
          !error && <Cargando />
        ) : (
          <section aria-labelledby="titulo-sugerir">
            <h2 id="titulo-sugerir">Sugerir menú</h2>
            <p>La app propone un platillo por día para los tiempos de comida que planificas.</p>
            <div className="mf-campo">
              <label htmlFor="semana-menu">Semana</label>
              <select
                id="semana-menu"
                value={semana}
                disabled={ocupado}
                onChange={(e) => {
                  setSemana(e.target.value);
                  setConfirmar(false);
                }}
              >
                {semanas.map((s) => (
                  <option key={s} value={s}>
                    {etiquetaSemana(s)}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="mf-boton mf-boton--primario"
              disabled={ocupado}
              onClick={() => void sugerir(false)}
            >
              {ocupado ? 'Sugiriendo…' : 'Sugerir menú'}
            </button>
            {confirmar && (
              <div className="mf-advertencia" role="alert">
                <p>
                  Esta semana ya tiene un borrador. Si lo regeneras, los platillos fijados se
                  conservan y el resto se reemplaza.
                </p>
                <button
                  type="button"
                  className="mf-boton mf-boton--primario"
                  disabled={ocupado}
                  onClick={() => void sugerir(true)}
                >
                  Regenerar
                </button>{' '}
                <button
                  type="button"
                  className="mf-boton mf-boton--secundario"
                  onClick={() => setConfirmar(false)}
                >
                  Cancelar
                </button>
              </div>
            )}
          </section>
        )}
        {menu && (
          <section aria-labelledby="titulo-menu" className="mf-tarjeta">
            <h2 id="titulo-menu">Borrador del {etiquetaSemana(menu.fechaInicio)}</h2>
            {menu.avisos.length > 0 && (
              <div className="mf-advertencia" role="status">
                {menu.avisos.map((a) => (
                  <p key={`${a.fecha}:${a.tiempo}`}>
                    {etiquetaDia(a.fecha)} · {NOMBRES_TIEMPO[a.tiempo].toLowerCase()}: {a.mensaje}
                  </p>
                ))}
              </div>
            )}
            <div className="mf-menu-tabla">
              <table aria-label="Menú de la semana">
                <thead>
                  <tr>
                    <th scope="col">Día</th>
                    {tiempos.map((t) => (
                      <th scope="col" key={t}>
                        {NOMBRES_TIEMPO[t]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fechas.map((fecha) => (
                    <tr key={fecha}>
                      <th scope="row">{etiquetaDia(fecha)}</th>
                      {tiempos.map((t) => {
                        const d = menu.detalles.find((x) => x.fecha === fecha && x.tiempo === t);
                        return (
                          <td key={t}>
                            {d?.platillo ? (
                              <>
                                {d.platillo.nombre}
                                {d.fijado && <small> (fijado)</small>}
                              </>
                            ) : (
                              <span className="mf-menu-vacio">Sin sugerencia</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              <strong>Presupuesto semanal:</strong> Q{menu.presupuestoSemanal}
            </p>
            <ul aria-label="Presupuesto por tiempo">
              {menu.tiempos.map((t) => (
                <li key={t.tiempo}>
                  {NOMBRES_TIEMPO[t.tiempo]}: presupuesto Q{t.presupuesto}
                </li>
              ))}
            </ul>
            {menu.costoIncompleto && (
              <p className="mf-texto-suave">
                Costo estimado incompleto: todavía no hay precios para los ingredientes.
              </p>
            )}
          </section>
        )}
      </div>
    </PaginaBase>
  );
}
