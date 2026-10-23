import { useState, type FormEvent } from 'react';
import {
  LARGO_MAXIMO_NOMBRE_PRODUCTO,
  LARGO_MAXIMO_UNIDAD_COMPRA,
  MENSAJES_CATALOGO,
  NOMBRES_TIPO_PRODUCTO,
  TipoProducto,
} from '@menu/shared';
import { ProblemaApi, mensajeDeError } from '../api';
import type { Categoria, Producto, Unidad } from '../api/catalogo';
import { useApiCatalogo } from '../api/contexto-catalogo';
import { CampoTexto } from './CampoTexto';

interface Props {
  unidades: Unidad[];
  categorias: Categoria[];
  /** Nombre sugerido (texto del buscador, CU-03.2 3a). */
  nombreInicial?: string;
  tipoInicial?: TipoProducto;
  alGuardar(producto: Producto): void;
  alCancelar?(): void;
  /** Abrir el existente cuando la API responde 409 (CA-13.3). */
  alAbrirExistente?(id: string): void;
}

/**
 * Formulario "Nuevo producto" del catálogo común (HU-13 · CU-03.3). Se usa en Catálogo de
 * productos y desde el buscador de ingredientes (CA-12.2).
 */
export function FormularioProducto({
  unidades,
  categorias,
  nombreInicial = '',
  tipoInicial = TipoProducto.INGREDIENTE,
  alGuardar,
  alCancelar,
  alAbrirExistente,
}: Props) {
  const api = useApiCatalogo();
  const [nombre, setNombre] = useState(nombreInicial);
  const [tipo, setTipo] = useState<TipoProducto>(tipoInicial);
  const [categoriaId, setCategoriaId] = useState(categorias[0]?.id ?? '');
  const [unidadCompra, setUnidadCompra] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [unidadId, setUnidadId] = useState(unidades.find((u) => u.codigo === 'lb')?.id ?? '');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [alerta, setAlerta] = useState<string | null>(null);
  const [existente, setExistente] = useState<{ id: string; etiqueta: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    evento.stopPropagation();
    setAlerta(null);
    setExistente(null);
    const nuevos: Record<string, string> = {};
    if (!nombre.trim()) nuevos.nombre = MENSAJES_CATALOGO.nombreProductoObligatorio;
    if (!unidadCompra.trim()) nuevos.unidadCompra = MENSAJES_CATALOGO.unidadCompraObligatoria;
    if (!(Number(cantidad.replace(',', '.')) > 0)) {
      nuevos.presentacionCantidad = MENSAJES_CATALOGO.presentacionInvalida;
    }
    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0) return;
    setOcupado(true);
    try {
      const creado = await api.crearProducto({
        nombre: nombre.trim(),
        tipo,
        categoriaId,
        unidadCompra: unidadCompra.trim(),
        presentacionCantidad: cantidad.replace(',', '.'),
        presentacionUnidadId: unidadId,
      });
      alGuardar(creado);
    } catch (error) {
      if (error instanceof ProblemaApi && error.codigo === 'PRODUCTO_DUPLICADO') {
        setExistente({
          id: String(error.cuerpo.existenteId),
          etiqueta: String(error.cuerpo.existente),
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

  return (
    <form noValidate onSubmit={guardar} aria-label="Nuevo producto" className="mf-tarjeta">
      <h2>Nuevo producto</h2>
      {alerta && (
        <div className="mf-alerta" role="alert">
          <p>{alerta}</p>
        </div>
      )}
      {existente && (
        <div className="mf-alerta" role="alert">
          <p>{MENSAJES_CATALOGO.productoDuplicado(existente.etiqueta)}</p>
          {alAbrirExistente && (
            <button
              type="button"
              className="mf-boton mf-boton--secundario"
              onClick={() => alAbrirExistente(existente.id)}
            >
              Usar {existente.etiqueta}
            </button>
          )}
        </div>
      )}
      <CampoTexto
        etiqueta="Nombre del producto"
        value={nombre}
        maxLength={LARGO_MAXIMO_NOMBRE_PRODUCTO}
        onChange={(e) => setNombre(e.target.value)}
        error={errores.nombre}
      />
      <div className="mf-filtros">
        <div className="mf-campo">
          <label htmlFor="producto-tipo">Tipo</label>
          <select
            id="producto-tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoProducto)}
          >
            {Object.values(TipoProducto).map((t) => (
              <option key={t} value={t}>
                {NOMBRES_TIPO_PRODUCTO[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="mf-campo">
          <label htmlFor="producto-categoria">Categoría</label>
          <select
            id="producto-categoria"
            value={categoriaId}
            onChange={(e) => setCategoriaId(e.target.value)}
          >
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>
      <CampoTexto
        etiqueta="Unidad de compra"
        ayuda="Cómo se compra: bolsa, lb, unidad, frasco, botella…"
        value={unidadCompra}
        maxLength={LARGO_MAXIMO_UNIDAD_COMPRA}
        onChange={(e) => setUnidadCompra(e.target.value)}
        error={errores.unidadCompra}
      />
      <div className="mf-filtros">
        <CampoTexto
          etiqueta="Presentación (cantidad)"
          inputMode="decimal"
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
          error={errores.presentacionCantidad}
        />
        <div className="mf-campo">
          <label htmlFor="producto-unidad">Unidad de la presentación</label>
          <select
            id="producto-unidad"
            value={unidadId}
            onChange={(e) => setUnidadId(e.target.value)}
          >
            {unidades.map((u) => (
              <option key={u.id} value={u.id}>
                {u.codigo} · {u.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mf-acciones">
        <button className="mf-boton mf-boton--primario" type="submit" disabled={ocupado}>
          {ocupado ? 'Guardando…' : 'Guardar producto'}
        </button>
        {alCancelar && (
          <button type="button" className="mf-boton mf-boton--secundario" onClick={alCancelar}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
