/**
 * Corrida automática de precios (M08 · CU-09.1, HU-33). Orquesta la corrida sin saber cómo se
 * lee cada sitio ni dónde se guarda: usa adaptadores (`adaptador.ts`) y un repositorio. Respeta
 * RNF-12 y R-03: un sitio solo se consulta si está habilitado, con permiso de extracción tras
 * revisar sus términos (D-07) y robots.txt lo permite, y como máximo 1 solicitud por segundo.
 */
import {
  ErrorExtraccion,
  type AdaptadorSitio,
  type TipoErrorExtraccion,
  type VinculoConsulta,
} from './adaptador.js';
import { reglasDeRespuesta, type RespuestaRobots } from './robots.js';

export type EstadoCorrida = 'EN_CURSO' | 'COMPLETADA' | 'PARCIAL' | 'FALLIDA' | 'OMITIDA';
export type EstadoSitio =
  | 'EN_CURSO'
  | 'COMPLETADA'
  | 'PARCIAL'
  | 'FALLIDA'
  | 'BLOQUEADO'
  | 'NO_HABILITADO'
  | 'DETENIDO';

/** Supermercado con extractor (`soportaExtraccion`) y su configuración de permisos. */
export interface SitioConfigurado {
  id: string;
  codigo: string;
  nombre: string;
  /** Sitio habilitado para corridas (fase del proyecto). */
  habilitado: boolean;
  /** Permiso tras revisar los términos de uso (D-07). */
  extraccionPermitida: boolean;
}

export interface TotalesSitio {
  estado: EstadoSitio;
  totalOk: number;
  totalFallidos: number;
  detenidoPorEstructura: boolean;
}

export interface AvisoCorrida {
  tipo: 'SITIO_BLOQUEADO' | 'CORRIDA_PARCIAL' | 'CORRIDA_FALLIDA';
  titulo: string;
  mensaje: string;
  datos: Record<string, unknown>;
}

/** Acceso a datos de la corrida; la implementación real usa PostgreSQL. */
export interface RepositorioCorridas {
  /**
   * Crea la corrida "En curso", o "Omitida" si ya hay otra en curso (E1). Es atómico: dos
   * disparos simultáneos no pueden quedar los dos en curso.
   */
  iniciarCorrida(
    programadaPara: Date,
    disparo: 'PROGRAMADA' | 'MANUAL',
    ahora: Date,
  ): Promise<{ id: string; omitida: boolean }>;
  sitios(): Promise<SitioConfigurado[]>;
  vinculosActivos(supermercadoId: string): Promise<VinculoConsulta[]>;
  abrirSitio(
    corridaId: string,
    supermercadoId: string,
    estado: EstadoSitio,
    totalVinculos: number,
    ahora: Date,
  ): Promise<string>;
  /** Guarda un precio automático ya normalizado con el factor del vínculo. */
  guardarPrecio(
    corridaId: string,
    vinculo: VinculoConsulta,
    precio: string,
    fecha: string,
  ): Promise<void>;
  registrarError(
    corridaSitioId: string,
    productoSupermercadoId: string | null,
    tipo: TipoErrorExtraccion,
    mensaje: string,
    intentos: number,
  ): Promise<void>;
  cerrarSitio(corridaSitioId: string, totales: TotalesSitio, ahora: Date): Promise<void>;
  cerrarCorrida(
    corridaId: string,
    estado: EstadoCorrida,
    totales: { consultados: number; actualizados: number; fallidos: number },
    ahora: Date,
  ): Promise<void>;
  /** Aviso dentro de la app para los administradores de todos los hogares (CU-09.1 3a, CU-09.3 5). */
  avisar(corridaId: string, aviso: AvisoCorrida): Promise<void>;
}

export interface Limitador {
  esperarTurno(sitio: string): Promise<number>;
}

export interface DependenciasCorrida {
  repo: RepositorioCorridas;
  /** Adaptadores disponibles por código de supermercado; un sitio sin adaptador no se consulta. */
  adaptadores: ReadonlyMap<string, AdaptadorSitio>;
  /** Interruptor de entorno por sitio (capa adicional a la base de datos). */
  sitioEncendido: (codigo: string) => boolean;
  obtenerRobots: (origen: string, agente: string) => Promise<RespuestaRobots>;
  limitador: Limitador;
  reloj: () => Date;
  /** Fecha de calendario local ("aaaa-mm-dd") con que se guardan los precios. */
  fechaLocal: (ahora: Date) => string;
  /** Encola el recálculo de mínimo y mediana (CU-09.2) cuando se guardó algún precio. */
  encolarRecalculo: (corridaId: string) => Promise<void>;
}

