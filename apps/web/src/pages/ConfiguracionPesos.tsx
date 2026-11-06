import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { PESOS_MOTOR_POR_DEFECTO, validarPesosMotor, type PesosMotor } from '@menu/shared';
import { ProblemaApi, mensajeDeError } from '../api';
import { useApiConfiguracion } from '../api/contexto-configuracion';
import type { ConfiguracionHogar, PesosMotorTexto } from '../api/configuracion';
import { useAuth } from '../auth/contexto';
import { Cargando } from '../auth/Cargando';
import { PaginaBase } from './PaginaBase';
import './acceso.css';
import './hogar.css';

const FACTORES: [keyof PesosMotorTexto, string, string][] = [
  ['preferencia', 'Preferencia', 'Calificaciones y favoritos del hogar.'],
  ['novedad', 'Novedad', 'Cuánto hace que no se prepara el platillo.'],
  ['ahorro', 'Ahorro', 'Qué tan barato es frente al presupuesto por comida.'],
  ['afinidad', 'Afinidad', 'Qué tanto se ha preparado en las últimas 16 semanas.'],
];

const aTexto = (p: PesosMotor): PesosMotorTexto => ({
  preferencia: p.preferencia.toFixed(2),
  novedad: p.novedad.toFixed(2),
  ahorro: p.ahorro.toFixed(2),
  afinidad: p.afinidad.toFixed(2),
});
const numero = (texto: string) => (texto.trim() === '' ? Number.NaN : Number(texto));
const aNumeros = (t: PesosMotorTexto): PesosMotor => ({
  preferencia: numero(t.preferencia),
  novedad: numero(t.novedad),
  ahorro: numero(t.ahorro),
  afinidad: numero(t.afinidad),
});

/** Pesos del puntaje del motor: suma en vivo y guardado solo del administrador (HU-20). */
export default function ConfiguracionPesos() {
  const api = useApiConfiguracion();
  const { hogar } = useAuth();
  const admin = hogar?.rol === 'ADMIN';
  const [config, setConfig] = useState<ConfiguracionHogar | null>(null);
  const [pesos, setPesos] = useState<PesosMotorTexto>(aTexto(PESOS_MOTOR_POR_DEFECTO));
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);

  function aplicar(c: ConfiguracionHogar) {
    setConfig(c);
    setPesos({ ...c.pesos });
  }
  useEffect(() => {
    let activo = true;
    setError(null);
    api
      .obtener()
      .then((c) => {
        if (activo) aplicar(c);
      })
      .catch((e: unknown) => {
        if (activo) setError(mensajeDeError(e));
      });
    return () => {
      activo = false;
    };
  }, [api, intento]);

  const validacion = validarPesosMotor(aNumeros(pesos));
  const suma = Number.isFinite(validacion.suma) ? validacion.suma.toFixed(2) : '—';

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!config || !admin || !validacion.valido) return;
    setOcupado(true);
    setError(null);
    setMensaje(null);
    try {
      aplicar(await api.guardarPesosMotor({ version: config.version, ...pesos }));
      setMensaje('Pesos guardados. Se aplican al próximo menú que se sugiera.');
    } catch (err) {
      setError(mensajeDeError(err));
      if (err instanceof ProblemaApi && err.codigo === 'VERSION_DESACTUALIZADA') {
        try {
          aplicar(await api.obtener());
        } catch {
          /* Conserva el aviso y permite reintentar. */
        }
      }
    } finally {
      setOcupado(false);
    }
  }
  const cambiar = (factor: keyof PesosMotorTexto, valor: string) => {
    setPesos((p) => ({ ...p, [factor]: valor }));
    setMensaje(null);
  };
  const restaurar = () => {
    setPesos(aTexto(PESOS_MOTOR_POR_DEFECTO));
    setMensaje(null);
  };

  return (
    <PaginaBase titulo="Pesos del motor">
      <div className="mf-hogar">
        <Link className="mf-enlace" to="/configuracion">
          Volver a Configuración
        </Link>
        {error && (
          <div className="mf-alerta" role="alert">
            <p>{error}</p>
            {!config && (
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
        {!config ? (
          !error && <Cargando />
        ) : (
          <>
            {!admin && <p role="status">Solo el administrador puede cambiar los pesos</p>}
            {mensaje && <p role="status">{mensaje}</p>}
            <p>
              El motor puntúa cada platillo con cuatro factores. Los pesos indican cuánto cuenta
              cada uno y deben sumar 1.00.
            </p>
            <form onSubmit={(e) => void guardar(e)} aria-label="Pesos del motor">
              {FACTORES.map(([factor, titulo, ayuda]) => (
                <div className="mf-campo" key={factor}>
                  <label htmlFor={`peso-${factor}`}>{titulo}</label>
                  <input
                    id={`peso-${factor}`}
                    inputMode="decimal"
                    value={pesos[factor]}
                    disabled={!admin || ocupado}
                    aria-describedby={`ayuda-${factor}`}
                    onChange={(e) => cambiar(factor, e.target.value)}
                  />
                  <small id={`ayuda-${factor}`}>{ayuda}</small>
                </div>
              ))}
              <p aria-live="polite">
                <strong>Suma: </strong>
                {suma}
              </p>
              {!validacion.valido && validacion.mensaje && (
                <p role="alert" className="mf-alerta">
                  {validacion.mensaje}
                </p>
              )}
              {admin && (
                <>
                  <button
                    type="submit"
                    className="mf-boton mf-boton--primario"
                    disabled={ocupado || !validacion.valido}
                  >
                    {ocupado ? 'Guardando…' : 'Guardar'}
                  </button>{' '}
                  <button
                    type="button"
                    className="mf-boton mf-boton--secundario"
                    disabled={ocupado}
                    onClick={restaurar}
                  >
                    Restaurar valores por defecto
                  </button>
                </>
              )}
            </form>
          </>
        )}
      </div>
    </PaginaBase>
  );
}
