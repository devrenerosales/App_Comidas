import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { mensajeDeError } from '../api';
import { useApiTablero } from '../api/contexto-tablero';
import type { SemanaTablero, Tablero } from '../api/tablero';
import { Cargando } from '../auth/Cargando';
import { GraficaPresupuesto } from './GraficaPresupuesto';
import { Medidor } from './Medidor';
import { PaginaBase } from './PaginaBase';
import { fechaCompleta } from './supermercados';
import {
  aNumero,
  diasRestantes,
  fechaCorta,
  NOMBRE_TIEMPO,
  nivelMedidor,
  quetzales,
  resumenAhorro,
  ritmoDiario,
} from './tablero';
import './hogar.css';
import './inicio.css';

const dinero = (monto: string | null): string => {
  const n = aNumero(monto);
  return n === null ? '—' : quetzales(n);
};

/** Resultado de una semana frente a su presupuesto, en palabras (el color solo acompaña). */
function resultado(s: SemanaTablero): string {
  const presupuesto = aNumero(s.presupuesto);
  const gasto = aNumero(s.gastoReal);
  if (presupuesto === null || gasto === null) return 'Sin gasto registrado';
  const dif = Math.round((gasto - presupuesto) * 100) / 100;
  return dif > 0 ? `Excede por Q${dif.toFixed(2)}` : 'Dentro del presupuesto';
}

const textoNivel = {
  normal: 'Vas dentro del presupuesto',
  cerca: 'Estás cerca del límite',
  excede: 'Superaste el presupuesto',
} as const;