export interface ResumenCorrida {
  corridaId: string;
  estado: EstadoCorrida;
  sitios: { codigo: string; estado: EstadoSitio; ok: number; fallidos: number }[];
}

/** Intentos por producto: 1 + 2 reintentos (ADR-007). */
export const INTENTOS_POR_PRODUCTO = 3;
/** Un sitio se corta si falla más de la mitad, una vez consultados al menos estos productos. */
export const MINIMO_PARA_CORTE = 5;

const mensajeDe = (e: unknown): string =>
  (e instanceof Error ? e.message : String(e)).slice(0, 500);

async function consultarSitio(
  deps: DependenciasCorrida,
  corridaId: string,
  sitio: SitioConfigurado,
): Promise<{ resumen: ResumenCorrida['sitios'][number]; consultados: number }> {
  const { repo, adaptadores } = deps;
  const adaptador = adaptadores.get(sitio.codigo);
  const vinculos = await repo.vinculosActivos(sitio.id);
  const cerrado = async (
    estado: EstadoSitio,
    totalOk: number,
    totalFallidos: number,
    detenido = false,
    idSitio?: string,
  ) => {
    const ahora = deps.reloj();
    const id =
      idSitio ?? (await repo.abrirSitio(corridaId, sitio.id, estado, vinculos.length, ahora));
    await repo.cerrarSitio(
      id,
      { estado, totalOk, totalFallidos, detenidoPorEstructura: detenido },
      ahora,
    );
    return {
      resumen: { codigo: sitio.codigo, estado, ok: totalOk, fallidos: totalFallidos },
      consultados: totalOk + totalFallidos,
    };
  };

  // 2a: sitio de una fase posterior, o sin lector todavía → "Sitio no habilitado".
  if (!sitio.habilitado || !adaptador) return cerrado('NO_HABILITADO', 0, 0);

  const bloquear = async (motivo: string, tipo: TipoErrorExtraccion = 'ROBOTS') => {
    const idSitio = await repo.abrirSitio(
      corridaId,
      sitio.id,
      'EN_CURSO',
      vinculos.length,
      deps.reloj(),
    );
    await repo.registrarError(idSitio, null, tipo, motivo, 1);
    await repo.avisar(corridaId, {
      tipo: 'SITIO_BLOQUEADO',
      titulo: `${sitio.nombre} bloqueado`,
      mensaje: `${sitio.nombre} bloqueado: registra precios manualmente`,
      datos: { supermercado: sitio.codigo, motivo },
    });
    return cerrado('BLOQUEADO', 0, 0, false, idSitio);
  };

  // 3a: sin permiso de extracción (términos de uso sin revisar, D-07).
  if (!sitio.extraccionPermitida || !deps.sitioEncendido(sitio.codigo)) {
    return bloquear('Extracción sin permiso: términos de uso sin revisar', 'OTRO');
  }

  // 3: robots.txt de cada sitio al inicio de la corrida.
  const respuesta = await deps.obtenerRobots(adaptador.origen, adaptador.agente);
  const reglas = reglasDeRespuesta(respuesta, adaptador.agente);
  if (!reglas) {
    return bloquear('Bloqueado por robots.txt: no se pudo verificar');
  }
  const permitidos: VinculoConsulta[] = [];
  const prohibidos: VinculoConsulta[] = [];
  for (const v of vinculos) {
    const ruta = adaptador.rutaProducto(v);
    (ruta !== null && reglas.permitido(ruta) ? permitidos : prohibidos).push(v);
  }
  if (vinculos.length > 0 && permitidos.length === 0) {
    return bloquear('Bloqueado por robots.txt');
  }

  const idSitio = await repo.abrirSitio(
    corridaId,
    sitio.id,
    'EN_CURSO',
    vinculos.length,
    deps.reloj(),
  );
  for (const v of prohibidos) {
    await repo.registrarError(idSitio, v.id, 'ROBOTS', 'Ruta no permitida por robots.txt', 1);
  }

  let ok = 0;
  let fallidos = prohibidos.length;
  let detenido = false;
  for (const vinculo of permitidos) {
    let error: ErrorExtraccion | null = null;
    let intentos = 0;
    let precio: string | null = null;
    while (intentos < INTENTOS_POR_PRODUCTO && precio === null) {
      intentos += 1;
      await deps.limitador.esperarTurno(sitio.codigo);
      try {
        precio = await adaptador.consultar(vinculo);
        error = null;
      } catch (e) {
        error = e instanceof ErrorExtraccion ? e : new ErrorExtraccion('OTRO', mensajeDe(e));
      }
    }
    if (precio !== null) {
      await repo.guardarPrecio(corridaId, vinculo, precio, deps.fechaLocal(deps.reloj()));
      ok += 1;
    } else {
      fallidos += 1;
      await repo.registrarError(
        idSitio,
        vinculo.id,
        error?.tipo ?? 'OTRO',
        error?.message ?? 'Falla desconocida',
        intentos,
      );
    }
    const consultados = ok + fallidos - prohibidos.length;
    if (consultados >= MINIMO_PARA_CORTE && (fallidos - prohibidos.length) / consultados > 0.5) {
      detenido = true;
      break;
    }
  }

  const estado: EstadoSitio = detenido
    ? 'DETENIDO'
    : fallidos === 0
      ? 'COMPLETADA'
      : ok === 0
        ? 'FALLIDA'
        : 'PARCIAL';
  // CU-09.3 paso 5: el administrador ve el sitio y cuántos productos quedaron sin actualizar.
  if (estado !== 'COMPLETADA') {
    const sinActualizar = vinculos.length - ok;
    await repo.avisar(corridaId, {
      tipo: ok > 0 ? 'CORRIDA_PARCIAL' : 'CORRIDA_FALLIDA',
      titulo: sitio.nombre,
      mensaje: `${sitio.nombre}: ${sinActualizar} ${sinActualizar === 1 ? 'producto sin actualizar' : 'productos sin actualizar'}`,
      datos: { supermercado: sitio.codigo, sinActualizar, estado },
    });
  }
  return cerrado(estado, ok, fallidos, detenido, idSitio);
}

