import { describe, expect, it, vi } from 'vitest';
import { crearApiVinculos } from './vinculos';

describe('API de vínculos (HU-35)', () => {
  it('cada función llama a su ruta y método', async () => {
    const peticion = vi.fn().mockResolvedValue({});
    const api = crearApiVinculos({ peticion } as never);
    const datos = {
      supermercadoId: 's1',
      nombreTienda: 'Arroz',
      presentacionCantidad: '5',
      presentacionUnidadId: 'u1',
    };
    const llamadas: [Promise<unknown>, string, unknown?][] = [
      [api.supermercados(), '/supermercados'],
      [api.listar('p1'), '/productos/p1/vinculos'],
      [api.crear('p1', datos), '/productos/p1/vinculos', { metodo: 'POST', cuerpo: datos }],
      [
        api.crear('p1', datos, true),
        '/productos/p1/vinculos?reemplazar=true',
        { metodo: 'POST', cuerpo: datos },
      ],
      [
        api.actualizar('v1', { marca: null }),
        '/vinculos/v1',
        { metodo: 'PATCH', cuerpo: { marca: null } },
      ],
    ];
    await Promise.all(llamadas.map(([promesa]) => promesa));
    llamadas.forEach(([, ruta, opciones], i) => {
      expect(peticion.mock.calls[i]).toEqual(opciones ? [ruta, opciones] : [ruta]);
    });
  });
});
