import { PaginaBase } from './PaginaBase';
import { Link } from 'react-router-dom';

export default function Inicio() {
  return (
    <PaginaBase titulo="Inicio">
      <p>Registra lo que comieron en semanas pasadas para construir el historial de tu hogar.</p>
      <Link className="mf-boton mf-boton--primario" to="/historial">
        Ver historial de comidas
      </Link>
    </PaginaBase>
  );
}
