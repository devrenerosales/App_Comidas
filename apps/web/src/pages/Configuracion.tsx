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
        {hogar && (
          <section aria-labelledby="titulo-tiempos">
            <h2 id="titulo-tiempos">Tiempos de comida y presupuesto</h2>
            <p>Qué tiempos planificas, cuánto gastas a la semana y cómo se reparte.</p>
            <Link className="mf-boton mf-boton--secundario" to="/configuracion/tiempos">
              Tiempos y presupuesto
            </Link>
          </section>
        )}
        {hogar && (
          <section aria-labelledby="titulo-semana">
            <h2 id="titulo-semana">Semana</h2>
            <p>Elige cuándo empieza tu semana y qué día planificas.</p>
            <Link className="mf-boton mf-boton--secundario" to="/configuracion/semana">
              Configurar semana
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
