/**
 * Datos semilla comunes a todos los ambientes (modelo-datos.md §8). Idempotente:
 * se puede ejecutar en cada despliegue. La carga de las semanas del cuaderno NO es
 * semilla: usa el flujo de importación (RF-18, D-06).
 */
import { eq, sql } from 'drizzle-orm';
import type { Db } from './cliente';
import { categoria, producto, supermercado, unidad, usuario } from './schema';
import type { CategoriaInsert, SupermercadoInsert, UnidadInsert } from './tipos';

/**
 * §8.1 — Supermercados con la extracción APAGADA (D-07, PA-02, R-03). Los dominios se
 * registran al revisar los términos de uso; hasta entonces quedan en null.
 */
export const SUPERMERCADOS_SEMILLA = [
  {
    codigo: 'WALMART',
    nombre: 'Walmart',
    soportaExtraccion: true,
    habilitado: true,
    extraccionPermitida: false,
  },
  {
    codigo: 'PAIZ',
    nombre: 'Paiz',
    soportaExtraccion: true,
    habilitado: true,
    extraccionPermitida: false,
  },
  {
    codigo: 'LA_TORRE',
    nombre: 'La Torre',
    soportaExtraccion: false,
    habilitado: false,
    extraccionPermitida: false,
  },
  {
    codigo: 'SUPER_FRESH',
    nombre: 'Super Fresh',
    soportaExtraccion: false,
    habilitado: false,
    extraccionPermitida: false,
  },
] as const satisfies readonly SupermercadoInsert[];

/** §8.2 — Unidades con su factor a la unidad base de la magnitud (g, ml, unidad). */
export const UNIDADES_SEMILLA = [
  { codigo: 'g', nombre: 'gramo', magnitud: 'MASA', factorBase: '1' },
  { codigo: 'kg', nombre: 'kilogramo', magnitud: 'MASA', factorBase: '1000' },
  { codigo: 'lb', nombre: 'libra', magnitud: 'MASA', factorBase: '453.592370' },
  { codigo: 'oz', nombre: 'onza', magnitud: 'MASA', factorBase: '28.349523' },
  { codigo: 'ml', nombre: 'mililitro', magnitud: 'VOLUMEN', factorBase: '1' },
  { codigo: 'l', nombre: 'litro', magnitud: 'VOLUMEN', factorBase: '1000' },
  { codigo: 'taza', nombre: 'taza', magnitud: 'VOLUMEN', factorBase: '240' },
  { codigo: 'cda', nombre: 'cucharada', magnitud: 'VOLUMEN', factorBase: '15' },
  { codigo: 'cdta', nombre: 'cucharadita', magnitud: 'VOLUMEN', factorBase: '5' },
  { codigo: 'unidad', nombre: 'unidad', magnitud: 'CONTEO', factorBase: '1' },
  { codigo: 'manojo', nombre: 'manojo', magnitud: 'CONTEO', factorBase: null },
  { codigo: 'diente', nombre: 'diente', magnitud: 'CONTEO', factorBase: null },
] as const satisfies readonly UnidadInsert[];

/** §8.3 — Categorías de producto; `orden` = orden de pasillo en la lista de compras. */
export const CATEGORIAS_SEMILLA = [
  { codigo: 'carnes', nombre: 'Carnes', orden: 1 },
  { codigo: 'lacteos', nombre: 'Lácteos', orden: 2 },
  { codigo: 'verduras', nombre: 'Verduras', orden: 3 },
  { codigo: 'frutas', nombre: 'Frutas', orden: 4 },
  { codigo: 'granos', nombre: 'Granos', orden: 5 },
  { codigo: 'abarrotes', nombre: 'Abarrotes', orden: 6 },
  { codigo: 'condimentos', nombre: 'Condimentos', orden: 7 },
  { codigo: 'panaderia', nombre: 'Panadería', orden: 8 },
  { codigo: 'otros', nombre: 'Otros', orden: 9 },
] as const satisfies readonly CategoriaInsert[];

/** Producto semilla: categoría y unidad de presentación por código. */
export interface ProductoSemilla {
  nombre: string;
  tipo: 'INGREDIENTE' | 'DESPENSA' | 'AMBOS';
  categoria: (typeof CATEGORIAS_SEMILLA)[number]['codigo'];
  /** Cómo se compra: bolsa, lb, unidad, frasco, botella… */
  unidadCompra: string;
  /** Contenido de la unidad de compra (decimal en texto). */
  cantidad: string;
  unidad: (typeof UNIDADES_SEMILLA)[number]['codigo'];
}

