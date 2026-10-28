import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Carga variables de `.env` (directorio actual y raíz del monorepo) sin sobrescribir las
 * que ya existen en el entorno. Solo para los comandos `db:*` en desarrollo; en contenedores
 * las variables llegan por el entorno.
 */
export function cargarEntorno(
  directorios: string[] = [process.cwd(), resolve(process.cwd(), '../..')],
): void {
  for (const dir of directorios) {
    const archivo = resolve(dir, '.env');
    if (!existsSync(archivo)) continue;
    for (const linea of readFileSync(archivo, 'utf8').split(/\r?\n/)) {
      const coincidencia = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(linea);
      if (!coincidencia) continue;
      const [, clave, crudo] = coincidencia as unknown as [string, string, string];
      if (process.env[clave] !== undefined) continue;
      process.env[clave] = crudo.replace(/^(['"])(.*)\1$/, '$2');
    }
  }
}

/** Devuelve la variable requerida o falla con un mensaje claro. */
export function variableRequerida(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) {
    throw new Error(`Falta la variable de entorno ${nombre} (ver .env.example).`);
  }
  return valor;
}
