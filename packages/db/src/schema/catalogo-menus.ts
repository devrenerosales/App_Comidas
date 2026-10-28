/**
 * Dominio 2 — Catálogo y menús (M03, M04, M05, M06), incluida la importación histórica (M04).
 * Fuente: docs/02-diseno/modelo-datos.md §3.2 y §4.
 */
import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
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
  decisionPlatillo,
  decisionSemana,
  estadoAlertaPresupuesto,
  estadoImportacion,
  estadoMenu,
  formatoArchivo,
  hojaImportacion,
  magnitudUnidad,
  origenAlias,
  origenAsignacion,
  origenImportacion,
  origenMenu,
  proteinaPrincipal,
  tiempoComida,
  tipoProducto,
} from './enums';
import { hogar, ingredienteExcluido, marcaPreferida, usuario } from './hogar-config';
import { despensaItem, listaCompras, listaItem, listaItemOrigen } from './compras-despensa';
import { notificacionEnviada, precioResumen, productoSupermercado } from './precios-notificaciones';

// -----------------------------------------------------------------------------
// Catálogo global (D-05)
// -----------------------------------------------------------------------------

export const unidad = pgTable(
  'unidad',
  {
    id: id(),
    /** g, kg, lb, oz, ml, l, taza, cda, cdta, unidad, manojo, diente. */
    codigo: varchar('codigo', { length: 10 }).notNull(),
    nombre: varchar('nombre', { length: 30 }).notNull(),
    magnitud: magnitudUnidad('magnitud').notNull(),
    /** Equivalencia a la unidad base de su magnitud (g, ml, unidad); null = no convertible. */
    factorBase: decimal('factor_base', 14, 6),
    createdAt: creadoEn(),
  },
  (t) => [unico([t.codigo])],
);

export const categoria = pgTable(
  'categoria',
  {
    id: id(),
    codigo: varchar('codigo', { length: 20 }).notNull(),
    nombre: varchar('nombre', { length: 40 }).notNull(),
    orden: smallint('orden').notNull().default(0),
    createdAt: creadoEn(),
  },
  (t) => [unico([t.codigo])],
);

/** Catálogo GLOBAL de productos (D-05). Unidad de compra = empaque; presentación = contenido. */
export const producto = pgTable(
  'producto',
  {
    id: id(),
    nombre: varchar('nombre', { length: 80 }).notNull(),
    nombreNormalizado: varchar('nombre_normalizado', { length: 80 }).notNull(),
    tipo: tipoProducto('tipo').notNull(),
    categoriaId: uuid('categoria_id').notNull(),
    /** bolsa, lb, unidad, frasco, caja, botella... */
    unidadCompra: varchar('unidad_compra', { length: 20 }).notNull(),
    presentacionCantidad: decimal('presentacion_cantidad', 10, 3).notNull(),
    presentacionUnidadId: uuid('presentacion_unidad_id').notNull(),
    activo: boolean('activo').notNull().default(true),
    createdAt: creadoEn(),
    updatedAt: actualizadoEn(),
  },
  (t) => [
    // El nombre por convención excede 63 caracteres; se acorta.
    unico(
      [t.nombreNormalizado, t.presentacionCantidad, t.presentacionUnidadId],
      'producto_nombre_normalizado_presentacion_key',
    ),
    indice(t.tipo, t.categoriaId, t.activo),
    // Requiere pg_trgm (migración 0000_extensiones).
    index('producto_nombre_trgm_idx').using('gin', t.nombreNormalizado.op('gin_trgm_ops')),
    fk(t.categoriaId, categoria.id, 'restrict'),
    fk(t.presentacionUnidadId, unidad.id, 'restrict'),
  ],
);

