import { useCallback, useEffect, useId, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  FACTOR_PORCION_MAXIMO,
  FACTOR_PORCION_MINIMO,
  FACTOR_PORCION_SUGERIDO,
  LARGO_MAXIMO_NOMBRE_COMENSAL,
  MENSAJES_COMENSALES,
  Rol,
  TipoComensal,
  esFactorPorcionValido,
  formatearFactor,
  limpiarNombreComensal,
  mostrarFactor,
  normalizarNombreComensal,
  pasoFactor,
  totalPorciones,
} from '@menu/shared';
import { ProblemaApi, mensajeDeError } from '../api';
import type { Comensal } from '../api/comensales';
import { useApiComensales } from '../api/contexto-comensales';
import { Cargando } from '../auth/Cargando';
import { useAuth } from '../auth/contexto';
import { CampoTexto } from './CampoTexto';
import { PaginaBase } from './PaginaBase';
import './acceso.css';
import './hogar.css';
import './comensales.css';

const NOMBRE_TIPO: Readonly<Record<TipoComensal, string>> = {
  ADULTO: 'Adulto',
  NINO: 'Niño',
};

interface PropsStepper {
  /** Completa los nombres accesibles: "de Rene" → "Subir porción de Rene". */
  sujeto: string;
  valor: number;
  onCambiar: (valor: number) => void;
  deshabilitado?: boolean;
}

/** −/+ en pasos de 0.25 dentro de 0.25–2.0 (D-02). Botones de 44 px con nombre accesible. */
export function StepperFactor({ sujeto, valor, onCambiar, deshabilitado }: PropsStepper) {
  return (
    <div className="mf-stepper" role="group" aria-label={`Porción ${sujeto}`}>
      <button
        type="button"
        className="mf-stepper__boton"
        aria-label={`Bajar porción ${sujeto}`}
        disabled={deshabilitado || valor <= FACTOR_PORCION_MINIMO}
        onClick={() => onCambiar(pasoFactor(valor, -1))}
      >
        −
      </button>
      <output className="mf-stepper__valor" aria-live="polite">
        {mostrarFactor(valor)}
      </output>
      <button
        type="button"
        className="mf-stepper__boton"
        aria-label={`Subir porción ${sujeto}`}
        disabled={deshabilitado || valor >= FACTOR_PORCION_MAXIMO}
        onClick={() => onCambiar(pasoFactor(valor, 1))}
      >
        +
      </button>
    </div>
  );
}

interface PropsEtiqueta {
  valor: TipoComensal;
  onCambiar: (tipo: TipoComensal) => void;
}

/** Etiqueta adulto / niño: solo informativa, no cambia las porciones (D-02). */
function SelectorEtiqueta({ valor, onCambiar }: PropsEtiqueta) {
  const nombre = useId();
  return (
    <fieldset className="mf-etiquetas">
      <legend>Etiqueta (opcional)</legend>
      {Object.values(TipoComensal).map((tipo) => (
        <label key={tipo} className="mf-etiquetas__opcion">
          <input
            type="radio"
            name={nombre}
            value={tipo}
            checked={valor === tipo}
            onChange={() => onCambiar(tipo)}
          />
          {NOMBRE_TIPO[tipo]}
        </label>
      ))}
      <p className="mf-campo__ayuda">Solo es informativa: no cambia las porciones.</p>
    </fieldset>
  );
}

interface Edicion {
  id: string;
  nombre: string;
  tipo: TipoComensal;
  error?: string;
}

/**
 * Pantalla "Comensales" (HU-03 · CU-01.3, D-02): lista con el factor de porción de cada comensal
 * y el total de porciones (Σ factores de activos, RN-07). El administrador agrega, edita el
 * nombre y la etiqueta, ajusta el factor con −/+ y quita (inactiva) con confirmación; el miembro
 * solo consulta (RN-10).
 */
