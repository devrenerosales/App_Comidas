import { IonSpinner } from '@ionic/react';

/** Indicador mientras se recupera la sesión. */
export function Cargando() {
  return (
    <div className="mf-cargando" role="status" aria-live="polite">
      <IonSpinner name="crescent" color="primary" aria-hidden="true" />
      <span>Cargando…</span>
    </div>
  );
}