/** Equivalencia de una unidad de receta de otra magnitud (p. ej. taza de arroz → lb). */
export const productoEquivalencia = pgTable(
  'producto_equivalencia',
  {
    id: id(),
    productoId: uuid('producto_id').notNull(),
    unidadId: uuid('unidad_id').notNull(),
    /** Cantidad en la unidad de presentación del producto que equivale a 1 unidad_id. */
    factor: decimal('factor', 14, 6).notNull(),
    createdAt: creadoEn(),
  },
  (t) => [
    unico([t.productoId, t.unidadId]),
    fk(t.productoId, producto.id, 'cascade'),
    fk(t.unidadId, unidad.id, 'restrict'),
  ],
);

// -----------------------------------------------------------------------------
// Platillos del hogar
// -----------------------------------------------------------------------------

/** Platillo del hogar (D-05). Sin borrado físico: activo=false (RF-11). */
export const platillo = pgTable(
  'platillo',
  {
    id: id(),
    hogarId: uuid('hogar_id').notNull(),
    nombre: varchar('nombre', { length: 80 }).notNull(),
    /** Minúsculas, sin tildes, espacios simples — único por hogar. */
    nombreNormalizado: varchar('nombre_normalizado', { length: 80 }).notNull(),
    proteinaPrincipal: proteinaPrincipal('proteina_principal').notNull().default('OTRA'),
    porcionesBase: smallint('porciones_base').notNull().default(4),
    activo: boolean('activo').notNull().default(true),
    favorito: boolean('favorito').notNull().default(false),
    /** true si no tiene ingredientes (sin costo estimado) — CU-03.2, CU-04.3. */
    incompleto: boolean('incompleto').notNull().default(true),
    calificacionPromedio: decimal('calificacion_promedio', 3, 2),
    calificacionConteo: integer('calificacion_conteo').notNull().default(0),
    createdAt: creadoEn(),
    updatedAt: actualizadoEn(),
  },
  (t) => [
    unico([t.hogarId, t.nombreNormalizado]),
    indice(t.hogarId, t.activo, t.proteinaPrincipal),
    index('platillo_nombre_trgm_idx').using('gin', t.nombreNormalizado.op('gin_trgm_ops')),
    fk(t.hogarId, hogar.id, 'cascade'),
  ],
);

export const platilloTiempo = pgTable(
  'platillo_tiempo',
  {
    platilloId: uuid('platillo_id').notNull(),
    tiempo: tiempoComida('tiempo').notNull(),
  },
  (t) => [
    primaryKey({ name: 'platillo_tiempo_pkey', columns: [t.platilloId, t.tiempo] }),
    indice(t.tiempo),
    fk(t.platilloId, platillo.id, 'cascade'),
  ],
);

export const etiqueta = pgTable(
  'etiqueta',
  {
    id: id(),
    hogarId: uuid('hogar_id').notNull(),
    nombre: varchar('nombre', { length: 30 }).notNull(),
    nombreNormalizado: varchar('nombre_normalizado', { length: 30 }).notNull(),
    createdAt: creadoEn(),
  },
  (t) => [unico([t.hogarId, t.nombreNormalizado]), fk(t.hogarId, hogar.id, 'cascade')],
);

export const platilloEtiqueta = pgTable(
  'platillo_etiqueta',
  {
    platilloId: uuid('platillo_id').notNull(),
    etiquetaId: uuid('etiqueta_id').notNull(),
  },
  (t) => [
    primaryKey({ name: 'platillo_etiqueta_pkey', columns: [t.platilloId, t.etiquetaId] }),
    indice(t.etiquetaId),
    fk(t.platilloId, platillo.id, 'cascade'),
    fk(t.etiquetaId, etiqueta.id, 'cascade'),
  ],
);

