import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { aCentavos, costosDelMenu, deCentavos } from '@menu/shared';
import { ProblemaApi, mensajeDeError } from '../api';
import { useApiConfiguracion } from '../api/contexto-configuracion';
import { useApiMenus } from '../api/contexto-menus';
import type {
  AdvertenciaPlan,
  AlternativasDelDia,
  DetalleMenu,
  MenuGenerado,
  TiempoMenu,
} from '../api/menus';
import { Cargando } from '../auth/Cargando';
import { CalendarioMenu } from './CalendarioMenu';
import { GrillaMenu } from './GrillaMenu';
import { PanelMotivo } from './PanelMotivo';
import { ResumenCostos } from './ResumenCostos';
import { PaginaBase } from './PaginaBase';
import { SelectorPlatillo } from './SelectorPlatillo';
import { SelectorVista } from './SelectorVista';
import {
  etiquetaDia,
  etiquetaEspacio,
  etiquetaSemana,
  fechaHoraGuatemala,
  sumarDiasFecha,
} from './fechas';
import { NOMBRES_TIEMPO } from './nombres-catalogo';
import { guardarVista, vistaGuardada, type VistaSemana } from './vista-semana';
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

/** CU-05.3: lo que dice cada tiempo sobre el presupuesto (CA-21.1 y CA-21.3). */
function EstadoPresupuesto({ t }: { t: TiempoMenu }) {
  if (t.estado === 'EXCEDE') {
    return (
      <>
        {' · '}costo Q{t.costoEstimado}
        {' · '}
        <span className="mf-exceso">Excede por Q{t.exceso}</span>
      </>
    );
  }
  if (t.costoEstimado === null) return null;
  if (t.estado === 'COSTO_INCOMPLETO') {
    return <> · costo conocido Q{t.costoEstimado} (incompleto)</>;
  }
  const disponible = (aCentavos(t.presupuesto) ?? 0) - (aCentavos(t.costoEstimado) ?? 0);
  return (
    <>
      {' · '}costo Q{t.costoEstimado}
      {' · '}
      <span className="mf-costo-ok">
        Dentro del presupuesto (Q{deCentavos(disponible)} disponibles)
      </span>
    </>
  );
}

/** Alternativas más baratas de un día, con el tiempo de comida al que pertenecen. */
interface BarataDelDia extends AlternativasDelDia {
  tiempo: TiempoMenu['tiempo'];
}

const alternativasDe = (menu: MenuGenerado): BarataDelDia[] =>
  menu.tiempos.flatMap((t) => (t.alternativas ?? []).map((a) => ({ ...a, tiempo: t.tiempo })));

/** Cambio que el servidor pidió confirmar porque incumple RN-02 o RN-03 (CU-06.1 3a). */
interface Pendiente {
  advertencias: AdvertenciaPlan[];
  accion: (confirmar: boolean) => Promise<MenuGenerado>;
}

/**
 * Plan de la semana: sugiere el menú, permite cambiar, mover y fijar platillos y aprobarlo
 * (HU-19, HU-24, HU-25).
 */
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
  const [aprobada, setAprobada] = useState(false);
  const [motivo, setMotivo] = useState<DetalleMenu | null>(null);
  const [baratas, setBaratas] = useState<BarataDelDia[]>([]);
  const [vista, setVista] = useState<VistaSemana>(vistaGuardada);

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
    setAprobada(false);
    setMotivo(null);
    setBaratas([]);
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
      const generado = await menus.generar({ semana, ...(regenerar ? { regenerar: true } : {}) });
      setMenu(generado);
      setBaratas(alternativasDe(generado));
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
      setBaratas([]);
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

  /** CU-06.2: aprobar no pide confirmación aunque haya exceso (D-03). */
  async function aprobar() {
    if (!menu) return;
    setOcupado(true);
    setError(null);
    try {
      const respuesta = await menus.aprobar(menu.id, menu.version);
      setMenu(respuesta.menu);
      setAprobada(true);
      setEditando(null);
      setMoviendo(null);
      setPendiente(null);
    } catch (e) {
      setError(mensajeDeError(e));
      // E3: si otro miembro ya lo aprobó o cambió, se muestra lo más reciente.
      if (
        e instanceof ProblemaApi &&
        (e.codigo === 'MENU_YA_APROBADO' || e.codigo === 'VERSION_DESACTUALIZADA')
      ) {
        setMenu(await menus.obtenerPorSemana(semana).catch(() => menu));
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
              <p role="status">
                {aprobada
                  ? 'Menú aprobado. La lista de compras de la semana quedó creada.'
                  : 'Este menú está aprobado: solo se puede consultar.'}
                {menu.aprobadoPor && menu.aprobadoEn && (
                  <>
                    {' '}
                    Aprobado por {menu.aprobadoPor.nombre} el {fechaHoraGuatemala(menu.aprobadoEn)}.
                  </>
                )}
              </p>
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
            <SelectorVista
              vista={vista}
              onCambiar={(v) => {
                setVista(v);
                guardarVista(v);
              }}
            />
            {vista === 'CALENDARIO' ? (
              <CalendarioMenu
                menu={menu}
                editable={editable}
                moviendo={moviendo}
                ocupado={ocupado}
                onMotivo={setMotivo}
                onAlternativa={(d) => void cambiar(() => menus.alternativa(menu.id, d.id))}
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
            ) : (
              <GrillaMenu
                menu={menu}
                editable={editable}
                moviendo={moviendo}
                ocupado={ocupado}
                onMotivo={setMotivo}
                onAlternativa={(d) => void cambiar(() => menus.alternativa(menu.id, d.id))}
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
            )}
            {motivo && (
              <PanelMotivo
                menuId={menu.id}
                detalleId={motivo.id}
                espacio={etiquetaEspacio(motivo)}
                onCerrar={() => setMotivo(null)}
              />
            )}
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
                  <EstadoPresupuesto t={t} />
                </li>
              ))}
            </ul>
            <ResumenCostos costos={costosDelMenu(menu)} />
            {editable && baratas.length > 0 && (
              <section aria-label="Alternativas más baratas">
                <h3>Alternativas más baratas</h3>
                <p>
                  El presupuesto no alcanza. Estas opciones cuestan menos que el platillo actual de
                  cada día:
                </p>
                <ul>
                  {baratas.map((a) => {
                    const espacio = menu.detalles.find(
                      (d) => d.fecha === a.fecha && d.tiempo === a.tiempo,
                    );
                    return (
                      <li key={`${a.fecha}:${a.tiempo}`}>
                        {etiquetaEspacio(a)}:{' '}
                        {a.platillos.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            className="mf-enlace"
                            disabled={ocupado || !espacio}
                            onClick={() =>
                              void cambiar((c) =>
                                menus.editar(menu.id, espacio!.id, {
                                  platilloId: p.id,
                                  ...(c ? { confirmar: true } : {}),
                                }),
                              )
                            }
                          >
                            Usar {p.nombre} (Q{p.costo})
                          </button>
                        ))}
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
            {editable && (
              <button
                type="button"
                className="mf-boton mf-boton--primario"
                disabled={ocupado}
                onClick={() => void aprobar()}
              >
                {ocupado ? 'Trabajando…' : 'Aprobar menú'}
              </button>
            )}
          </section>
        )}
      </div>
    </PaginaBase>
  );
}
