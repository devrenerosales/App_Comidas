import { simularAlmacenamiento } from '../test/almacenamiento';
import { aplicarTema, elegirTema, leerTema } from './tema';

describe('tema', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-tema');
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sin nada guardado es automático', () => {
    simularAlmacenamiento();
    expect(leerTema()).toBe('auto');
  });

  it('elegir oscuro lo guarda y lo aplica al documento', () => {
    const { datos } = simularAlmacenamiento();
    elegirTema('oscuro');
    expect(datos.get('menu-familiar:tema')).toBe('oscuro');
    expect(leerTema()).toBe('oscuro');
    expect(document.documentElement.getAttribute('data-tema')).toBe('oscuro');
  });

  it('volver a automático quita el atributo y lo guardado', () => {
    const { datos } = simularAlmacenamiento();
    elegirTema('claro');
    elegirTema('auto');
    expect(datos.has('menu-familiar:tema')).toBe(false);
    expect(leerTema()).toBe('auto');
    expect(document.documentElement.hasAttribute('data-tema')).toBe(false);
  });

  it('ignora un valor guardado que no es un tema', () => {
    simularAlmacenamiento({ 'menu-familiar:tema': 'rosa' });
    expect(leerTema()).toBe('auto');
  });

  it('si el almacenamiento falla, igual aplica el tema', () => {
    const { almacen } = simularAlmacenamiento();
    almacen.setItem.mockImplementation(() => {
      throw new Error('bloqueado');
    });
    expect(() => elegirTema('claro')).not.toThrow();
    expect(document.documentElement.getAttribute('data-tema')).toBe('claro');
  });

  it('si no se puede ni leer, vuelve a automático', () => {
    const { almacen } = simularAlmacenamiento();
    almacen.getItem.mockImplementation(() => {
      throw new Error('bloqueado');
    });
    expect(leerTema()).toBe('auto');
  });

  it('aplicarTema acepta otro documento', () => {
    const otro = document.implementation.createHTMLDocument('x');
    aplicarTema('oscuro', otro);
    expect(otro.documentElement.getAttribute('data-tema')).toBe('oscuro');
  });
});