/** Nombres alternos que resuelven importaciones futuras sin preguntar (RF-17). */
export const platilloAlias = pgTable(
  'platillo_alias',
  {
    id: id(),
    hogarId: uuid('hogar_id').notNull(),
    platilloId: uuid('platillo_id').notNull(),
    alias: varchar('alias', { length: 80 }).notNull(),
    aliasNormalizado: varchar('alias_normalizado', { length: 80 }).notNull(),
    origen: origenAlias('origen').notNull().default('IMPORTACION'),
    createdAt: creadoEn(),
  },
  (t) => [
    unico([t.hogarId, t.aliasNormalizado]),
    indice(t.platilloId),
    fk(t.hogarId, hogar.id, 'cascade'),
    fk(t.platilloId, platillo.id, 'cascade'),
  ],
);

/** Ingrediente para porciones_base del platillo (RF-12). */
export const platilloIngrediente = pgTable(
  'platillo_ingrediente',
  {
    id: id(),
    platilloId: uuid('platillo_id').notNull(),
    productoId: uuid('producto_id').notNull(),
    cantidad: decimal('cantidad', 10, 3).notNull(),
    unidadId: uuid('unidad_id').notNull(),
    createdAt: creadoEn(),
    updatedAt: actualizadoEn(),
  },
  (t) => [
    unico([t.platilloId, t.productoId]),
    indice(t.productoId),
    fk(t.platilloId, platillo.id, 'cascade'),
    fk(t.productoId, producto.id, 'restrict'),
    fk(t.unidadId, unidad.id, 'restrict'),
  ],
);

// -----------------------------------------------------------------------------
// Menús
// -----------------------------------------------------------------------------

/**
 * Menú de una semana del hogar. Único por (hogar, fecha_inicio).
 * Al aprobar se congelan presupuesto, Σ factores y tiempos (D-04) y el exceso (D-03).
 */
export const menuSemanal = pgTable(
  'menu_semanal',
  {
    id: id(),
    hogarId: uuid('hogar_id').notNull(),
    fechaInicio: fecha('fecha_inicio').notNull(),
    fechaFin: fecha('fecha_fin').notNull(),
    /** Semana corta por cambio de día de inicio (CU-02.4). */
    esTransicion: boolean('es_transicion').notNull().default(false),
    estado: estadoMenu('estado').notNull().default('BORRADOR'),
    /** Borrador cuya configuración cambió (CU-02.3 5b); se ofrece regenerar. */
    desactualizado: boolean('desactualizado').notNull().default(false),
    origen: origenMenu('origen').notNull().default('MOTOR'),
    configuracionVersion: integer('configuracion_version'),
    presupuestoSemanal: dinero('presupuesto_semanal'),
    sumaFactoresPorcion: decimal('suma_factores_porcion', 5, 2),
    pesoPreferencia: decimal('peso_preferencia', 3, 2),
    pesoNovedad: decimal('peso_novedad', 3, 2),
    pesoAhorro: decimal('peso_ahorro', 3, 2),
    pesoAfinidad: decimal('peso_afinidad', 3, 2),
    costoEstimado: dinero('costo_estimado'),
    costoIncompleto: boolean('costo_incompleto').notNull().default(false),
    generadoEn: instante('generado_en'),
    aprobadoPorId: uuid('aprobado_por_id'),
    aprobadoEn: instante('aprobado_en'),
    /** RN-11 / D-03: exceso total al aprobar (null o 0 = dentro del presupuesto). */
    excesoAlAprobar: dinero('exceso_al_aprobar'),
    estadoAlertaPresupuesto: estadoAlertaPresupuesto('estado_alerta_presupuesto')
      .notNull()
      .default('NORMAL'),
    gastoReal: dinero('gasto_real'),
    notaGasto: varchar('nota_gasto', { length: 200 }),
    gastoRegistradoPorId: uuid('gasto_registrado_por_id'),
    gastoRegistradoEn: instante('gasto_registrado_en'),
    importacionId: uuid('importacion_id'),
    notas: varchar('notas', { length: 500 }),
    version: integer('version').notNull().default(1),
    createdAt: creadoEn(),
    updatedAt: actualizadoEn(),
  },
  (t) => [
    unico([t.hogarId, t.fechaInicio]),
    indice(t.hogarId, t.estado, t.fechaInicio),
    fk(t.hogarId, hogar.id, 'cascade'),
    fk(t.aprobadoPorId, usuario.id, 'set null'),
    fk(t.gastoRegistradoPorId, usuario.id, 'set null'),
    fk(t.importacionId, importacion.id, 'set null'),
  ],
);