export default function Comensales() {
  const { hogar } = useAuth();
  const api = useApiComensales();
  const esAdmin = hogar?.rol === Rol.ADMIN;

  const [comensales, setComensales] = useState<Comensal[] | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [borradores, setBorradores] = useState<Record<string, number>>({});
  const [edicion, setEdicion] = useState<Edicion | null>(null);
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState<TipoComensal>(TipoComensal.ADULTO);
  const [factor, setFactor] = useState<number>(FACTOR_PORCION_SUGERIDO);
  const [errorNombre, setErrorNombre] = useState<string | undefined>();
  const [inactivoRepetido, setInactivoRepetido] = useState<Comensal | null>(null);
  const [alerta, setAlerta] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    const lista = await api.listar(esAdmin);
    setComensales(lista.comensales);
    return lista.comensales;
  }, [api, esAdmin]);

  useEffect(() => {
    let vigente = true;
    api
      .listar(esAdmin)
      .then((lista) => vigente && setComensales(lista.comensales))
      .catch((error: unknown) => vigente && setErrorCarga(mensajeDeError(error)));
    return () => {
      vigente = false;
    };
  }, [api, esAdmin]);

  const activos = useMemo(() => (comensales ?? []).filter((c) => c.activo), [comensales]);
  const inactivos = useMemo(() => (comensales ?? []).filter((c) => !c.activo), [comensales]);
  const factorDe = (c: Comensal) => borradores[c.id] ?? Number(c.factorPorcion);
  const cambios = activos.filter(
    (c) => borradores[c.id] !== undefined && borradores[c.id] !== Number(c.factorPorcion),
  );
  const total = totalPorciones(activos.map((c) => ({ factorPorcion: factorDe(c) })));
  const ninos = activos.filter((c) => c.tipo === TipoComensal.NINO).length;

  function limpiarMensajes() {
    setAlerta(null);
    setAviso(null);
  }

  /** Ejecuta una operación con la API, recarga la lista y muestra el aviso. */
  async function operar(fn: () => Promise<unknown>, exito: string): Promise<boolean> {
    limpiarMensajes();
    setOcupado(true);
    try {
      await fn();
      await cargar();
      setAviso(exito);
      return true;
    } catch (error) {
      setAlerta(mensajeDeError(error));
      return false;
    } finally {
      setOcupado(false);
    }
  }

  function repetido(nombreBuscado: string, exceptoId?: string): Comensal | undefined {
    const clave = normalizarNombreComensal(nombreBuscado);
    return (comensales ?? []).find(
      (c) => c.id !== exceptoId && normalizarNombreComensal(c.nombre) === clave,
    );
  }

  async function agregar(evento: FormEvent) {
    evento.preventDefault();
    limpiarMensajes();
    setInactivoRepetido(null);
    const limpio = limpiarNombreComensal(nombre);
    if (!limpio) {
      setErrorNombre(MENSAJES_COMENSALES.nombreObligatorio);
      return;
    }
    const existente = repetido(limpio);
    if (existente) {
      setErrorNombre(MENSAJES_COMENSALES.nombreRepetido);
      if (!existente.activo) setInactivoRepetido(existente);
      return;
    }
    if (!esFactorPorcionValido(factor)) {
      setAlerta(MENSAJES_COMENSALES.factorInvalido);
      return;
    }
    setErrorNombre(undefined);
    setOcupado(true);
    try {
      await api.crear({ nombre: limpio, tipo, factorPorcion: formatearFactor(factor) });
      await cargar();
      setAviso(`Agregamos a ${limpio} con porción ${mostrarFactor(factor)}.`);
      setNombre('');
      setTipo(TipoComensal.ADULTO);
      setFactor(FACTOR_PORCION_SUGERIDO);
    } catch (error) {
      if (error instanceof ProblemaApi && error.codigo === 'NOMBRE_REPETIDO') {
        setErrorNombre(error.message);
      } else if (error instanceof ProblemaApi && error.codigo === 'FACTOR_INVALIDO') {
        setAlerta(error.message);
      } else {
        setAlerta(mensajeDeError(error));
      }
    } finally {
      setOcupado(false);
    }
  }

  async function guardarFactores() {
    const pendientes = cambios;
    const ok = await operar(async () => {
      for (const c of pendientes) {
        await api.editar(c.id, { factorPorcion: formatearFactor(factorDe(c)) });
      }
    }, 'Cambios guardados.');
    if (ok) setBorradores({});
  }

  async function guardarEdicion(evento: FormEvent) {
    evento.preventDefault();
    if (!edicion) return;
    const limpio = limpiarNombreComensal(edicion.nombre);
    if (!limpio) {
      setEdicion({ ...edicion, error: MENSAJES_COMENSALES.nombreObligatorio });
      return;
    }
    if (repetido(limpio, edicion.id)) {
      setEdicion({ ...edicion, error: MENSAJES_COMENSALES.nombreRepetido });
      return;
    }
    limpiarMensajes();
    setOcupado(true);
    try {
      await api.editar(edicion.id, { nombre: limpio, tipo: edicion.tipo });
      await cargar();
      setEdicion(null);
      setAviso('Cambios guardados.');
    } catch (error) {
      if (error instanceof ProblemaApi && error.codigo === 'NOMBRE_REPETIDO') {
        setEdicion({ ...edicion, error: error.message });
      } else {
        setAlerta(mensajeDeError(error));
      }
    } finally {
      setOcupado(false);
    }
  }

  async function quitar(c: Comensal) {
    limpiarMensajes();
    if (activos.length <= 1) {
      setAlerta(MENSAJES_COMENSALES.ultimoComensal);
      return;
    }
    if (!window.confirm(`¿Quitar a ${c.nombre}? Dejará de contar en las porciones del hogar.`)) {
      return;
    }
    const ok = await operar(
      () => api.inactivar(c.id),
      `${c.nombre} ya no cuenta en las porciones.`,
    );
    if (ok) {
      setBorradores(({ [c.id]: _quitado, ...resto }) => resto);
    }
  }

  async function reactivar(c: Comensal) {
    const ok = await operar(() => api.reactivar(c.id), `${c.nombre} vuelve a contar.`);
    if (ok) {
      setInactivoRepetido(null);
      setErrorNombre(undefined);
      setNombre('');
    }
  }

  if (!comensales && !errorCarga) {
    return (
      <PaginaBase titulo="Comensales">
        <Cargando />
      </PaginaBase>
    );
  }

  return (
    <PaginaBase titulo="Comensales">
      <div className="mf-hogar mf-comensales">
        <Link className="mf-enlace" to="/configuracion/hogar">
          ← Hogar y usuarios
        </Link>
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

        {comensales && (
          <section className="mf-tarjeta mf-total" aria-labelledby="titulo-total">
            <h2 id="titulo-total">Total de porciones</h2>
            <p className="mf-total__valor" aria-live="polite">
              {mostrarFactor(total)}
            </p>
            <p className="mf-texto-suave">
              {activos.length === 1 ? '1 comensal' : `${activos.length} comensales`}
              {ninos > 0 && ` · ${ninos === 1 ? '1 niño' : `${ninos} niños`}`} · las cantidades del
              menú y de la lista se ajustan a este total.
            </p>
            {cambios.length > 0 && <p className="mf-total__pendiente">Sin guardar</p>}
          </section>
        )}

        {comensales && (
          <section className="mf-tarjeta" aria-labelledby="titulo-lista-comensales">
            <h2 id="titulo-lista-comensales">Quiénes comen en casa</h2>
            {activos.length === 0 ? (
              <p className="mf-texto-suave">
                {esAdmin
                  ? 'Aún no hay comensales. Agrega al menos uno para calcular las porciones.'
                  : 'Aún no hay comensales registrados.'}
              </p>
            ) : (
              <ul className="mf-lista mf-lista-comensales">
                {activos.map((c) =>
                  edicion?.id === c.id ? (
                    <li key={c.id}>
                      <form
                        className="mf-edicion"
                        noValidate
                        aria-label={`Editar a ${c.nombre}`}
                        onSubmit={(e) => void guardarEdicion(e)}
                      >
                        <CampoTexto
                          etiqueta="Nombre"
                          name="nombre-edicion"
                          maxLength={LARGO_MAXIMO_NOMBRE_COMENSAL}
                          value={edicion.nombre}
                          onChange={(e) =>
                            setEdicion({ ...edicion, nombre: e.target.value, error: undefined })
                          }
                          error={edicion.error}
                        />
                        <SelectorEtiqueta
                          valor={edicion.tipo}
                          onCambiar={(t) => setEdicion({ ...edicion, tipo: t })}
                        />
                        <div className="mf-acciones">
                          <button
                            type="submit"
                            className="mf-boton mf-boton--primario"
                            disabled={ocupado}
                          >
                            Guardar
                          </button>
                          <button
                            type="button"
                            className="mf-boton mf-boton--secundario"
                            onClick={() => setEdicion(null)}
                          >
                            Cancelar
                          </button>
                        </div>
                      </form>
                    </li>
                  ) : (
                    <li key={c.id}>
                      <span className="mf-lista__datos">
                        <strong>{c.nombre}</strong>
                        <span>
                          {NOMBRE_TIPO[c.tipo]}
                          {!esAdmin && ` · porción ${mostrarFactor(c.factorPorcion)}`}
                        </span>
                      </span>
                      {esAdmin && (
                        <span className="mf-comensal__acciones">
                          <StepperFactor
                            sujeto={`de ${c.nombre}`}
                            valor={factorDe(c)}
                            deshabilitado={ocupado}
                            onCambiar={(v) => setBorradores((b) => ({ ...b, [c.id]: v }))}
                          />
                          <button
                            type="button"
                            className="mf-boton mf-boton--secundario"
                            aria-label={`Editar a ${c.nombre}`}
                            onClick={() => setEdicion({ id: c.id, nombre: c.nombre, tipo: c.tipo })}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="mf-boton mf-boton--peligro"
                            aria-label={`Quitar a ${c.nombre}`}
                            disabled={ocupado}
                            onClick={() => void quitar(c)}
                          >
                            Quitar
                          </button>
                        </span>
                      )}
                    </li>
                  ),
                )}
              </ul>
            )}
            {esAdmin && cambios.length > 0 && (
              <div className="mf-acciones">
                <button
                  type="button"
                  className="mf-boton mf-boton--primario"
                  disabled={ocupado}
                  onClick={() => void guardarFactores()}
                >
                  Guardar cambios
                </button>
                <button
                  type="button"
                  className="mf-boton mf-boton--secundario"
                  onClick={() => setBorradores({})}
                >
                  Descartar
                </button>
              </div>
            )}
          </section>
        )}

        {comensales && esAdmin && (
          <section className="mf-tarjeta" aria-labelledby="titulo-agregar-comensal">
            <h2 id="titulo-agregar-comensal">Agregar comensal</h2>
            <form noValidate aria-label="Agregar comensal" onSubmit={(e) => void agregar(e)}>
              <CampoTexto
                etiqueta="Nombre del comensal"
                name="nombre"
                autoComplete="off"
                placeholder="Abuela Carmen"
                maxLength={LARGO_MAXIMO_NOMBRE_COMENSAL}
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                error={errorNombre}
              />
              {inactivoRepetido && (
                <p className="mf-texto-suave">
                  {inactivoRepetido.nombre} está quitado.{' '}
                  <button
                    type="button"
                    className="mf-boton mf-boton--secundario"
                    onClick={() => void reactivar(inactivoRepetido)}
                  >
                    Volver a agregar a {inactivoRepetido.nombre}
                  </button>
                </p>
              )}
              <SelectorEtiqueta valor={tipo} onCambiar={setTipo} />
              <div className="mf-campo">
                <span className="mf-campo__titulo">Porción</span>
                <StepperFactor sujeto="del nuevo comensal" valor={factor} onCambiar={setFactor} />
                <p className="mf-campo__ayuda">
                  1.0 es una porción de adulto. Usa 0.5 para un niño pequeño; de 0.25 a 2.0.
                </p>
              </div>
              <button className="mf-boton mf-boton--primario" type="submit" disabled={ocupado}>
                Agregar comensal
              </button>
            </form>
          </section>
        )}

        {comensales && esAdmin && inactivos.length > 0 && (
          <section className="mf-tarjeta" aria-labelledby="titulo-inactivos">
            <h2 id="titulo-inactivos">Quitados</h2>
            <ul className="mf-lista">
              {inactivos.map((c) => (
                <li key={c.id}>
                  <span className="mf-lista__datos">
                    <strong>{c.nombre}</strong>
                    <span>
                      {NOMBRE_TIPO[c.tipo]} · porción {mostrarFactor(c.factorPorcion)}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="mf-boton mf-boton--secundario"
                    aria-label={`Volver a agregar a ${c.nombre}`}
                    disabled={ocupado}
                    onClick={() => void reactivar(c)}
                  >
                    Volver a agregar
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {comensales && !esAdmin && (
          <p className="mf-texto-suave">{MENSAJES_COMENSALES.soloAdministrador}.</p>
        )}
      </div>
    </PaginaBase>
  );
}