/** Inicio: cómo va la semana (gasto, comidas de hoy, costo por tiempo) e historial de presupuesto. */
export default function Inicio() {
  const api = useApiTablero();
  const [tablero, setTablero] = useState<Tablero | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let activo = true;
    setError(null);
    api
      .obtener()
      .then((t) => activo && setTablero(t))
      .catch((e: unknown) => activo && setError(mensajeDeError(e)));
    return () => {
      activo = false;
    };
  }, [api, intento]);

  const actual = tablero?.semanaActual ?? null;
  const presupuesto = aNumero(actual?.presupuesto ?? null);
  const gastoReal = aNumero(actual?.gastoReal ?? null);
  const estimado = aNumero(actual?.costoEstimado ?? null);
  // Sin gasto real se muestra el costo estimado del menú como cifra de referencia.
  const cifra = gastoReal ?? estimado;
  const nivel =
    cifra !== null && presupuesto !== null ? nivelMedidor(cifra, presupuesto) : 'normal';
  const restante = presupuesto !== null && cifra !== null ? presupuesto - cifra : null;
  const dias = actual && tablero ? diasRestantes(tablero.hoy, actual.fechaFin) : 1;
  const ahorro = tablero ? resumenAhorro(tablero.historial) : null;

  return (
    <PaginaBase titulo="Inicio">
      <div className="mf-inicio">
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
        {tablero === null ? (
          !error && <Cargando />
        ) : (
          <>
            <section aria-labelledby="titulo-semana-actual" className="mf-hero">
              {actual === null ? (
                <>
                  <h2 id="titulo-semana-actual" className="mf-hero__etiqueta">
                    Esta semana
                  </h2>
                  <p className="mf-hero__sub">
                    Todavía no hay un menú aprobado para esta semana.{' '}
                    <Link className="mf-enlace" to="/semana">
                      Ir a Semana
                    </Link>
                  </p>
                </>
              ) : (
                <>
                  <h2 id="titulo-semana-actual" className="mf-hero__etiqueta">
                    {gastoReal === null ? 'Costo estimado del menú' : 'Gasto de la semana'}
                  </h2>
                  <p className="mf-hero__fechas">
                    {fechaCompleta(actual.fechaInicio)} al {fechaCompleta(actual.fechaFin)}
                  </p>
                  <p className="mf-hero__valor">
                    {gastoReal === null && estimado === null
                      ? 'Sin registrar'
                      : dinero(String(cifra))}
                  </p>
                  {presupuesto !== null && cifra !== null && (
                    <>
                      <p className="mf-hero__sub">
                        de {quetzales(presupuesto)} de presupuesto ·{' '}
                        {presupuesto > 0 ? Math.round((cifra / presupuesto) * 100) : 0} %
                      </p>
                      <Medidor
                        etiqueta="Gasto frente al presupuesto"
                        valor={cifra}
                        maximo={presupuesto}
                        nivel={nivel}
                      />
                      <p className={`mf-hero__estado mf-hero__estado--${nivel}`}>
                        {textoNivel[nivel]}
                      </p>
                    </>
                  )}
                  {gastoReal === null && (
                    <p className="mf-hero__sub">
                      Aún no registras el gasto real.{' '}
                      <Link className="mf-enlace" to="/semana">
                        Registrar gasto real
                      </Link>
                    </p>
                  )}
                </>
              )}
            </section>

            {actual && restante !== null && (
              <dl className="mf-kpis" aria-label="Resumen de la semana">
                <div className="mf-kpi">
                  <dt>{restante >= 0 ? 'Te quedan' : 'Te pasaste'}</dt>
                  <dd
                    className={
                      restante < 0 ? 'mf-kpi__valor mf-kpi__valor--error' : 'mf-kpi__valor'
                    }
                  >
                    {quetzales(Math.abs(restante))}
                  </dd>
                </div>
                <div className="mf-kpi">
                  <dt>Por día</dt>
                  <dd className="mf-kpi__valor">{quetzales(ritmoDiario(restante, dias))}</dd>
                  <dd className="mf-kpi__nota">
                    {dias} {dias === 1 ? 'día' : 'días'} restantes
                  </dd>
                </div>
                {ahorro && ahorro.semanas > 0 && (
                  <div className="mf-kpi">
                    <dt>Ahorro acumulado</dt>
                    <dd
                      className={
                        ahorro.ahorro < 0 ? 'mf-kpi__valor mf-kpi__valor--error' : 'mf-kpi__valor'
                      }
                    >
                      {ahorro.ahorro < 0 ? '−' : '+'}
                      {quetzales(Math.abs(ahorro.ahorro))}
                    </dd>
                    <dd className="mf-kpi__nota">
                      en {ahorro.semanas} {ahorro.semanas === 1 ? 'semana' : 'semanas'}
                    </dd>
                  </div>
                )}
              </dl>
            )}

            {actual && (
              <section aria-labelledby="titulo-hoy" className="mf-tarjeta mf-seccion">
                <h2 id="titulo-hoy">Hoy · {fechaCorta(tablero.hoy)}</h2>
                {actual.comidasDeHoy.length === 0 ? (
                  <p className="mf-texto-suave">No hay comidas planificadas para hoy.</p>
                ) : (
                  <ul className="mf-hoy" aria-label="Comidas de hoy">
                    {actual.comidasDeHoy.map((c) => (
                      <li key={c.tiempo}>
                        <span className="mf-chip">{NOMBRE_TIEMPO[c.tiempo] ?? c.tiempo}</span>
                        <strong>{c.platillo ?? 'Sin sugerencia'}</strong>
                        <span className="mf-texto-suave">{dinero(c.costoEstimado)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mf-texto-suave mf-seccion__pie">
                  <strong>
                    {actual.comidasHastaHoy} de {actual.comidasPlanificadas}
                  </strong>{' '}
                  comidas de la semana ya pasaron · costo estimado Q{actual.costoEstimadoHastaHoy}
                </p>
                <Medidor
                  etiqueta="Comidas transcurridas de la semana"
                  valor={actual.comidasHastaHoy}
                  maximo={Math.max(actual.comidasPlanificadas, 1)}
                  fino
                />
              </section>
            )}

            {actual && actual.tiempos.length > 0 && (
              <section aria-labelledby="titulo-tiempos" className="mf-tarjeta mf-seccion">
                <h2 id="titulo-tiempos">Costo por tiempo de comida</h2>
                <ul className="mf-tiempos" aria-label="Costo estimado por tiempo de comida">
                  {actual.tiempos.map((t) => {
                    const costo = aNumero(t.costoEstimado);
                    const tope = aNumero(t.presupuesto) ?? 0;
                    return (
                      <li key={t.tiempo}>
                        <div className="mf-tiempos__fila">
                          <strong>{NOMBRE_TIEMPO[t.tiempo] ?? t.tiempo}</strong>
                          <span>
                            {dinero(t.costoEstimado)} de {dinero(t.presupuesto)}
                          </span>
                        </div>
                        {costo !== null && (
                          <Medidor
                            etiqueta={`${NOMBRE_TIEMPO[t.tiempo] ?? t.tiempo}: costo frente a su presupuesto`}
                            valor={costo}
                            maximo={tope}
                            nivel={nivelMedidor(costo, tope)}
                            fino
                          />
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            <section
              aria-labelledby="titulo-historial-presupuesto"
              className="mf-tarjeta mf-seccion"
            >
              <h2 id="titulo-historial-presupuesto">Historial de presupuesto</h2>
              {tablero.historial.length === 0 ? (
                <p className="mf-texto-suave">Aún no hay semanas aprobadas.</p>
              ) : (
                <>
                  <GraficaPresupuesto historial={tablero.historial} />
                  {ahorro && ahorro.promedio !== null && (
                    <p className="mf-texto-suave">
                      Gasto promedio: <strong>{quetzales(ahorro.promedio)}</strong> por semana.
                    </p>
                  )}
                  <h3 className="mf-seccion__subtitulo">Detalle por semana</h3>
                  <ul className="mf-lista" aria-label="Historial de presupuesto">
                    {tablero.historial.map((s) => (
                      <li key={s.id} className="mf-lista-item">
                        <strong>
                          {fechaCorta(s.fechaInicio)} al {fechaCorta(s.fechaFin)}
                        </strong>
                        <span>
                          Presupuesto {dinero(s.presupuesto)} · Gasto {dinero(s.gastoReal)}
                        </span>
                        <small
                          className={
                            resultado(s).startsWith('Excede')
                              ? 'mf-resultado mf-resultado--excede'
                              : 'mf-resultado'
                          }
                        >
                          {resultado(s)}
                        </small>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>

            <p>
              <Link className="mf-enlace" to="/historial">
                Ver historial de comidas
              </Link>
            </p>
          </>
        )}
      </div>
    </PaginaBase>
  );
}
