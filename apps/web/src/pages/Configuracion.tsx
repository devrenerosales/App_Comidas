import { IonText } from '@ionic/react';
import { useAuth } from '../auth/contexto';
import { BotonCerrarSesion } from './BotonCerrarSesion';
import { PaginaBase } from './PaginaBase';

export default function Configuracion() {
  const { usuario } = useAuth();
  return (
    <PaginaBase titulo="Configuración">
      <section aria-labelledby="titulo-cuenta">
        <h2 id="titulo-cuenta">Tu cuenta</h2>
        {usuario && (
          <IonText>
            <p>
              {usuario.nombre} · {usuario.correo}
            </p>
          </IonText>
        )}
        <BotonCerrarSesion />
      </section>
    </PaginaBase>
  );
}
