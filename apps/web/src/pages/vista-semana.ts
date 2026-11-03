export type VistaSemana = 'TABLA' | 'CALENDARIO';

const CLAVE = 'mf.vistaSemana';

/** La última vista elegida en este navegador; la tabla si no hay o el almacenamiento falla. */
export function vistaGuardada(): VistaSemana {
  try {
    return localStorage.getItem(CLAVE) === 'CALENDARIO' ? 'CALENDARIO' : 'TABLA';
  } catch {
    return 'TABLA';
  }
}

export function guardarVista(vista: VistaSemana): void {
  try {
    localStorage.setItem(CLAVE, vista);
  } catch {
    // Solo es una comodidad por navegador: sin almacenamiento se vuelve a la tabla.
  }
}
