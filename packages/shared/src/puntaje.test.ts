import { describe, expect, it } from 'vitest';
import {
  calcularPuntaje,
  diasEntre,
  fechaReferenciaMotor,
  ordenarPorPuntaje,
  PESOS_MOTOR_POR_DEFECTO,
  validarPesosMotor,
  type ContextoPuntaje,
  type DatosPuntaje,
} from './puntaje';

// Ejemplo numérico de CU-05.2: almuerzo, Q245.00 por semana → Q35.00 por comida, máximo 8 veces.
const referencia = '2026-11-01';
const contexto: ContextoPuntaje = { referencia, presupuestoPorComida: 35, maximoVeces: 8 };
const haceSemanas = (n: number) => {
  const d = new Date(Date.UTC(2026, 10, 1) - n * 7 * 86_400_000);
  return d.toISOString().slice(0, 10);
};
const base: DatosPuntaje = {
  esFavorito: false,
  promedioCalificaciones: null,
  ultimaPreparacion: null,
  costo: null,
  vecesEnVentana: 0,
};

describe('calcularPuntaje (CU-05.2, HU-20)', () => {
  it('CA-20.1: Pollo en crema', () => {
    const r = calcularPuntaje(
      {
        ...base,
        promedioCalificaciones: 4.6,
        ultimaPreparacion: haceSemanas(4),
        costo: 28,
        vecesEnVentana: 6,
      },
      contexto,
    );
    expect(r.factores).toEqual({ preferencia: 0.9, novedad: 0.5, ahorro: 0.2, afinidad: 0.75 });
    expect(r.puntaje).toBe(0.6375);
  });

  it('Carne guisada', () => {
    const r = calcularPuntaje(
      {
        ...base,
        promedioCalificaciones: 4,
        ultimaPreparacion: haceSemanas(10),
        costo: 31.5,
        vecesEnVentana: 2,
      },
      contexto,
    );
    expect(r.factores).toEqual({ preferencia: 0.75, novedad: 1, ahorro: 0.1, afinidad: 0.25 });
    expect(r.puntaje).toBe(0.6075);
  });

  it('CA-20.2: novedad 0 por RN-04 y ahorro sin negativos', () => {
    const r = calcularPuntaje(
      {
        ...base,
        promedioCalificaciones: 5,
        ultimaPreparacion: haceSemanas(1),
        costo: 42,
        vecesEnVentana: 4,
      },
      contexto,
    );
    expect(r.factores).toEqual({ preferencia: 1, novedad: 0, ahorro: 0, afinidad: 0.5 });
    expect(r.puntaje).toBe(0.475);
  });

  it('favorito vale 1 aunque tenga calificación baja', () => {
    const r = calcularPuntaje({ ...base, esFavorito: true, promedioCalificaciones: 2 }, contexto);
    expect(r.factores.preferencia).toBe(1);
  });

  it('sin calificaciones la preferencia es 0.50 y nunca preparado da novedad 1.00', () => {
    const r = calcularPuntaje(base, contexto);
    expect(r.factores.preferencia).toBe(0.5);
    expect(r.factores.novedad).toBe(1);
  });

  it('D-18: costo incompleto da ahorro neutro 0.50', () => {
    expect(calcularPuntaje({ ...base, costo: null }, contexto).factores.ahorro).toBe(0.5);
  });

  it('novedad: 2 semanas ya cuentan; 1 semana y 6 días no', () => {
    const n = (ultima: string) =>
      calcularPuntaje({ ...base, ultimaPreparacion: ultima }, contexto).factores.novedad;
    expect(n('2026-10-19')).toBe(0); // 13 días → 1 semana → RN-04
    expect(n('2026-10-18')).toBe(0.25); // 14 días → 2 semanas
  });

  it('sin presupuesto por comida el ahorro es 0 y sin máximo la afinidad es 0', () => {
    const r = calcularPuntaje(
      { ...base, costo: 10, vecesEnVentana: 3 },
      { ...contexto, presupuestoPorComida: 0, maximoVeces: 0 },
    );
    expect(r.factores.ahorro).toBe(0);
    expect(r.factores.afinidad).toBe(0);
  });

  it('usa pesos distintos a los de defecto', () => {
    const r = calcularPuntaje({ ...base, promedioCalificaciones: 5 }, contexto, {
      preferencia: 1,
      novedad: 0,
      ahorro: 0,
      afinidad: 0,
    });
    expect(r.puntaje).toBe(1);
  });
});

