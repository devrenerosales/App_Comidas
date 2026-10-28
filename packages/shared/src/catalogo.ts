/**
 * Reglas del catálogo compartidas por la API y la app (M03 · CU-03.1, CU-03.2, CU-03.3).
 * Supuestos de M03: nombre de platillo único por hogar sin distinguir mayúsculas ni tildes,
 * proteína principal de una lista fija, hasta 10 etiquetas, porciones base 4 por defecto (1–20),
 * unidades agrupadas por magnitud y catálogo de productos común a todos los hogares (D-05).
 */

/** Proteína principal del platillo (enum `proteina_principal`, lista fija de CU-03.1). */
export const ProteinaPrincipal = {
  POLLO: 'POLLO',
  RES: 'RES',
  CERDO: 'CERDO',
  PESCADO: 'PESCADO',
  HUEVO: 'HUEVO',
  EMBUTIDO: 'EMBUTIDO',
  VEGETARIANA: 'VEGETARIANA',
  OTRA: 'OTRA',
} as const;
export type ProteinaPrincipal = (typeof ProteinaPrincipal)[keyof typeof ProteinaPrincipal];

/** Nombre visible de cada proteína, en el orden de la lista de CU-03.1. */
export const NOMBRES_PROTEINA: Readonly<Record<ProteinaPrincipal, string>> = {
  POLLO: 'Pollo',
  RES: 'Res',
  CERDO: 'Cerdo',
  PESCADO: 'Pescado',
  HUEVO: 'Huevo',
  EMBUTIDO: 'Embutido',
  VEGETARIANA: 'Vegetariana',
  OTRA: 'Otra',
};

/** Tipo de producto (enum `tipo_producto`): ingrediente, despensa o ambos (CU-03.3). */
export const TipoProducto = {
  INGREDIENTE: 'INGREDIENTE',
  DESPENSA: 'DESPENSA',
  AMBOS: 'AMBOS',
} as const;
export type TipoProducto = (typeof TipoProducto)[keyof typeof TipoProducto];

export const NOMBRES_TIPO_PRODUCTO: Readonly<Record<TipoProducto, string>> = {
  INGREDIENTE: 'Ingrediente',
  DESPENSA: 'Despensa',
  AMBOS: 'Ingrediente y despensa',
};

/** `true` si un producto de `tipo` aparece al filtrar por `filtro` (AMBOS entra en los dos). */
export function tipoCoincide(tipo: TipoProducto, filtro: TipoProducto): boolean {
  return tipo === filtro || tipo === TipoProducto.AMBOS || filtro === TipoProducto.AMBOS;
}

/** Magnitud de una unidad (enum `magnitud_unidad`, supuesto de CU-03.2). */
export const MagnitudUnidad = {
  MASA: 'MASA',
  VOLUMEN: 'VOLUMEN',
  CONTEO: 'CONTEO',
} as const;
export type MagnitudUnidad = (typeof MagnitudUnidad)[keyof typeof MagnitudUnidad];

/** Límites de columnas y supuestos de M03. */
export const LARGO_MAXIMO_NOMBRE_PLATILLO = 80;
export const LARGO_MAXIMO_ETIQUETA = 30;
export const MAXIMO_ETIQUETAS = 10;
export const PORCIONES_BASE_POR_DEFECTO = 4;
export const PORCIONES_BASE_MINIMAS = 1;
export const PORCIONES_BASE_MAXIMAS = 20;
export const MAXIMO_INGREDIENTES = 50;
export const LARGO_MAXIMO_NOMBRE_PRODUCTO = 80;
export const LARGO_MAXIMO_UNIDAD_COMPRA = 20;
/** `numeric(10,3)`: hasta 7 enteros y 3 decimales. */
export const CANTIDAD_MAXIMA = 9_999_999.999;

/**
 * Nombre normalizado para unicidad y búsqueda (`*_normalizado`, modelo-datos §6.2): sin tildes
 * ni diéresis, en minúsculas, sin espacios al inicio ni al final y con espacios simples.
 * "  Pepián  de POLLO " → "pepian de pollo"; "Güisquil" → "guisquil".
 */
