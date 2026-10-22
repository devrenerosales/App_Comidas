/** Código SQLSTATE de violación de unicidad en PostgreSQL. */
export const UNIQUE_VIOLATION = '23505';

/** `true` si el error (de `pg` directo o envuelto por Drizzle en `cause`) es una violación de unicidad. */
export function esViolacionUnicidad(error: unknown): boolean {
  const codigo =
    (error as { code?: string } | null)?.code ??
    (error as { cause?: { code?: string } } | null)?.cause?.code;
  return codigo === UNIQUE_VIOLATION;
}
