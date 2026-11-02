import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ProblemaApi, mensajeDeError } from '../api';
import { useApiConfiguracion } from '../api/contexto-configuracion';
import { useApiMenus } from '../api/contexto-menus';
import type { AdvertenciaPlan, DetalleMenu, MenuGenerado } from '../api/menus';
import { Cargando } from '../auth/Cargando';
import { GrillaMenu } from './GrillaMenu';
import { PaginaBase } from './PaginaBase';
import { SelectorPlatillo } from './SelectorPlatillo';
import { etiquetaDia, etiquetaEspacio, etiquetaSemana, sumarDiasFecha } from './fechas';
import { NOMBRES_TIEMPO } from './nombres-catalogo';
import './acceso.css';
import './hogar.css';
import './semana.css';

/** Cuántas semanas futuras se ofrecen para sugerir. */
const SEMANAS_OFRECIDAS = 4;

const TITULO_ESTADO = {
  BORRADOR: 'Borrador',
  APROBADO: 'Menú aprobado',
  HISTORICO: 'Menú histórico',
} as const;

/** Cambio que el servidor pidió confirmar porque incumple RN-02 o RN-03 (CU-06.1 3a). */
interface Pendiente {
  advertencias: AdvertenciaPlan[];
  accion: (confirmar: boolean) => Promise<MenuGenerado>;
}

/** Plan de la semana: sugiere el menú y permite cambiar, mover y fijar platillos (HU-19, HU-24). */
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
  const [editando, setEditando] = useState<DetalleMenu | null>(null);
  const [moviendo, setMoviendo] = useState<string | null>(null);
  const [pendiente, setPendiente] = useState<Pendiente | null>(null);

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

  // CU-06.1 paso 1: al elegir una semana se abre su menú si ya existe.
  useEffect(() => {
    if (!semana) return;
    let activo = true;
    setMenu(null);
    setEditando(null);
    setMoviendo(null);
    setPendiente(null);
    menus
      .obtenerPorSemana(semana)
      .then((m) => {
        if (activo) setMenu(m);
      })
      .catch((e: unknown) => {
        if (activo && !(e instanceof ProblemaApi && e.codigo === 'SIN_MENU')) {
          setError(mensajeDeError(e));
        }
      });
    return () => {
      activo = false;
    };
  }, [menus, semana]);

  async function sugerir(regenerar: boolean) {
    setOcupado(true);
    setError(null);
    setFaltan(false);
    setConfirmar(false);
    try {
      setMenu(await menus.generar({ semana, ...(regenerar ? { regenerar: true } : {}) }));
      setEditando(null);
      setMoviendo(null);
      setPendiente(null);
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

  /** Corre un cambio del menú; si incumple RN-02 o RN-03 pide confirmación y lo reintenta. */
  async function cambiar(
    accion: (confirmar: boolean) => Promise<MenuGenerado>,
    confirmado = false,
  ) {
    setOcupado(true);
    setError(null);
    try {
      setMenu(await accion(confirmado));
      setEditando(null);
      setMoviendo(null);
      setPendiente(null);
    } catch (e) {
      if (e instanceof ProblemaApi && e.codigo === 'CONFIRMACION_REQUERIDA') {
        setPendiente({ advertencias: (e.cuerpo.advertencias as AdvertenciaPlan[]) ?? [], accion });
      } else {
        setPendiente(null);
        setError(mensajeDeError(e));
      }
    } finally {
      setOcupado(false);
    }
  }

  const editable = menu?.estado === 'BORRADOR';
  const mover = (origenDetalleId: string, destinoDetalleId: string) =>
    void cambiar((c) =>
      menus.mover(menu!.id, {
        origenDetalleId,
        destinoDetalleId,
        ...(c ? { confirmar: true } : {}),
      }),
    );

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
                  setError(null);
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
              {ocupado ? 'Trabajando…' : 'Sugerir menú'}
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
            <h2 id="titulo-menu">
              {TITULO_ESTADO[menu.estado]} del {etiquetaSemana(menu.fechaInicio)}
            </h2>
            {menu.estado === 'APROBADO' && (
              <p role="status">Este menú está aprobado: solo se puede consultar.</p>
            )}
            {menu.estado === 'HISTORICO' && (
              <p role="status">Esta semana está en el historial: solo se puede consultar.</p>
            )}
            {menu.avisos.length > 0 && (
              <div className="mf-advertencia" role="status">
                {menu.avisos.map((a) => (
                  <p key={`${a.fecha}:${a.tiempo}`}>
                    {etiquetaDia(a.fecha)} · {NOMBRES_TIEMPO[a.tiempo].toLowerCase()}: {a.mensaje}
                  </p>
                ))}
              </div>
            )}
            {moviendo && (
              <p role="status">
                Elige el espacio de destino con <strong>Mover aquí</strong>, o arrastra el platillo.{' '}
                <button type="button" className="mf-enlace" onClick={() => setMoviendo(null)}>
                  Cancelar movimiento
                </button>
              </p>
            )}
            {pendiente && (
              <div className="mf-advertencia" role="alertdialog" aria-label="Confirmar cambio">
                {pendiente.advertencias.map((a) => (
                  <p key={`${a.codigo}:${a.fecha}`}>{a.mensaje}</p>
                ))}
                <p>¿Quieres guardar el cambio de todos modos?</p>
                <button
                  type="button"
                  className="mf-boton mf-boton--primario"
                  disabled={ocupado}
                  onClick={() => void cambiar(pendiente.accion, true)}
                >
                  Confirmar
                </button>{' '}
                <button
                  type="button"
                  className="mf-boton mf-boton--secundario"
                  onClick={() => setPendiente(null)}
                >
                  Cancelar cambio
                </button>
              </div>
            )}
            <GrillaMenu
              menu={menu}
              editable={editable}
              moviendo={moviendo}
              ocupado={ocupado}
              onCambiar={(d) => {
                setEditando(d);
                setMoviendo(null);
                setPendiente(null);
              }}
              onFijar={(d) => void cambiar(() => menus.fijar(menu.id, d.id, !d.fijado))}
              onIniciarMover={(d) => {
                setMoviendo(d.id);
                setEditando(null);
                setPendiente(null);
              }}
              onMover={mover}
            />
            {editable && editando && (
              <SelectorPlatillo
                espacio={etiquetaEspacio(editando)}
                tiempo={editando.tiempo}
                ocupado={ocupado}
                onCancelar={() => setEditando(null)}
                onElegir={(p) =>
                  void cambiar((c) =>
                    menus.editar(menu.id, editando.id, {
                      platilloId: p.id,
                      ...(c ? { confirmar: true } : {}),
                    }),
                  )
                }
              />
            )}
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
