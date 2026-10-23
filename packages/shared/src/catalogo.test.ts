import { describe, expect, it } from 'vitest';
import {
  MENSAJES_CATALOGO,
  MagnitudUnidad,
  NOMBRES_PROTEINA,
  ProteinaPrincipal,
  TipoProducto,
  convertirCantidad,
  escalarCantidad,
  etiquetaProducto,
  formatearCantidad,
  limpiarTexto,
  normalizarNombreCatalogo,
  redondear,
  separarEtiquetas,
  tipoCoincide,
  unidadCompatible,
  type UnidadMedida,
} from './catalogo';

const LB: UnidadMedida = { codigo: 'lb', magnitud: MagnitudUnidad.MASA, factorBase: '453.592370' };
const G: UnidadMedida = { codigo: 'g', magnitud: MagnitudUnidad.MASA, factorBase: '1' };
const KG: UnidadMedida = { codigo: 'kg', magnitud: MagnitudUnidad.MASA, factorBase: 1000 };
const ML: UnidadMedida = { codigo: 'ml', magnitud: MagnitudUnidad.VOLUMEN, factorBase: '1' };
const TAZA: UnidadMedida = { codigo: 'taza', magnitud: MagnitudUnidad.VOLUMEN, factorBase: '240' };
const DIENTE: UnidadMedida = {
  codigo: 'diente',
  magnitud: MagnitudUnidad.CONTEO,
  factorBase: null,
};
const UNIDAD: UnidadMedida = { codigo: 'unidad', magnitud: MagnitudUnidad.CONTEO, factorBase: '1' };

describe('normalizarNombreCatalogo (CU-03.1)', () => {
  it('CA-11.3 "carne GUISADA" y "Carne guisada" normalizan igual', () => {
    expect(normalizarNombreCatalogo('carne GUISADA')).toBe('carne guisada');
    expect(normalizarNombreCatalogo('Carne guisada')).toBe('carne guisada');
  });

  it('quita tildes, diéresis y espacios de más', () => {
    expect(normalizarNombreCatalogo('  Pepián   de POLLO ')).toBe('pepian de pollo');
    expect(normalizarNombreCatalogo('Güisquil')).toBe('guisquil');
    expect(normalizarNombreCatalogo('Piña')).toBe('pina');
  });

  it('limpiarTexto conserva mayúsculas y tildes', () => {
    expect(limpiarTexto('  Pepián   de pollo ')).toBe('Pepián de pollo');
  });
});

describe('separarEtiquetas (CU-03.1)', () => {
  it('CA-11.1 separa "típico, fin de semana" por comas', () => {
    expect(separarEtiquetas('típico, fin de semana')).toEqual(['típico', 'fin de semana']);
  });

  it('descarta vacías y repetidas sin distinguir tildes', () => {
    expect(separarEtiquetas(['Típico', ' tipico ', '', '  ', 'Rápido'])).toEqual([
      'Típico',
      'Rápido',
    ]);
  });
});

describe('tipoCoincide (CU-03.3)', () => {
  it('CA-13.1 DESPENSA y AMBOS aparecen al filtrar por despensa', () => {
    expect(tipoCoincide(TipoProducto.DESPENSA, TipoProducto.DESPENSA)).toBe(true);
    expect(tipoCoincide(TipoProducto.AMBOS, TipoProducto.DESPENSA)).toBe(true);
    expect(tipoCoincide(TipoProducto.INGREDIENTE, TipoProducto.DESPENSA)).toBe(false);
    expect(tipoCoincide(TipoProducto.INGREDIENTE, TipoProducto.AMBOS)).toBe(true);
  });
});

describe('unidadCompatible (CU-03.2 E2)', () => {
  it('CA-12.3 ml no es compatible con un producto en lb', () => {
    expect(unidadCompatible(ML, LB)).toBe(false);
    expect(MENSAJES_CATALOGO.unidadIncompatible('ml', 'lb')).toBe(
      'La unidad ml no es compatible con lb',
    );
  });

  it('misma magnitud es compatible aunque no sea convertible', () => {
    expect(unidadCompatible(G, LB)).toBe(true);
    expect(unidadCompatible(DIENTE, UNIDAD)).toBe(true);
  });

  it('una equivalencia del producto permite otra magnitud', () => {
    expect(unidadCompatible(TAZA, LB, ['taza'])).toBe(true);
    expect(unidadCompatible(TAZA, LB, ['cda'])).toBe(false);
  });
});

