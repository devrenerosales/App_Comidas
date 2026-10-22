/**
 * `pnpm db:seed` — carga los catálogos semilla (supermercados, unidades, categorías) en
 * DATABASE_URL. Idempotente. SEED_ADMIN_SISTEMA_CORREO marca a ese usuario como
 * administrador del sistema si ya existe (D-07).
 */
import { crearDb } from '../cliente';
import { cargarEntorno, variableRequerida } from '../entorno';
import { sembrar } from '../semilla';

async function principal(): Promise<void> {
  cargarEntorno();
  const db = crearDb(variableRequerida('DATABASE_URL'), { max: 1 });
  try {
    const r = await sembrar(db, { adminSistemaCorreo: process.env.SEED_ADMIN_SISTEMA_CORREO });
    console.warn(
      `Semilla aplicada: ${r.supermercados} supermercados, ${r.unidades} unidades, ` +
        `${r.categorias} categorías; admin del sistema ${r.adminSistemaMarcado ? 'marcado' : 'sin cambios'}.`,
    );
  } finally {
    await db.$client.end();
  }
}

principal().catch((error: unknown) => {
  console.error('Error al sembrar:', error instanceof Error ? error.message : error);
  process.exit(1);
});
