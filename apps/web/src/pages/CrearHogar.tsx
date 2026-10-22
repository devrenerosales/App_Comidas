import { IonText } from '@ionic/react';
import { useAuth } from '../auth/contexto';
import { PaginaBase } from './PaginaBase';
import { BotonCerrarSesion } from './BotonCerrarSesion';

/**
 * Destino tras registrarse sin hogar (CU-01.1 paso 6). El formulario de crear hogar e
 * invitar llega con HU-02 (CU-01.2).
 */
export default function CrearHogar() {
  const { usuario } = useAuth();
  return (
    <PaginaBase titulo="Crear hogar">
      <IonText>
        <p>¡Hola, {usuario?.nombre}! Tu cuenta está lista.</p>
        <p>Pronto podrás crear tu hogar e invitar a tu familia desde aquí.</p>
      </IonText>
      <BotonCerrarSesion />
    </PaginaBase>
  );
}
