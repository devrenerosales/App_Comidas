import type { ResumenPrecio as Resumen } from '../api/precios';
import { fechaCompleta } from './supermercados';

interface Props {
  /** `null` = el producto no tiene ningún precio. */
  resumen: Resumen | null;
}

/** Mediana, compra sugerida y aviso de vigencia de un producto (CU-09.2, HU-36). */
export function ResumenPrecio({ resumen }: Props) {
  if (!resumen) {
    return (
      <section className="mf-tarjeta" aria-label="Resumen de precios">
        <p className="mf-texto-suave">Sin precio: todavía no hay precios de este producto.</p>
      </section>
    );
  }
  const supermercados = `${resumen.cantidadPrecios} ${resumen.cantidadPrecios === 1 ? 'supermercado' : 'supermercados'}`;
  return (
    <section className="mf-tarjeta" aria-label="Resumen de precios">
      <p>
        <strong>Costo estimado: Q{resumen.precioMediana}</strong> (mediana de {supermercados})
      </p>
      <p>
        <strong>Compra sugerida: Q{resumen.precioMinimo}</strong> en{' '}
        {resumen.supermercadoMinimo.nombre} ({fechaCompleta(resumen.fechaPrecioMinimo)})
      </p>
      {resumen.desactualizado && (
        <p className="mf-advertencia" role="status">
          Desactualizado: ningún precio es de los últimos 14 días; el más antiguo es del{' '}
          {fechaCompleta(resumen.fechaPrecioMasAntiguo)}.
        </p>
      )}
    </section>
  );
}
