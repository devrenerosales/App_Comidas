import { useEffect, useState, type FormEvent } from 'react';
import { Link, useHistory, useLocation, useParams } from 'react-router-dom';
import {
  LARGO_MAXIMO_NOMBRE_PLATILLO,
  MAXIMO_ETIQUETAS,
  MENSAJES_CATALOGO,
  NOMBRES_PROTEINA,
  ORDEN_TIEMPOS,
  ProteinaPrincipal,
  separarEtiquetas,
  type TiempoComida,
} from '@menu/shared';
import { ProblemaApi, mensajeDeError } from '../api';
import type { Categoria, DetallePlatillo, Unidad } from '../api/catalogo';
import { useApiCatalogo } from '../api/contexto-catalogo';
import { Cargando } from '../auth/Cargando';
import { CampoTexto } from './CampoTexto';
import { EditorIngredientes } from './EditorIngredientes';
import { PaginaBase } from './PaginaBase';
import { NOMBRES_TIEMPO } from './nombres-catalogo';
import './acceso.css';
import './hogar.css';
import './catalogo.css';

/**
 * Nuevo platillo / editar platillo (HU-11 · CU-03.1 pasos 3–6, 3a, 3b) con el editor de
 * ingredientes (HU-12). La calificación del platillo llega con HU-14 (S3).
 */
