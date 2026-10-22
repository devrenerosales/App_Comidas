import { IonContent, IonPage } from '@ionic/react';
import type { ReactNode } from 'react';
import './acceso.css';

interface Props {
  titulo: string;
  intro: string;
  children: ReactNode;
  pie?: ReactNode;
}

/** Marco común de "Iniciar sesión" y "Crear cuenta". */
export function PaginaAcceso({ titulo, intro, children, pie }: Props) {
  return (
    <IonPage className="mf-acceso">
      <IonContent className="mf-acceso">
        <main className="mf-acceso__contenedor">
          <p className="mf-acceso__marca">Menú Familiar</p>
          <h1>{titulo}</h1>
          <p className="mf-acceso__intro">{intro}</p>
          <div className="mf-tarjeta">{children}</div>
          {pie && <p className="mf-acceso__pie">{pie}</p>}
        </main>
      </IonContent>
    </IonPage>
  );
}
