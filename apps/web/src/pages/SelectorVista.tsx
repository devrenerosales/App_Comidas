import type { VistaSemana } from './vista-semana';

const OPCIONES: [VistaSemana, string][] = [
  ['TABLA', 'Tabla'],
  ['CALENDARIO', 'Calendario'],
];

/** Alterna entre ver el menú como tabla o como calendario. */
export function SelectorVista({
  vista,
  onCambiar,
}: {
  vista: VistaSemana;
  onCambiar: (vista: VistaSemana) => void;
}) {
  return (
    <div className="mf-selector-vista" role="group" aria-label="Vista del menú">
      {OPCIONES.map(([valor, texto]) => (
        <button
          key={valor}
          type="button"
          className={`mf-boton ${vista === valor ? 'mf-boton--primario' : 'mf-boton--secundario'}`}
          aria-pressed={vista === valor}
          onClick={() => onCambiar(valor)}
        >
          {texto}
        </button>
      ))}
    </div>
  );
}
