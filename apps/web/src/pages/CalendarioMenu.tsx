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
 * Vista de calendario del menú: una tarjeta por día con sus tiempos de comida. Ofrece las mismas
 * acciones que la tabla (¿Por qué?, cambiar, otra opción, fijar y mover tocando o arrastrando).
 * El borde de cada espacio indica si su tiempo cumple o excede el presupuesto (HU-26).
 */
export function CalendarioMenu({ menu, ...acciones }: Props) {
  const fechas = [...new Set(menu.detalles.map((d) => d.fecha))];
  const costos = costosDelMenu(menu);
  const tiempos = ORDEN_TIEMPOS.filter((t) => menu.tiempos.some((x) => x.tiempo === t));
  return (
    <ol className="mf-calendario" aria-label="Calendario de la semana">
      {fechas.map((fecha) => {
        const dia = costos.porDia.find((x) => x.fecha === fecha);
        return (
          <li key={fecha} className="mf-dia">
            <h3 className="mf-dia-titulo">{etiquetaDia(fecha)}</h3>
            {tiempos.length > 1 && dia?.costo != null && (
              <small className="mf-menu-costo">
                Día: Q{dia.costo}
                {dia.incompleto ? '*' : ''}
              </small>
            )}
            {tiempos.map((t) => {
              const d = menu.detalles.find((x) => x.fecha === fecha && x.tiempo === t);
              if (!d) return null;
              const estado = menu.tiempos.find((x) => x.tiempo === t)?.estado;
              const clases = [
                'mf-dia-espacio',
                estado === 'EXCEDE' ? 'mf-dia-espacio--excede' : '',
                acciones.moviendo === d.id ? 'mf-dia-espacio--moviendo' : '',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <div key={t} className={clases} {...propiedadesDeArrastre(d, acciones)}>
                  {tiempos.length > 1 && <span className="mf-dia-tiempo">{NOMBRES_TIEMPO[t]}</span>}
                  {d.platillo ? (
                    <strong className="mf-dia-platillo">{d.platillo.nombre}</strong>
                  ) : (
                    <span className="mf-menu-vacio">Sin sugerencia</span>
                  )}
                  {d.fijado && <small className="mf-dia-marca">Fijado</small>}
                  {d.origen === 'REEMPLAZO_PRESUPUESTO' && (
                    <small className="mf-dia-marca">Ajustado al presupuesto</small>
                  )}
                  {d.platillo && d.costoEstimado !== null && (
                    <small className="mf-menu-costo">
                      Q{d.costoEstimado}
                      {d.costoIncompleto ? '*' : ''}
                    </small>
                  )}
                  <AccionesEspacio d={d} acciones={acciones} />
                </div>
              );
            })}
          </li>
        );
      })}
    </ol>
  );
}