export function normalizarNombreCatalogo(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
}

/** Texto visible: sin espacios al inicio ni al final y con espacios simples. */
export function limpiarTexto(texto: string): string {
  return texto.trim().replace(/\s+/g, ' ');
}

/**
 * Etiquetas de un platillo desde texto libre ("típico, fin de semana") o una lista: recorta,
 * descarta vacías y quita repetidas comparando normalizado (gana la primera escritura).
 */
export function separarEtiquetas(entrada: string | readonly string[]): string[] {
  const partes = typeof entrada === 'string' ? entrada.split(',') : entrada;
  const vistas = new Set<string>();
  const resultado: string[] = [];
  for (const parte of partes) {
    const limpia = limpiarTexto(parte);
    const clave = normalizarNombreCatalogo(limpia);
    if (!clave || vistas.has(clave)) continue;
    vistas.add(clave);
    resultado.push(limpia);
  }
  return resultado;
}

/** Unidad de medida con su magnitud y su factor a la unidad base (g, ml, unidad). */
export interface UnidadMedida {
  codigo: string;
  magnitud: MagnitudUnidad;
  /** Decimal en texto o número; null = no convertible (manojo, diente). */
  factorBase: string | number | null;
}

/**
 * CU-03.2 E2: la unidad del ingrediente debe ser de la misma magnitud que la presentación del
 * producto, salvo que el producto tenga una equivalencia registrada para esa unidad
 * (`producto_equivalencia`, p. ej. taza de arroz → lb).
 */
export function unidadCompatible(
  unidad: Pick<UnidadMedida, 'codigo' | 'magnitud'>,
  presentacion: Pick<UnidadMedida, 'magnitud'>,
  equivalencias: readonly string[] = [],
): boolean {
  return unidad.magnitud === presentacion.magnitud || equivalencias.includes(unidad.codigo);
}

/**
 * Convierte `cantidad` de la unidad `de` a la unidad `a` con los factores de la tabla `unidad`
 * (semilla §8.2). Devuelve null si son de distinta magnitud o alguna no es convertible.
 */
export function convertirCantidad(
  cantidad: number | string,
  de: UnidadMedida,
  a: UnidadMedida,
): number | null {
  const valor = Number(cantidad);
  if (de.codigo === a.codigo) return valor;
  if (de.magnitud !== a.magnitud || de.factorBase === null || a.factorBase === null) return null;
  return redondear((valor * Number(de.factorBase)) / Number(a.factorBase), 6);
}

/**
 * Redondeo half-up (alejándose de 0) a `decimales`. El ajuste relativo de 1e-12 corrige la
 * representación binaria: 1.0005 se guarda como 1.000499999… y debe quedar en 1.001.
 */
export function redondear(valor: number, decimales = 3): number {
  const escala = 10 ** decimales;
  return (Math.sign(valor) * Math.round(Math.abs(valor) * escala * (1 + 1e-12))) / escala;
}

/**
 * RN-07 con D-02: cantidad para el hogar = cantidad base × Σ factores de porción ÷ porciones
 * base, redondeada a 3 decimales (`numeric(10,3)`). La suma de factores la recibe como
 * parámetro (sale de los comensales activos, HU-03).
 * Ej.: 2 lb para 4 porciones con Σ 2.5 → 1.25 lb.
 */
export function escalarCantidad(
  cantidadBase: number | string,
  porcionesBase: number,
  sumaFactores: number | string,
): number {
  const base = Number(cantidadBase);
  const suma = Number(sumaFactores);
  if (!Number.isFinite(base) || base < 0) {
    throw new RangeError('RN-07: la cantidad base debe ser un número mayor o igual a 0');
  }
  if (!Number.isFinite(porcionesBase) || porcionesBase <= 0) {
    throw new RangeError('RN-07: las porciones base deben ser mayores que 0');
  }
  if (!Number.isFinite(suma) || suma < 0) {
    throw new RangeError('RN-07: la suma de factores debe ser mayor o igual a 0');
  }
  return redondear((base * suma) / porcionesBase, 3);
}

