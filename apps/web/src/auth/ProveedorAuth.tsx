import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiAuth as apiPorDefecto, cliente as clientePorDefecto } from '../api';
import type { ApiAuth, DatosRegistro } from '../api/auth';
import type { ClienteHttp } from '../api/cliente';
import type { HogarDeSesion, Sesion } from '../api/tipos';
import { ContextoAuth, type EstadoSesion, type ValorAuth } from './contexto';

interface Props {
  children: ReactNode;
  api?: ApiAuth;
  cliente?: Pick<ClienteHttp, 'alCambiarSesion'>;
}

interface Estado {
  estado: EstadoSesion;
  sesion: Sesion | null;
}

/**
 * Contexto de autenticación (ADR-004): al abrir la app intenta recuperar la sesión con el
 * refresh; el token de acceso vive solo en memoria del cliente HTTP.
 */
export function ProveedorAuth({
  children,
  api = apiPorDefecto,
  cliente = clientePorDefecto,
}: Props) {
  const [{ estado, sesion }, setEstado] = useState<Estado>({ estado: 'cargando', sesion: null });

  const aplicar = useCallback((nueva: Sesion | null) => {
    setEstado({ estado: nueva ? 'autenticado' : 'anonimo', sesion: nueva });
  }, []);

  useEffect(() => {
    let activo = true;
    api
      .restaurar()
      .then((s) => activo && aplicar(s))
      .catch(() => activo && aplicar(null));
    const anular = cliente.alCambiarSesion((s) => aplicar(s));
    return () => {
      activo = false;
      anular();
    };
  }, [api, cliente, aplicar]);

  const iniciarSesion = useCallback(
    async (correo: string, contrasena: string) => {
      const s = await api.iniciarSesion(correo, contrasena);
      aplicar(s);
      return s;
    },
    [api, aplicar],
  );

  const registrar = useCallback(
    async (datos: DatosRegistro) => {
      const s = await api.registrar(datos);
      aplicar(s);
      return s;
    },
    [api, aplicar],
  );

  const cerrarSesion = useCallback(async () => {
    await api.cerrarSesion();
    aplicar(null);
  }, [api, aplicar]);

  const entrarAlHogar = useCallback((hogar: HogarDeSesion) => {
    setEstado((previo) =>
      previo.sesion ? { ...previo, sesion: { ...previo.sesion, hogar } } : previo,
    );
  }, []);

  const valor = useMemo<ValorAuth>(
    () => ({
      estado,
      usuario: sesion?.usuario ?? null,
      hogar: sesion?.hogar ?? null,
      iniciarSesion,
      registrar,
      cerrarSesion,
      entrarAlHogar,
    }),
    [estado, sesion, iniciarSesion, registrar, cerrarSesion, entrarAlHogar],
  );

  return <ContextoAuth.Provider value={valor}>{children}</ContextoAuth.Provider>;
}
