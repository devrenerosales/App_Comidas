import { useEffect, useState } from 'react';
import type { TiempoComida } from '@menu/shared';
import { mensajeDeError } from '../api';
import { useApiCatalogo } from '../api/contexto-catalogo';
import type { ResumenPlatillo } from '../api/catalogo';

interface Props {
  /** Texto del espacio que se está llenando, p. ej. "Domingo 01/11 almuerzo". */
  espacio: string;
  tiempo: TiempoComida;
  ocupado: boolean;
  onElegir: (platillo: ResumenPlatillo) => void;
  onCancelar: () => void;
}

const MINIMO_BUSQUEDA = 2;
const MAXIMO_RESULTADOS = 8;

/** Busca un platillo activo que aplique al tiempo de comida del espacio (CU-06.1 2a). */
export function SelectorPlatillo({ espacio, tiempo, ocupado, onElegir, onCancelar }: Props) {
  const catalogo = useApiCatalogo();
  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState<ResumenPlatillo[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = texto.trim();
    if (q.length < MINIMO_BUSQUEDA) {
      setResultados([]);
      return;
    }
    let activo = true;
    setError(null);
    catalogo
      .listarPlatillos({ q, tiempo, estado: 'ACTIVO' })
      .then((r) => {
        if (activo) setResultados(r.datos.slice(0, MAXIMO_RESULTADOS));
      })
      .catch((e: unknown) => {
        if (activo) setError(mensajeDeError(e));
      });
    return () => {
      activo = false;
    };
  }, [catalogo, texto, tiempo]);

  return (
    <section className="mf-tarjeta" aria-label={`Elegir platillo para ${espacio}`}>
      <h2>Elegir platillo para {espacio}</h2>
      <div className="mf-campo">
        <label htmlFor="buscar-platillo-menu">Buscar platillo</label>
        <input
          id="buscar-platillo-menu"
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <small>Escribe al menos 2 letras. Solo salen platillos que aplican a este tiempo.</small>
      </div>
      {error && (
        <p role="alert" className="mf-alerta">
          {error}
        </p>
      )}
      {resultados.length > 0 && (
        <ul className="mf-resultados" aria-label="Platillos encontrados">
          {resultados.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="mf-boton mf-boton--secundario"
                disabled={ocupado}
                onClick={() => onElegir(p)}
              >
                Elegir {p.nombre}
              </button>
            </li>
          ))}
        </ul>
      )}
      {texto.trim().length >= MINIMO_BUSQUEDA && !error && resultados.length === 0 && (
        <p className="mf-texto-suave">No hay platillos para «{texto.trim()}».</p>
      )}
      <button type="button" className="mf-boton mf-boton--secundario" onClick={onCancelar}>
        Cancelar
      </button>
    </section>
  );
}
