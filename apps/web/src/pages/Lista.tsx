import { useEffect, useState, type FormEvent } from 'react';
import { cantidadValida, validarPrecio } from '@menu/shared';
import { Link } from 'react-router-dom';
import { ProblemaApi, mensajeDeError } from '../api';
import { useApiConfiguracion } from '../api/contexto-configuracion';
import { useApiMenus } from '../api/contexto-menus';
import type { ItemLista } from '../api/listas';
import type { MenuGenerado } from '../api/menus';
import { Cargando } from '../auth/Cargando';
import { AvanceComidas } from './AvanceComidas';
import { GastoReal } from './GastoReal';
import { PaginaBase } from './PaginaBase';
import { etiquetaSemana, sumarDiasFecha } from './fechas';
import { useListaSincronizada, type ListaSincronizada } from './useListaSincronizada';
import './acceso.css';
import './hogar.css';
import './semana.css';

/** Semanas que se ofrecen a partir de la que sigue al último menú aprobado: las ya aprobadas y las próximas. */
const SEMANAS_ANTERIORES = 8;
const SEMANAS_SIGUIENTES = 4;

/** "7 lb" cuando se compra por libra, "3 × bolsa 2 lb" cuando la presentación trae más contenido. */
function textoCompra(i: ItemLista): string {
  const p = i.presentacion;
  if (!p) return i.cantidadComprar;
  if (p.cantidad === '1' && p.unidadCompra === p.unidad) return `${i.cantidadComprar} ${p.unidad}`;
  return `${i.cantidadComprar} × ${p.texto}`;
}

type VistaLista = 'PRODUCTOS' | 'POR_COMIDA';

/** Alterna entre ver los productos de la lista o el avance por comida (HU-43). */
function SelectorVistaLista({
  vista,
  alCambiar,
}: {
  vista: VistaLista;
  alCambiar: (v: VistaLista) => void;
}) {
  const opciones: [VistaLista, string][] = [
    ['PRODUCTOS', 'Productos'],
    ['POR_COMIDA', 'Por comida'],
  ];
  return (
    <div className="mf-selector-vista" role="group" aria-label="Vista de la lista">
      {opciones.map(([valor, texto]) => (
        <button
          key={valor}
          type="button"
          className={`mf-boton ${vista === valor ? 'mf-boton--primario' : 'mf-boton--secundario'}`}
          aria-pressed={vista === valor}
          onClick={() => alCambiar(valor)}
        >
          {texto}
        </button>
      ))}
    </div>
  );
}

const cambiosPendientes = (n: number) =>
  `${n} ${n === 1 ? 'cambio pendiente' : 'cambios pendientes'}`;

/** Origen que se avisa en la fila: lo que trae la despensa (CU-07.2). */
const ORIGEN_DESPENSA: Partial<Record<ItemLista['origen'], string>> = {
  DESPENSA: 'Despensa',
  MENU_Y_DESPENSA: 'Menú + Despensa',
};

interface FilaProps {
  item: ItemLista;
  editable: boolean;
  alMarcar: ListaSincronizada['marcar'];
  alQuitar: ListaSincronizada['quitar'];
  alPrecio: ListaSincronizada['registrarPrecio'];
}

/** "Promedio de compra Q27.20 (3 compras) · Mediana Q27.50" (RN-12), solo con lo que se conoce. */
function textoReferencia(i: ItemLista): string | null {
  const partes = [
    i.promedioCompra
      ? `Promedio de compra Q${i.promedioCompra.precio} (${i.promedioCompra.compras} ${
          i.promedioCompra.compras === 1 ? 'compra' : 'compras'
        })`
      : null,
    i.medianaMercado ? `Mediana Q${i.medianaMercado}` : null,
  ].filter((p): p is string => p !== null);
  return partes.length > 0 ? partes.join(' · ') : null;
}

