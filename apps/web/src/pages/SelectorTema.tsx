import { useState } from 'react';
import { elegirTema, leerTema, TEMAS, type Tema } from '../theme/tema';

const ETIQUETA: Record<Tema, string> = {
  auto: 'Automático',
  claro: 'Claro',
  oscuro: 'Oscuro',
};

/** Elige la apariencia de la app: sigue al sistema o fuerza el tema claro u oscuro. */
export function SelectorTema() {
  const [tema, setTema] = useState<Tema>(leerTema);

  function elegir(nuevo: Tema) {
    elegirTema(nuevo);
    setTema(nuevo);
  }

  return (
    <div className="mf-segmentos" role="group" aria-label="Apariencia">
      {TEMAS.map((t) => (
        <button
          key={t}
          type="button"
          className="mf-boton mf-boton--secundario"
          aria-pressed={tema === t}
          onClick={() => elegir(t)}
        >
          {ETIQUETA[t]}
        </button>
      ))}
    </div>
  );
}
