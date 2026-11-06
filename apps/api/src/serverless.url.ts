/**
 * Vercel agrega a la dirección los parámetros con nombre de la reescritura de `vercel.json`
 * (`/api/v1/:path*` → `?path=…`). La API valida sus consultas con `forbidNonWhitelisted`, así que
 * ese `path` extra haría fallar toda lista con "Este campo no está permitido".
 */
const PARAMETROS_DE_REESCRITURA = ['path'];

/** Quita de la dirección los parámetros que agrega la reescritura y conserva los demás. */
export function limpiarUrl(url: string): string {
  const corte = url.indexOf('?');
  if (corte === -1) return url;
  const ruta = url.slice(0, corte);
  const parametros = new URLSearchParams(url.slice(corte + 1));
  for (const nombre of PARAMETROS_DE_REESCRITURA) parametros.delete(nombre);
  const resto = parametros.toString();
  return resto ? `${ruta}?${resto}` : ruta;
}
