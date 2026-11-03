import { avanceDeLista, nombreDiaSemana, type AvanceComida } from '@menu/shared';
import type { ListaCompras } from '../api/listas';
import { NOMBRES_TIEMPO } from './nombres-catalogo';
import type { ListaSincronizada } from './useListaSincronizada';

interface Props {
  lista: ListaCompras;
  editable: boolean;
  alMarcar: ListaSincronizada['marcar'];
}

/** "Pepián de pollo · miércoles almuerzo" (y " · 4 de 6" cuando tiene ingredientes en la lista). */
function titulo(c: AvanceComida): string {
  const base = `${c.platillo.nombre} · ${nombreDiaSemana(c.fecha)} ${NOMBRES_TIEMPO[c.tiempo].toLowerCase()}`;
  return c.sinIngredientes ? base : `${base} · ${c.cubiertos} de ${c.total}`;
}

/**
 * Pestaña "Por comida" (CU-07.6, HU-43): avance general de la semana y, por comida, cuántos de sus
 * ingredientes ya están comprados o "Ya lo tengo". Se calcula aquí con la lista visible, así que
 * también se actualiza sin conexión.
 */
export function AvanceComidas({ lista, editable, alMarcar }: Props) {
  const avance = avanceDeLista(
    lista.items.map((i) => ({
      id: i.id,
      producto: i.producto.nombre,
      estado: i.estado,
      comidas: i.comidas,
    })),
    lista.comidas ?? [],
  );
  const { general } = avance;
  return (
    <section aria-label="Avance por comida">
      <p>
        <progress
          className="mf-barra mf-barra--cumple"
          aria-label="Avance general de la compra"
          max={Math.max(general.total, 1)}
          value={general.cubiertos}
        />
        {general.cubiertos} de {general.total} productos ({general.porcentaje} %)
      </p>
      {avance.comidas.length === 0 ? (
        <p className="mf-texto-suave">Este menú no tiene comidas con platillo.</p>
      ) : (
        <ul className="mf-lista" aria-label="Comidas de la semana">
          {avance.comidas.map((c) => (
            <li key={c.menuDetalleId} className="mf-lista-item">
              <details>
                <summary>
                  <span>{titulo(c)}</span>
                  {c.listaParaPreparar && (
                    <small className="mf-dia-marca"> Lista para preparar</small>
                  )}
                  {c.sinIngredientes && (
                    <small className="mf-dia-marca"> Sin ingredientes registrados</small>
                  )}
                </summary>
                {!c.sinIngredientes && (
                  <progress
                    className={`mf-barra ${c.listaParaPreparar ? 'mf-barra--cumple' : ''}`}
                    aria-label={`Avance de ${c.platillo.nombre}`}
                    max={c.total}
                    value={c.cubiertos}
                  />
                )}
                {c.pendientes.length > 0 && (
                  <ul className="mf-lista" aria-label={`Pendientes de ${c.platillo.nombre}`}>
                    {c.pendientes.map((p) => (
                      <li key={p.itemId} className="mf-lista-item">
                        <span>{p.producto}</span>
                        {editable && (
                          <span className="mf-menu-acciones">
                            <button
                              type="button"
                              className="mf-enlace"
                              aria-label={`Comprado ${p.producto}`}
                              onClick={() => alMarcar(p.itemId, 'COMPRADO')}
                            >
                              Comprado
                            </button>
                            <button
                              type="button"
                              className="mf-enlace"
                              aria-label={`Ya lo tengo ${p.producto}`}
                              onClick={() => alMarcar(p.itemId, 'YA_LO_TENGO')}
                            >
                              Ya lo tengo
                            </button>
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </details>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
