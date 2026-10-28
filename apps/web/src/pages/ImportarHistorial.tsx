import { useEffect, useState } from 'react';
import { Link, useHistory, useParams } from 'react-router-dom';
import { aCentavos, formatoQuetzales } from '@menu/shared';
import { useAuth } from '../auth/contexto';
import { mensajeDeError } from '../api';
import {
  useApiImportaciones,
  type FilaImportacion,
  type VistaImportacion,
} from '../api/importaciones';
import { PaginaBase } from './PaginaBase';
import ResolverPlatillos from './ResolverPlatillos';
import './acceso.css';
import './hogar.css';

const monto = (gasto: string | null) =>
  gasto === null ? 'Sin gasto' : formatoQuetzales(aCentavos(gasto)!, true);
export default function ImportarHistorial() {
  const { id } = useParams<{ id?: string }>();
  const api = useApiImportaciones();
  const history = useHistory();
  const { hogar } = useAuth();
  const [vista, setVista] = useState<VistaImportacion | null>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [filas, setFilas] = useState<FilaImportacion[]>([]);
  const [pagina, setPagina] = useState(1);
  const [paginas, setPaginas] = useState(0);
  const [soloErrores, setSoloErrores] = useState(true);
  const [intento, setIntento] = useState(0);
  useEffect(() => {
    let activo = true;
    setVista(null);
    setError('');
    if (!id || hogar?.rol !== 'ADMIN') return;
    setOcupado(true);
    api
      .obtener(id)
      .then((r) => {
        if (activo) setVista(r);
      })
      .catch((e: unknown) => {
        if (activo) setError(mensajeDeError(e));
      })
      .finally(() => {
        if (activo) setOcupado(false);
      });
    return () => {
      activo = false;
    };
  }, [api, id, intento, hogar?.rol]);
  useEffect(() => {
    let activo = true;
    if (!vista || !id || !vista.revision) {
      setFilas([]);
      return;
    }
    api
      .filas(id, pagina, soloErrores)
      .then((r) => {
        if (activo) {
          setFilas(r.datos);
          setPaginas(r.paginacion.totalPaginas);
        }
      })
      .catch((e: unknown) => {
        if (activo) {
          setFilas([]);
          setError(mensajeDeError(e));
        }
      });
    return () => {
      activo = false;
    };
  }, [api, id, pagina, soloErrores, vista]);
  async function ejecutar(accion: () => Promise<void>) {
    setOcupado(true);
    setError('');
    try {
      await accion();
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setOcupado(false);
    }
  }
  async function descargar(formato: 'csv' | 'xlsx') {
    await ejecutar(async () => {
      const blob = await api.plantilla(formato);
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = `plantilla-menus.${formato}`;
      document.body.append(enlace);
      enlace.click();
      enlace.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }
  return (
    <PaginaBase titulo="Importar historial">
      <div className="mf-hogar">
        <Link className="mf-enlace" to="/historial">
          Volver al historial
        </Link>
        {hogar?.rol !== 'ADMIN' ? (
          <p>Solo la persona administradora puede importar menús.</p>
        ) : (
          <>
            <p>Carga menús de semanas terminadas. Revisa los datos antes de confirmarlos.</p>
            {error && (
              <div className="mf-alerta" role="alert">
                <p>{error}</p>
                {id && (
                  <button disabled={ocupado} onClick={() => setIntento((n) => n + 1)}>
                    Volver a cargar vista previa
                  </button>
                )}
              </div>
            )}
            {!id && (
              <>
                <p>
                  CSV en UTF-8 con separador coma o Excel con hoja Menus. Máximo 5 MB y 5000 filas.
                </p>
                <p>
                  Columnas obligatorias: fecha, tiempo_comida y platillo. Opcionales: dia,
                  proteina_principal, gasto_semana_gtq y notas.
                </p>
                <p>
                  El gasto es opcional, positivo y debe coincidir en todas las filas de una semana.
                  Las notas admiten 200 caracteres por comida.
                </p>
                <div className="mf-acciones">
                  <button disabled={ocupado} onClick={() => void descargar('csv')}>
                    Plantilla CSV
                  </button>{' '}
                  <button disabled={ocupado} onClick={() => void descargar('xlsx')}>
                    Plantilla Excel y diccionario
                  </button>
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (archivo)
                      void ejecutar(async () => {
                        if (archivo.size > 5 * 1024 * 1024) {
                          setError('El archivo admite hasta 5 MB');
                          return;
                        }
                        const r = await api.cargar(archivo);
                        history.push(`/historial/importar/${r.id}`);
                      });
                  }}
                >
                  <label>
                    Archivo de menús{' '}
                    <input
                      type="file"
                      accept=".csv,.xlsx"
                      disabled={ocupado}
                      onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
                    />
                  </label>
                  <button className="mf-boton mf-boton--primario" disabled={ocupado || !archivo}>
                    Revisar archivo
                  </button>
                </form>
              </>
            )}
            {ocupado && <p role="status">Procesando…</p>}
            {vista && (
              <>
                <h2>{vista.nombreArchivo}</h2>
                <p>
                  {vista.totalFilas} filas · {vista.filasConError} con errores
                </p>
                {vista.estado === 'CANCELADA' && (
                  <p role="status">Importación cancelada. No se guardaron menús.</p>
                )}
                {vista.reporte && (
                  <p role="status">
                    Importación confirmada: {vista.reporte.semanasCreadas} semanas creadas,{' '}
                    {vista.reporte.reemplazadas} reemplazadas y {vista.reporte.omitidas} omitidas.
                    {vista.reporte.platillosCreados > 0 &&
                      ` Se crearon ${vista.reporte.platillosCreados} platillos nuevos sin ingredientes.`}
                    {vista.reporte.aliasCreados > 0 &&
                      ` Se recordaron ${vista.reporte.aliasCreados} nombres alternos.`}
                  </p>
                )}
                {vista.revision && (
                  <>
                    <ResolverPlatillos
                      vista={vista}
                      ocupado={ocupado}
                      ejecutar={ejecutar}
                      alCambiar={setVista}
                    />
                    {!!vista.filasConError && (
                      <p role="alert">
                        Corrige los errores en el archivo y vuelve a cargarlo. No se guardará
                        ninguna semana con errores.
                      </p>
                    )}
                    <p>
                      Las semanas existentes se omiten. Elige Reemplazar únicamente si quieres
                      sustituir todo su menú y su gasto.
                    </p>
                    {vista.semanas.map((s) => (
                      <section
                        className="mf-tarjeta"
                        key={s.semanaInicio}
                        aria-label={`Semana ${s.semanaInicio}`}
                      >
                        <h3>
                          {s.semanaInicio} al {s.fechaFin}
                        </h3>
                        <p>Gasto del archivo: {monto(s.gastoSemana)}</p>
                        {s.existente ? (
                          <>
                            <p>
                              Registrado: {monto(s.existente.gastoReal)} · {s.existente.estado}
                            </p>
                            <label>
                              Acción para {s.semanaInicio}{' '}
                              <select
                                disabled={ocupado}
                                value={s.decision}
                                onChange={(e) => {
                                  const decision = e.target.value as 'OMITIR' | 'REEMPLAZAR';
                                  void ejecutar(async () =>
                                    setVista(
                                      await api.decidir(
                                        vista.id,
                                        vista.revision!,
                                        s.semanaInicio,
                                        decision,
                                      ),
                                    ),
                                  );
                                }}
                              >
                                <option value="OMITIR">Omitir</option>
                                {s.puedeReemplazar && (
                                  <option value="REEMPLAZAR">Reemplazar todo</option>
                                )}
                              </select>
                            </label>
                            {!s.puedeReemplazar && <p>Esta semana está protegida y se omitirá.</p>}
                          </>
                        ) : (
                          <p>Se creará como histórica.</p>
                        )}
                      </section>
                    ))}
                    <h3>Revisión por fila</h3>
                    <label>
                      <input
                        type="checkbox"
                        checked={soloErrores}
                        onChange={(e) => {
                          setSoloErrores(e.target.checked);
                          setPagina(1);
                        }}
                      />{' '}
                      Mostrar solo errores
                    </label>
                    {!filas.length && (
                      <p>
                        {soloErrores ? 'Sin errores para mostrar.' : 'No hay filas en esta página.'}
                      </p>
                    )}
                    <ul>
                      {filas.map((f) => (
                        <li key={f.numeroFila}>
                          Fila {f.numeroFila}: {f.datos.fecha} · {f.datos.tiempo} ·{' '}
                          {f.datos.platillo}
                          {f.errores.map((e, i) => (
                            <p key={i}>
                              {e.columna}: {e.motivo}
                            </p>
                          ))}
                        </li>
                      ))}
                    </ul>
                    {paginas > 1 && (
                      <div>
                        <button disabled={pagina <= 1} onClick={() => setPagina((n) => n - 1)}>
                          Anterior
                        </button>{' '}
                        Página {pagina} de {paginas}{' '}
                        <button
                          disabled={pagina >= paginas}
                          onClick={() => setPagina((n) => n + 1)}
                        >
                          Siguiente
                        </button>
                      </div>
                    )}
                    <button
                      className="mf-boton mf-boton--primario"
                      disabled={ocupado || !vista.puedeConfirmar}
                      onClick={() =>
                        void ejecutar(async () => {
                          await api.confirmar(vista.id, vista.revision!);
                          setVista(await api.obtener(vista.id));
                        })
                      }
                    >
                      Confirmar importación
                    </button>
                    <button
                      className="mf-boton mf-boton--secundario"
                      disabled={ocupado}
                      onClick={() =>
                        void ejecutar(async () =>
                          setVista(await api.cancelar(vista.id, vista.revision!)),
                        )
                      }
                    >
                      Cancelar importación
                    </button>
                  </>
                )}
                {!vista.revision && <Link to="/historial/importar">Cargar otro archivo</Link>}
              </>
            )}
          </>
        )}
      </div>
    </PaginaBase>
  );
}
