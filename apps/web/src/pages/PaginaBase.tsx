import { IonContent, IonHeader, IonPage, IonText, IonTitle, IonToolbar } from '@ionic/react';
import type { ReactNode } from 'react';

interface Props {
  titulo: string;
  children?: ReactNode;
}

/** Estructura común de una página con encabezado colapsable (iOS) y contenido. */
export function PaginaBase({ titulo, children }: Props) {
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>{titulo}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="ion-padding">
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">{titulo}</IonTitle>
          </IonToolbar>
        </IonHeader>
        {children ?? (
          <IonText color="medium">
            <p>Próximamente.</p>
          </IonText>
        )}
      </IonContent>
    </IonPage>
  );
}
