import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ProblemaApi, mensajeDeError } from '../api';
import { useApiConfiguracion } from '../api/contexto-configuracion';
import { useApiMenus } from '../api/contexto-menus';
import type { ItemLista } from '../api/listas';
import type { MenuGenerado } from '../api/menus';
import { Cargando } from '../auth/Cargando';
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

const cambiosPendientes = (n: number) =>
  `${n} ${n === 1 ? 'cambio pendiente' : 'cambios pendientes'}`;

interface FilaProps {
  item: ItemLista;
  editable: boolean;
  alMarcar: ListaSincronizada['marcar'];
  alQuitar: ListaSincronizada['quitar'];
}

function FilaItem({ item, editable, alMarcar, alQuitar }: FilaProps) {
  const requerida = item.cantidadRequerida;
  const cubierto = item.estado !== 'PENDIENTE';
  const nombre = item.producto.nombre;
  return (
    <li className="mf-lista-item">
      <label className="mf-lista-nombre">
        {editable && (
          <input
            type="checkbox"
            checked={item.estado === 'COMPRADO'}
            aria-label={`Marcar ${nombre} como comprado`}
            onChange={(e) => alMarcar(item.id, e.target.checked ? 'COMPRADO' : 'PENDIENTE')}
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
      {item.sinConversion && <small className="mf-dia-marca">Sin conversión</small>}
      {item.estado === 'YA_LO_TENGO' && <small className="mf-dia-marca">Ya lo tengo</small>}
      {editable && (
        <span className="mf-menu-acciones">
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
            {lista.items.length === 0 ? (
              <p>
                Los platillos de este menú todavía no tienen ingredientes, así que no hay productos
                que comprar.
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
                  />
                ))}
              </ul>
            )}
            {editable && <AgregarProducto alAgregar={sincronizada.agregar} />}
          </section>
        )}
      </div>
    </PaginaBase>
  );
}