/** Copia por tiempo de comida: % y presupuesto usados, costo y exceso (D-04, RN-05, RF-26). */
export const menuTiempo = pgTable(
  'menu_tiempo',
  {
    id: id(),
    menuId: uuid('menu_id').notNull(),
    tiempo: tiempoComida('tiempo').notNull(),
    porcentaje: decimal('porcentaje', 5, 2).notNull(),
    presupuesto: dinero('presupuesto').notNull(),
    costoEstimado: dinero('costo_estimado'),
    /** max(0, costo - presupuesto); > 0 muestra "Excede por Q__". */
    exceso: dinero('exceso').notNull().default('0'),
    intentosAjuste: smallint('intentos_ajuste').notNull().default(0),
    createdAt: creadoEn(),
    updatedAt: actualizadoEn(),
  },
  (t) => [unico([t.menuId, t.tiempo]), fk(t.menuId, menuSemanal.id, 'cascade')],
);

/** Espacio día × tiempo. platillo_id null = "Sin sugerencia" (CU-05.1 E3). */
export const menuDetalle = pgTable(
  'menu_detalle',
  {
    id: id(),
    menuId: uuid('menu_id').notNull(),
    fecha: fecha('fecha').notNull(),
    tiempo: tiempoComida('tiempo').notNull(),
    platilloId: uuid('platillo_id'),
    fijado: boolean('fijado').notNull().default(false),
    origen: origenAsignacion('origen').notNull().default('MOTOR'),
    puntaje: decimal('puntaje', 6, 4),
    factorPreferencia: decimal('factor_preferencia', 5, 4),
    factorNovedad: decimal('factor_novedad', 5, 4),
    factorAhorro: decimal('factor_ahorro', 5, 4),
    factorAfinidad: decimal('factor_afinidad', 5, 4),
    costoEstimado: dinero('costo_estimado'),
    costoIncompleto: boolean('costo_incompleto').notNull().default(false),
    /** Códigos de reglas aplicadas: REEMPLAZO_PRESUPUESTO, RN02_CONFIRMADA, RN03_CONFIRMADA... */
    reglasAplicadas: text('reglas_aplicadas')
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    notas: varchar('notas', { length: 200 }),
    modificadoPorId: uuid('modificado_por_id'),
    modificadoEn: instante('modificado_en'),
    createdAt: creadoEn(),
    updatedAt: actualizadoEn(),
  },
  (t) => [
    unico([t.menuId, t.fecha, t.tiempo]),
    indice(t.platilloId, t.fecha),
    fk(t.menuId, menuSemanal.id, 'cascade'),
    fk(t.platilloId, platillo.id, 'restrict'),
    fk(t.modificadoPorId, usuario.id, 'set null'),
  ],
);

/** Alternativas ya mostradas para un espacio en Borrador (RF-23). */
export const menuAlternativaMostrada = pgTable(
  'menu_alternativa_mostrada',
  {
    id: id(),
    menuDetalleId: uuid('menu_detalle_id').notNull(),
    platilloId: uuid('platillo_id').notNull(),
    createdAt: creadoEn(),
  },
  (t) => [
    unico([t.menuDetalleId, t.platilloId]),
    fk(t.menuDetalleId, menuDetalle.id, 'cascade'),
    fk(t.platilloId, platillo.id, 'cascade'),
  ],
);