/** Precio pagado de un producto comprado (CU-07.7): opcional, con el contenido si fue otra presentación. */
function FormularioPrecio({
  item,
  alGuardar,
  alCerrar,
}: {
  item: ItemLista;
  alGuardar: FilaProps['alPrecio'];
  alCerrar: () => void;
}) {
  const [precio, setPrecio] = useState(item.precioReal ?? '');
  const [contenido, setContenido] = useState(item.contenidoComprado ?? '');
  const [error, setError] = useState<string | null>(null);
  const unidad = item.presentacion?.unidad;

  function guardar(e: FormEvent) {
    e.preventDefault();
    const validado = validarPrecio(precio);
    if (!validado.ok) {
      setError(validado.mensaje);
      return;
    }
    let contenidoValido: number | undefined;
    if (contenido.trim() !== '') {
      const c = cantidadValida(contenido);
      if (c === null) {
        setError('El contenido comprado debe ser mayor que 0');
        return;
      }
      contenidoValido = c;
    }
    alGuardar(item.id, validado.valor, contenidoValido);
    alCerrar();
  }

  return (
    <form onSubmit={guardar} aria-label={`Precio de ${item.producto.nombre}`} noValidate>
      <div className="mf-campo">
        <label htmlFor={`precio-${item.id}`}>Precio pagado (Q)</label>
        <input
          id={`precio-${item.id}`}
          inputMode="decimal"
          value={precio}
          onChange={(e) => setPrecio(e.target.value)}
        />
      </div>
      {item.presentacion && unidad && (
        <div className="mf-campo">
          <label htmlFor={`contenido-${item.id}`}>
            Contenido comprado ({unidad}), si no fue {item.presentacion.texto}
          </label>
          <input
            id={`contenido-${item.id}`}
            inputMode="decimal"
            value={contenido}
            onChange={(e) => setContenido(e.target.value)}
          />
        </div>
      )}
      {error && (
        <p className="mf-exceso" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="mf-boton mf-boton--secundario">
        Guardar precio
      </button>{' '}
      <button type="button" className="mf-enlace" onClick={alCerrar}>
        {item.precioReal ? 'Cancelar' : 'Omitir precio'}
      </button>
    </form>
  );
}

function FilaItem({ item, editable, alMarcar, alQuitar, alPrecio }: FilaProps) {
  const [anotandoPrecio, setAnotandoPrecio] = useState(false);
  const requerida = item.cantidadRequerida;
  const cubierto = item.estado !== 'PENDIENTE';
  const nombre = item.producto.nombre;
  const referencia = textoReferencia(item);
  return (
    <li className="mf-lista-item">
      <label className="mf-lista-nombre">
        {editable && (
          <input
            type="checkbox"
            checked={item.estado === 'COMPRADO'}
            aria-label={`Marcar ${nombre} como comprado`}
            onChange={(e) => {
              alMarcar(item.id, e.target.checked ? 'COMPRADO' : 'PENDIENTE');
              // CU-07.7 paso 1: al marcar comprado se ofrece anotar el precio pagado.
              setAnotandoPrecio(e.target.checked);
            }}
          />
        )}{' '}
        <strong className={cubierto ? 'mf-tachado' : undefined}>{nombre}</strong>
      </label>
      <span className={cubierto ? 'mf-tachado' : undefined}>Comprar: {textoCompra(item)}</span>
      {requerida && (
        <small className="mf-menu-costo">
          Requerido: {requerida.cantidad} {requerida.unidad}
          {item.equivalente && ` (≈ ${item.equivalente.cantidad} ${item.equivalente.unidad})`}
        </small>
      )}
      {referencia && <small className="mf-menu-costo">{referencia}</small>}
      {item.sinConversion && <small className="mf-dia-marca">Sin conversión</small>}
      {ORIGEN_DESPENSA[item.origen] && (
        <small className="mf-dia-marca">{ORIGEN_DESPENSA[item.origen]}</small>
      )}
      {item.estado === 'YA_LO_TENGO' && <small className="mf-dia-marca">Ya lo tengo</small>}
      {item.estado === 'COMPRADO' && item.precioReal && (
        <small className="mf-dia-marca">Pagado Q{item.precioReal}</small>
      )}
      {editable && (
        <span className="mf-menu-acciones">
          {item.estado === 'COMPRADO' && !anotandoPrecio && (
            <button
              type="button"
              className="mf-enlace"
              aria-label={`${item.precioReal ? 'Corregir' : 'Anotar'} precio de ${nombre}`}
              onClick={() => setAnotandoPrecio(true)}
            >
              {item.precioReal ? 'Corregir precio' : 'Anotar precio'}
            </button>
          )}
          <button
            type="button"
            className="mf-enlace"
            aria-pressed={item.estado === 'YA_LO_TENGO'}
            aria-label={`Ya lo tengo ${nombre}`}
            onClick={() =>
              alMarcar(item.id, item.estado === 'YA_LO_TENGO' ? 'PENDIENTE' : 'YA_LO_TENGO')
            }
          >
            Ya lo tengo
          </button>
          <button
            type="button"
            className="mf-enlace"
            aria-label={`Quitar ${nombre}`}
            onClick={() => alQuitar(item.id)}
          >
            Quitar
          </button>
        </span>
      )}
      {editable && item.estado === 'COMPRADO' && anotandoPrecio && (
        <FormularioPrecio
          item={item}
          alGuardar={alPrecio}
          alCerrar={() => setAnotandoPrecio(false)}
        />
      )}
    </li>
  );
}

/** Formulario para agregar un producto a mano (texto libre, CU-07.3 paso 2). */
function AgregarProducto({ alAgregar }: { alAgregar: ListaSincronizada['agregar'] }) {
  const [nombre, setNombre] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [error, setError] = useState<string | null>(null);

  function enviar(e: FormEvent) {
    e.preventDefault();
    const problema = alAgregar(nombre, cantidad);
    setError(problema);
    if (!problema) {
      setNombre('');
      setCantidad('1');
    }
  }

  return (
    <form onSubmit={enviar} aria-label="Agregar producto" noValidate>
      <h3>Agregar producto</h3>
      <div className="mf-campo">
        <label htmlFor="producto-nuevo">Producto</label>
        <input
          id="producto-nuevo"
          value={nombre}
          maxLength={80}
          onChange={(e) => setNombre(e.target.value)}
        />
      </div>
      <div className="mf-campo">
        <label htmlFor="cantidad-nueva">Cantidad</label>
        <input
          id="cantidad-nueva"
          inputMode="decimal"
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
        />
      </div>
      {error && (
        <p className="mf-exceso" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="mf-boton mf-boton--secundario">
        Agregar
      </button>
    </form>
  );
}

/**
 * Lista de compras de la semana (CU-07.1 y CU-07.3, HU-28 y HU-30): los ingredientes del menú
 * aprobado sumados por producto, que se pueden marcar, quitar y ampliar, también sin conexión. Un
 * menú sin aprobar todavía no tiene lista.
 */
export default function Lista() {
  const configuracion = useApiConfiguracion();
  const menus = useApiMenus();
  const [semanas, setSemanas] = useState<string[] | null>(null);
  const [semana, setSemana] = useState('');
  const [menu, setMenu] = useState<MenuGenerado | null>(null);
  const [sinMenu, setSinMenu] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  const [vista, setVista] = useState<VistaLista>('PRODUCTOS');
  const sincronizada = useListaSincronizada(menu?.listaId ?? null);
  const { lista, pendientes, sinConexion, aviso } = sincronizada;
  const editable = menu?.estado === 'APROBADO';

  useEffect(() => {
    let activo = true;
    setError(null);
    configuracion
      .obtenerSemana()
      .then((c) => {
        if (!activo) return;
        const desde = c.proximaSemana.desde;
        setSemanas(
          Array.from({ length: SEMANAS_ANTERIORES + SEMANAS_SIGUIENTES }, (_, i) =>
            sumarDiasFecha(desde, (i - SEMANAS_ANTERIORES) * 7),
          ),
        );
        // Abre la semana más reciente ya planificada, que suele ser la que se está comprando.
        setSemana(sumarDiasFecha(desde, -7));
      })
      .catch((e: unknown) => {
        if (activo) setError(mensajeDeError(e));
      });
    return () => {
      activo = false;
    };
  }, [configuracion, intento]);

  // Al elegir una semana se abre su menú; la lista se abre desde su id.
  useEffect(() => {
    if (!semana) return;
    let activo = true;
    setMenu(null);
    setSinMenu(false);
    setError(null);
    menus
      .obtenerPorSemana(semana)
      .then((m) => {
        if (activo) setMenu(m);
      })
      .catch((e: unknown) => {
        if (!activo) return;
        if (e instanceof ProblemaApi && e.codigo === 'SIN_MENU') setSinMenu(true);
        else setError(mensajeDeError(e));
      });
    return () => {
      activo = false;
    };
  }, [menus, semana, intento]);

  const mensajeError = error ?? sincronizada.error;

  return (
    <PaginaBase titulo="Lista de compras">
      <div className="mf-hogar">
        {mensajeError && (
          <div className="mf-alerta" role="alert">
            <p>{mensajeError}</p>
            <button
              type="button"
              className="mf-boton mf-boton--secundario"
              onClick={() => {
                setIntento((n) => n + 1);
                sincronizada.reintentar();
              }}
            >
              Reintentar
            </button>
          </div>
        )}
        {!semanas ? (
          !mensajeError && <Cargando />
        ) : (
          <div className="mf-campo">
            <label htmlFor="semana-lista">Semana</label>
            <select id="semana-lista" value={semana} onChange={(e) => setSemana(e.target.value)}>
              {semanas.map((s) => (
                <option key={s} value={s}>
                  {etiquetaSemana(s)}
                </option>
              ))}
            </select>
          </div>
        )}
        {sinMenu && (
          <p role="status">
            Esta semana todavía no tiene menú.{' '}
            <Link className="mf-enlace" to="/semana">
              Ir a Semana
            </Link>
          </p>
        )}
        {menu && menu.estado === 'BORRADOR' && (
          <p role="status">
            Aprueba el menú para generar la lista.{' '}
            <Link className="mf-enlace" to="/semana">
              Ir a Semana
            </Link>
          </p>
        )}
        {lista && (
          <section aria-labelledby="titulo-lista" className="mf-tarjeta">
            <h2 id="titulo-lista">Lista del {etiquetaSemana(lista.semana.desde)}</h2>
            {lista.excede && <p className="mf-exceso">{lista.excede.texto}</p>}
            {sinConexion && (
              <p role="status" className="mf-texto-suave">
                Sin conexión: los cambios se guardan en este teléfono y se envían al reconectar.
              </p>
            )}
            {pendientes > 0 && (
              <p role="status" className="mf-advertencia">
                {cambiosPendientes(pendientes)}
              </p>
            )}
            {aviso && (
              <p role="alert" className="mf-exceso">
                {aviso}
              </p>
            )}
            <p>
              {lista.comprados} / {lista.total} comprados
            </p>
            {lista.sinConversion > 0 && (
              <p className="mf-texto-suave">
                Hay productos sin conversión de unidades: revisa cuánto comprar de ellos.
              </p>
            )}
            <SelectorVistaLista vista={vista} alCambiar={setVista} />
            {vista === 'POR_COMIDA' ? (
              <AvanceComidas lista={lista} editable={editable} alMarcar={sincronizada.marcar} />
            ) : (
              <>
                {lista.items.length === 0 ? (
                  <p>
                    Los platillos de este menú todavía no tienen ingredientes, así que no hay
                    productos que comprar.
                  </p>
                ) : (
                  <ul className="mf-lista" aria-label="Productos de la lista">
                    {lista.items.map((i) => (
                      <FilaItem
                        key={i.id}
                        item={i}
                        editable={editable}
                        alMarcar={sincronizada.marcar}
                        alQuitar={sincronizada.quitar}
                        alPrecio={sincronizada.registrarPrecio}
                      />
                    ))}
                  </ul>
                )}
                {editable && <AgregarProducto alAgregar={sincronizada.agregar} />}
              </>
            )}
          </section>
        )}
        <p>
          <Link className="mf-enlace" to="/despensa">
            Configurar la despensa
          </Link>
        </p>
        {lista && menu?.estado === 'APROBADO' && (
          <GastoReal
            menu={menu}
            sugerido={lista.gastoSugerido ?? menu.gastoSugerido}
            alRegistrar={(gasto) => setMenu({ ...menu, gasto })}
          />
        )}
      </div>
    </PaginaBase>
  );
}
