import { useEffect, useState } from 'react';
import { mensajeDeError } from '../api';
import { useApiMenus } from '../api/contexto-menus';
import type { MotivoSugerencia } from '../api/menus';

interface Props {
  menuId: string;
  detalleId: string;
  /** Texto del espacio, p. ej. "Domingo 01/11 almuerzo". */
  espacio: string;
  onCerrar: () => void;
}

const FACTORES = [
  ['preferencia', 'Preferencia'],
  ['novedad', 'Novedad'],
  ['ahorro', 'Ahorro'],
  ['afinidad', 'Afinidad'],
] as const;

const dos = (valor: string) => Number(valor).toFixed(2);

/** "¿Por qué este platillo?": factores con barras, pesos usados, puntaje, costo y reglas (HU-22). */
export function PanelMotivo({ menuId, detalleId, espacio, onCerrar }: Props) {
  const menus = useApiMenus();
  const [motivo, setMotivo] = useState<MotivoSugerencia | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;
    setMotivo(null);
    setError(null);
    menus
      .motivo(menuId, detalleId)
      .then((m) => {
        if (activo) setMotivo(m);
      })
      .catch((e: unknown) => {
        if (activo) setError(mensajeDeError(e));
      });
    return () => {
      activo = false;
    };
  }, [menus, menuId, detalleId]);

  return (
    <section className="mf-tarjeta" aria-label={`Por qué ${espacio}`}>
      <h2>¿Por qué este platillo?</h2>
      <p>
        <strong>{motivo ? motivo.platillo.nombre : espacio}</strong>
        {motivo && <> · {espacio}</>}
      </p>
      {error && (
        <p role="alert" className="mf-alerta">
          {error}
        </p>
      )}
      {!motivo && !error && <p className="mf-texto-suave">Cargando…</p>}
      {motivo && (
        <>
          <p role="status">{motivo.resumen}</p>
          {motivo.factores && (
            <ul className="mf-factores" aria-label="Factores del puntaje">
              {FACTORES.map(([clave, nombre]) => (
                <li key={clave}>
                  <span>
                    {nombre} {dos(motivo.factores![clave])}
                    {motivo.pesos && <small> (peso {dos(motivo.pesos[clave])})</small>}
                  </span>
                  <meter
                    min={0}
                    max={1}
                    value={Number(motivo.factores![clave])}
                    aria-label={`${nombre} ${dos(motivo.factores![clave])}`}
                  />
                </li>
              ))}
            </ul>
          )}
          {motivo.puntaje && (
            <p>
              <strong>Puntaje:</strong> {Number(motivo.puntaje).toFixed(4)}
            </p>
          )}
          <p>
            {motivo.costo.estimado
              ? `Costo estimado Q${motivo.costo.estimado}`
              : motivo.costo.incompleto
                ? 'Costo incompleto: todavía no hay precios para los ingredientes.'
                : 'Sin costo estimado'}
          </p>
          {motivo.reglasAplicadas.length > 0 && (
            <p className="mf-texto-suave">Reglas aplicadas: {motivo.reglasAplicadas.join(', ')}</p>
          )}
        </>
      )}
      <button type="button" className="mf-boton mf-boton--secundario" onClick={onCerrar}>
        Cerrar
      </button>
    </section>
  );
}
