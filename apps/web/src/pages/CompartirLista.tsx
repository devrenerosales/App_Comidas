import { useId, useState } from 'react';
import { textoDeLista } from '@menu/shared';
import type { ListaCompras } from '../api/listas';

/**
 * Compartir la lista (CU-07.5, HU-32): arma el texto en el dispositivo, así que funciona sin
 * conexión, y lo manda al menú de compartir del sistema (WhatsApp u otra app). Si el navegador no
 * lo tiene, copia el texto al portapapeles. Por defecto lleva solo los pendientes, sin precios.
 */
export function CompartirLista({ lista }: { lista: ListaCompras }) {
  const idIncluir = useId();
  const idTexto = useId();
  const [incluirComprados, setIncluirComprados] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [textoManual, setTextoManual] = useState<string | null>(null);

  async function compartir() {
    setTextoManual(null);
    const { texto, productos } = textoDeLista(lista.semana, lista.items, incluirComprados);
    if (productos === 0) {
      setAviso('No hay productos pendientes');
      return;
    }
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'Lista de compras', text: texto });
        setAviso(null);
        return;
      } catch (e) {
        // Si la persona cierra el menú no hay nada más que hacer; otro fallo se resuelve copiando.
        if (e instanceof DOMException && e.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(texto);
      setAviso('Lista copiada');
    } catch {
      setTextoManual(texto);
      setAviso('No se pudo copiar automáticamente: selecciona el texto y cópialo.');
    }
  }

  const sinPendientes = aviso === 'No hay productos pendientes';
  return (
    <div className="mf-compartir">
      <button
        type="button"
        className="mf-boton mf-boton--secundario"
        onClick={() => void compartir()}
      >
        Compartir
      </button>{' '}
      <label htmlFor={idIncluir}>
        <input
          id={idIncluir}
          type="checkbox"
          checked={incluirComprados}
          onChange={(e) => {
            setIncluirComprados(e.target.checked);
            setAviso(null);
            setTextoManual(null);
          }}
        />{' '}
        Incluir comprados
      </label>
      {aviso && (
        <p role="status" className="mf-texto-suave">
          {aviso}
        </p>
      )}
      {sinPendientes && !incluirComprados && (
        <p className="mf-texto-suave">Activa «Incluir comprados» para compartir toda la lista.</p>
      )}
      {textoManual && (
        <div className="mf-campo">
          <label htmlFor={idTexto}>Texto de la lista</label>
          <textarea
            id={idTexto}
            readOnly
            rows={Math.min(textoManual.split('\n').length, 10)}
            value={textoManual}
            onFocus={(e) => e.currentTarget.select()}
          />
        </div>
      )}
    </div>
  );
}
