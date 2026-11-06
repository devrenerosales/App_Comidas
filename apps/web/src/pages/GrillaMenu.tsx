import { ORDEN_TIEMPOS, costosDelMenu } from '@menu/shared';
import type { MenuGenerado } from '../api/menus';
import { propiedadesDeArrastre, type AccionesMenu } from './acciones-menu';
import { AccionesEspacio } from './AccionesEspacio';
import { etiquetaDia } from './fechas';
import { NOMBRES_TIEMPO } from './nombres-catalogo';

interface Props extends AccionesMenu {
  menu: MenuGenerado;
}

/**
 * Tabla día × tiempo con "¿Por qué?" (HU-22) y, en el Borrador, "Otra opción" (HU-23), editar,
 * fijar y mover (tocando o arrastrando) por espacio (HU-24).
 */
export function GrillaMenu({ menu, ...acciones }: Props) {
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
                  return (
                    <td key={t} {...propiedadesDeArrastre(d, acciones)}>
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
                      <AccionesEspacio d={d} acciones={acciones} />
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