/** Una calificación por espacio; la última reemplaza (RF-14). */
export const calificacion = pgTable(
  'calificacion',
  {
    id: id(),
    menuDetalleId: uuid('menu_detalle_id').notNull(),
    platilloId: uuid('platillo_id').notNull(),
    valor: smallint('valor').notNull(),
    usuarioId: uuid('usuario_id'),
    createdAt: creadoEn(),
    updatedAt: actualizadoEn(),
  },
  (t) => [
    unico([t.menuDetalleId]),
    indice(t.platilloId),
    fk(t.menuDetalleId, menuDetalle.id, 'cascade'),
    fk(t.platilloId, platillo.id, 'cascade'),
    fk(t.usuarioId, usuario.id, 'set null'),
  ],
);

// -----------------------------------------------------------------------------
// Importación histórica (M04)
// -----------------------------------------------------------------------------

export const importacion = pgTable(
  'importacion',
  {
    id: id(),
    hogarId: uuid('hogar_id').notNull(),
    usuarioId: uuid('usuario_id'),
    origen: origenImportacion('origen').notNull().default('ARCHIVO'),
    nombreArchivo: varchar('nombre_archivo', { length: 200 }).notNull(),
    formato: formatoArchivo('formato').notNull(),
    tamanoBytes: integer('tamano_bytes').notNull(),
    estado: estadoImportacion('estado').notNull(),
    totalFilas: integer('total_filas').notNull().default(0),
    filasConError: integer('filas_con_error').notNull().default(0),
    /** Reporte final: semanas creadas/reemplazadas/omitidas, platillos creados, conciliación. */
    reporte: jsonb('reporte'),
    confirmadaEn: instante('confirmada_en'),
    createdAt: creadoEn(),
    updatedAt: actualizadoEn(),
  },
  (t) => [
    indice(t.hogarId, t.createdAt),
    fk(t.hogarId, hogar.id, 'cascade'),
    fk(t.usuarioId, usuario.id, 'set null'),
  ],
);

export const importacionFila = pgTable(
  'importacion_fila',
  {
    id: id(),
    importacionId: uuid('importacion_id').notNull(),
    hoja: hojaImportacion('hoja').notNull(),
    numeroFila: integer('numero_fila').notNull(),
    datos: jsonb('datos').notNull(),
    /** [{columna, motivo}] */
    errores: jsonb('errores'),
    valida: boolean('valida').notNull(),
    semanaInicio: fecha('semana_inicio'),
  },
  (t) => [
    unico([t.importacionId, t.hoja, t.numeroFila]),
    fk(t.importacionId, importacion.id, 'cascade'),
  ],
);

/** Decisión por nombre distinto de platillo del archivo (RF-17). */
export const importacionPlatillo = pgTable(
  'importacion_platillo',
  {
    id: id(),
    importacionId: uuid('importacion_id').notNull(),
    nombreOriginal: varchar('nombre_original', { length: 80 }).notNull(),
    nombreNormalizado: varchar('nombre_normalizado', { length: 80 }).notNull(),
    platilloSugeridoId: uuid('platillo_sugerido_id'),
    similitud: decimal('similitud', 5, 4),
    decision: decisionPlatillo('decision').notNull().default('PENDIENTE'),
    platilloId: uuid('platillo_id'),
    /** Nombre corregido al crear (CU-04.3 5b). */
    nombreFinal: varchar('nombre_final', { length: 80 }),
    proteinaPrincipal: proteinaPrincipal('proteina_principal'),
  },
  (t) => [
    unico([t.importacionId, t.nombreNormalizado]),
    fk(t.importacionId, importacion.id, 'cascade'),
    fk(t.platilloSugeridoId, platillo.id, 'set null'),
    fk(t.platilloId, platillo.id, 'set null'),
  ],
);

export const importacionSemana = pgTable(
  'importacion_semana',
  {
    id: id(),
    importacionId: uuid('importacion_id').notNull(),
    semanaInicio: fecha('semana_inicio').notNull(),
    yaExiste: boolean('ya_existe').notNull().default(false),
    decision: decisionSemana('decision').notNull().default('CREAR'),
    gastoSemana: dinero('gasto_semana'),
  },
  (t) => [unico([t.importacionId, t.semanaInicio]), fk(t.importacionId, importacion.id, 'cascade')],
);

