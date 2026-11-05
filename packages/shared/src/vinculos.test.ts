import { describe, expect, it } from 'vitest';
import type { UnidadMedida } from './catalogo';
import {
  factorVinculo,
  mensajeUnidadNoConvertible,
  pluralUnidad,
  precioDeVinculo,
  urlEnDominio,
} from './vinculos';

const LB: UnidadMedida = { codigo: 'lb', magnitud: 'MASA', factorBase: '453.592370' };
const KG: UnidadMedida = { codigo: 'kg', magnitud: 'MASA', factorBase: '1000' };
const OZ: UnidadMedida = { codigo: 'oz', magnitud: 'MASA', factorBase: '28.349523' };
const LITRO: UnidadMedida = { codigo: 'l', magnitud: 'VOLUMEN', factorBase: '1000' };
const MANOJO: UnidadMedida = { codigo: 'manojo', magnitud: 'CONTEO', factorBase: null };

describe('factorVinculo (CA-35.1 y CA-35.2)', () => {
  it('CA-35.1 la misma presentación da factor 1', () => {
    expect(factorVinculo({ cantidad: '2', unidad: LB }, { cantidad: '2', unidad: LB })).toBe(1);
  });

  it('CA-35.2 una bolsa de 5 lb contra una de 2 lb da 2.5', () => {
    expect(factorVinculo({ cantidad: 5, unidad: LB }, { cantidad: '2.000', unidad: LB })).toBe(2.5);
  });

  it('convierte entre unidades de la misma magnitud', () => {
    expect(factorVinculo({ cantidad: 1, unidad: KG }, { cantidad: 1, unidad: LB })).toBe(2.204623);
    expect(factorVinculo({ cantidad: 16, unidad: OZ }, { cantidad: 1, unidad: LB })).toBe(1);
  });

  it('CA-35.4 una unidad de otra magnitud no es convertible', () => {
    expect(factorVinculo({ cantidad: 1, unidad: LITRO }, { cantidad: 1, unidad: LB })).toBeNull();
  });

  it('una unidad sin factor solo vale contra sí misma', () => {
    expect(factorVinculo({ cantidad: 2, unidad: MANOJO }, { cantidad: 1, unidad: MANOJO })).toBe(2);
    expect(factorVinculo({ cantidad: 1, unidad: MANOJO }, { cantidad: 1, unidad: LB })).toBeNull();
  });

  it('cantidades que no son mayores que 0 no dan factor', () => {
    expect(factorVinculo({ cantidad: 0, unidad: LB }, { cantidad: 2, unidad: LB })).toBeNull();
    expect(factorVinculo({ cantidad: 2, unidad: LB }, { cantidad: 0, unidad: LB })).toBeNull();
    expect(factorVinculo({ cantidad: 'x', unidad: LB }, { cantidad: 2, unidad: LB })).toBeNull();
  });
});

describe('mensajeUnidadNoConvertible (CA-35.4)', () => {
  it('pone la unidad del catálogo en plural', () => {
    expect(mensajeUnidadNoConvertible('libra')).toBe(
      'La unidad de la presentación no es convertible a libras',
    );
  });

  it('pluralUnidad usa -es cuando termina en consonante', () => {
    expect(pluralUnidad('unidad')).toBe('unidades');
    expect(pluralUnidad('litro')).toBe('litros');
  });
});

describe('urlEnDominio (E2)', () => {
  it('acepta el dominio, su www y los subdominios', () => {
    expect(urlEnDominio('https://www.walmart.com.gt/producto/1', 'walmart.com.gt')).toBe(true);
    expect(urlEnDominio('https://walmart.com.gt/producto/1', 'www.walmart.com.gt')).toBe(true);
    expect(urlEnDominio('http://tienda.Walmart.com.gt/x', 'walmart.com.gt')).toBe(true);
  });

  it('rechaza otro dominio, uno que solo termina parecido, o algo que no es http(s)', () => {
    expect(urlEnDominio('https://paiz.com.gt/producto', 'walmart.com.gt')).toBe(false);
    expect(urlEnDominio('https://malwalmart.com.gt/x', 'walmart.com.gt')).toBe(false);
    expect(urlEnDominio('https://walmart.com.gt.malo.com/x', 'walmart.com.gt')).toBe(false);
    expect(urlEnDominio('ftp://walmart.com.gt/x', 'walmart.com.gt')).toBe(false);
    expect(urlEnDominio('https://walmart.com.gt@malo.com/x', 'walmart.com.gt')).toBe(false);
    expect(urlEnDominio('https://walmart.com.gt:8443/x?q=1', 'walmart.com.gt')).toBe(true);
  });

  it('rechaza un texto que no es una URL', () => {
    expect(urlEnDominio('walmart.com.gt/producto', 'walmart.com.gt')).toBe(false);
    expect(urlEnDominio('', 'walmart.com.gt')).toBe(false);
  });
});

describe('precioDeVinculo (CA-35.2)', () => {
  it('Q31.25 por la bolsa de 5 lb se normaliza a Q12.50', () => {
    expect(precioDeVinculo('31.25', 2.5)).toBe(12.5);
  });

  it('redondea a centavos', () => {
    expect(precioDeVinculo(10, 3)).toBe(3.33);
  });
});
