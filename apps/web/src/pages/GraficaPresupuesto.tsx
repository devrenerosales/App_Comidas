import type { SemanaTablero } from '../api/tablero';
import { construirGrafica, MEDIDAS, quetzales, trazoColumna, type Columna } from './tablero';

const marca = (valor: number): string => `Q${Number.isInteger(valor) ? valor : valor.toFixed(1)}`;

const descripcion = (c: Columna): string => {
  const gasto = c.gasto === null ? 'sin gasto registrado' : `gasto ${quetzales(c.gasto)}`;
  const presupuesto =
    c.presupuesto === null ? 'sin presupuesto' : `presupuesto ${quetzales(c.presupuesto)}`;
  return `Semana del ${c.etiqueta}: ${gasto}, ${presupuesto}${c.excede ? ', excedió' : ''}`;
};

/**
 * Columnas de gasto por semana con una marca del presupuesto. La semana más reciente va en el
 * color de énfasis, las anteriores en un tono de contexto y las que excedieron, en el de error.
 * El detalle por semana (lista de abajo) es la versión en tabla de esta gráfica.
 */
export function GraficaPresupuesto({ historial }: { historial: readonly SemanaTablero[] }) {
  const { columnas, marcas } = construirGrafica(historial);
  const { ancho, alto, izquierda, derecha, abajo } = MEDIDAS;
  const hayExceso = columnas.some((c) => c.excede);
  const ultima = columnas.at(-1);

  return (
    <figure className="mf-grafica">
      <svg
        viewBox={`0 0 ${ancho} ${alto}`}
        role="group"
        aria-label="Gasto por semana frente al presupuesto"
        className="mf-grafica__svg"
      >
        {marcas.map((m) => (
          <g key={m.valor}>
            <line
              x1={izquierda}
              x2={ancho - derecha}
              y1={m.y}
              y2={m.y}
              className="mf-grafica__rejilla"
            />
            <text x={izquierda - 8} y={m.y + 4} textAnchor="end" className="mf-grafica__eje">
              {marca(m.valor)}
            </text>
          </g>
        ))}
        {columnas.map((c) => (
          <g key={c.id} tabIndex={0} role="img" aria-label={descripcion(c)}>
            <title>{descripcion(c)}</title>
            <rect x={c.x - 8} y={0} width={c.ancho + 16} height={alto - abajo} fill="transparent" />
            {c.alto > 0 && (
              <path
                d={trazoColumna(c.x, c.y, c.ancho, c.alto)}
                className={
                  c.excede
                    ? 'mf-grafica__columna mf-grafica__columna--excede'
                    : c.actual
                      ? 'mf-grafica__columna mf-grafica__columna--actual'
                      : 'mf-grafica__columna'
                }
              />
            )}
            {c.yPresupuesto !== null && (
              <line
                x1={c.x - 4}
                x2={c.x + c.ancho + 4}
                y1={c.yPresupuesto}
                y2={c.yPresupuesto}
                className="mf-grafica__presupuesto"
              />
            )}
            <text
              x={c.x + c.ancho / 2}
              y={alto - abajo + 18}
              textAnchor="middle"
              className="mf-grafica__eje"
            >
              {c.etiqueta}
            </text>
          </g>
        ))}
        {ultima && ultima.gasto !== null && (
          <text
            x={ultima.x + ultima.ancho / 2}
            y={Math.max(ultima.y - 6, 10)}
            textAnchor="middle"
            className="mf-grafica__valor"
          >
            {quetzales(ultima.gasto)}
          </text>
        )}
      </svg>
      <figcaption className="mf-leyenda">
        <span className="mf-leyenda__item">
          <i className="mf-leyenda__muestra mf-leyenda__muestra--gasto" aria-hidden="true" />
          Gasto
        </span>
        <span className="mf-leyenda__item">
          <i className="mf-leyenda__muestra mf-leyenda__muestra--presupuesto" aria-hidden="true" />
          Presupuesto
        </span>
        {hayExceso && (
          <span className="mf-leyenda__item">
            <i className="mf-leyenda__muestra mf-leyenda__muestra--excede" aria-hidden="true" />
            Excedió
          </span>
        )}
      </figcaption>
    </figure>
  );
}
