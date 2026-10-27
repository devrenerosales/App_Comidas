import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { aCentavos, formatoQuetzales } from '@menu/shared';
import { useAuth } from '../auth/contexto';
import { useApiHistorial } from '../api/contexto-historial';
import type { SemanaHistorica } from '../api/historial';
import { mensajeDeError } from '../api';
import { CampoTexto } from './CampoTexto';
import { PaginaBase } from './PaginaBase';
import './acceso.css';
import './hogar.css';

export default function Historial() {
  const api = useApiHistorial();
  const { hogar } = useAuth();
  const location = useLocation<{ aviso?: string }>();
  const [semanas, setSemanas] = useState<SemanaHistorica[]>([]);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [filtros, setFiltros] = useState({ desde: '', hasta: '', pagina: 1 });
  const [paginas, setPaginas] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  useEffect(() => {
    let activo = true;
    setCargando(true);
    setError(null);
    api
      .listar(filtros)
      .then((r) => {
        if (activo) {
          setSemanas(r.datos);
          setPaginas(r.paginacion.totalPaginas);
        }
      })
      .catch((e: unknown) => {
        if (activo) setError(mensajeDeError(e));
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, [api, filtros, intento]);
  function filtrar(e: FormEvent) {
    e.preventDefault();
    setFiltros({ desde, hasta, pagina: 1 });
  }
  return (
    <PaginaBase titulo="Historial de comidas">
      <div className="mf-hogar">
        <Link className="mf-enlace" to="/inicio">
          Volver a Inicio
        </Link>
        <p>Consulta los menús y el gasto real de semanas pasadas.</p>
        {hogar?.rol === 'ADMIN' && (
          <Link className="mf-boton mf-boton--secundario" to="/historial/importar">
            Importar archivo
          </Link>
        )}
        {location.state?.aviso && <p role="status">{location.state.aviso}</p>}
        {hogar?.rol === 'ADMIN' && (
          <Link className="mf-boton mf-boton--primario" to="/historial/capturar">
            Capturar semana
          </Link>
        )}
        <form aria-label="Filtrar historial" onSubmit={filtrar}>
          <CampoTexto
            etiqueta="Desde"
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
          />
          <CampoTexto
            etiqueta="Hasta"
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
          />
          <button className="mf-boton mf-boton--secundario" disabled={cargando}>
            Filtrar
          </button>
        </form>
        {error && (
          <div role="alert" className="mf-alerta">
            <p>{error}</p>
            <button type="button" onClick={() => setIntento((v) => v + 1)}>
              Reintentar
            </button>
          </div>
        )}
        {cargando ? (
          <p role="status">Cargando historial…</p>
        ) : (
          !error && (
            <>
              {!semanas.length && <p>No hay semanas históricas registradas.</p>}
              {semanas.map((s) => (
                <section key={s.id} className="mf-tarjeta" aria-label={`Semana ${s.fechaInicio}`}>
                  <h2>
                    {s.fechaInicio} al {s.fechaFin}
                  </h2>
                  <p>
                    Histórico · {s.detalles.length} comidas ·{' '}
                    {s.gastoReal === null
                      ? 'Sin gasto registrado'
                      : formatoQuetzales(aCentavos(s.gastoReal)!, true)}
                  </p>
                  {s.notas && <p>{s.notas}</p>}
                  <details>
                    <summary>Ver platillos de la semana</summary>
                    <ul>
                      {s.detalles.map((d) => (
                        <li key={`${d.fecha}:${d.tiempo}`}>
                          {d.fecha} · {d.tiempo.toLowerCase()}: {d.nombre ?? 'Sin platillo'}
                          {d.notas && <p>{d.notas}</p>}
                        </li>
                      ))}
                    </ul>
                  </details>
                </section>
              ))}
              {paginas > 1 && (
                <nav aria-label="Páginas del historial">
                  <button
                    type="button"
                    disabled={filtros.pagina === 1}
                    onClick={() => setFiltros({ ...filtros, pagina: filtros.pagina - 1 })}
                  >
                    Anterior
                  </button>
                  <span>
                    {' '}
                    Página {filtros.pagina} de {paginas}{' '}
                  </span>
                  <button
                    type="button"
                    disabled={filtros.pagina >= paginas}
                    onClick={() => setFiltros({ ...filtros, pagina: filtros.pagina + 1 })}
                  >
                    Siguiente
                  </button>
                </nav>
              )}
            </>
          )
        )}
      </div>
    </PaginaBase>
  );
}
