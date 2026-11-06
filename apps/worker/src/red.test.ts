import { describe, expect, it, vi } from 'vitest';
import { crearAdaptadores } from './adaptadores.js';
import { ID_PROGRAMADOR_CORRIDA, PROGRAMACION_CORRIDA, programarCorrida } from './programador.js';
import { descargarRobots, fechaLocal } from './red.js';

const respuesta = (estado: number, cuerpo = '') => new Response(cuerpo, { status: estado });

describe('descargarRobots', () => {
  it('2xx devuelve el texto y pide /robots.txt con el agente', async () => {
    const http = vi.fn().mockResolvedValue(respuesta(200, 'User-agent: *\nDisallow: /x\n'));
    const r = await descargarRobots('https://sitio.test/tienda', 'MenuFamiliarBot/1.0', http);
    expect(r).toEqual({ estado: 'OK', texto: 'User-agent: *\nDisallow: /x\n' });
    const [url, init] = http.mock.calls[0]!;
    expect(url).toBe('https://sitio.test/robots.txt');
    expect(init.headers['User-Agent']).toBe('MenuFamiliarBot/1.0');
  });

  it('4xx significa que el sitio no publica reglas', async () => {
    const http = vi.fn().mockResolvedValue(respuesta(404));
    expect(await descargarRobots('https://sitio.test', 'Bot', http)).toEqual({
      estado: 'NO_EXISTE',
    });
  });

  it('5xx no permite saber qué se permite', async () => {
    const http = vi.fn().mockResolvedValue(respuesta(503));
    expect(await descargarRobots('https://sitio.test', 'Bot', http)).toEqual({
      estado: 'ERROR',
      motivo: 'HTTP 503',
    });
  });

  it('un fallo de red o un tiempo agotado también es ERROR', async () => {
    const http = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    expect(await descargarRobots('https://sitio.test', 'Bot', http)).toEqual({
      estado: 'ERROR',
      motivo: 'ECONNREFUSED',
    });
    const raro = vi.fn().mockRejectedValue('boom');
    expect(await descargarRobots('https://sitio.test', 'Bot', raro)).toMatchObject({
      estado: 'ERROR',
      motivo: 'boom',
    });
  });
});

describe('fechaLocal', () => {
  it('usa la fecha de Guatemala (UTC−6), no la de UTC', () => {
    // Sábado 24/10/2026 21:00 en Guatemala ya es domingo 25 en UTC.
    expect(fechaLocal(new Date('2026-10-25T03:00:00Z'))).toBe('2026-10-24');
    expect(fechaLocal(new Date('2026-10-25T06:00:00Z'))).toBe('2026-10-25');
  });
});

describe('programarCorrida', () => {
  it('registra sábado y domingo 21:00 en la zona de Guatemala, de forma idempotente', async () => {
    const cola = { upsertJobScheduler: vi.fn().mockResolvedValue(undefined) };
    await programarCorrida(cola);
    expect(PROGRAMACION_CORRIDA).toBe('0 21 * * 6,0');
    expect(cola.upsertJobScheduler).toHaveBeenCalledWith(
      ID_PROGRAMADOR_CORRIDA,
      { pattern: '0 21 * * 6,0', tz: 'America/Guatemala' },
      { name: 'corrida' },
    );
  });
});

describe('crearAdaptadores', () => {
  it('no hay lectores de sitios reales hasta revisar sus términos de uso (D-07)', () => {
    expect(crearAdaptadores().size).toBe(0);
  });
});
