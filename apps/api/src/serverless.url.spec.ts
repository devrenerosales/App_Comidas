import { limpiarUrl } from './serverless.url';

describe('limpiarUrl', () => {
  it.each([
    ['/api/v1/productos', '/api/v1/productos'],
    ['/api/v1/productos?path=productos', '/api/v1/productos'],
    ['/api/v1/productos?path=productos&q=arroz', '/api/v1/productos?q=arroz'],
    ['/api/v1/productos?q=arroz&path=productos&pagina=2', '/api/v1/productos?q=arroz&pagina=2'],
    ['/api/v1/productos?q=pollo%20entero', '/api/v1/productos?q=pollo+entero'],
    ['/api/v1/listas/abc/items?path=listas%2Fabc%2Fitems', '/api/v1/listas/abc/items'],
    ['/api/v1/productos?', '/api/v1/productos'],
  ])('%s → %s', (entrada, esperado) => {
    expect(limpiarUrl(entrada)).toBe(esperado);
  });
});
