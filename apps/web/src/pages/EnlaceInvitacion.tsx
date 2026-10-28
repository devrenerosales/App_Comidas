import { useId, useState } from 'react';
import { enlaceWhatsApp, textoParaCompartir } from './compartir';

interface Props {
  enlace: string;
  hogarNombre: string;
  /** Texto de la fecha de vencimiento ya formateado. */
  vence: string;
}

/**
 * Enlace de invitación listo para copiar o compartir (CU-01.2 paso 5b y E2): "Copiar enlace",
 * "Compartir…" con la Web Share API si el dispositivo la tiene y "Enviar por WhatsApp" (wa.me).
 */
export function EnlaceInvitacion({ enlace, hogarNombre, vence }: Props) {
  const id = useId();
  const [aviso, setAviso] = useState<string | null>(null);
  const texto = textoParaCompartir(hogarNombre, enlace);
  const puedeCompartir = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  async function copiar() {
    try {
      await navigator.clipboard.writeText(enlace);
      setAviso('Enlace copiado');
    } catch {
      (document.getElementById(id) as HTMLInputElement | null)?.select();
      setAviso('No se pudo copiar automáticamente: selecciona el enlace y cópialo.');
    }
  }

  async function compartir() {
    try {
      await navigator.share({ title: 'Menú Familiar', text: texto, url: enlace });
    } catch {
      // El usuario canceló o la app de destino falló: el enlace sigue visible para copiarlo.
    }
  }

  return (
    <div className="mf-enlace-invitacion">
      <div className="mf-campo">
        <label htmlFor={id}>Enlace de invitación</label>
        <input id={id} readOnly value={enlace} onFocus={(e) => e.currentTarget.select()} />
        <p className="mf-campo__ayuda">Sirve una sola vez y vence el {vence}.</p>
      </div>
      <div className="mf-acciones">
        <button type="button" className="mf-boton mf-boton--secundario" onClick={copiar}>
          Copiar enlace
        </button>
        {puedeCompartir && (
          <button type="button" className="mf-boton mf-boton--secundario" onClick={compartir}>
            Compartir…
          </button>
        )}
        <a
          className="mf-boton mf-boton--secundario"
          href={enlaceWhatsApp(texto)}
          target="_blank"
          rel="noopener noreferrer"
        >
          Enviar por WhatsApp
        </a>
      </div>
      {aviso && (
        <p className="mf-campo__ayuda" role="status">
          {aviso}
        </p>
      )}
    </div>
  );
}
