/**
 * Lector de robots.txt (RNF-12, R-03): decide si una ruta se puede consultar. Implementa lo
 * esencial del estándar: grupos por `User-agent` (gana el grupo más específico para nuestro
 * agente, o `*`), reglas `Allow` y `Disallow` por prefijo con comodines `*` y `$`, y gana la regla
 * más larga; a igual longitud gana `Allow`.
 */

export interface ReglasRobots {
  /** `true` si la ruta ("/producto/123?x=1") se puede consultar. */
  permitido(ruta: string): boolean;
}

interface Regla {
  permite: boolean;
  patron: RegExp;
  longitud: number;
}

interface Grupo {
  agentes: string[];
  reglas: Regla[];
}

/** Convierte un patrón de robots.txt ("/a*b$") en una expresión regular anclada al inicio. */
function aRegExp(patron: string): RegExp {
  const termina = patron.endsWith('$');
  const cuerpo = (termina ? patron.slice(0, -1) : patron)
    .split('*')
    .map((parte) => parte.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${cuerpo}${termina ? '$' : ''}`);
}

function agrupar(texto: string): Grupo[] {
  const grupos: Grupo[] = [];
  let actual: Grupo | null = null;
  let leyendoAgentes = false;
  for (const bruta of texto.split(/\r?\n/)) {
    const linea = bruta.replace(/#.*$/, '').trim();
    const separador = linea.indexOf(':');
    if (separador < 0) continue;
    const campo = linea.slice(0, separador).trim().toLowerCase();
    const valor = linea.slice(separador + 1).trim();
    if (campo === 'user-agent') {
      if (!actual || !leyendoAgentes) {
        actual = { agentes: [], reglas: [] };
        grupos.push(actual);
      }
      actual.agentes.push(valor.toLowerCase());
      leyendoAgentes = true;
    } else if (campo === 'allow' || campo === 'disallow') {
      leyendoAgentes = false;
      // Un Disallow vacío no prohíbe nada.
      if (actual && valor !== '') {
        actual.reglas.push({
          permite: campo === 'allow',
          patron: aRegExp(valor),
          longitud: valor.length,
        });
      }
    } else {
      leyendoAgentes = false;
    }
  }
  return grupos;
}

/**
 * Reglas aplicables a `agente` (nuestro User-Agent): el grupo cuyo nombre aparece en él, el
 * más largo si hay varios, o el grupo `*`. Sin grupo aplicable todo está permitido.
 */
export function analizarRobots(texto: string, agente: string): ReglasRobots {
  const grupos = agrupar(texto);
  const nuestro = agente.toLowerCase();
  let elegido: Grupo | undefined;
  let mejor = 0;
  for (const g of grupos) {
    for (const a of g.agentes) {
      if (a !== '*' && nuestro.includes(a) && a.length > mejor) {
        elegido = g;
        mejor = a.length;
      }
    }
  }
  elegido ??= grupos.find((g) => g.agentes.includes('*'));
  const reglas = elegido?.reglas ?? [];
  return {
    permitido(ruta) {
      let ganadora: Regla | undefined;
      for (const r of reglas) {
        if (!r.patron.test(ruta)) continue;
        if (
          !ganadora ||
          r.longitud > ganadora.longitud ||
          (r.longitud === ganadora.longitud && r.permite)
        ) {
          ganadora = r;
        }
      }
      return ganadora ? ganadora.permite : true;
    },
  };
}

/** Resultado de descargar el robots.txt de un sitio. */
export type RespuestaRobots =
  | { estado: 'OK'; texto: string }
  /** 4xx: el sitio no publica reglas, así que no hay restricción. */
  | { estado: 'NO_EXISTE' }
  /** 5xx o sin red: no se puede saber qué se permite, así que no se consulta. */
  | { estado: 'ERROR'; motivo: string };

/** Reglas a aplicar según la respuesta; `null` si no se puede verificar (se bloquea). */
export function reglasDeRespuesta(r: RespuestaRobots, agente: string): ReglasRobots | null {
  if (r.estado === 'OK') return analizarRobots(r.texto, agente);
  if (r.estado === 'NO_EXISTE') return { permitido: () => true };
  return null;
}
