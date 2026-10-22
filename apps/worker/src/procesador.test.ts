import { describe, expect, it, vi } from 'vitest';
import { LimitadorPorSitio } from './limitador.js';
import { COLA_PRECIOS, crearProcesadorPrecios } from './procesador.js';
import { leerFlagsSitios } from './sitios.js';

const limitadorInstantaneo = () =>
  new LimitadorPorSitio(1000, { ahora: () => 0, dormir: async () => undefined });

describe('processor de la cola "precios"', () => {
  it('usa el nombre de cola "precios"', () => {
    expect(COLA_PRECIOS).toBe('precios');
  });

  it('con la configuración por defecto omite todos los sitios sin usar el limitador', async () => {
    const limitador = limitadorInstantaneo();
    const espia = vi.spyOn(limitador, 'esperarTurno');
    const procesar = crearProcesadorPrecios({ flags: leerFlagsSitios({}), limitador });
    await expect(
      procesar({
        id: '1',
        name: 'precio',
        data: { sitio: 'WALMART', productoSupermercadoId: 'p1' },
      }),
    ).resolves.toEqual({ estado: 'omitido', motivo: 'sitio WALMART deshabilitado' });
    expect(espia).not.toHaveBeenCalled();
  });

  it('con el sitio habilitado pasa por el limitador', async () => {
    const limitador = limitadorInstantaneo();
    const espia = vi.spyOn(limitador, 'esperarTurno');
    const procesar = crearProcesadorPrecios({
      flags: leerFlagsSitios({ SCRAPER_PAIZ_ENABLED: 'true' }),
      limitador,
    });
    const job = { name: 'precio', data: { sitio: 'PAIZ', productoSupermercadoId: 'p1' } };
    await expect(procesar(job)).resolves.toEqual({
      estado: 'pendiente',
      sitio: 'PAIZ',
      esperaMs: 0,
    });
    await expect(procesar(job)).resolves.toEqual({
      estado: 'pendiente',
      sitio: 'PAIZ',
      esperaMs: 1000,
    });
    expect(espia).toHaveBeenCalledTimes(2);
  });

  it('rechaza jobs con sitio inválido o sin datos', async () => {
    const procesar = crearProcesadorPrecios({
      flags: leerFlagsSitios({}),
      limitador: limitadorInstantaneo(),
    });
    await expect(procesar({ id: '9', name: 'x', data: { sitio: 'OTRO' } })).rejects.toThrow(
      /Job 9: sitio inválido "OTRO"/,
    );
    await expect(procesar({ name: 'x', data: null })).rejects.toThrow(/Job \?/);
  });
});
