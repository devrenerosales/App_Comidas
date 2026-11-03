import { describe, expect, it } from 'vitest';
import {
  CANTIDAD_MAXIMA_ITEM,
  cantidadValida,
  resolverCambio,
  type CambioLista,
  type EstadoItemSync,
  type OperacionLista,
} from './lista-sync';

const T = (hora: string) => `2026-11-03T${hora}:00.000Z`;
const ms = (hora: string) => Date.parse(T(hora));

const cambio = (
  operacion: OperacionLista,
  hora: string,
  datos: CambioLista['datos'] = null,
): CambioLista => ({ id: 'c1', itemId: 'i1', operacion, datos, marcaTiempo: T(hora) });

const item = (extra: Partial<EstadoItemSync> = {}): EstadoItemSync => ({
  estado: 'PENDIENTE',
  cantidadComprar: 7,
  eliminado: false,
  modificadoEn: ms('09:00'),
  ...extra,
});

describe('cantidadValida', () => {
  it('acepta números mayores que 0 y los redondea a 3 decimales', () => {
    expect(cantidadValida(30)).toBe(30);
    expect(cantidadValida('2.5')).toBe(2.5);
    expect(cantidadValida(1.23456)).toBe(1.235);
    expect(cantidadValida(CANTIDAD_MAXIMA_ITEM)).toBe(CANTIDAD_MAXIMA_ITEM);
  });

  it('rechaza vacío, 0, negativos, texto y lo que no cabe en la columna', () => {
    for (const malo of [
      null,
      undefined,
      '',
      0,
      -1,
      '0',
      'abc',
      NaN,
      0.0001,
      CANTIDAD_MAXIMA_ITEM + 1,
    ]) {
      expect(cantidadValida(malo as never)).toBeNull();
    }
  });
});

