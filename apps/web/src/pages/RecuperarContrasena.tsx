import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { apiAuth, mensajeDeError } from '../api';
import type { ApiAuth } from '../api/auth';
import { CampoTexto } from './CampoTexto';
import { PaginaAcceso } from './PaginaAcceso';

export default function RecuperarContrasena({
  api = apiAuth,
}: {
  api?: Pick<ApiAuth, 'recuperar'>;
}) {
  const [correo, setCorreo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim()) || correo.trim().length > 254) {
      setError('Ingresa un correo válido');
      return;
    }
    setEnviando(true);
    try {
      await api.recuperar(correo.trim());
      setEnviado(true);
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setEnviando(false);
    }
  }
  return (
    <PaginaAcceso
      titulo="Recuperar contraseña"
      intro="Te enviaremos un enlace para crear una nueva contraseña."
      pie={
        <Link className="mf-enlace" to="/login">
          Volver a iniciar sesión
        </Link>
      }
    >
      {enviado ? (
        <p role="status">
          Si el correo existe, recibirás un enlace. Revisa también la carpeta de spam. El enlace
          vence en una hora.
        </p>
      ) : (
        <form noValidate onSubmit={enviar} aria-label="Recuperar contraseña">
          {error && (
            <p role="alert" className="mf-alerta">
              {error}
            </p>
          )}
          <CampoTexto
            etiqueta="Correo"
            type="email"
            name="correo"
            autoComplete="email"
            required
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            maxLength={254}
          />
          <button className="mf-boton mf-boton--primario" disabled={enviando} type="submit">
            {enviando ? 'Enviando…' : 'Enviar enlace'}
          </button>
        </form>
      )}
    </PaginaAcceso>
  );
}