type Fila = [string, ProductoSemilla['tipo'], string, string, ProductoSemilla['unidad']];

const productos = (
  categoriaCodigo: ProductoSemilla['categoria'],
  filas: readonly Fila[],
): ProductoSemilla[] =>
  filas.map(([nombre, tipo, unidadCompra, cantidad, unidad]) => ({
    nombre,
    tipo,
    categoria: categoriaCodigo,
    unidadCompra,
    cantidad,
    unidad,
  }));

/**
 * §8.5 — Productos básicos guatemaltecos del catálogo común (D-05, HU-13) con presentaciones
 * habituales en el supermercado; se completan con la lista de compras en S2 (M04). No incluye
 * "Miltomate": el criterio CA-12.2 lo crea desde el buscador de ingredientes.
 */
export const PRODUCTOS_SEMILLA: readonly ProductoSemilla[] = [
  ...productos('carnes', [
    ['Pechuga de pollo', 'INGREDIENTE', 'lb', '1', 'lb'],
    ['Pollo entero', 'INGREDIENTE', 'lb', '1', 'lb'],
    ['Muslos de pollo', 'INGREDIENTE', 'lb', '1', 'lb'],
    ['Carne de res para guisar', 'INGREDIENTE', 'lb', '1', 'lb'],
    ['Carne molida de res', 'INGREDIENTE', 'lb', '1', 'lb'],
    ['Costilla de res', 'INGREDIENTE', 'lb', '1', 'lb'],
    ['Chuleta de cerdo', 'INGREDIENTE', 'lb', '1', 'lb'],
    ['Filete de pescado', 'INGREDIENTE', 'lb', '1', 'lb'],
    ['Salchicha de pollo', 'INGREDIENTE', 'paquete', '454', 'g'],
    ['Longaniza', 'INGREDIENTE', 'lb', '1', 'lb'],
  ]),
  ...productos('lacteos', [
    ['Crema', 'AMBOS', 'bolsa', '500', 'ml'],
    ['Queso fresco', 'AMBOS', 'lb', '1', 'lb'],
    ['Leche entera', 'AMBOS', 'caja', '1', 'l'],
    ['Huevos', 'AMBOS', 'cartón', '30', 'unidad'],
    ['Mantequilla', 'AMBOS', 'barra', '90', 'g'],
  ]),
  ...productos('verduras', [
    ['Tomate', 'INGREDIENTE', 'lb', '1', 'lb'],
    ['Cebolla', 'INGREDIENTE', 'lb', '1', 'lb'],
    ['Chile pimiento', 'INGREDIENTE', 'unidad', '1', 'unidad'],
    ['Güisquil', 'INGREDIENTE', 'unidad', '1', 'unidad'],
    ['Papa', 'INGREDIENTE', 'lb', '1', 'lb'],
    ['Zanahoria', 'INGREDIENTE', 'lb', '1', 'lb'],
    ['Ejote', 'INGREDIENTE', 'lb', '1', 'lb'],
    ['Repollo', 'INGREDIENTE', 'unidad', '1', 'unidad'],
    ['Ajo', 'INGREDIENTE', 'cabeza', '1', 'unidad'],
    ['Cilantro', 'INGREDIENTE', 'manojo', '1', 'manojo'],
    ['Aguacate', 'INGREDIENTE', 'unidad', '1', 'unidad'],
  ]),
  ...productos('frutas', [
    ['Plátano', 'INGREDIENTE', 'unidad', '1', 'unidad'],
    ['Banano', 'DESPENSA', 'lb', '1', 'lb'],
    ['Limón', 'INGREDIENTE', 'bolsa', '1', 'lb'],
  ]),
  ...productos('granos', [
    ['Arroz', 'AMBOS', 'bolsa', '1', 'lb'],
    ['Frijol negro', 'AMBOS', 'bolsa', '1', 'lb'],
    ['Frijol negro volteado', 'AMBOS', 'bolsa', '400', 'g'],
    ['Avena', 'AMBOS', 'bolsa', '400', 'g'],
  ]),
  ...productos('abarrotes', [
    ['Aceite', 'AMBOS', 'botella', '900', 'ml'],
    ['Azúcar', 'AMBOS', 'bolsa', '5', 'lb'],
    ['Sal', 'AMBOS', 'bolsa', '1', 'kg'],
    ['Espagueti', 'AMBOS', 'paquete', '200', 'g'],
    ['Salsa de tomate', 'AMBOS', 'sobre', '106', 'g'],
    ['Café molido', 'DESPENSA', 'bolsa', '400', 'g'],
  ]),
  ...productos('condimentos', [
    ['Consomé de pollo', 'AMBOS', 'frasco', '150', 'g'],
    ['Pimienta negra molida', 'AMBOS', 'frasco', '50', 'g'],
    ['Achiote', 'INGREDIENTE', 'paquete', '100', 'g'],
    ['Salsa inglesa', 'AMBOS', 'botella', '145', 'ml'],
  ]),
  ...productos('panaderia', [
    ['Tortillas de maíz', 'AMBOS', 'paquete', '10', 'unidad'],
    ['Pan francés', 'AMBOS', 'unidad', '1', 'unidad'],
  ]),
];