export default function PlatilloDetalle() {
  const api = useApiCatalogo();
  const historial = useHistory();
  const { id } = useParams<{ id?: string }>();
  const { search } = useLocation();
  const nuevo = !id;

  const [platillo, setPlatillo] = useState<DetallePlatillo | null>(null);
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [nombre, setNombre] = useState(() => new URLSearchParams(search).get('nombre') ?? '');
  const [tiempos, setTiempos] = useState<TiempoComida[]>(['ALMUERZO']);
  const [proteina, setProteina] = useState<ProteinaPrincipal>(ProteinaPrincipal.OTRA);
  const [etiquetas, setEtiquetas] = useState('');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [alerta, setAlerta] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [duplicado, setDuplicado] = useState<{ id: string; nombre: string } | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let vigente = true;
    Promise.all([
      id ? api.obtenerPlatillo(id) : Promise.resolve(null),
      api.listarUnidades(),
      api.listarCategorias(),
    ])
      .then(([p, u, c]) => {
        if (!vigente) return;
        setUnidades(u);
        setCategorias(c);
        if (p) {
          setPlatillo(p);
          setNombre(p.nombre);
          setTiempos(p.tiempos);
          setProteina(p.proteinaPrincipal);
          setEtiquetas(p.etiquetas.join(', '));
        }
      })
      .catch((e: unknown) => vigente && setErrorCarga(mensajeDeError(e)));
    return () => {
      vigente = false;
    };
  }, [api, id]);

  function alternarTiempo(t: TiempoComida) {
    setTiempos(tiempos.includes(t) ? tiempos.filter((x) => x !== t) : [...tiempos, t]);
  }

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    setAlerta(null);
    setAviso(null);
    setDuplicado(null);
    const lista = separarEtiquetas(etiquetas);
    const nuevos: Record<string, string> = {};
    if (!nombre.trim()) nuevos.nombre = MENSAJES_CATALOGO.nombrePlatilloObligatorio;
    if (tiempos.length === 0) nuevos.tiempos = MENSAJES_CATALOGO.sinTiempo;
    if (lista.length > MAXIMO_ETIQUETAS) nuevos.etiquetas = MENSAJES_CATALOGO.maximoEtiquetas;
    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0) return;
    const datos = { nombre: nombre.trim(), tiempos, proteinaPrincipal: proteina, etiquetas: lista };
    setOcupado(true);
    try {
      if (platillo) {
        setPlatillo(await api.actualizarPlatillo(platillo.id, datos));
        setAviso('Platillo guardado.');
      } else {
        const creado = await api.crearPlatillo(datos);
        historial.replace(`/platillos/${creado.id}`, { recienCreado: true });
      }
    } catch (error) {
      if (error instanceof ProblemaApi && error.codigo === 'PLATILLO_DUPLICADO') {
        setDuplicado({
          id: String(error.cuerpo.existenteId),
          nombre: String(error.cuerpo.existenteNombre),
        });
      } else if (error instanceof ProblemaApi && error.errores.length > 0) {
        setErrores(Object.fromEntries(error.errores.map((e) => [e.campo, e.mensaje])));
      } else {
        setAlerta(mensajeDeError(error));
      }
    } finally {
      setOcupado(false);
    }
  }

  async function cambiarActivo() {
    if (!platillo) return;
    setAlerta(null);
    setAviso(null);
    if (platillo.activo) {
      const confirma = window.confirm(
        `¿Inactivar «${platillo.nombre}»? Dejará de aparecer en la lista y en las sugerencias, pero se conserva en el historial.`,
      );
      if (!confirma) return;
    }
    try {
      const actualizado = platillo.activo
        ? await api.inactivarPlatillo(platillo.id)
        : await api.reactivarPlatillo(platillo.id);
      setPlatillo(actualizado);
      setAviso(actualizado.activo ? 'Platillo reactivado.' : 'Platillo inactivado.');
    } catch (error) {
      setAlerta(mensajeDeError(error));
    }
  }

  const titulo = nuevo ? 'Nuevo platillo' : (platillo?.nombre ?? 'Platillo');
  if (!nuevo && !platillo && !errorCarga) {
    return (
      <PaginaBase titulo={titulo}>
        <Cargando />
      </PaginaBase>
    );
  }

  return (
    <PaginaBase titulo={titulo}>
      <div className="mf-catalogo">
        <p style={{ margin: '0 0 12px' }}>
          <Link className="mf-enlace" to="/platillos">
            ← Volver a platillos
          </Link>
        </p>
        {errorCarga && (
          <div className="mf-alerta" role="alert">
            <p>{errorCarga}</p>
          </div>
        )}
        {platillo?.advertencias.map((a) => (
          <div key={a.productoId} className="mf-advertencia" role="note">
            <p>{a.mensaje}</p>
          </div>
        ))}
        {aviso && (
          <div className="mf-aviso" role="status">
            <p>{aviso}</p>
          </div>
        )}
        {alerta && (
          <div className="mf-alerta" role="alert">
            <p>{alerta}</p>
          </div>
        )}
        {duplicado && (
          <div className="mf-alerta" role="alert">
            <p>{MENSAJES_CATALOGO.platilloDuplicado(duplicado.nombre)}</p>
            <Link className="mf-boton mf-boton--secundario" to={`/platillos/${duplicado.id}`}>
              Abrir {duplicado.nombre}
            </Link>
          </div>
        )}

        <form noValidate onSubmit={guardar} aria-label="Datos del platillo" className="mf-tarjeta">
          {platillo && (
            <p className="mf-chips" style={{ marginBottom: 12 }}>
              {platillo.incompleto && (
                <span className="mf-chip mf-chip--incompleto">{MENSAJES_CATALOGO.incompleto}</span>
              )}
              {!platillo.activo && <span className="mf-chip mf-chip--inactivo">Inactivo</span>}
            </p>
          )}
          <CampoTexto
            etiqueta="Nombre del platillo"
            value={nombre}
            maxLength={LARGO_MAXIMO_NOMBRE_PLATILLO}
            onChange={(e) => setNombre(e.target.value)}
            error={errores.nombre}
          />
          <fieldset
            className="mf-fieldset"
            aria-describedby={errores.tiempos ? 'tiempos-error' : undefined}
          >
            <legend>Tiempos de comida</legend>
            <div className="mf-opciones">
              {ORDEN_TIEMPOS.map((t) => (
                <label key={t} className="mf-opcion">
                  <input
                    type="checkbox"
                    checked={tiempos.includes(t)}
                    onChange={() => alternarTiempo(t)}
                  />
                  {NOMBRES_TIEMPO[t]}
                </label>
              ))}
            </div>
            {errores.tiempos && (
              <p id="tiempos-error" className="mf-campo__error">
                {errores.tiempos}
              </p>
            )}
          </fieldset>
          <div className="mf-campo">
            <label htmlFor="platillo-proteina">Proteína principal</label>
            <select
              id="platillo-proteina"
              value={proteina}
              onChange={(e) => setProteina(e.target.value as ProteinaPrincipal)}
            >
              {Object.values(ProteinaPrincipal).map((p) => (
                <option key={p} value={p}>
                  {NOMBRES_PROTEINA[p]}
                </option>
              ))}
            </select>
          </div>
          <CampoTexto
            etiqueta="Etiquetas"
            ayuda={`Separadas por comas, hasta ${MAXIMO_ETIQUETAS}. Ej.: típico, fin de semana`}
            value={etiquetas}
            onChange={(e) => setEtiquetas(e.target.value)}
            error={errores.etiquetas}
          />
          <div className="mf-acciones">
            <button className="mf-boton mf-boton--primario" type="submit" disabled={ocupado}>
              {ocupado ? 'Guardando…' : 'Guardar platillo'}
            </button>
            {platillo && (
              <button
                type="button"
                className={
                  platillo.activo ? 'mf-boton mf-boton--peligro' : 'mf-boton mf-boton--secundario'
                }
                onClick={() => void cambiarActivo()}
              >
                {platillo.activo ? 'Inactivar' : 'Reactivar'}
              </button>
            )}
          </div>
        </form>

        {platillo && unidades.length > 0 && (
          <EditorIngredientes
            key={platillo.id}
            platillo={platillo}
            unidades={unidades}
            categorias={categorias}
            alGuardar={setPlatillo}
          />
        )}
        {nuevo && (
          <p className="mf-texto-suave" style={{ marginTop: 16 }}>
            Guarda el platillo para agregar sus ingredientes.
          </p>
        )}
      </div>
    </PaginaBase>
  );
}