// -----------------------------------------------------------------------------
// Relaciones
// -----------------------------------------------------------------------------

export const unidadRelaciones = relations(unidad, ({ many }) => ({
  productosPresentacion: many(producto),
  vinculosPresentacion: many(productoSupermercado),
  ingredientes: many(platilloIngrediente),
  equivalencias: many(productoEquivalencia),
  itemsLista: many(listaItem),
}));

export const categoriaRelaciones = relations(categoria, ({ many }) => ({
  productos: many(producto),
}));

export const productoRelaciones = relations(producto, ({ one, many }) => ({
  categoria: one(categoria, { fields: [producto.categoriaId], references: [categoria.id] }),
  presentacionUnidad: one(unidad, {
    fields: [producto.presentacionUnidadId],
    references: [unidad.id],
  }),
  equivalencias: many(productoEquivalencia),
  ingredientes: many(platilloIngrediente),
  vinculos: many(productoSupermercado),
  resumenesPrecio: many(precioResumen),
  despensa: many(despensaItem),
  itemsLista: many(listaItem),
  marcasPreferidas: many(marcaPreferida),
  excluidoEn: many(ingredienteExcluido),
}));

export const productoEquivalenciaRelaciones = relations(productoEquivalencia, ({ one }) => ({
  producto: one(producto, {
    fields: [productoEquivalencia.productoId],
    references: [producto.id],
  }),
  unidad: one(unidad, { fields: [productoEquivalencia.unidadId], references: [unidad.id] }),
}));

export const platilloRelaciones = relations(platillo, ({ one, many }) => ({
  hogar: one(hogar, { fields: [platillo.hogarId], references: [hogar.id] }),
  tiempos: many(platilloTiempo),
  etiquetas: many(platilloEtiqueta),
  aliases: many(platilloAlias),
  ingredientes: many(platilloIngrediente),
  asignaciones: many(menuDetalle),
  alternativasMostradas: many(menuAlternativaMostrada),
  calificaciones: many(calificacion),
  decisionesImportacion: many(importacionPlatillo, {
    relationName: 'decision_platillo_destino',
  }),
  sugerenciasImportacion: many(importacionPlatillo, {
    relationName: 'decision_platillo_sugerido',
  }),
}));

export const platilloTiempoRelaciones = relations(platilloTiempo, ({ one }) => ({
  platillo: one(platillo, { fields: [platilloTiempo.platilloId], references: [platillo.id] }),
}));

export const etiquetaRelaciones = relations(etiqueta, ({ one, many }) => ({
  hogar: one(hogar, { fields: [etiqueta.hogarId], references: [hogar.id] }),
  platillos: many(platilloEtiqueta),
}));

export const platilloEtiquetaRelaciones = relations(platilloEtiqueta, ({ one }) => ({
  platillo: one(platillo, { fields: [platilloEtiqueta.platilloId], references: [platillo.id] }),
  etiqueta: one(etiqueta, { fields: [platilloEtiqueta.etiquetaId], references: [etiqueta.id] }),
}));

export const platilloAliasRelaciones = relations(platilloAlias, ({ one }) => ({
  hogar: one(hogar, { fields: [platilloAlias.hogarId], references: [hogar.id] }),
  platillo: one(platillo, { fields: [platilloAlias.platilloId], references: [platillo.id] }),
}));

export const platilloIngredienteRelaciones = relations(platilloIngrediente, ({ one }) => ({
  platillo: one(platillo, {
    fields: [platilloIngrediente.platilloId],
    references: [platillo.id],
  }),
  producto: one(producto, {
    fields: [platilloIngrediente.productoId],
    references: [producto.id],
  }),
  unidad: one(unidad, { fields: [platilloIngrediente.unidadId], references: [unidad.id] }),
}));

