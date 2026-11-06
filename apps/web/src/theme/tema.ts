/** Apariencia de la app: automática (según el sistema), clara u oscura. Se recuerda en el navegador. */
export type Tema = 'auto' | 'claro' | 'oscuro';

export const TEMAS: readonly Tema[] = ['auto', 'claro', 'oscuro'];

const CLAVE = 'menu-familiar:tema';

const esTema = (valor: unknown): valor is Tema => TEMAS.includes(valor as Tema);

/** El tema guardado, o "auto" si no hay uno válido o el almacenamiento no está disponible. */
export function leerTema(): Tema {
  try {
    const guardado = localStorage.getItem(CLAVE);
    return esTema(guardado) ? guardado : 'auto';
  } catch {
    return 'auto';
  }
}

/** Aplica el tema al documento: "auto" quita el atributo y deja decidir al sistema. */
export function aplicarTema(tema: Tema, documento: Document = document): void {
  if (tema === 'auto') documento.documentElement.removeAttribute('data-tema');
  else documento.documentElement.setAttribute('data-tema', tema);
}

/** Guarda y aplica el tema; si el navegador no deja guardar, igual se aplica en esta sesión. */
export function elegirTema(tema: Tema): void {
  try {
    if (tema === 'auto') localStorage.removeItem(CLAVE);
    else localStorage.setItem(CLAVE, tema);
  } catch {
    /* sin almacenamiento (modo privado): vale solo para esta sesión */
  }
  aplicarTema(tema);
}
