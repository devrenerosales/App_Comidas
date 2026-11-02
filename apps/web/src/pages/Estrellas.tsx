import './estrellas.css';

interface Props {
  /** Texto accesible del grupo, p. ej. "Calificación de Pollo en crema del 2026-11-10". */
  etiqueta: string;
  valor: number | null;
  deshabilitado?: boolean;
  onElegir: (valor: number) => void;
}

/** Control de 1 a 5 estrellas (HU-14). Cada estrella es un botón con el valor en su nombre. */
export function Estrellas({ etiqueta, valor, deshabilitado = false, onElegir }: Props) {
  return (
    <span className="mf-estrellas" role="group" aria-label={etiqueta}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`mf-estrella${valor !== null && n <= valor ? ' mf-estrella--llena' : ''}`}
          aria-label={`${n} ${n === 1 ? 'estrella' : 'estrellas'}`}
          aria-pressed={valor === n}
          disabled={deshabilitado}
          onClick={() => onElegir(n)}
        >
          {valor !== null && n <= valor ? '★' : '☆'}
        </button>
      ))}
    </span>
  );
}
