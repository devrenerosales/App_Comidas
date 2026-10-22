import { IonText } from '@ionic/react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/contexto';
import { BotonCerrarSesion } from './BotonCerrarSesion';
import { PaginaBase } from './PaginaBase';
import './acceso.css';
import './hogar.css';

export default function Configuracion() {
  const { usuario, hogar } = useAuth();
  return (
    <PaginaBase titulo="Configuración">
      <div className="mf-hogar">
        {hogar && (
          <section aria-labelledby="titulo-hogar">
            <h2 id="titulo-hogar">Tu hogar</h2>
            <p>
              {hogar.nombre} · {hogar.rol === 'ADMIN' ? 'Administrador' : 'Miembro'}
            </p>
            <Link className="mf-boton mf-boton--secundario" to="/configuracion/hogar">
              Hogar y usuarios
            </Link>
          </section>
        )}
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
      </div>
    </PaginaBase>
  );
}
