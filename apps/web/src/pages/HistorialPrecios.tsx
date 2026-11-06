import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PERIODOS_SEMANAS, type PeriodoSemanas, type SeriePrecios } from '@menu/shared';
import { mensajeDeError } from '../api';
import type { Producto } from '../api/catalogo';
import { useApiCatalogo } from '../api/contexto-catalogo';
import { useApiPrecios } from '../api/contexto-precios';
import { Cargando } from '../auth/Cargando';
import { PaginaBase } from './PaginaBase';
import { fechaCompleta } from './supermercados';
import './acceso.css';
import './catalogo.css';
import './hogar.css';

const ORIGEN = { AUTOMATICO: 'Automático', MANUAL: 'Manual', TICKET: 'Ticket' } as const;
const INDICADOR = { SUBE: '▲ Subió', BAJA: '▼ Bajó', IGUAL: '= Igual' } as const;
/** Colores distinguibles del gráfico; la leyenda repite el nombre para no depender del color. */
const COLORES = ['#1d6fb8', '#c0392b', '#2e8b57', '#b9770e', '#7d3c98'];

/** Gráfico de líneas simple: una línea por supermercado, fecha en X y precio en Y. */
function Grafico({ series }: { series: SeriePrecios[] }) {
  const ancho = 320;
  const alto = 160;
  const margen = 8;
  const dia = (f: string) => Date.parse(`${f}T00:00:00Z`) / 86_400_000;
  const puntos = series.flatMap((s) => s.puntos);
  const fechas = puntos.map((p) => dia(p.fecha));
  const precios = puntos.map((p) => Number(p.precioNormalizado));
  const [d0, d1] = [Math.min(...fechas), Math.max(...fechas)];
  const [p0, p1] = [Math.min(...precios), Math.max(...precios)];
  const x = (f: string) =>
    d1 === d0 ? ancho / 2 : margen + ((dia(f) - d0) / (d1 - d0)) * (ancho - 2 * margen);
  const y = (v: string) =>
    p1 === p0 ? alto / 2 : alto - margen - ((Number(v) - p0) / (p1 - p0)) * (alto - 2 * margen);
  return (
    <figure style={{ margin: '0 0 12px' }}>
      <svg
        viewBox={`0 0 ${ancho} ${alto}`}
        role="img"
        aria-label="Gráfico de precios por supermercado"
        style={{ width: '100%', maxWidth: 480 }}
      >
        {series.map((s, i) => {
          const color = COLORES[i % COLORES.length]!;
          return (
            <g key={s.supermercado.id} stroke={color} fill={color}>
              <polyline
                fill="none"
                strokeWidth="2"
                points={s.puntos.map((p) => `${x(p.fecha)},${y(p.precioNormalizado)}`).join(' ')}
              />
              {s.puntos.map((p, j) => (
                <circle key={j} cx={x(p.fecha)} cy={y(p.precioNormalizado)} r="3" />
              ))}
            </g>
          );
        })}
      </svg>
      <figcaption>
        {series.map((s, i) => (
          <span key={s.supermercado.id} style={{ marginRight: 12 }}>
            <span style={{ color: COLORES[i % COLORES.length] }} aria-hidden="true">
              ●
            </span>{' '}
            {s.supermercado.nombre}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

function VariacionTexto({ titulo, v }: { titulo: string; v: SeriePrecios['variacionAnterior'] }) {
  return (
    <p style={{ margin: '0 0 4px' }}>
      {titulo}: <strong>{v.texto}</strong>
      {v.tendencia && <small> {INDICADOR[v.tendencia]}</small>}
    </p>
  );
}

/** Histórico de precios de un producto y su variación por supermercado (CU-08.3, HU-37). */
export default function HistorialPrecios() {
  const { id: productoId = '' } = useParams<{ id: string }>();
  const catalogo = useApiCatalogo();
  const apiPrecios = useApiPrecios();
  const [producto, setProducto] = useState<Producto | null>(null);
  const [semanas, setSemanas] = useState<PeriodoSemanas>(12);
  const [series, setSeries] = useState<SeriePrecios[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let activo = true;
    catalogo
      .obtenerProducto(productoId)
      .then((p) => activo && setProducto(p))
      .catch((e: unknown) => activo && setError(mensajeDeError(e)));
    return () => {
      activo = false;
    };
  }, [catalogo, productoId, intento]);

  useEffect(() => {
    let activo = true;
    setSeries(null);
    setError(null);
    apiPrecios
      .historico(productoId, semanas)
      .then((r) => activo && setSeries(r.series))
      .catch((e: unknown) => activo && setError(mensajeDeError(e)));
    return () => {
      activo = false;
    };
  }, [apiPrecios, productoId, semanas, intento]);

  const filas = (series ?? [])
    .flatMap((s) => s.puntos.map((p) => ({ ...p, supermercado: s.supermercado.nombre })))
    .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));

  return (
    <PaginaBase
      titulo={producto ? `Historial de precios de ${producto.nombre}` : 'Historial de precios'}
    >
      <div className="mf-catalogo">
        <p style={{ margin: '0 0 12px' }}>
          <Link className="mf-enlace" to={`/platillos/productos/${productoId}/supermercados`}>
            ← Supermercados del producto
          </Link>
        </p>
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
        <div className="mf-campo">
          <label htmlFor="periodo-historial">Periodo</label>
          <select
            id="periodo-historial"
            value={semanas}
            onChange={(e) => setSemanas(Number(e.target.value) as PeriodoSemanas)}
          >
            {PERIODOS_SEMANAS.map((n) => (
              <option key={n} value={n}>
                {n} semanas
              </option>
            ))}
          </select>
        </div>
        {series === null ? (
          !error && <Cargando />
        ) : series.length === 0 ? (
          <p className="mf-texto-suave" role="status">
            Aún no hay precios para este producto en este periodo.
          </p>
        ) : (
          <>
            <Grafico series={series} />
            {series.map((s) => (
              <section
                key={s.supermercado.id}
                className="mf-tarjeta"
                aria-label={s.supermercado.nombre}
              >
                <h3 style={{ margin: '0 0 4px' }}>{s.supermercado.nombre}</h3>
                <VariacionTexto titulo="Vs. anterior" v={s.variacionAnterior} />
                <VariacionTexto titulo="En el periodo" v={s.variacionPeriodo} />
              </section>
            ))}
            <table aria-label="Precios registrados">
              <thead>
                <tr>
                  <th scope="col">Fecha</th>
                  <th scope="col">Supermercado</th>
                  <th scope="col">Precio</th>
                  <th scope="col">Origen</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f, i) => (
                  <tr key={i}>
                    <td>{fechaCompleta(f.fecha)}</td>
                    <td>{f.supermercado}</td>
                    <td>Q{f.precioNormalizado}</td>
                    <td>{ORIGEN[f.origen]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mf-texto-suave">
              Los precios son por la presentación de compra del producto. Se muestran los
              automáticos y los que registró tu hogar.
            </p>
          </>
        )}
      </div>
    </PaginaBase>
  );
}
