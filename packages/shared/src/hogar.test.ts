import { describe, expect, it } from 'vitest';
import { EstadoInvitacion, enmascararCorreo, estadoInvitacion } from './hogar';

describe('estadoInvitacion (CU-01.2)', () => {
  const ahora = new Date('2026-10-22T12:00:00.000Z');
  const manana = new Date('2026-10-23T12:00:00.000Z');
  const ayer = new Date('2026-10-21T12:00:00.000Z');

  it('vigente si no vence, no se usó ni se revocó', () => {
    expect(estadoInvitacion({ venceEn: manana, usadaEn: null, revocadaEn: null }, ahora)).toBe(
      EstadoInvitacion.VIGENTE,
    );
  });

  it('CA-02.3 vencida si su vencimiento ya pasó (acepta fechas en texto)', () => {
    expect(
      estadoInvitacion({ venceEn: ayer.toISOString(), usadaEn: null, revocadaEn: null }, ahora),
    ).toBe(EstadoInvitacion.VENCIDA);
    expect(estadoInvitacion({ venceEn: ahora, usadaEn: null, revocadaEn: null }, ahora)).toBe(
      EstadoInvitacion.VENCIDA,
    );
  });

  it('CA-02.2 usada prevalece sobre revocada y vencida', () => {
    expect(estadoInvitacion({ venceEn: ayer, usadaEn: ayer, revocadaEn: ayer }, ahora)).toBe(
      EstadoInvitacion.USADA,
    );
    expect(estadoInvitacion({ venceEn: ayer, usadaEn: null, revocadaEn: ayer }, ahora)).toBe(
      EstadoInvitacion.REVOCADA,
    );
  });

  it('usa la hora actual por defecto', () => {
    expect(
      estadoInvitacion({ venceEn: new Date(Date.now() + 60_000), usadaEn: null, revocadaEn: null }),
    ).toBe(EstadoInvitacion.VIGENTE);
  });
});

describe('enmascararCorreo', () => {
  it('deja la primera letra y el dominio', () => {
    expect(enmascararCorreo('ana@correo.com')).toBe('a**@correo.com');
    expect(enmascararCorreo('rosalesrene@correo.com')).toBe('r**********@correo.com');
    expect(enmascararCorreo('a@correo.com')).toBe('a**@correo.com');
  });

  it('devuelve el texto sin cambios si no es un correo', () => {
    expect(enmascararCorreo('sin-arroba')).toBe('sin-arroba');
  });
});
