import { useEffect, useState } from 'react';
import { mensajeDeError } from '../api';
import { useApiCatalogo } from '../api/contexto-catalogo';
import type { ResumenPlatillo } from '../api/catalogo';
import {
  useApiImportaciones,
  type DecisionPlatillo,
  type PlatilloPorResolver,
  type VistaImportacion,
} from '../api/importaciones';

const porcentaje = (similitud: number) => `${Math.round(similitud * 100)} %`;
function textoPropuesta(p: PlatilloPorResolver['propuesta']) {
  return p.accion === 'ASOCIAR' && p.platillo
    ? `Asociar a ${p.platillo} (${porcentaje(p.similitud ?? 0)})`
    : 'Crear nuevo';
}
function textoDecision(p: PlatilloPorResolver) {
  if (p.decision === 'ASOCIAR') return `Se asociará a ${p.platillo ?? 'otro platillo'}`;
  if (p.decision === 'CREAR') return `Se creará ${p.nombreFinal ?? p.nombreOriginal}`;
  return `Propuesta: ${textoPropuesta(p.propuesta)}`;
}

interface FilaProps {
  platillo: PlatilloPorResolver;
  ocupado: boolean;
  decidir: (d: DecisionPlatillo) => void;
}
function FilaPlatillo({ platillo: p, ocupado, decidir }: FilaProps) {
  const catalogo = useApiCatalogo();
  const [nombre, setNombre] = useState(p.nombreFinal ?? p.nombreOriginal);
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState<ResumenPlatillo[]>([]);
  const [elegido, setElegido] = useState('');
  const [errorBusqueda, setErrorBusqueda] = useState('');
  useEffect(() => {
    if (!busqueda.trim()) {
      setResultados([]);
      return;
    }
    let activo = true;
    const timer = setTimeout(() => {
      catalogo
        .listarPlatillos({ q: busqueda.trim() })
        .then((r) => {
          if (activo) {
            setResultados(r.datos);
            setErrorBusqueda('');
          }
        })
        .catch((e: unknown) => {
          if (activo) setErrorBusqueda(mensajeDeError(e));
        });
    }, 250);
    return () => {
      activo = false;
      clearTimeout(timer);
    };
  }, [catalogo, busqueda]);
  const pendiente = p.decision === 'PENDIENTE';
  return (
    <li className="mf-tarjeta" aria-label={`Platillo ${p.nombreOriginal}`}>
      <strong>{p.nombreOriginal}</strong>
      <p>{textoDecision(p)}</p>
      {pendiente && (
        <button
          className="mf-boton mf-boton--primario"
          disabled={ocupado}
          onClick={() =>
            decidir({
              nombreNormalizado: p.nombreNormalizado,
              decision: p.propuesta.accion,
              ...(p.propuesta.platilloId ? { platilloId: p.propuesta.platilloId } : {}),
            })
          }
        >
          Aceptar propuesta
        </button>
      )}
      <details>
        <summary>{pendiente ? 'Otras opciones' : 'Cambiar decisión'}</summary>
        <div>
          <label>
            Nombre del platillo nuevo
            <input
              value={nombre}
              maxLength={80}
              onChange={(e) => setNombre(e.target.value)}
              aria-label={`Nombre nuevo para ${p.nombreOriginal}`}
            />
          </label>{' '}
          <button
            disabled={ocupado || !nombre.trim()}
            onClick={() =>
              decidir({
                nombreNormalizado: p.nombreNormalizado,
                decision: 'CREAR',
                nombreFinal: nombre,
              })
            }
          >
            Crear nuevo
          </button>
        </div>
        <div>
          <label>
            Buscar platillo del catálogo
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              aria-label={`Buscar platillo para ${p.nombreOriginal}`}
            />
          </label>
          {errorBusqueda && <p role="alert">{errorBusqueda}</p>}
          {!!resultados.length && (
            <>
              <label>
                Platillo existente
                <select
                  value={elegido}
                  onChange={(e) => setElegido(e.target.value)}
                  aria-label={`Platillo existente para ${p.nombreOriginal}`}
                >
                  <option value="">Elige uno</option>
                  {resultados.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nombre}
                    </option>
                  ))}
                </select>
              </label>{' '}
              <button
                disabled={ocupado || !elegido}
                onClick={() =>
                  decidir({
                    nombreNormalizado: p.nombreNormalizado,
                    decision: 'ASOCIAR',
                    platilloId: elegido,
                  })
                }
              >
                Asociar
              </button>
            </>
          )}
        </div>
      </details>
    </li>
  );
}

interface Props {
  vista: VistaImportacion;
  ocupado: boolean;
  ejecutar: (accion: () => Promise<void>) => Promise<void>;
  alCambiar: (vista: VistaImportacion) => void;
}
/** Resolución de platillos que no están en el catálogo al importar (HU-17). */
export default function ResolverPlatillos({ vista, ocupado, ejecutar, alCambiar }: Props) {
  const api = useApiImportaciones();
  const [lista, setLista] = useState<PlatilloPorResolver[]>([]);
  const [pagina, setPagina] = useState(1);
  const [paginas, setPaginas] = useState(0);
  const [errorLista, setErrorLista] = useState('');
  const { id, revision } = vista;
  useEffect(() => {
    let activo = true;
    if (!revision) return;
    api
      .platillos(id, 'revisar', pagina)
      .then((r) => {
        if (!activo) return;
        setLista(r.datos);
        setPaginas(r.paginacion.totalPaginas);
        setErrorLista('');
        // Si la última página quedó vacía tras resolver, vuelve a la anterior.
        if (!r.datos.length && pagina > 1) setPagina(pagina - 1);
      })
      .catch((e: unknown) => {
        if (activo) setErrorLista(mensajeDeError(e));
      });
    return () => {
      activo = false;
    };
  }, [api, id, revision, pagina]);
  if (!revision) return null;
  const faltan = vista.pendientes.length;
  const enviar = (cuerpo: Parameters<typeof api.decidirPlatillos>[2]) =>
    ejecutar(async () => alCambiar(await api.decidirPlatillos(id, revision, cuerpo)));
  if (!faltan && !lista.length && !errorLista) return null;
  return (
    <section aria-label="Platillos por resolver">
      <h3>Platillos por resolver</h3>
      {errorLista && <p role="alert">{errorLista}</p>}
      {faltan > 0 && (
        <div className="mf-alerta">
          <p>
            {faltan === 1
              ? 'Falta 1 platillo por resolver.'
              : `Faltan ${faltan} platillos por resolver.`}{' '}
            Acepta la propuesta o elige otra opción para cada uno.
          </p>
          <button
            className="mf-boton mf-boton--primario"
            disabled={ocupado}
            onClick={() => void enviar({ aceptarPropuestas: true })}
          >
            Aceptar todas las propuestas
          </button>
        </div>
      )}
      <ul className="mf-lista">
        {lista.map((p) => (
          <FilaPlatillo
            key={`${p.nombreNormalizado}:${p.decision}:${p.platilloId ?? ''}:${p.nombreFinal ?? ''}`}
            platillo={p}
            ocupado={ocupado}
            decidir={(d) => void enviar({ decisiones: [d] })}
          />
        ))}
      </ul>
      {paginas > 1 && (
        <div>
          <button disabled={pagina <= 1} onClick={() => setPagina((n) => n - 1)}>
            Anterior platillos
          </button>{' '}
          Página {pagina} de {paginas}{' '}
          <button disabled={pagina >= paginas} onClick={() => setPagina((n) => n + 1)}>
            Siguiente platillos
          </button>
        </div>
      )}
    </section>
  );
}