export const menuSemanalRelaciones = relations(menuSemanal, ({ one, many }) => ({
  hogar: one(hogar, { fields: [menuSemanal.hogarId], references: [hogar.id] }),
  aprobadoPor: one(usuario, {
    fields: [menuSemanal.aprobadoPorId],
    references: [usuario.id],
    relationName: 'menu_aprobado_por',
  }),
  gastoRegistradoPor: one(usuario, {
    fields: [menuSemanal.gastoRegistradoPorId],
    references: [usuario.id],
    relationName: 'menu_gasto_registrado_por',
  }),
  importacion: one(importacion, {
    fields: [menuSemanal.importacionId],
    references: [importacion.id],
  }),
  tiempos: many(menuTiempo),
  detalles: many(menuDetalle),
  lista: one(listaCompras),
  notificaciones: many(notificacionEnviada),
}));

export const menuTiempoRelaciones = relations(menuTiempo, ({ one }) => ({
  menu: one(menuSemanal, { fields: [menuTiempo.menuId], references: [menuSemanal.id] }),
}));

export const menuDetalleRelaciones = relations(menuDetalle, ({ one, many }) => ({
  menu: one(menuSemanal, { fields: [menuDetalle.menuId], references: [menuSemanal.id] }),
  platillo: one(platillo, { fields: [menuDetalle.platilloId], references: [platillo.id] }),
  modificadoPor: one(usuario, {
    fields: [menuDetalle.modificadoPorId],
    references: [usuario.id],
  }),
  calificacion: one(calificacion),
  alternativasMostradas: many(menuAlternativaMostrada),
  itemsLista: many(listaItemOrigen),
}));

export const menuAlternativaMostradaRelaciones = relations(menuAlternativaMostrada, ({ one }) => ({
  menuDetalle: one(menuDetalle, {
    fields: [menuAlternativaMostrada.menuDetalleId],
    references: [menuDetalle.id],
  }),
  platillo: one(platillo, {
    fields: [menuAlternativaMostrada.platilloId],
    references: [platillo.id],
  }),
}));

export const calificacionRelaciones = relations(calificacion, ({ one }) => ({
  menuDetalle: one(menuDetalle, {
    fields: [calificacion.menuDetalleId],
    references: [menuDetalle.id],
  }),
  platillo: one(platillo, { fields: [calificacion.platilloId], references: [platillo.id] }),
  usuario: one(usuario, { fields: [calificacion.usuarioId], references: [usuario.id] }),
}));

export const importacionRelaciones = relations(importacion, ({ one, many }) => ({
  hogar: one(hogar, { fields: [importacion.hogarId], references: [hogar.id] }),
  usuario: one(usuario, { fields: [importacion.usuarioId], references: [usuario.id] }),
  filas: many(importacionFila),
  platillos: many(importacionPlatillo),
  semanas: many(importacionSemana),
  menus: many(menuSemanal),
}));

export const importacionFilaRelaciones = relations(importacionFila, ({ one }) => ({
  importacion: one(importacion, {
    fields: [importacionFila.importacionId],
    references: [importacion.id],
  }),
}));

export const importacionPlatilloRelaciones = relations(importacionPlatillo, ({ one }) => ({
  importacion: one(importacion, {
    fields: [importacionPlatillo.importacionId],
    references: [importacion.id],
  }),
  platilloSugerido: one(platillo, {
    fields: [importacionPlatillo.platilloSugeridoId],
    references: [platillo.id],
    relationName: 'decision_platillo_sugerido',
  }),
  platillo: one(platillo, {
    fields: [importacionPlatillo.platilloId],
    references: [platillo.id],
    relationName: 'decision_platillo_destino',
  }),
}));

export const importacionSemanaRelaciones = relations(importacionSemana, ({ one }) => ({
  importacion: one(importacion, {
    fields: [importacionSemana.importacionId],
    references: [importacion.id],
  }),
}));