/** Cantidad para mostrar sin ceros de más: "2.000" → "2", 156.25 → "156.25", "0.500" → "0.5". */
export function formatearCantidad(cantidad: number | string): string {
  const valor = redondear(Number(cantidad), 3);
  return String(valor);
}

export interface DatosEtiquetaProducto {
  nombre: string;
  unidadCompra: string;
  presentacionCantidad: number | string;
  presentacionUnidad: string;
}

/** Cómo se muestra un producto en el catálogo (CA-13.1): "Arroz · bolsa 2 lb". */
export function etiquetaProducto(p: DatosEtiquetaProducto): string {
  return `${p.nombre} · ${p.unidadCompra} ${formatearCantidad(p.presentacionCantidad)} ${p.presentacionUnidad}`;
}

/** Mensajes en español de los criterios de aceptación de HU-11, HU-12 y HU-13. */
export const MENSAJES_CATALOGO = {
  /** CU-03.1 E1. */
  nombrePlatilloObligatorio: 'Ingresa el nombre del platillo',
  nombrePlatilloLargo: `El nombre admite hasta ${LARGO_MAXIMO_NOMBRE_PLATILLO} caracteres`,
  /** CU-03.1 E2 · CA-11.4. */
  sinTiempo: 'Selecciona al menos un tiempo de comida',
  maximoEtiquetas: `Puedes agregar hasta ${MAXIMO_ETIQUETAS} etiquetas`,
  etiquetaLarga: `Cada etiqueta admite hasta ${LARGO_MAXIMO_ETIQUETA} caracteres`,
  /** CU-03.1 E3 · CA-11.3. */
  platilloDuplicado: (nombre: string) => `Ya existe el platillo ${nombre}`,
  /** CU-03.1 2a. */
  sinCoincidencias: 'Sin coincidencias',
  porcionesInvalidas: `Las porciones base deben ser un número entero de ${PORCIONES_BASE_MINIMAS} a ${PORCIONES_BASE_MAXIMAS}`,
  /** CU-03.2 E1 · CA-12.4. */
  cantidadInvalida: 'La cantidad debe ser mayor que 0',
  /** CU-03.2 E2 · CA-12.3. */
  unidadIncompatible: (unidad: string, presentacion: string) =>
    `La unidad ${unidad} no es compatible con ${presentacion}`,
  /** CU-03.2 E3. */
  productoRepetido: (nombre: string) =>
    `${nombre} ya está en el platillo; suma la cantidad en un solo ingrediente`,
  productoInactivo: (nombre: string) => `${nombre} está inactivo; elige otro producto`,
  productoNoExiste: 'El producto ya no existe en el catálogo',
  /** CA-13.2. */
  ingredienteInactivo: (nombre: string) => `Ingrediente inactivo: ${nombre}`,
  /** Platillo sin ingredientes (supuesto de CU-03.2). */
  incompleto: 'Incompleto',
  nombreProductoObligatorio: 'Ingresa el nombre del producto',
  nombreProductoLargo: `El nombre admite hasta ${LARGO_MAXIMO_NOMBRE_PRODUCTO} caracteres`,
  unidadCompraObligatoria: 'Indica cómo se compra (bolsa, lb, unidad, frasco…)',
  /** CU-03.3 E1 · CA-13.4. */
  presentacionInvalida: 'La presentación debe ser mayor que 0',
  /** CU-03.3 E2 · CA-13.3. */
  productoDuplicado: (etiqueta: string) => `Ya existe ${etiqueta}`,
  /** D-05: el catálogo es común a todos los hogares. */
  soloAdminSistema:
    'Solo el administrador del sistema puede editar o inactivar productos del catálogo común',
  magnitudEnUso:
    'Este producto se usa en platillos; su presentación debe seguir en la misma magnitud',
} as const;