describe('convertirCantidad (tabla de unidades §8.2)', () => {
  it('convierte dentro de la magnitud con factorBase', () => {
    expect(convertirCantidad(1, LB, G)).toBe(453.59237);
    expect(convertirCantidad('2', KG, G)).toBe(2000);
    expect(convertirCantidad(1, TAZA, ML)).toBe(240);
    expect(convertirCantidad(500, G, KG)).toBe(0.5);
  });

  it('misma unidad devuelve la cantidad sin tocar', () => {
    expect(convertirCantidad('3', DIENTE, DIENTE)).toBe(3);
  });

  it('null si cambia la magnitud o alguna unidad no es convertible', () => {
    expect(convertirCantidad(1, ML, LB)).toBeNull();
    expect(convertirCantidad(1, DIENTE, UNIDAD)).toBeNull();
    expect(convertirCantidad(1, UNIDAD, DIENTE)).toBeNull();
  });
});

describe('escalarCantidad (RN-07, D-02)', () => {
  it('CA-12.1 Σ factores 6.0 con 4 porciones base: 2 lb → 3 lb y 250 ml → 375 ml', () => {
    expect(escalarCantidad(2, 4, 6)).toBe(3);
    expect(escalarCantidad('250.000', 4, '6.00')).toBe(375);
  });

  it('CA-12.5 Σ factores 2.5 (1.0 + 1.0 + 0.5): 2 lb → 1.25 lb y 250 ml → 156.25 ml', () => {
    expect(escalarCantidad(2, 4, 2.5)).toBe(1.25);
    expect(escalarCantidad(250, 4, 2.5)).toBe(156.25);
  });

  it('redondea a 3 decimales half-up', () => {
    expect(escalarCantidad(1, 3, 1)).toBe(0.333);
    expect(escalarCantidad(1.0005, 1, 1)).toBe(1.001);
    expect(escalarCantidad(5, 4, 0)).toBe(0);
  });

  it('rechaza datos fuera de rango', () => {
    expect(() => escalarCantidad(-1, 4, 2)).toThrow(RangeError);
    expect(() => escalarCantidad('x', 4, 2)).toThrow(RangeError);
    expect(() => escalarCantidad(1, 0, 2)).toThrow(RangeError);
    expect(() => escalarCantidad(1, Number.NaN, 2)).toThrow(RangeError);
    expect(() => escalarCantidad(1, 4, -0.25)).toThrow(RangeError);
    expect(() => escalarCantidad(1, 4, 'abc')).toThrow(RangeError);
  });
});

describe('formato de cantidades y productos', () => {
  it('formatearCantidad quita ceros de más', () => {
    expect(formatearCantidad('2.000')).toBe('2');
    expect(formatearCantidad(156.25)).toBe('156.25');
    expect(formatearCantidad('0.500')).toBe('0.5');
  });

  it('redondear con decimales por defecto y negativos', () => {
    expect(redondear(1.23456)).toBe(1.235);
    expect(redondear(-1.0005, 3)).toBe(-1.001);
  });

  it('CA-13.1 "Arroz · bolsa 2 lb" y CA-13.3 "Aceite · botella 900 ml"', () => {
    expect(
      etiquetaProducto({
        nombre: 'Arroz',
        unidadCompra: 'bolsa',
        presentacionCantidad: '2.000',
        presentacionUnidad: 'lb',
      }),
    ).toBe('Arroz · bolsa 2 lb');
    expect(
      etiquetaProducto({
        nombre: 'Aceite',
        unidadCompra: 'botella',
        presentacionCantidad: 900,
        presentacionUnidad: 'ml',
      }),
    ).toBe('Aceite · botella 900 ml');
  });
});

describe('mensajes y listas fijas (M03)', () => {
  it('proteína principal con la lista fija de CU-03.1', () => {
    expect(Object.keys(NOMBRES_PROTEINA)).toEqual(Object.values(ProteinaPrincipal));
  });

  it('textos de los criterios de aceptación', () => {
    expect(MENSAJES_CATALOGO.platilloDuplicado('Carne guisada')).toBe(
      'Ya existe el platillo Carne guisada',
    );
    expect(MENSAJES_CATALOGO.sinTiempo).toBe('Selecciona al menos un tiempo de comida');
    expect(MENSAJES_CATALOGO.cantidadInvalida).toBe('La cantidad debe ser mayor que 0');
    expect(MENSAJES_CATALOGO.presentacionInvalida).toBe('La presentación debe ser mayor que 0');
    expect(MENSAJES_CATALOGO.ingredienteInactivo('Crema')).toBe('Ingrediente inactivo: Crema');
    expect(MENSAJES_CATALOGO.productoDuplicado('Aceite · botella 900 ml')).toBe(
      'Ya existe Aceite · botella 900 ml',
    );
    expect(MENSAJES_CATALOGO.productoRepetido('Arroz')).toMatch(/^Arroz ya está/);
    expect(MENSAJES_CATALOGO.productoInactivo('Crema')).toMatch(/^Crema está inactivo/);
  });
});
