/**
 * Datos semilla comunes a todos los ambientes (modelo-datos.md §8). Idempotente:
 * se puede ejecutar en cada despliegue. La carga de las semanas del cuaderno NO es
 * semilla: usa el flujo de importación (RF-18, D-06).
 */
import { eq, sql } from 'drizzle-orm';
import type { Db } from './cliente';
import { categoria, supermercado, unidad, usuario } from './schema';
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

export interface OpcionesSemilla {
  /** Correo de un usuario existente que se marca como administrador del sistema (D-07). */
  adminSistemaCorreo?: string | undefined;
}

export interface ResultadoSemilla {
  supermercados: number;
  unidades: number;
  categorias: number;
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
      adminSistemaMarcado,
    };
  });
}