describe('resolverCambio (CU-07.3, HU-30)', () => {
  describe('AGREGAR un ítem nuevo', () => {
    it('con producto del catálogo queda pendiente y vigente', () => {
      expect(
        resolverCambio(
          undefined,
          cambio('AGREGAR', '10:00', { productoId: 'p1', cantidadComprar: 30 }),
        ),
      ).toEqual({
        resultado: 'APLICADO',
        parche: {
          productoId: 'p1',
          estado: 'PENDIENTE',
          cantidadComprar: 30,
          eliminado: false,
          compradoEn: null,
          modificadoEn: ms('10:00'),
        },
      });
    });

    it('CA-30.2 con texto libre ("Tortillas", 30) recorta los espacios', () => {
      expect(
        resolverCambio(
          undefined,
          cambio('AGREGAR', '10:00', { textoLibre: '  Tortillas ', cantidadComprar: '30' }),
        ),
      ).toMatchObject({
        resultado: 'APLICADO',
        parche: { textoLibre: 'Tortillas', cantidadComprar: 30 },
      });
    });

    it('CA-30.4 con cantidad 0 se rechaza con CANTIDAD_INVALIDA', () => {
      expect(
        resolverCambio(
          undefined,
          cambio('AGREGAR', '10:00', { textoLibre: 'Cebolla', cantidadComprar: 0 }),
        ),
      ).toEqual({ resultado: 'RECHAZADO', motivo: 'CANTIDAD_INVALIDA' });
    });

    it('sin producto, con ambos o con un texto demasiado largo se rechaza', () => {
      for (const datos of [
        null,
        { cantidadComprar: 1 },
        { textoLibre: '   ', cantidadComprar: 1 },
        { productoId: 'p1', textoLibre: 'Velas', cantidadComprar: 1 },
        { textoLibre: 'x'.repeat(81), cantidadComprar: 1 },
      ]) {
        expect(resolverCambio(undefined, cambio('AGREGAR', '10:00', datos))).toEqual({
          resultado: 'RECHAZADO',
          motivo: 'PRODUCTO_INVALIDO',
        });
      }
    });
  });

  it('cualquier otra operación sobre un ítem que no existe se rechaza', () => {
    expect(resolverCambio(undefined, cambio('MARCAR_COMPRADO', '10:00'))).toEqual({
      resultado: 'RECHAZADO',
      motivo: 'ITEM_NO_ENCONTRADO',
    });
  });

  it('una marca de tiempo inválida se rechaza', () => {
    expect(
      resolverCambio(item(), { ...cambio('MARCAR_COMPRADO', '10:00'), marcaTiempo: 'ayer' }),
    ).toEqual({ resultado: 'RECHAZADO', motivo: 'MARCA_TIEMPO_INVALIDA' });
  });

  describe('marcar y desmarcar', () => {
    it('CA-30.1 marcar comprado guarda la hora del dispositivo', () => {
      expect(resolverCambio(item(), cambio('MARCAR_COMPRADO', '10:00'))).toEqual({
        resultado: 'APLICADO',
        parche: {
          estado: 'COMPRADO',
          eliminado: false,
          compradoEn: ms('10:00'),
          modificadoEn: ms('10:00'),
        },
      });
    });

    it('"Ya lo tengo" cuenta como cubierto con su hora', () => {
      expect(resolverCambio(item(), cambio('MARCAR_YA_LO_TENGO', '10:00'))).toMatchObject({
        resultado: 'APLICADO',
        parche: { estado: 'YA_LO_TENGO', compradoEn: ms('10:00') },
      });
    });

    it('desmarcar lo devuelve a pendiente sin hora de compra', () => {
      expect(
        resolverCambio(item({ estado: 'COMPRADO' }), cambio('DESMARCAR_COMPRADO', '10:00')),
      ).toEqual({
        resultado: 'APLICADO',
        parche: { estado: 'PENDIENTE', compradoEn: null, modificadoEn: ms('10:00') },
      });
    });

    it('desmarcar un ítem eliminado no hace nada', () => {
      expect(
        resolverCambio(item({ eliminado: true }), cambio('DESMARCAR_COMPRADO', '10:00')),
      ).toEqual({ resultado: 'OBSOLETO', motivo: 'ITEM_ELIMINADO' });
    });
  });

  describe('conflictos: gana la marca de tiempo más reciente', () => {
    it('un cambio anterior al último aplicado es obsoleto', () => {
      expect(
        resolverCambio(item({ modificadoEn: ms('10:00') }), cambio('MARCAR_COMPRADO', '09:59')),
      ).toEqual({ resultado: 'OBSOLETO', motivo: 'CAMBIO_ANTIGUO' });
    });

    it('un empate lo gana el cambio que llega después', () => {
      expect(
        resolverCambio(item({ modificadoEn: ms('10:00') }), cambio('MARCAR_COMPRADO', '10:00')),
      ).toMatchObject({ resultado: 'APLICADO' });
    });

    it('CA-30.3 quitado a las 10:00 y comprado a las 10:05: vuelve a la lista como comprado', () => {
      const quitado = item({ eliminado: true, modificadoEn: ms('10:00') });
      expect(resolverCambio(quitado, cambio('MARCAR_COMPRADO', '10:05'))).toEqual({
        resultado: 'APLICADO',
        parche: {
          estado: 'COMPRADO',
          eliminado: false,
          compradoEn: ms('10:05'),
          modificadoEn: ms('10:05'),
        },
      });
    });

    it('comprado antes de que lo quitaran (09:55) no lo restaura', () => {
      const quitado = item({ eliminado: true, modificadoEn: ms('10:00') });
      expect(resolverCambio(quitado, cambio('MARCAR_COMPRADO', '09:55'))).toEqual({
        resultado: 'OBSOLETO',
        motivo: 'CAMBIO_ANTIGUO',
      });
    });
  });

  describe('quitar y volver a agregar', () => {
    it('ELIMINAR marca el ítem como eliminado', () => {
      expect(resolverCambio(item(), cambio('ELIMINAR', '10:00'))).toEqual({
        resultado: 'APLICADO',
        parche: { eliminado: true, modificadoEn: ms('10:00') },
      });
    });

    it('quitar un ítem ya eliminado es obsoleto', () => {
      expect(resolverCambio(item({ eliminado: true }), cambio('ELIMINAR', '10:00'))).toEqual({
        resultado: 'OBSOLETO',
        motivo: 'YA_ELIMINADO',
      });
    });

    it('agregar otra vez un producto vigente es obsoleto', () => {
      expect(
        resolverCambio(
          item(),
          cambio('AGREGAR', '10:00', { productoId: 'p1', cantidadComprar: 2 }),
        ),
      ).toEqual({ resultado: 'OBSOLETO', motivo: 'YA_EXISTE' });
    });

    it('agregar un producto que se había quitado lo restaura como pendiente con la cantidad nueva', () => {
      expect(
        resolverCambio(
          item({ eliminado: true, estado: 'COMPRADO' }),
          cambio('AGREGAR', '10:00', { productoId: 'p1', cantidadComprar: 2 }),
        ),
      ).toEqual({
        resultado: 'APLICADO',
        parche: {
          estado: 'PENDIENTE',
          cantidadComprar: 2,
          eliminado: false,
          compradoEn: null,
          modificadoEn: ms('10:00'),
        },
      });
    });

    it('restaurar con cantidad inválida se rechaza', () => {
      expect(
        resolverCambio(
          item({ eliminado: true }),
          cambio('AGREGAR', '10:00', { productoId: 'p1', cantidadComprar: 0 }),
        ),
      ).toEqual({ resultado: 'RECHAZADO', motivo: 'CANTIDAD_INVALIDA' });
    });
  });

  describe('ACTUALIZAR la cantidad', () => {
    it('cambia la cantidad', () => {
      expect(resolverCambio(item(), cambio('ACTUALIZAR', '10:00', { cantidadComprar: 8 }))).toEqual(
        {
          resultado: 'APLICADO',
          parche: { cantidadComprar: 8, modificadoEn: ms('10:00') },
        },
      );
    });

    it('con cantidad inválida se rechaza', () => {
      expect(
        resolverCambio(item(), cambio('ACTUALIZAR', '10:00', { cantidadComprar: -1 })),
      ).toEqual({ resultado: 'RECHAZADO', motivo: 'CANTIDAD_INVALIDA' });
    });

    it('sobre un ítem eliminado no hace nada', () => {
      expect(
        resolverCambio(
          item({ eliminado: true }),
          cambio('ACTUALIZAR', '10:00', { cantidadComprar: 8 }),
        ),
      ).toEqual({ resultado: 'OBSOLETO', motivo: 'ITEM_ELIMINADO' });
    });
  });

  it('el precio real todavía no se admite (HU-44)', () => {
    expect(resolverCambio(item(), cambio('REGISTRAR_PRECIO', '10:00'))).toEqual({
      resultado: 'RECHAZADO',
      motivo: 'OPERACION_NO_SOPORTADA',
    });
  });
});
