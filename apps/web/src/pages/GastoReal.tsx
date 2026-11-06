import { useState, type FormEvent } from 'react';
import { NOTA_GASTO_MAXIMA, validarGasto } from '@menu/shared';
import { mensajeDeError } from '../api';
import { useApiMenus } from '../api/contexto-menus';
import type { Diferencia, GastoRegistrado, MenuGenerado } from '../api/menus';
import { fechaHoraGuatemala } from './fechas';

interface Props {
  menu: MenuGenerado;
  /** Suma de los precios reales anotados en la lista; prellena el monto si todavía no hay gasto. */
  sugerido?: string | null;
  alRegistrar: (gasto: GastoRegistrado) => void;
}

/** Una diferencia en verde si se gastó menos o lo mismo, y en rojo si se pasó (CA-27.1 y CA-27.2). */
function LineaDiferencia({ d }: { d: Diferencia }) {
  return <p className={Number(d.monto) > 0 ? 'mf-exceso' : 'mf-costo-ok'}>{d.texto}</p>;
}

/**
 * Gasto real de la semana (CU-06.4, HU-27): un solo monto total para un menú aprobado, que se puede
 * corregir, comparado con lo estimado y con el presupuesto. Si la lista tiene precios anotados
 * (CU-07.7), el monto aparece prellenado con su suma.
 */
export function GastoReal({ menu, sugerido, alRegistrar }: Props) {
  const menus = useApiMenus();
  const gasto = menu.gasto ?? null;
  const [abierto, setAbierto] = useState(false);
  const [monto, setMonto] = useState('');
  const [nota, setNota] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const prellenado = !gasto && sugerido ? sugerido : null;

  function abrir() {
    setMonto(gasto?.gastoReal ?? prellenado ?? '');
    setNota(gasto?.nota ?? '');
    setError(null);
    setAbierto(true);
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    const validado = validarGasto(monto);
    if (!validado.ok) {
      setError(validado.mensaje);
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const guardado = await menus.registrarGasto(menu.id, monto.trim(), nota.trim() || undefined);
      alRegistrar(guardado);
      setAbierto(false);
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section aria-label="Gasto real" className="mf-costos">
      {gasto ? (
        <>
          <p>
            <strong>Gasto real:</strong> Q{gasto.gastoReal}
          </p>
          {gasto.diferenciaVsEstimado && <LineaDiferencia d={gasto.diferenciaVsEstimado} />}
          {gasto.diferenciaVsPresupuesto && <LineaDiferencia d={gasto.diferenciaVsPresupuesto} />}
          {gasto.nota && <p className="mf-texto-suave">Nota: {gasto.nota}</p>}
          {gasto.registradoPor && gasto.registradoEn && (
            <small className="mf-texto-suave">
              Registrado por {gasto.registradoPor.nombre} el{' '}
              {fechaHoraGuatemala(gasto.registradoEn)}
            </small>
          )}
        </>
      ) : (
        <p className="mf-texto-suave">Todavía no registras lo que gastaste esta semana.</p>
      )}
      {!abierto && (
        <p>
          <button type="button" className="mf-boton mf-boton--secundario" onClick={abrir}>
            {gasto ? 'Corregir gasto' : 'Registrar gasto real'}
          </button>
        </p>
      )}
      {abierto && (
        <form onSubmit={(e) => void guardar(e)} aria-label="Registrar gasto real" noValidate>
          <div className="mf-campo">
            <label htmlFor="gasto-monto">Monto gastado (Q)</label>
            <input
              id="gasto-monto"
              inputMode="decimal"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
            />
            {prellenado && monto === prellenado && (
              <small className="mf-texto-suave">
                Sugerido con los precios que anotaste en la lista. Puedes cambiarlo.
              </small>
            )}
          </div>
          <div className="mf-campo">
            <label htmlFor="gasto-nota">Nota (opcional)</label>
            <input
              id="gasto-nota"
              maxLength={NOTA_GASTO_MAXIMA}
              value={nota}
              onChange={(e) => setNota(e.target.value)}
            />
          </div>
          {error && (
            <p className="mf-exceso" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="mf-boton" disabled={guardando}>
            Guardar gasto
          </button>{' '}
          <button
            type="button"
            className="mf-enlace"
            disabled={guardando}
            onClick={() => setAbierto(false)}
          >
            Cancelar
          </button>
        </form>
      )}
    </section>
  );
}
