import { describe, expect, it, vi } from 'vitest';
import { consulta, crearApiCatalogo } from './catalogo';

describe('API del catálogo (HU-11..13)', () => {
  it('consulta omite vacíos y codifica', () => {
    expect(consulta({})).toBe('');
    expect(consulta({ q: 'pepián de pollo', tiempo: '', tamano: 100, x: undefined })).toBe(
      '?q=pepi%C3%A1n+de+pollo&tamano=100',
    );
  });

  it('cada función llama a su ruta y método', async () => {
    const peticion = vi.fn().mockResolvedValue({});
    const api = crearApiCatalogo({ peticion } as never);
    const llamadas: [Promise<unknown>, string, unknown?][] = [
      [api.listarUnidades(), '/unidades'],
      [api.listarCategorias(), '/categorias'],
      [api.listarProductos({ q: 'pollo', activo: 'true' }), '/productos?q=pollo&activo=true'],
      [api.listarProductos(), '/productos'],
      [api.crearProducto({} as never), '/productos', { metodo: 'POST', cuerpo: {} }],
      [api.inactivarProducto('p1'), '/productos/p1/inactivar', { metodo: 'POST' }],
      [api.reactivarProducto('p1'), '/productos/p1/reactivar', { metodo: 'POST' }],
      [api.listarPlatillos({ proteina: 'POLLO' }), '/platillos?tamano=100&proteina=POLLO'],
      [api.listarPlatillos(), '/platillos?tamano=100'],
      [api.obtenerPlatillo('a/b'), '/platillos/a%2Fb'],
      [
        api.crearPlatillo({ nombre: 'X' }),
        '/platillos',
        { metodo: 'POST', cuerpo: { nombre: 'X' } },
      ],
      [api.actualizarPlatillo('pl1', {}), '/platillos/pl1', { metodo: 'PATCH', cuerpo: {} }],
      [api.inactivarPlatillo('pl1'), '/platillos/pl1/inactivar', { metodo: 'POST' }],
      [api.reactivarPlatillo('pl1'), '/platillos/pl1/reactivar', { metodo: 'POST' }],
      [
        api.guardarIngredientes('pl1', 4, []),
        '/platillos/pl1/ingredientes',
        { metodo: 'PUT', cuerpo: { porcionesBase: 4, ingredientes: [] } },
      ],
      [api.vistaPrevia('pl1', 2.5), '/platillos/pl1/vista-previa?sumaFactores=2.5'],
      [api.vistaPrevia('pl1'), '/platillos/pl1/vista-previa'],
    ];
    await Promise.all(llamadas.map(([p]) => p));
    llamadas.forEach(([, ruta, opciones], i) => {
      const args = peticion.mock.calls[i] as unknown[];
      expect(args[0]).toBe(ruta);
      if (opciones) expect(args[1]).toEqual(opciones);
    });
  });
});
