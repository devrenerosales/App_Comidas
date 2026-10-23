import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  MENSAJES_CONFIGURACION,
  ModoDistribucion,
  NOMBRE_TIEMPO,
  ORDEN_TIEMPOS,
  OpcionTiempos,
  Rol,
  aCentavos,
  calcularMontos,
  distribucionPorDefecto,
  formatoPorcentaje,
  formatoQuetzales,
  aEnteroX100,
  opcionDeTiempos,
  porcentajesDesdeMontos,
  tiemposDeOpcion,
  validarPresupuesto,
  validarSumaMontos,
  validarSumaPorcentajes,
  vistaPrevia,
  type PorTiempo,
  type TiempoComida,
  type VistaPrevia,
} from '@menu/shared';
import { ProblemaApi, mensajeDeError } from '../api';
import type {
  ConfiguracionGuardada,
  ConfiguracionHogar,
  RespuestaVistaPrevia,
} from '../api/configuracion';
import { useApiConfiguracion } from '../api/contexto-configuracion';
import { Cargando } from '../auth/Cargando';
import { useAuth } from '../auth/contexto';
import { CampoTexto } from './CampoTexto';
import { PaginaBase } from './PaginaBase';
import './acceso.css';
import './hogar.css';
import './configuracion.css';

type Valores = PorTiempo<string>;

const COLORES: Readonly<Record<TiempoComida, string>> = {
  DESAYUNO: '#C98A2B',
  ALMUERZO: '#2F6B4F',
  CENA: '#5B7FA6',
};

