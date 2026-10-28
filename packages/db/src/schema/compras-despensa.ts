/**
 * Dominio 3 — Compras y despensa (M07).
 * Fuente: docs/02-diseno/modelo-datos.md §3.3 y §4.
 */
import { relations } from 'drizzle-orm';
import { boolean, integer, jsonb, pgTable, uuid, varchar } from 'drizzle-orm/pg-core';
import {
  actualizadoEn,
  creadoEn,
  decimal,
  dinero,
  fecha,
  fk,
  id,
  indice,
  instante,
  unico,
} from './comun';
import {
  estadoItemLista,
  frecuenciaDespensa,
  operacionSync,
  origenItemLista,
  resultadoSync,
} from './enums';
import { hogar, usuario } from './hogar-config';
import { menuDetalle, menuSemanal, producto, unidad } from './catalogo-menus';

export const listaCompras = pgTable(
  'lista_compras',
  {
    id: id(),
    hogarId: uuid('hogar_id').notNull(),
    menuId: uuid('menu_id').notNull(),
    /** Se incrementa con cada cambio aplicado; el cliente la usa para sincronizar. */
    version: integer('version').notNull().default(1),
    generadaEn: instante('generada_en').notNull().defaultNow(),
    createdAt: creadoEn(),
    updatedAt: actualizadoEn(),
  },
  (t) => [
    unico([t.menuId]),
    indice(t.hogarId),
    fk(t.hogarId, hogar.id, 'cascade'),
    fk(t.menuId, menuSemanal.id, 'cascade'),
  ],
);

/** Ítem de lista. `id` puede generarlo el cliente (offline). `eliminado` = borrado lógico (LWW). */
export const listaItem = pgTable(
  'lista_item',
  {
    id: uuid('id').primaryKey(),
    listaId: uuid('lista_id').notNull(),
    productoId: uuid('producto_id'),
    /** Producto de texto libre (no se cotiza). */
    textoLibre: varchar('texto_libre', { length: 80 }),
    origen: origenItemLista('origen').notNull(),
    cantidadRequerida: decimal('cantidad_requerida', 12, 3),
    unidadRequeridaId: uuid('unidad_requerida_id'),
    /** Presentaciones enteras a comprar (redondeo hacia arriba). */
    cantidadComprar: decimal('cantidad_comprar', 10, 3).notNull(),
    sinConversion: boolean('sin_conversion').notNull().default(false),
    /** RF-30 / RF-43: PENDIENTE, COMPRADO o YA_LO_TENGO. */
    estado: estadoItemLista('estado').notNull().default('PENDIENTE'),
    /** Momento (hora del dispositivo) en que pasó a COMPRADO o YA_LO_TENGO (RN-12). */
    compradoEn: instante('comprado_en'),
    compradoPorId: uuid('comprado_por_id'),
    /** RF-44: total pagado por el ítem en GTQ (opcional, solo con estado COMPRADO). */
    precioReal: dinero('precio_real'),
    /** Contenido comprado en la unidad de la presentación del catálogo (p. ej. 5 lb). */
    contenidoComprado: decimal('contenido_comprado', 12, 3),
    /** precio_real × presentación del catálogo ÷ contenido_comprado, a centavos (RN-12). */
    precioNormalizado: dinero('precio_normalizado'),
    eliminado: boolean('eliminado').notNull().default(false),
    /** Hora del dispositivo del último cambio ("última escritura gana"). */
    modificadoEnDispositivo: instante('modificado_en_dispositivo').notNull(),
    version: integer('version').notNull().default(1),
    createdAt: creadoEn(),
    updatedAt: actualizadoEn(),
  },
  (t) => [
    unico([t.listaId, t.productoId]),
    indice(t.listaId, t.eliminado),
    /** Promedio de compra de 12 semanas por producto (RN-12). */
    indice(t.productoId, t.compradoEn),
    fk(t.listaId, listaCompras.id, 'cascade'),
    fk(t.productoId, producto.id, 'restrict'),
    fk(t.unidadRequeridaId, unidad.id, 'set null'),
    fk(t.compradoPorId, usuario.id, 'set null'),
  ],
);

/** Comidas programadas (detalles del menú) que originan cada ítem consolidado (RF-43, RN-13). */
export const listaItemOrigen = pgTable(
  'lista_item_origen',
  {
    id: id(),
    listaItemId: uuid('lista_item_id').notNull(),
    menuDetalleId: uuid('menu_detalle_id').notNull(),
    /** Cantidad escalada que aporta esa comida, en la unidad requerida del ítem. */
    cantidadRequerida: decimal('cantidad_requerida', 12, 3),
    createdAt: creadoEn(),
  },
  (t) => [
    unico([t.listaItemId, t.menuDetalleId]),
    indice(t.menuDetalleId),
    fk(t.listaItemId, listaItem.id, 'cascade'),
    fk(t.menuDetalleId, menuDetalle.id, 'cascade'),
  ],
);

