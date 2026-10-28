import { useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useAuth } from '../auth/contexto';
import './acceso.css';

/** Cierra la sesión en este dispositivo y vuelve a "Iniciar sesión" (HU-01). */
export function BotonCerrarSesion() {
  const { cerrarSesion } = useAuth();
  const history = useHistory();
  const [cerrando, setCerrando] = useState(false);

  async function cerrar() {
    setCerrando(true);
    await cerrarSesion();
    history.replace('/login');
  }

  return (
    <button
      type="button"
      className="mf-boton mf-boton--secundario"
      onClick={cerrar}
      disabled={cerrando}
    >
      {cerrando ? 'Cerrando sesión…' : 'Cerrar sesión'}
    </button>
  );
}
