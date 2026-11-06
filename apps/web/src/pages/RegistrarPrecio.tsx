import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  formatearCantidad,
  precioDeVinculo,
  validarFechaCompra,
  validarPrecioMercado,
} from '@menu/shared';
import { mensajeDeError } from '../api';
import type { Producto, Unidad } from '../api/catalogo';
import { useApiCatalogo } from '../api/contexto-catalogo';
import { useApiPrecios } from '../api/contexto-precios';
import { useApiVinculos } from '../api/contexto-vinculos';
import type { DatosPrecio, ResumenPrecio as DatosResumen } from '../api/precios';
import type { SupermercadoCatalogo, Vinculo } from '../api/vinculos';
import { Cargando } from '../auth/Cargando';
import { PaginaBase } from './PaginaBase';
import { ResumenPrecio } from './ResumenPrecio';
import { hoyEnDispositivo } from './precios';
import { fechaCompleta } from './supermercados';
import './acceso.css';
import './catalogo.css';
import './hogar.css';

/** Registrar a mano el precio de un producto en un supermercado (CU-08.1, HU-34). */
export default function RegistrarPrecio() {
  const { id: productoId = '' } = useParams<{ id: string }>();
  const catalogo = useApiCatalogo();
  const apiVinculos = useApiVinculos();
  const apiPrecios = useApiPrecios();
  const hoy = hoyEnDispositivo();

  const [producto, setProducto] = useState<Producto | null>(null);
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [supermercados, setSupermercados] = useState<SupermercadoCatalogo[]>([]);
  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  /** `undefined` = todavía no se sabe o no se pudo leer; `null` = sin precio. */
  const [resumen, setResumen] = useState<DatosResumen | null | undefined>(undefined);
  const [cargado, setCargado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);

  const [supermercadoId, setSupermercadoId] = useState('');
  const [precio, setPrecio] = useState('');
  const [fecha, setFecha] = useState(hoy);
  const [cantidad, setCantidad] = useState('');
  const [unidadId, setUnidadId] = useState('');
  const [errores, setErrores] = useState<string[]>([]);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let activo = true;
    setError(null);
    Promise.all([
      catalogo.obtenerProducto(productoId),
      catalogo.listarUnidades(),
      apiVinculos.supermercados(),
      apiVinculos.listar(productoId),
    ])
      .then(([p, u, s, v]) => {
        if (!activo) return;
        setProducto(p);
        setUnidades(u);
        setSupermercados(s);
        setVinculos(v);
        setCantidad(formatearCantidad(p.presentacion.cantidad));
        setUnidadId(p.presentacion.unidad.id);
        setSupermercadoId((actual) => actual || (s[0]?.id ?? ''));
        setCargado(true);
        apiPrecios
          .resumen(productoId)
          .then((r) => activo && setResumen(r))
          .catch(() => activo && setResumen(undefined));
      })
      .catch((e: unknown) => {
        if (activo) setError(mensajeDeError(e));
      });
    return () => {
      activo = false;
    };
  }, [catalogo, apiVinculos, apiPrecios, productoId, intento]);

  const elegido = supermercados.find((s) => s.id === supermercadoId);
  const vinculo = vinculos.find((v) => v.activo && v.supermercado.id === supermercadoId);
  const precioValido = validarPrecioMercado(precio);

  /** Precio llevado a la presentación de compra del producto (RN-08), mientras se escribe. */
  const equivalente = useMemo(
    () =>
      vinculo && precioValido.ok ? precioDeVinculo(precioValido.precio, vinculo.factor) : null,
    [vinculo, precioValido],
  );
  const faltaVinculoConEnlace = !vinculo && elegido?.requiereEnlace === true;

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setMensaje(null);
    const validaFecha = validarFechaCompra(fecha, hoy);
    const problemas = [
      ...(precioValido.ok ? [] : [precioValido.mensaje]),
      ...(validaFecha.ok ? [] : [validaFecha.mensaje]),
    ];
    setErrores(problemas);
    if (problemas.length > 0 || !precioValido.ok) return;

    const datos: DatosPrecio = {
      precio: precioValido.precio,
      fechaPrecio: fecha,
      ...(vinculo
        ? { productoSupermercadoId: vinculo.id }
        : {
            productoId,
            supermercadoId,
            presentacionCantidad: cantidad.trim().replace(',', '.'),
            presentacionUnidadId: unidadId,
          }),
    };
    setOcupado(true);
    try {
      const r = await apiPrecios.registrar(datos);
      setPrecio('');
      setVinculos(await apiVinculos.listar(productoId));
      setResumen(await apiPrecios.resumen(productoId).catch(() => undefined));
      setMensaje(
        `Precio guardado: Q${r.precio} en ${r.vinculo.supermercado.nombre} (${fechaCompleta(r.fechaPrecio)}).` +
          (r.vinculoCreado ? ' Se creó el vínculo con este supermercado.' : ''),
      );
    } catch (e) {
      setErrores([mensajeDeError(e)]);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <PaginaBase titulo={producto ? `Registrar precio de ${producto.nombre}` : 'Registrar precio'}>
      <div className="mf-catalogo">
        <p style={{ margin: '0 0 12px' }}>
          <Link className="mf-enlace" to={`/platillos/productos/${productoId}/supermercados`}>
            ← Volver a los supermercados del producto
          </Link>
        </p>
        {error && (
          <div className="mf-alerta" role="alert">
            <p>{error}</p>
            {!cargado && (
              <button
                type="button"
                className="mf-boton mf-boton--secundario"
                onClick={() => setIntento((n) => n + 1)}
              >
                Reintentar
              </button>
            )}
          </div>
        )}
        {!cargado || !producto ? (
          !error && <Cargando />
        ) : (
          <form onSubmit={(e) => void enviar(e)} aria-label="Registrar precio" noValidate>
            <p>
              Presentación de compra: <strong>{producto.etiqueta}</strong>. Anota lo que viste o
              pagaste en la tienda; el precio queda en tu hogar.
            </p>
            {resumen !== undefined && <ResumenPrecio resumen={resumen} />}
            {mensaje && <p role="status">{mensaje}</p>}
            {errores.length > 0 && (
              <div className="mf-alerta" role="alert">
                {errores.map((m) => (
                  <p key={m}>{m}</p>
                ))}
              </div>
            )}
            <div className="mf-campo">
              <label htmlFor="precio-supermercado">Supermercado</label>
              <select
                id="precio-supermercado"
                value={supermercadoId}
                onChange={(e) => {
                  setSupermercadoId(e.target.value);
                  setErrores([]);
                }}
              >
                {supermercados.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </div>

            {vinculo && (
              <p className="mf-texto-suave">
                Se registra sobre «{vinculo.nombreTienda}» ({vinculo.presentacion.texto}).
              </p>
            )}
            {faltaVinculoConEnlace && elegido && (
              <div className="mf-advertencia" role="status">
                <p>
                  {elegido.nombre} se consulta automáticamente y necesita un vínculo con la URL o el
                  SKU del producto antes de registrar precios.{' '}
                  <Link
                    className="mf-enlace"
                    to={`/platillos/productos/${productoId}/supermercados`}
                  >
                    Crear el vínculo
                  </Link>
                </p>
              </div>
            )}
            {!vinculo && !faltaVinculoConEnlace && elegido && (
              <>
                <p className="mf-texto-suave">
                  Este producto todavía no está vinculado con {elegido.nombre}: indica la
                  presentación en que se vende y se creará el vínculo con este precio.
                </p>
                <div className="mf-campo">
                  <label htmlFor="precio-cantidad">Cantidad de la presentación</label>
                  <input
                    id="precio-cantidad"
                    inputMode="decimal"
                    value={cantidad}
                    onChange={(e) => setCantidad(e.target.value)}
                  />
                </div>
                <div className="mf-campo">
                  <label htmlFor="precio-unidad">Unidad</label>
                  <select
                    id="precio-unidad"
                    value={unidadId}
                    onChange={(e) => setUnidadId(e.target.value)}
                  >
                    {unidades.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nombre} ({u.codigo})
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div className="mf-campo">
              <label htmlFor="precio-monto">Precio (Q)</label>
              <input
                id="precio-monto"
                inputMode="decimal"
                value={precio}
                onChange={(e) => {
                  setPrecio(e.target.value);
                  setErrores([]);
                }}
              />
            </div>
            {equivalente !== null && vinculo && vinculo.factor !== '1' && (
              <p className="mf-texto-suave">
                Equivale a Q{equivalente.toFixed(2)} por tu presentación ({producto.etiqueta}).
              </p>
            )}
            <div className="mf-campo">
              <label htmlFor="precio-fecha">Fecha de compra</label>
              <input
                id="precio-fecha"
                type="date"
                max={hoy}
                value={fecha}
                onChange={(e) => {
                  setFecha(e.target.value);
                  setErrores([]);
                }}
              />
            </div>
            <button
              type="submit"
              className="mf-boton mf-boton--primario"
              disabled={ocupado || !supermercadoId || faltaVinculoConEnlace}
            >
              {ocupado ? 'Guardando…' : 'Guardar precio'}
            </button>
          </form>
        )}
      </div>
    </PaginaBase>
  );
}