/** Registro idempotente de cada cambio offline (id = UUID generado por el cliente). */
export const syncCambio = pgTable(
  'sync_cambio',
  {
    id: uuid('id').primaryKey(),
    listaId: uuid('lista_id').notNull(),
    itemId: uuid('item_id').notNull(),
    usuarioId: uuid('usuario_id'),
    operacion: operacionSync('operacion').notNull(),
    datos: jsonb('datos'),
    marcaTiempoDispositivo: instante('marca_tiempo_dispositivo').notNull(),
    resultado: resultadoSync('resultado').notNull(),
    motivo: varchar('motivo', { length: 200 }),
    recibidoEn: instante('recibido_en').notNull().defaultNow(),
  },
  (t) => [
    indice(t.listaId, t.recibidoEn),
    fk(t.listaId, listaCompras.id, 'cascade'),
    fk(t.usuarioId, usuario.id, 'set null'),
  ],
);

/** Producto recurrente del hogar con frecuencia (RF-29, PA-03). */
export const despensaItem = pgTable(
  'despensa_item',
  {
    id: id(),
    hogarId: uuid('hogar_id').notNull(),
    productoId: uuid('producto_id').notNull(),
    /** En presentaciones de compra del producto. */
    cantidad: decimal('cantidad', 10, 3).notNull(),
    frecuencia: frecuenciaDespensa('frecuencia').notNull().default('MENSUAL'),
    activo: boolean('activo').notNull().default(true),
    /** fecha_inicio de la última semana en que se incluyó; null = toca en la primera lista. */
    ultimaInclusionSemana: fecha('ultima_inclusion_semana'),
    ultimaInclusionListaId: uuid('ultima_inclusion_lista_id'),
    /** Precio de referencia de la carga del cuaderno (no es un PRECIO formal). */
    precioReferencia: dinero('precio_referencia'),
    notas: varchar('notas', { length: 200 }),
    createdAt: creadoEn(),
    updatedAt: actualizadoEn(),
  },
  (t) => [
    unico([t.hogarId, t.productoId]),
    indice(t.hogarId, t.activo),
    fk(t.hogarId, hogar.id, 'cascade'),
    fk(t.productoId, producto.id, 'restrict'),
    fk(t.ultimaInclusionListaId, listaCompras.id, 'set null'),
  ],
);

// -----------------------------------------------------------------------------
// Relaciones
// -----------------------------------------------------------------------------

export const listaComprasRelaciones = relations(listaCompras, ({ one, many }) => ({
  hogar: one(hogar, { fields: [listaCompras.hogarId], references: [hogar.id] }),
  menu: one(menuSemanal, { fields: [listaCompras.menuId], references: [menuSemanal.id] }),
  items: many(listaItem),
  cambiosSync: many(syncCambio),
  despensa: many(despensaItem),
}));

export const listaItemRelaciones = relations(listaItem, ({ one, many }) => ({
  lista: one(listaCompras, { fields: [listaItem.listaId], references: [listaCompras.id] }),
  producto: one(producto, { fields: [listaItem.productoId], references: [producto.id] }),
  unidadRequerida: one(unidad, {
    fields: [listaItem.unidadRequeridaId],
    references: [unidad.id],
  }),
  compradoPor: one(usuario, { fields: [listaItem.compradoPorId], references: [usuario.id] }),
  origenes: many(listaItemOrigen),
}));

export const listaItemOrigenRelaciones = relations(listaItemOrigen, ({ one }) => ({
  listaItem: one(listaItem, {
    fields: [listaItemOrigen.listaItemId],
    references: [listaItem.id],
  }),
  menuDetalle: one(menuDetalle, {
    fields: [listaItemOrigen.menuDetalleId],
    references: [menuDetalle.id],
  }),
}));

export const syncCambioRelaciones = relations(syncCambio, ({ one }) => ({
  lista: one(listaCompras, { fields: [syncCambio.listaId], references: [listaCompras.id] }),
  usuario: one(usuario, { fields: [syncCambio.usuarioId], references: [usuario.id] }),
}));

export const despensaItemRelaciones = relations(despensaItem, ({ one }) => ({
  hogar: one(hogar, { fields: [despensaItem.hogarId], references: [hogar.id] }),
  producto: one(producto, { fields: [despensaItem.productoId], references: [producto.id] }),
  ultimaInclusionLista: one(listaCompras, {
    fields: [despensaItem.ultimaInclusionListaId],
    references: [listaCompras.id],
  }),
}));
