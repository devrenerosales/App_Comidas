import type { NivelMedidor } from './tablero';

interface Props {
  etiqueta: string;
  valor: number;
  maximo: number;
  /** El color sigue al estado: normal, cerca del límite o excedido. */
  nivel?: NivelMedidor;
  /** Más delgado, para listas. */
  fino?: boolean;
}

/** Medidor de una razón contra un límite; la pista es un tono más claro del mismo color. */
export function Medidor({ etiqueta, valor, maximo, nivel = 'normal', fino = false }: Props) {
  const porcentaje = maximo > 0 ? Math.min(100, Math.max(0, (valor / maximo) * 100)) : 0;
  return (
    <div
      className={`mf-medidor mf-medidor--${nivel}${fino ? ' mf-medidor--fino' : ''}`}
      role="meter"
      aria-label={etiqueta}
      aria-valuemin={0}
      aria-valuemax={maximo}
      aria-valuenow={Math.min(valor, maximo)}
    >
      <span className="mf-medidor__relleno" style={{ width: `${porcentaje}%` }} />
    </div>
  );
}