/**
 * CU-09.1: crea la corrida, consulta cada sitio en paralelo (con su propio límite de 1 solicitud
 * por segundo), la cierra con totales y, si se guardó algún precio, encola el recálculo.
 * Con otra corrida en curso la nueva se registra "Omitida" y no consulta nada (E1).
 */
export async function ejecutarCorrida(
  deps: DependenciasCorrida,
  opciones: { programadaPara?: Date; disparo?: 'PROGRAMADA' | 'MANUAL' } = {},
): Promise<ResumenCorrida> {
  const inicio = deps.reloj();
  const { id: corridaId, omitida } = await deps.repo.iniciarCorrida(
    opciones.programadaPara ?? inicio,
    opciones.disparo ?? 'PROGRAMADA',
    inicio,
  );
  if (omitida) return { corridaId, estado: 'OMITIDA', sitios: [] };

  try {
    const sitios = await deps.repo.sitios();
    const resultados = await Promise.all(sitios.map((s) => consultarSitio(deps, corridaId, s)));
    const resumenes = resultados.map((r) => r.resumen);
    const actualizados = resumenes.reduce((n, s) => n + s.ok, 0);
    const fallidos = resumenes.reduce((n, s) => n + s.fallidos, 0);
    const conProblema = resumenes.some((s) =>
      ['PARCIAL', 'FALLIDA', 'DETENIDO', 'BLOQUEADO'].includes(s.estado),
    );
    const estado: EstadoCorrida = !conProblema
      ? 'COMPLETADA'
      : actualizados > 0
        ? 'PARCIAL'
        : 'FALLIDA';
    await deps.repo.cerrarCorrida(
      corridaId,
      estado,
      { consultados: actualizados + fallidos, actualizados, fallidos },
      deps.reloj(),
    );
    if (actualizados > 0) await deps.encolarRecalculo(corridaId);
    return { corridaId, estado, sitios: resumenes };
  } catch (e) {
    // E2: sin base de datos o falla inesperada → la corrida queda "Fallida", sin dejarla en curso.
    await deps.repo
      .cerrarCorrida(
        corridaId,
        'FALLIDA',
        { consultados: 0, actualizados: 0, fallidos: 0 },
        deps.reloj(),
      )
      .catch(() => undefined);
    throw e;
  }
}
