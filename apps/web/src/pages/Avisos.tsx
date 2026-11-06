import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { mensajeDeError } from '../api';
import type { Aviso } from '../api/avisos';
import { useApiAvisos } from '../api/contexto-avisos';
import { Cargando } from '../auth/Cargando';
import { PaginaBase } from './PaginaBase';
import { fechaCompleta } from './supermercados';
import './acceso.css';
import './hogar.css';

/** Fecha local del aviso en "dd/mm/aaaa" (la corrida corre a las 21:00 de Guatemala). */
const fechaDelAviso = (iso: string): string =>
  fechaCompleta(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guatemala' }).format(new Date(iso)),
  );

/**
 * Avisos de precios del administrador (HU-38): sitios bloqueados y productos que la corrida
 * automática no pudo actualizar, para que registre esos precios a mano.
 */
export default function Avisos() {
  const api = useApiAvisos();
  const [avisos, setAvisos] = useState<Aviso[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let activo = true;
    setError(null);
    api
      .listar()
      .then((a) => activo && setAvisos(a))
      .catch((e: unknown) => activo && setError(mensajeDeError(e)));
    return () => {
      activo = false;
    };
  }, [api, intento]);

  async function marcarLeido(id: string) {
    try {
      await api.marcarLeido(id);
      setAvisos(
        (actuales) => actuales?.map((a) => (a.id === id ? { ...a, leido: true } : a)) ?? null,
      );
    } catch (e) {
      setError(mensajeDeError(e));
    }
  }

  const pendientes = avisos?.filter((a) => !a.leido).length ?? 0;

  return (
    <PaginaBase titulo="Avisos de precios">
      <div className="mf-hogar">
        <p style={{ margin: '0 0 12px' }}>
          <Link className="mf-enlace" to="/configuracion">
            ← Configuración
          </Link>
        </p>
        {error && (
          <div className="mf-alerta" role="alert">
            <p>{error}</p>
            <button
              type="button"
              className="mf-boton mf-boton--secundario"
              onClick={() => setIntento((n) => n + 1)}
            >
              Reintentar
            </button>
          </div>
        )}
        {avisos === null ? (
          !error && <Cargando />
        ) : avisos.length === 0 ? (
          <p className="mf-texto-suave">No hay avisos de precios.</p>
        ) : (
          <>
            <p role="status">
              {pendientes === 0
                ? 'No tienes avisos sin leer.'
                : `${pendientes} ${pendientes === 1 ? 'aviso sin leer' : 'avisos sin leer'}`}
            </p>
            <ul className="mf-lista" aria-label="Avisos de precios">
              {avisos.map((a) => (
                <li key={a.id} className="mf-lista-item">
                  <strong>{a.mensaje}</strong>
                  <small className="mf-menu-costo">{fechaDelAviso(a.createdAt)}</small>
                  {a.leido ? (
                    <small className="mf-dia-marca">Leído</small>
                  ) : (
                    <button
                      type="button"
                      className="mf-enlace"
                      aria-label={`Marcar como leído: ${a.mensaje}`}
                      onClick={() => void marcarLeido(a.id)}
                    >
                      Marcar como leído
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <p className="mf-texto-suave">
              Registra a mano los precios que faltan en{' '}
              <Link className="mf-enlace" to="/platillos/productos">
                Productos → Supermercados → Registrar precio
              </Link>
              .
            </p>
          </>
        )}
      </div>
    </PaginaBase>
  );
}