/**
 * Nombre normalizado de un producto semilla: minúsculas, sin tildes ni diéresis y con espacios
 * simples. Debe coincidir con `normalizarNombreCatalogo` de @menu/shared (lo verifica la prueba
 * de integración de la API; @menu/db no depende de @menu/shared).
 */
export function normalizarNombreSemilla(nombre: string): string {
  return nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
}

export interface OpcionesSemilla {
  /** Correo de un usuario existente que se marca como administrador del sistema (D-07). */
  adminSistemaCorreo?: string | undefined;
}

export interface ResultadoSemilla {
  supermercados: number;
  unidades: number;
  categorias: number;
  productos: number;
  adminSistemaMarcado: boolean;
}

/**
 * Inserta o actualiza los catálogos semilla en una transacción.
 * En supermercados existentes solo se actualizan nombre y `soportaExtraccion`: los permisos
 * (`habilitado`, `extraccionPermitida`) los decide un administrador del sistema y no se pisan.
 */
export async function sembrar(db: Db, opciones: OpcionesSemilla = {}): Promise<ResultadoSemilla> {
  return db.transaction(async (tx) => {
    await tx
      .insert(supermercado)
      .values([...SUPERMERCADOS_SEMILLA])
      .onConflictDoUpdate({
        target: supermercado.codigo,
        set: {
          nombre: sql`excluded.nombre`,
          soportaExtraccion: sql`excluded.soporta_extraccion`,
          updatedAt: sql`now()`,
        },
      });

    await tx
      .insert(unidad)
      .values([...UNIDADES_SEMILLA])
      .onConflictDoUpdate({
        target: unidad.codigo,
        set: {
          nombre: sql`excluded.nombre`,
          magnitud: sql`excluded.magnitud`,
          factorBase: sql`excluded.factor_base`,
        },
      });

    await tx
      .insert(categoria)
      .values([...CATEGORIAS_SEMILLA])
      .onConflictDoUpdate({
        target: categoria.codigo,
        set: { nombre: sql`excluded.nombre`, orden: sql`excluded.orden` },
      });

    // Productos: solo se insertan los que faltan. Si el administrador del sistema editó o
    // inactivó uno, la semilla no lo pisa (D-05).
    const categorias = await tx
      .select({ id: categoria.id, codigo: categoria.codigo })
      .from(categoria);
    const unidades = await tx.select({ id: unidad.id, codigo: unidad.codigo }).from(unidad);
    const idCategoria = new Map(categorias.map((c) => [c.codigo, c.id]));
    const idUnidad = new Map(unidades.map((u) => [u.codigo, u.id]));
    await tx
      .insert(producto)
      .values(
        PRODUCTOS_SEMILLA.map((p) => ({
          nombre: p.nombre,
          nombreNormalizado: normalizarNombreSemilla(p.nombre),
          tipo: p.tipo,
          categoriaId: idCategoria.get(p.categoria) as string,
          unidadCompra: p.unidadCompra,
          presentacionCantidad: p.cantidad,
          presentacionUnidadId: idUnidad.get(p.unidad) as string,
        })),
      )
      .onConflictDoNothing({
        target: [
          producto.nombreNormalizado,
          producto.presentacionCantidad,
          producto.presentacionUnidadId,
        ],
      });

    let adminSistemaMarcado = false;
    const correo = opciones.adminSistemaCorreo?.trim().toLowerCase();
    if (correo) {
      const marcados = await tx
        .update(usuario)
        .set({ esAdminSistema: true })
        .where(eq(usuario.correo, correo))
        .returning({ id: usuario.id });
      adminSistemaMarcado = marcados.length > 0;
    }

    return {
      supermercados: SUPERMERCADOS_SEMILLA.length,
      unidades: UNIDADES_SEMILLA.length,
      categorias: CATEGORIAS_SEMILLA.length,
      productos: PRODUCTOS_SEMILLA.length,
      adminSistemaMarcado,
    };
  });
}
