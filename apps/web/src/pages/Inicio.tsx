import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { mensajeDeError } from '../api';
import { useApiTablero } from '../api/contexto-tablero';
import type { SemanaTablero, Tablero } from '../api/tablero';
import { Cargando } from '../auth/Cargando';
import { PaginaBase } from './PaginaBase';
import { fechaCompleta } from './supermercados';
import './hogar.css';

const quetzales = (monto: string | null): string => (monto === null ? '—' : `Q${monto}`);

const corta = (fecha: string): string => `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`;

/** Diferencia entre el gasto y el presupuesto de una semana ("Dentro" / "Excede por Q__"). */
function resultado(s: SemanaTablero): string {
  if (s.presupuesto === null || s.gastoReal === null) return 'Sin gasto registrado';
  const dif = Math.round((Number(s.gastoReal) - Number(s.presupuesto)) * 100) / 100;
  return dif > 0 ? `Excede por Q${dif.toFixed(2)}` : 'Dentro del presupuesto';
}

/** Inicio: gasto y consumo de comidas de la semana en curso, e historial de presupuesto. */
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
  const presupuesto = actual?.presupuesto ? Number(actual.presupuesto) : null;
  const gasto = actual?.gastoReal !== null && actual ? Number(actual.gastoReal) : null;

  return (
    <PaginaBase titulo="Inicio">
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
        {tablero === null ? (
          !error && <Cargando />
        ) : (
          <>
            <section aria-labelledby="titulo-semana-actual" className="mf-tarjeta">
              <h2 id="titulo-semana-actual">Esta semana</h2>
              {actual === null ? (
                <p className="mf-texto-suave">
                  Todavía no hay un menú aprobado para esta semana.{' '}
                  <Link className="mf-enlace" to="/semana">
                    Ir a Semana
                  </Link>
                </p>
              ) : (
                <>
                  <p className="mf-texto-suave">
                    {fechaCompleta(actual.fechaInicio)} al {fechaCompleta(actual.fechaFin)}
                  </p>
                  <h3>Gasto actual</h3>
                  <p>
                    <strong>
                      {gasto === null ? 'Sin registrar' : quetzales(actual.gastoReal)}
                    </strong>
                    {presupuesto !== null && (
                      <> de {quetzales(actual.presupuesto)} de presupuesto</>
                    )}
                  </p>
                  {gasto !== null && presupuesto !== null && (
                    <progress
                      aria-label="Gasto frente al presupuesto"
                      max={presupuesto}
                      value={Math.min(gasto, presupuesto)}
                    />
                  )}
                  {gasto === null && (
                    <p className="mf-texto-suave">
                      Costo estimado del menú: {quetzales(actual.costoEstimado)}.{' '}
                      <Link className="mf-enlace" to="/semana">
                        Registrar gasto real
                      </Link>
                    </p>
                  )}
                  <h3>Comidas al día de hoy</h3>
                  <p>
                    <strong>
                      {actual.comidasHastaHoy} de {actual.comidasPlanificadas}
                    </strong>{' '}
                    comidas planificadas ya transcurridas · costo estimado Q
                    {actual.costoEstimadoHastaHoy}
                  </p>
                  <progress
                    aria-label="Comidas transcurridas de la semana"
                    max={Math.max(actual.comidasPlanificadas, 1)}
                    value={actual.comidasHastaHoy}
                  />
                </>
              )}
            </section>

            <section aria-labelledby="titulo-historial-presupuesto" className="mf-tarjeta">
              <h2 id="titulo-historial-presupuesto">Historial de presupuesto</h2>
              {tablero.historial.length === 0 ? (
                <p className="mf-texto-suave">Aún no hay semanas aprobadas.</p>
              ) : (
                <ul className="mf-lista" aria-label="Historial de presupuesto">
                  {tablero.historial.map((s) => (
                    <li key={s.id} className="mf-lista-item">
                      <strong>
                        {corta(s.fechaInicio)} al {corta(s.fechaFin)}
                      </strong>
                      <span>
                        Presupuesto {quetzales(s.presupuesto)} · Gasto {quetzales(s.gastoReal)}
                      </span>
                      <small className="mf-menu-costo">{resultado(s)}</small>
                    </li>
                  ))}
                </ul>
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