describe('validarPesosMotor (CA-20.3)', () => {
  it('acepta los pesos por defecto', () => {
    expect(validarPesosMotor(PESOS_MOTOR_POR_DEFECTO)).toEqual({ valido: true, suma: 1 });
  });

  it('rechaza una suma de 1.10 con el mensaje esperado', () => {
    const r = validarPesosMotor({ preferencia: 0.5, novedad: 0.25, ahorro: 0.2, afinidad: 0.15 });
    expect(r.valido).toBe(false);
    expect(r.mensaje).toBe('Los pesos deben sumar 1.00 (suma actual 1.10)');
  });

  it('rechaza pesos fuera de 0 a 1 o no numéricos', () => {
    expect(
      validarPesosMotor({ preferencia: 1.2, novedad: -0.2, ahorro: 0, afinidad: 0 }).valido,
    ).toBe(false);
    expect(
      validarPesosMotor({ preferencia: Number.NaN, novedad: 0, ahorro: 0, afinidad: 1 }).valido,
    ).toBe(false);
  });

  it('tolera ±0.001 por redondeo', () => {
    expect(
      validarPesosMotor({ preferencia: 0.333, novedad: 0.333, ahorro: 0.333, afinidad: 0.0007 })
        .valido,
    ).toBe(true);
  });
});

describe('ordenarPorPuntaje', () => {
  it('desempata por menor costo y luego por nombre', () => {
    const orden = ordenarPorPuntaje([
      { nombre: 'Zeta', costo: 20, puntaje: 0.5 },
      { nombre: 'Beta', costo: 30, puntaje: 0.5 },
      { nombre: 'Alfa', costo: 30, puntaje: 0.5 },
      { nombre: 'Sin precio', costo: null, puntaje: 0.5 },
      { nombre: 'Mejor', costo: 99, puntaje: 0.7 },
    ]).map((c) => c.nombre);
    expect(orden).toEqual(['Mejor', 'Zeta', 'Alfa', 'Beta', 'Sin precio']);
  });

  it('el costo incompleto va al final sin importar el orden de entrada', () => {
    const sinPrecio = { nombre: 'A sin precio', costo: null, puntaje: 0.5 };
    const conPrecio = { nombre: 'B con precio', costo: 40, puntaje: 0.5 };
    const otroSinPrecio = { nombre: 'C sin precio', costo: null, puntaje: 0.5 };
    expect(ordenarPorPuntaje([sinPrecio, conPrecio]).map((c) => c.nombre)).toEqual([
      'B con precio',
      'A sin precio',
    ]);
    expect(ordenarPorPuntaje([conPrecio, sinPrecio]).map((c) => c.nombre)).toEqual([
      'B con precio',
      'A sin precio',
    ]);
    expect(ordenarPorPuntaje([otroSinPrecio, sinPrecio]).map((c) => c.nombre)).toEqual([
      'A sin precio',
      'C sin precio',
    ]);
  });

  it('no modifica la lista original', () => {
    const lista = [
      { nombre: 'B', costo: 1, puntaje: 0.1 },
      { nombre: 'A', costo: 1, puntaje: 0.9 },
    ];
    ordenarPorPuntaje(lista);
    expect(lista[0]!.nombre).toBe('B');
  });
});

describe('fechaReferenciaMotor (D-19)', () => {
  it('sin historial usa la semana planificada', () => {
    expect(fechaReferenciaMotor('2026-11-22', null)).toBe('2026-11-22');
  });

  it('con historial reciente usa la semana planificada', () => {
    expect(fechaReferenciaMotor('2026-06-14', '2026-05-24')).toBe('2026-06-14');
  });

  it('con historial lejano mide desde el domingo siguiente a la última semana con datos', () => {
    // 2026-05-22 es viernes → el domingo siguiente es 2026-05-24
    expect(fechaReferenciaMotor('2026-11-22', '2026-05-22')).toBe('2026-05-24');
    // si la última fecha es domingo, el siguiente es 7 días después
    expect(fechaReferenciaMotor('2026-11-22', '2026-05-24')).toBe('2026-05-31');
  });

  it('con la referencia ajustada hay diferencia entre platillos recientes y antiguos', () => {
    const ref = fechaReferenciaMotor('2026-11-22', '2026-05-23');
    const reciente = calcularPuntaje(
      { ...base, ultimaPreparacion: '2026-05-22', vecesEnVentana: 4 },
      { referencia: ref, presupuestoPorComida: 35, maximoVeces: 4 },
    );
    expect(reciente.factores.novedad).toBe(0);
    expect(reciente.factores.afinidad).toBe(1);
  });
});

describe('diasEntre', () => {
  it('cuenta días completos con signo', () => {
    expect(diasEntre('2026-10-18', '2026-11-01')).toBe(14);
    expect(diasEntre('2026-11-01', '2026-10-18')).toBe(-14);
  });
});
