import { Link } from 'react-router-dom';
import type { CostosDelMenu } from '@menu/shared';

/** Texto del asterisco de CA-26.3; las celdas de la tabla marcan con `*` el costo incompleto. */
export const AVISO_COSTO_INCOMPLETO = '* Costo incompleto: hay ingredientes sin precio';

/**
 * CU-06.3: total de la semana frente al presupuesto con barra, verde si cumple y rojo si excede
 * (D-03: el exceso se indica pero no bloquea). Sin presupuesto muestra solo el costo (E1).
 */
export function ResumenCostos({ costos }: { costos: CostosDelMenu }) {
  const { total, presupuesto, diferencia, excede, exceso, costoIncompleto } = costos;
  const marca = costoIncompleto ? '*' : '';
  return (
    <section aria-label="Costo del menú" className="mf-costos">
      {total === null ? (
        <p>Todavía no hay costos conocidos para este menú.</p>
      ) : presupuesto === null ? (
        <>
          <p>
            <strong>Costo estimado:</strong> Q{total}
            {marca}
          </p>
          <p className="mf-texto-suave">
            No hay presupuesto configurado.{' '}
            <Link className="mf-enlace" to="/configuracion">
              Ir a Configuración
            </Link>
          </p>
        </>
      ) : (
        <>
          <p>
            <strong>Total:</strong> Q{total}
            {marca} de Q{presupuesto}
          </p>
          <progress
            className={excede ? 'mf-barra mf-barra--excede' : 'mf-barra mf-barra--cumple'}
            aria-label="Costo frente al presupuesto semanal"
            max={Number(presupuesto) || 1}
            value={Math.min(Number(total), Number(presupuesto) || 1)}
          />
          {excede ? (
            <p className="mf-exceso">Excede por Q{exceso}</p>
          ) : (
            <p className="mf-costo-ok">Disponible Q{diferencia}</p>
          )}
        </>
      )}
      {costoIncompleto && <p className="mf-texto-suave">{AVISO_COSTO_INCOMPLETO}</p>}
    </section>
  );
}
