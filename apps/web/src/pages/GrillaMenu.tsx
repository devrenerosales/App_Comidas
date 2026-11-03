import { ORDEN_TIEMPOS, costosDelMenu } from '@menu/shared';
import type { DetalleMenu, MenuGenerado } from '../api/menus';
import { etiquetaDia, etiquetaEspacio } from './fechas';
import { NOMBRES_TIEMPO } from './nombres-catalogo';

interface Props {
  menu: MenuGenerado;
  /** Solo el Borrador se puede cambiar (CU-06.1 E2). */
  editable: boolean;
  /** Espacio cuyo platillo se está moviendo; el resto ofrece "Mover aquí". */
  moviendo: string | null;
  ocupado: boolean;
  onMotivo: (d: DetalleMenu) => void;
  onAlternativa: (d: DetalleMenu) => void;
  onCambiar: (d: DetalleMenu) => void;
  onFijar: (d: DetalleMenu) => void;
  onIniciarMover: (d: DetalleMenu) => void;
  onMover: (origenId: string, destinoId: string) => void;
}

/**
 * Tabla día × tiempo con "¿Por qué?" (HU-22) y, en el Borrador, "Otra opción" (HU-23), editar,
 * fijar y mover (tocando o arrastrando) por espacio (HU-24).
 */
export function GrillaMenu({
  menu,
  editable,
  moviendo,
  ocupado,
  onMotivo,
  onAlternativa,
  onCambiar,
  onFijar,
  onIniciarMover,
  onMover,
}: Props) {
  const fechas = [...new Set(menu.detalles.map((d) => d.fecha))];
  const costos = costosDelMenu(menu);
  const tiempos = ORDEN_TIEMPOS.filter((t) => menu.tiempos.some((x) => x.tiempo === t));
  return (
    <div className="mf-menu-tabla">
      <table aria-label="Menú de la semana">
        <thead>
          <tr>
            <th scope="col">Día</th>
            {tiempos.map((t) => (
              <th scope="col" key={t}>
                {NOMBRES_TIEMPO[t]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {fechas.map((fecha) => {
            const dia = costos.porDia.find((x) => x.fecha === fecha);
            return (
              <tr key={fecha}>
                <th scope="row">
                  {etiquetaDia(fecha)}
                  {tiempos.length > 1 && dia?.costo != null && (
                    <small className="mf-menu-costo">
                      {' '}
                      Día: Q{dia.costo}
                      {dia.incompleto ? '*' : ''}
                    </small>
                  )}
                </th>
                {tiempos.map((t) => {
                  const d = menu.detalles.find((x) => x.fecha === fecha && x.tiempo === t);
                  if (!d) return <td key={t} />;
                  const nombre = etiquetaEspacio(d);
                  return (
                    <td
                      key={t}
                      draggable={editable && d.platillo !== null && !ocupado}
                      onDragStart={(e) => e.dataTransfer?.setData('text/plain', d.id)}
                      onDragOver={(e) => editable && e.preventDefault()}
                      onDrop={(e) => {
                        if (!editable) return;
                        e.preventDefault();
                        const origen = e.dataTransfer?.getData('text/plain');
                        if (origen && origen !== d.id) onMover(origen, d.id);
                      }}
                    >
                      {d.platillo ? (
                        <>
                          {d.platillo.nombre}
                          {d.fijado && <small> (fijado)</small>}
                        </>
                      ) : (
                        <span className="mf-menu-vacio">Sin sugerencia</span>
                      )}
                      {d.platillo && d.costoEstimado !== null && (
                        <small className="mf-menu-costo">
                          {' '}
                          Q{d.costoEstimado}
                          {d.costoIncompleto ? '*' : ''}
                        </small>
                      )}
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
                                onClick={() => onIniciarMover(d)}
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
                              onClick={() => onMover(moviendo, d.id)}
                            >
                              Mover aquí
                            </button>
                          )}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
