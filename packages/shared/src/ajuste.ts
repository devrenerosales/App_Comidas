/**
 * Costo por platillo y ajuste de la propuesta al presupuesto (M05 · CU-05.3, HU-21): funciones
 * puras. El costo de un platillo escala cada ingrediente por la Σ de factores de porción (RN-07,
 * D-02) y lo multiplica por el precio mediana; el ajuste reemplaza, por tiempo de comida, el platillo
 * más caro no fijado por uno más barato hasta cumplir el presupuesto o agotar 3 intentos (RN-05).
 */
import { convertirCantidad, escalarCantidad, type UnidadMedida } from './catalogo';
import type { CandidatoMotor } from './motor';
import type { ProteinaPrincipal } from './catalogo';
import { diaSiguiente } from './plan';
import { ordenarPorPuntaje } from './puntaje';

/** Intentos de reemplazo por tiempo de comida (CU-05.3 4a, RN-05). */
export const INTENTOS_AJUSTE = 3;
/** Alternativas más baratas que se ofrecen por día cuando el tiempo sigue excedido (E1). */
export const ALTERNATIVAS_POR_DIA = 3;

/** Un ingrediente de un platillo con lo necesario para costearlo. */
export interface IngredienteCosto {
  /** Cantidad base de la receta, en `unidad` (para las porciones base del platillo). */
  cantidad: number | string;
  unidad: UnidadMedida;
  /** Presentación del producto con la que se fija el precio (p. ej. 5 lb). */
  presentacion: { cantidad: number | string; unidad: UnidadMedida };
  /** Cantidad de presentación que equivale a 1 `unidad` cuando son de otra magnitud (CU-03.2). */
  equivalencia: number | string | null;
  /** Precio mediana de una presentación completa; null si el producto no tiene precio. */
  precioMediana: number | string | null;
}

export interface CostoPlatillo {
  /** Suma de los ingredientes con precio, en quetzales con 2 decimales. */
  costo: number;
  /** Sin ingredientes, o alguno sin precio o sin conversión de unidades (D-18). */
  incompleto: boolean;
}

const aQuetzales = (centavos: number) => centavos / 100;

/** Cantidad del ingrediente expresada en la unidad de la presentación; null si no se puede. */
export function enPresentacion(
  i: Pick<IngredienteCosto, 'unidad' | 'presentacion' | 'equivalencia'>,
  cantidadEscalada: number,
): number | null {
  const mismaMagnitud = i.unidad.magnitud === i.presentacion.unidad.magnitud;
  if (!mismaMagnitud && i.equivalencia !== null) return cantidadEscalada * Number(i.equivalencia);
  return convertirCantidad(cantidadEscalada, i.unidad, i.presentacion.unidad);
}

/**
 * CU-05.3 paso 2: Σ (cantidad × Σ factores ÷ porciones base) × precio mediana. Un ingrediente sin
 * precio aporta Q0.00 y marca el platillo como "Costo incompleto".
 */
export function costoDePlatillo(
  ingredientes: readonly IngredienteCosto[],
  porcionesBase: number,
  sumaFactores: number | string,
): CostoPlatillo {
  let centavos = 0;
  let incompleto = ingredientes.length === 0;
  for (const i of ingredientes) {
    const contenido = Number(i.presentacion.cantidad);
    const cantidad = enPresentacion(i, escalarCantidad(i.cantidad, porcionesBase, sumaFactores));
    if (i.precioMediana === null || cantidad === null || !(contenido > 0)) {
      incompleto = true;
      continue;
    }
    centavos += Math.round((Number(i.precioMediana) * cantidad * 100) / contenido);
  }
  return { costo: aQuetzales(centavos), incompleto };
}

/** Espacio de un tiempo de comida dentro de la propuesta. */
export interface EspacioAjuste {
  fecha: string;
  /** null = "Sin sugerencia". */
  candidato: CandidatoMotor | null;
  fijado: boolean;
}

export interface ReemplazoPresupuesto {
  fecha: string;
  de: CandidatoMotor;
  a: CandidatoMotor;
  /** Cuánto más barato es el nuevo, en quetzales con 2 decimales. */
  ahorro: number;
}

export interface AlternativasDelDia {
  fecha: string;
  platillos: CandidatoMotor[];
}