const fecha = new Intl.DateTimeFormat('es-GT', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
/** "1 de noviembre de 2026" a partir de AAAA-MM-DD. */
const fechaLarga = (dia: string) => fecha.format(new Date(`${dia}T00:00:00.000Z`));

const quetzales = (monto: string) => formatoQuetzales(aCentavos(monto) ?? 0);

function activosDe(config: ConfiguracionHogar): TiempoComida[] {
  return config.tiempos.filter((t) => t.activo).map((t) => t.tiempo);
}

/** Valores de los inputs para los tiempos dados a partir de porcentajes. */
function valoresDesde(
  porcentajes: PorTiempo<string | number>,
  modo: ModoDistribucion,
  presupuesto: string,
): Valores {
  if (modo === ModoDistribucion.MONTO && !validarPresupuesto(presupuesto)) {
    return calcularMontos(presupuesto, porcentajes);
  }
  const valores: Valores = {};
  for (const t of ORDEN_TIEMPOS) {
    const p = porcentajes[t];
    if (p !== undefined) valores[t] = formatoPorcentaje(aEnteroX100(p) as number);
  }
  return valores;
}

interface Reparto {
  /** Porcentajes resultantes (texto) o null si los valores no son válidos. */
  porcentajes: PorTiempo<string> | null;
  /** Mensaje de suma ("Faltan 5 % por asignar", "Excede el presupuesto por Q20.00") o error. */
  mensaje: string | null;
}

function calcularReparto(
  tiempos: readonly TiempoComida[],
  valores: Valores,
  modo: ModoDistribucion,
  presupuesto: string,
): Reparto {
  const propios: Valores = {};
  for (const t of tiempos) propios[t] = (valores[t] ?? '').trim();
  try {
    if (modo === ModoDistribucion.MONTO) {
      if (validarPresupuesto(presupuesto)) return { porcentajes: null, mensaje: null };
      const v = validarSumaMontos(presupuesto, propios);
      return v.valido
        ? { porcentajes: porcentajesDesdeMontos(presupuesto, propios), mensaje: null }
        : { porcentajes: null, mensaje: v.mensaje };
    }
    const v = validarSumaPorcentajes(propios);
    return v.valido
      ? { porcentajes: propios, mensaje: null }
      : { porcentajes: null, mensaje: v.mensaje };
  } catch {
    return {
      porcentajes: null,
      mensaje:
        modo === ModoDistribucion.MONTO
          ? MENSAJES_CONFIGURACION.montoInvalido
          : MENSAJES_CONFIGURACION.porcentajeInvalido,
    };
  }
}

/**
 * Pantalla "Tiempos de comida y presupuesto" (HU-05, HU-06, HU-07 · CU-02.1 a CU-02.3): elegir
 * solo almuerzo, dos tiempos o tres tiempos, el presupuesto semanal y su reparto en % o en Q
 * con validación en vivo, vista previa "Actual → Nuevo" antes de guardar y confirmación con los
 * menús afectados cuando cambian los tiempos. El miembro ve la configuración en solo lectura.
 */
export default function ConfiguracionTiempos() {
  const { hogar } = useAuth();
  const api = useApiConfiguracion();
  const esAdmin = hogar?.rol === Rol.ADMIN;

  const [config, setConfig] = useState<ConfiguracionHogar | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [opcion, setOpcion] = useState<OpcionTiempos>(OpcionTiempos.SOLO_ALMUERZO);
  const [marcados, setMarcados] = useState<TiempoComida[]>([]);
  const [presupuesto, setPresupuesto] = useState('');
  const [modo, setModo] = useState<ModoDistribucion>(ModoDistribucion.PORCENTAJE);
  const [valores, setValores] = useState<Valores>({});
  const [intentoContinuar, setIntentoContinuar] = useState(false);
  const [previa, setPrevia] = useState<RespuestaVistaPrevia | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [alerta, setAlerta] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  /** Deja el formulario igual a la configuración guardada. */
  const reiniciar = useCallback((c: ConfiguracionHogar) => {
    const activos = activosDe(c);
    setOpcion(opcionDeTiempos(activos) ?? OpcionTiempos.SOLO_ALMUERZO);
    setMarcados(activos);
    setPresupuesto(c.presupuestoSemanal);
    setModo(ModoDistribucion.PORCENTAJE);
    const porcentajes: PorTiempo<string> = {};
    for (const t of c.tiempos) if (t.activo) porcentajes[t.tiempo] = t.porcentaje;
    setValores(valoresDesde(porcentajes, ModoDistribucion.PORCENTAJE, c.presupuestoSemanal));
    setPrevia(null);
    setIntentoContinuar(false);
  }, []);

  useEffect(() => {
    let activo = true;
    api
      .obtener()
      .then((c) => {
        if (!activo) return;
        setConfig(c);
        reiniciar(c);
      })
      .catch((error: unknown) => activo && setErrorCarga(mensajeDeError(error)));
    return () => {
      activo = false;
    };
  }, [api, reiniciar]);

  const seleccion = useMemo(() => tiemposDeOpcion(opcion, marcados), [opcion, marcados]);
  const tiemposNuevos = seleccion.valido ? seleccion.tiempos : null;
  const claveActual = config ? activosDe(config).join('+') : '';
  // Con una selección no válida también se pide "Continuar" (CA-05.3 muestra el error al intentarlo).
  const cambianTiempos = tiemposNuevos === null || tiemposNuevos.join('+') !== claveActual;
  const errorPresupuesto = validarPresupuesto(presupuesto);
  const reparto = useMemo(
    () => (tiemposNuevos ? calcularReparto(tiemposNuevos, valores, modo, presupuesto) : null),
    [tiemposNuevos, valores, modo, presupuesto],
  );

  /** Vista previa local "Actual → Nuevo" (mismas reglas que la API, @menu/shared). */
  const local: VistaPrevia | null = useMemo(() => {
    if (!config || !tiemposNuevos || errorPresupuesto || !reparto?.porcentajes) return null;
    return vistaPrevia(config, tiemposNuevos, presupuesto, reparto.porcentajes);
  }, [config, tiemposNuevos, errorPresupuesto, reparto, presupuesto]);

  const hayCambios = Boolean(local?.impacto.some((i) => i.cambio !== 'SIN_CAMBIO'));
  const puedeGuardar = Boolean(local) && !ocupado;

  /** Al cambiar los tiempos se propone la distribución por defecto (supuesto de CU-02.3). */
  function elegirTiempos(nuevaOpcion: OpcionTiempos, nuevosMarcados: TiempoComida[]) {
    setOpcion(nuevaOpcion);
    setMarcados(nuevosMarcados);
    setPrevia(null);
    setAviso(null);
    const sel = tiemposDeOpcion(nuevaOpcion, nuevosMarcados);
    if (sel.valido)
      setValores(valoresDesde(distribucionPorDefecto(sel.tiempos), modo, presupuesto));
  }

  function alternarMarcado(tiempo: TiempoComida, marcado: boolean) {
    const nuevos = marcado ? [...marcados, tiempo] : marcados.filter((t) => t !== tiempo);
    elegirTiempos(OpcionTiempos.DOS_TIEMPOS, nuevos);
  }

  function cambiarModo(nuevo: ModoDistribucion) {
    if (nuevo === modo) return;
    const base =
      reparto?.porcentajes ?? (tiemposNuevos ? distribucionPorDefecto(tiemposNuevos) : {});
    setModo(nuevo);
    setValores(valoresDesde(base, nuevo, presupuesto));
  }

  function usarSugerida() {
    if (tiemposNuevos) {
      setValores(valoresDesde(distribucionPorDefecto(tiemposNuevos), modo, presupuesto));
    }
  }

  function cancelar() {
    setAlerta(null);
    setAviso(null);
    if (config) reiniciar(config);
  }

  async function manejarError(error: unknown) {
    if (error instanceof ProblemaApi && error.codigo === 'VERSION_DESACTUALIZADA') {
      setAlerta(error.message);
      setPrevia(null);
      const c = await api.obtener().catch(() => null);
      if (c) setConfig(c);
      return;
    }
    setAlerta(mensajeDeError(error));
  }

  function terminar(guardada: ConfiguracionGuardada) {
    setConfig(guardada);
    reiniciar(guardada);
    const n = guardada.borradoresDesactualizados.length;
    setAviso(
      n === 0
        ? 'Configuración guardada.'
        : `Configuración guardada. ${n === 1 ? '1 menú en borrador quedó' : `${n} menús en borrador quedaron`} "Desactualizado": regenéralo desde Semana.`,
    );
  }

  const distribucion = () =>
    (tiemposNuevos ?? []).map((tiempo) => ({
      tiempo,
      porcentaje: reparto?.porcentajes?.[tiempo] as string,
    }));

  async function continuar() {
    setIntentoContinuar(true);
    setAlerta(null);
    if (!tiemposNuevos || errorPresupuesto || !reparto?.porcentajes) return;
    setOcupado(true);
    try {
      setPrevia(
        await api.vistaPrevia({
          tiempos: tiemposNuevos,
          presupuestoSemanal: presupuesto.trim(),
          distribucion: distribucion(),
        }),
      );
    } catch (error) {
      await manejarError(error);
    } finally {
      setOcupado(false);
    }
  }

  async function guardar(evento?: FormEvent) {
    evento?.preventDefault();
    if (!config || !local || !tiemposNuevos) return;
    setAlerta(null);
    setOcupado(true);
    try {
      const guardada = cambianTiempos
        ? await api.guardarTiempos({
            version: previa?.version ?? config.version,
            presupuestoSemanal: presupuesto.trim(),
            tiempos: distribucion(),
          })
        : await api.guardarPresupuesto({
            version: config.version,
            presupuestoSemanal: presupuesto.trim(),
            modo,
            distribucion: tiemposNuevos.map((tiempo) =>
              modo === ModoDistribucion.MONTO
                ? { tiempo, monto: (valores[tiempo] ?? '').trim() }
                : { tiempo, porcentaje: (valores[tiempo] ?? '').trim() },
            ),
          });
      terminar(guardada);
    } catch (error) {
      await manejarError(error);
    } finally {
      setOcupado(false);
    }
  }

  if (!config && !errorCarga) {
    return (
      <PaginaBase titulo="Tiempos y presupuesto">
        <Cargando />
      </PaginaBase>
    );
  }

  return (
    <PaginaBase titulo="Tiempos y presupuesto">
      <div className="mf-hogar mf-config">
        {errorCarga && (
          <div className="mf-alerta" role="alert">
            <p>{errorCarga}</p>
          </div>
        )}
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

        {config && !esAdmin && <SoloLectura config={config} />}

        {config && esAdmin && (
          <form noValidate onSubmit={(e) => void guardar(e)} aria-label="Tiempos y presupuesto">
            <fieldset className="mf-config__opciones" disabled={previa !== null}>
              <legend>¿Qué tiempos planificas?</legend>
              <label className={opcionClase(opcion === OpcionTiempos.SOLO_ALMUERZO)}>
                <input
                  type="radio"
                  name="opcion-tiempos"
                  checked={opcion === OpcionTiempos.SOLO_ALMUERZO}
                  onChange={() => elegirTiempos(OpcionTiempos.SOLO_ALMUERZO, [])}
                />
                Solo almuerzo
              </label>
              <div className={opcionClase(opcion === OpcionTiempos.DOS_TIEMPOS)}>
                <label className="mf-config__opcion-titulo">
                  <input
                    type="radio"
                    name="opcion-tiempos"
                    checked={opcion === OpcionTiempos.DOS_TIEMPOS}
                    onChange={() => elegirTiempos(OpcionTiempos.DOS_TIEMPOS, marcados)}
                  />
                  Dos tiempos
                </label>
                {opcion === OpcionTiempos.DOS_TIEMPOS && (
                  <div className="mf-config__casillas" role="group" aria-label="Elige dos tiempos">
                    {ORDEN_TIEMPOS.map((t) => (
                      <label key={t} className="mf-config__casilla">
                        <input
                          type="checkbox"
                          checked={marcados.includes(t)}
                          onChange={(e) => alternarMarcado(t, e.target.checked)}
                        />
                        {NOMBRE_TIEMPO[t]}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <label className={opcionClase(opcion === OpcionTiempos.TRES_TIEMPOS)}>
                <input
                  type="radio"
                  name="opcion-tiempos"
                  checked={opcion === OpcionTiempos.TRES_TIEMPOS}
                  onChange={() => elegirTiempos(OpcionTiempos.TRES_TIEMPOS, [])}
                />
                Tres tiempos <span className="mf-texto-suave">· desayuno, almuerzo y cena</span>
              </label>
              {!seleccion.valido && (intentoContinuar || marcados.length > 0) && (
                <p className="mf-campo__error" role="alert">
                  {seleccion.mensaje}
                </p>
              )}
            </fieldset>

            <section className="mf-tarjeta" aria-labelledby="titulo-presupuesto">
              <h2 id="titulo-presupuesto">Presupuesto semanal</h2>
              <CampoTexto
                etiqueta="Presupuesto semanal en quetzales (Q)"
                name="presupuesto"
                inputMode="decimal"
                autoComplete="off"
                value={presupuesto}
                onChange={(e) => {
                  setPresupuesto(e.target.value);
                  setAviso(null);
                }}
                error={errorPresupuesto ?? undefined}
              />
            </section>

            {tiemposNuevos && reparto && (
              <section className="mf-tarjeta" aria-labelledby="titulo-reparto">
                <div className="mf-config__encabezado">
                  <h2 id="titulo-reparto">Vista previa del reparto</h2>
                  {hayCambios && <span className="mf-config__sin-guardar">Sin guardar</span>}
                </div>

                <fieldset className="mf-config__modo">
                  <legend>Repartir por</legend>
                  {[
                    [ModoDistribucion.PORCENTAJE, 'Porcentaje'],
                    [ModoDistribucion.MONTO, 'Quetzales'],
                  ].map(([valor, texto]) => (
                    <label key={valor} className="mf-config__casilla">
                      <input
                        type="radio"
                        name="modo"
                        checked={modo === valor}
                        onChange={() => cambiarModo(valor as ModoDistribucion)}
                      />
                      {texto}
                    </label>
                  ))}
                </fieldset>

                {local && (
                  <div className="mf-config__barra" aria-hidden="true">
                    {local.nuevo.map((r) => (
                      <span
                        key={r.tiempo}
                        style={{ width: `${r.porcentaje}%`, background: COLORES[r.tiempo] }}
                      />
                    ))}
                  </div>
                )}

                <table className="mf-config__tabla">
                  <caption className="mf-visualmente-oculto">
                    Reparto actual y nuevo por tiempo de comida
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Tiempo</th>
                      <th scope="col">Actual</th>
                      <th scope="col">Nuevo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ORDEN_TIEMPOS.filter(
                      (t) =>
                        tiemposNuevos.includes(t) ||
                        config.tiempos.some((c) => c.tiempo === t && c.activo),
                    ).map((t) => {
                      const actual = config.tiempos.find((c) => c.tiempo === t && c.activo);
                      const nuevo = local?.nuevo.find((r) => r.tiempo === t);
                      const activo = tiemposNuevos.includes(t);
                      return (
                        <tr key={t} data-tiempo={t}>
                          <th scope="row">
                            <span
                              className="mf-config__color"
                              style={{ background: COLORES[t] }}
                              aria-hidden="true"
                            />
                            {NOMBRE_TIEMPO[t]}
                          </th>
                          <td>
                            {actual
                              ? `${quetzales(actual.monto)} · ${formatoPorcentaje(aEnteroX100(actual.porcentaje) as number)} %`
                              : '—'}
                          </td>
                          <td>
                            {activo ? (
                              <span className="mf-config__nuevo">
                                <span className="mf-config__entrada">
                                  {modo === ModoDistribucion.MONTO && (
                                    <span aria-hidden="true">Q</span>
                                  )}
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    aria-label={
                                      modo === ModoDistribucion.MONTO
                                        ? `Monto de ${NOMBRE_TIEMPO[t]} en quetzales`
                                        : `Porcentaje de ${NOMBRE_TIEMPO[t]}`
                                    }
                                    value={valores[t] ?? ''}
                                    onChange={(e) => {
                                      setValores({ ...valores, [t]: e.target.value });
                                      setAviso(null);
                                    }}
                                  />
                                  {modo === ModoDistribucion.PORCENTAJE && (
                                    <span aria-hidden="true">%</span>
                                  )}
                                </span>
                                <span className="mf-config__equivalente">
                                  {nuevo
                                    ? modo === ModoDistribucion.MONTO
                                      ? `${formatoPorcentaje(aEnteroX100(nuevo.porcentaje) as number)} %`
                                      : quetzales(nuevo.monto)
                                    : ''}
                                </span>
                              </span>
                            ) : (
                              'Se quita'
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <div className="mf-config__suma" role="status" aria-live="polite">
                  {reparto.mensaje ? (
                    <span className="mf-config__suma--error">{reparto.mensaje}</span>
                  ) : local ? (
                    <span>Suma 100 % · {quetzales(local.presupuestoSemanal)}</span>
                  ) : null}
                  <button
                    type="button"
                    className="mf-enlace mf-config__sugerida"
                    onClick={usarSugerida}
                  >
                    Usar distribución sugerida
                  </button>
                </div>
                <p className="mf-texto-suave mf-config__nota">
                  Los porcentajes deben sumar 100 %. Los menús ya aprobados conservan la
                  configuración con que se aprobaron.
                </p>
              </section>
            )}

            {previa && (
              <section
                className="mf-tarjeta mf-config__confirmar"
                aria-labelledby="titulo-confirmar"
              >
                <h2 id="titulo-confirmar">Confirma el cambio de tiempos</h2>
                <p>
                  La nueva configuración se usa desde la semana del{' '}
                  <strong>{fechaLarga(previa.aplicaDesde)}</strong>.
                </p>
                {previa.menusAprobadosConservados.length > 0 && (
                  <p>
                    Menús aprobados que no cambian:{' '}
                    {previa.menusAprobadosConservados
                      .map((m) => `semana del ${fechaLarga(m.fechaInicio)}`)
                      .join(', ')}
                    .
                  </p>
                )}
                {previa.borradoresADesactualizar.length > 0 && (
                  <p>
                    Se marcarán "Desactualizado" para que los regeneres:{' '}
                    {previa.borradoresADesactualizar
                      .map((m) => `semana del ${fechaLarga(m.fechaInicio)}`)
                      .join(', ')}
                    . Sus platillos no se cambian automáticamente.
                  </p>
                )}
              </section>
            )}

            <div className="mf-config__acciones">
              <button
                type="button"
                className="mf-boton mf-boton--secundario"
                onClick={cancelar}
                disabled={ocupado}
              >
                Cancelar
              </button>
              {cambianTiempos && !previa ? (
                <button
                  type="button"
                  className="mf-boton mf-boton--primario"
                  onClick={() => void continuar()}
                  disabled={ocupado}
                >
                  Continuar
                </button>
              ) : cambianTiempos ? (
                <button
                  type="submit"
                  className="mf-boton mf-boton--primario"
                  disabled={!puedeGuardar}
                >
                  {ocupado ? 'Guardando…' : 'Confirmar'}
                </button>
              ) : (
                <button
                  type="submit"
                  className="mf-boton mf-boton--primario"
                  disabled={!puedeGuardar || !seleccion.valido}
                >
                  {ocupado ? 'Guardando…' : 'Guardar'}
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </PaginaBase>
  );
}

function opcionClase(elegida: boolean): string {
  return elegida ? 'mf-config__opcion mf-config__opcion--elegida' : 'mf-config__opcion';
}

/** Vista del miembro (RN-10): la configuración vigente sin controles de edición. */
function SoloLectura({ config }: { config: ConfiguracionHogar }) {
  return (
    <section className="mf-tarjeta" aria-labelledby="titulo-vigente">
      <h2 id="titulo-vigente">Configuración vigente</h2>
      <p>
        Presupuesto semanal: <strong>{quetzales(config.presupuestoSemanal)}</strong>
      </p>
      <ul className="mf-lista">
        {config.tiempos
          .filter((t) => t.activo)
          .map((t) => (
            <li key={t.tiempo}>
              <strong>{NOMBRE_TIEMPO[t.tiempo]}</strong>
              <span>
                {formatoPorcentaje(aEnteroX100(t.porcentaje) as number)} % · {quetzales(t.monto)}
              </span>
            </li>
          ))}
      </ul>
      <p className="mf-texto-suave">{MENSAJES_CONFIGURACION.soloAdminTiempos}.</p>
    </section>
  );
}
