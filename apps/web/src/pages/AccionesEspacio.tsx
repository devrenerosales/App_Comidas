import type { DetalleMenu } from '../api/menus';
import type { AccionesMenu } from './acciones-menu';
import { etiquetaEspacio } from './fechas';

/**
 * Botones de un espacio: "¿Por qué?" (HU-22) y, en el Borrador, "Cambiar", "Otra opción" (HU-23),
 * fijar y mover (HU-24).
 */
export function AccionesEspacio({ d, acciones }: { d: DetalleMenu; acciones: AccionesMenu }) {
  const { editable, moviendo, ocupado, onMotivo, onAlternativa, onCambiar, onFijar } = acciones;
  const nombre = etiquetaEspacio(d);
  return (
    <>
      {d.platillo && (
        <span className="mf-menu-acciones">
          <button
            type="button"
            className="mf-enlace"
            aria-label={`¿Por qué ${nombre}?`}
            onClick={() => onMotivo(d)}
          >
            ¿Por qué?
          </button>
        </span>
      )}
      {editable && (
        <span className="mf-menu-acciones">
          <button
            type="button"
            className="mf-enlace"
            disabled={ocupado}
            aria-label={`Cambiar ${nombre}`}
            onClick={() => onCambiar(d)}
          >
            Cambiar
          </button>
          <button
            type="button"
            className="mf-enlace"
            disabled={ocupado || d.fijado}
            title={d.fijado ? 'Quita el fijado para pedir otra opción' : undefined}
            aria-label={`Otra opción para ${nombre}`}
            onClick={() => onAlternativa(d)}
          >
            Otra opción
          </button>
          {d.platillo && (
            <>
              <button
                type="button"
                className="mf-enlace"
                disabled={ocupado}
                aria-pressed={d.fijado}
                aria-label={`${d.fijado ? 'Quitar fijado de' : 'Fijar'} ${nombre}`}
                onClick={() => onFijar(d)}
              >
                {d.fijado ? 'Quitar fijado' : 'Fijar'}
              </button>
              <button
                type="button"
                className="mf-enlace"
                disabled={ocupado}
                aria-label={`Mover ${nombre}`}
                onClick={() => acciones.onIniciarMover(d)}
              >
                Mover
              </button>
            </>
          )}
          {moviendo !== null && moviendo !== d.id && (
            <button
              type="button"
              className="mf-boton mf-boton--secundario"
              disabled={ocupado}
              aria-label={`Mover aquí a ${nombre}`}
              onClick={() => acciones.onMover(moviendo, d.id)}
            >
              Mover aquí
            </button>
          )}
        </span>
      )}
    </>
  );
}