export interface ResultadoAjuste {
  espacios: EspacioAjuste[];
  reemplazos: ReemplazoPresupuesto[];
  /** Intentos usados, incluidos los fallidos (0 a 3). */
  intentos: number;
  /** Costo del tiempo: los platillos sin costo conocido aportan Q0.00. */
  costo: number;
  /** max(0, costo − presupuesto). */
  exceso: number;
  /** Algún espacio con platillo sin costo conocido (D-18). */
  incompleto: boolean;
  /** Solo si el tiempo sigue excedido: hasta 3 más baratas por día no fijado (E1). */
  alternativas: AlternativasDelDia[];
}

/** `OTRA` no es una proteína concreta: no se compara para RN-02. */
const comparable = (p: ProteinaPrincipal) => p !== 'OTRA';

const centavosDe = (costo: number | null) => (costo === null ? 0 : Math.round(costo * 100));

/**
 * CU-05.3 4a, E1 y E2 para un tiempo de comida. `espacios` son los siete días en orden; los
 * `candidatos` son los platillos del tiempo ya puntuados (con `costo` null si es incompleto). Un
 * reemplazo debe ser más barato que el reemplazado, no estar ya en la semana (RN-03) ni repetir
 * proteína con el día anterior o el siguiente (RN-02). Si no hay reemplazo válido el intento se
 * pierde y se pasa al siguiente más caro; los fijados nunca se reemplazan.
 */
export function ajustarPresupuesto(entrada: {
  presupuesto: number;
  espacios: readonly EspacioAjuste[];
  candidatos: readonly CandidatoMotor[];
}): ResultadoAjuste {
  const presupuesto = Math.round(entrada.presupuesto * 100);
  const espacios = entrada.espacios.map((e) => ({ ...e }));
  const ordenados = ordenarPorPuntaje(entrada.candidatos);
  const reemplazos: ReemplazoPresupuesto[] = [];
  const fallidos = new Set<string>();
  const costoTotal = () => espacios.reduce((s, e) => s + centavosDe(e.candidato?.costo ?? null), 0);

  const usados = () => new Set(espacios.flatMap((e) => (e.candidato ? [e.candidato.id] : [])));
  const proteinaDe = (fecha: string) =>
    espacios.find((e) => e.fecha === fecha)?.candidato?.proteina;
  /** Candidatos válidos para el espacio de `fecha` que cuestan menos que `tope` centavos. */
  const masBaratos = (fecha: string, tope: number) => {
    const enUso = usados();
    const anterior = proteinaDe(diaSiguiente(fecha, -1));
    const siguiente = proteinaDe(diaSiguiente(fecha, 1));
    return ordenados.filter(
      (c) =>
        c.costo !== null &&
        centavosDe(c.costo) < tope &&
        !enUso.has(c.id) &&
        (!comparable(c.proteina) || (c.proteina !== anterior && c.proteina !== siguiente)),
    );
  };

  let intentos = 0;
  while (costoTotal() > presupuesto && intentos < INTENTOS_AJUSTE) {
    const objetivo = espacios
      .filter((e) => !e.fijado && e.candidato?.costo != null && !fallidos.has(e.fecha))
      .sort((a, b) => centavosDe(b.candidato!.costo) - centavosDe(a.candidato!.costo))[0];
    if (!objetivo) break;
    intentos += 1;
    const actual = objetivo.candidato!;
    const nuevo = masBaratos(objetivo.fecha, centavosDe(actual.costo))[0];
    if (!nuevo) {
      fallidos.add(objetivo.fecha);
      continue;
    }
    objetivo.candidato = nuevo;
    reemplazos.push({
      fecha: objetivo.fecha,
      de: actual,
      a: nuevo,
      ahorro: aQuetzales(centavosDe(actual.costo) - centavosDe(nuevo.costo)),
    });
  }

  const total = costoTotal();
  const alternativas: AlternativasDelDia[] =
    total > presupuesto
      ? espacios
          .filter((e) => !e.fijado && e.candidato?.costo != null)
          .map((e) => ({
            fecha: e.fecha,
            platillos: masBaratos(e.fecha, centavosDe(e.candidato!.costo)).slice(
              0,
              ALTERNATIVAS_POR_DIA,
            ),
          }))
          .filter((a) => a.platillos.length > 0)
      : [];
  return {
    espacios,
    reemplazos,
    intentos,
    costo: aQuetzales(total),
    exceso: aQuetzales(Math.max(0, total - presupuesto)),
    incompleto: espacios.some((e) => e.candidato !== null && e.candidato.costo === null),
    alternativas,
  };
}
