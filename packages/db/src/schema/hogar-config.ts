/**
 * Dominio 1 — Hogar, cuenta y configuración (M01, M02, M10) + idempotencia de la API.
 * Fuente: docs/02-diseno/modelo-datos.md §3.1 y §4.
 */
import { relations } from 'drizzle-orm';
import {
  boolean,
  char,
  integer,
  jsonb,
  pgTable,
  smallint,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { actualizadoEn, creadoEn, decimal, dinero, fk, id, indice, instante, unico } from './comun';
import { diaSemana, medioInvitacion, rolHogar, tiempoComida, tipoComensal } from './enums';
import {
  calificacion,
  etiqueta,
  importacion,
  menuDetalle,
  menuSemanal,
  platillo,
  platilloAlias,
  producto,
} from './catalogo-menus';
import { despensaItem, listaCompras, listaItem, syncCambio } from './compras-despensa';
import {
  aviso,
  notificacionEnviada,
  precio,
  precioResumen,
  productoSupermercado,
  supermercado,
  suscripcionPush,
  ticket,
} from './precios-notificaciones';

// -----------------------------------------------------------------------------
// Tablas
// -----------------------------------------------------------------------------

export const usuario = pgTable(
  'usuario',
  {
    id: id(),
    nombre: varchar('nombre', { length: 80 }).notNull(),
    /** Guardado en minúsculas y sin espacios; único global (RF-01). */
    correo: varchar('correo', { length: 254 }).notNull(),
    hashContrasena: varchar('hash_contrasena', { length: 255 }).notNull(),
    intentosFallidos: smallint('intentos_fallidos').notNull().default(0),
    primerIntentoFallidoEn: instante('primer_intento_fallido_en'),
    bloqueadoHasta: instante('bloqueado_hasta'),
    /** Tokens de acceso emitidos antes de esta marca se rechazan (CU-01.4). */
    sesionesInvalidasAntesDe: instante('sesiones_invalidas_antes_de'),
    /** Puede cambiar datos globales: permiso de extracción por sitio (D-07). */
    esAdminSistema: boolean('es_admin_sistema').notNull().default(false),
    activo: boolean('activo').notNull().default(true),
    createdAt: creadoEn(),
    updatedAt: actualizadoEn(),
  },
  (t) => [unico([t.correo])],
);

export const hogar = pgTable('hogar', {
  id: id(),
  nombre: varchar('nombre', { length: 80 }).notNull(),
  createdAt: creadoEn(),
  updatedAt: actualizadoEn(),
});

/** Pertenencia usuario-hogar con rol. usuario_id único: un hogar por usuario en v1 (DM-01). */
export const miembroHogar = pgTable(
  'miembro_hogar',
  {
    id: id(),
    hogarId: uuid('hogar_id').notNull(),
    usuarioId: uuid('usuario_id').notNull(),
    rol: rolHogar('rol').notNull().default('MIEMBRO'),
    createdAt: creadoEn(),
    updatedAt: actualizadoEn(),
  },
  (t) => [
    unico([t.usuarioId]),
    indice(t.hogarId, t.rol),
    fk(t.hogarId, hogar.id, 'cascade'),
    fk(t.usuarioId, usuario.id, 'cascade'),
  ],
);

export const invitacion = pgTable(
  'invitacion',
  {
    id: id(),
    hogarId: uuid('hogar_id').notNull(),
    creadaPorId: uuid('creada_por_id').notNull(),
    medio: medioInvitacion('medio').notNull(),
    correo: varchar('correo', { length: 254 }),
    /** SHA-256 del token; el token plano solo viaja en el enlace. */
    tokenHash: char('token_hash', { length: 64 }).notNull(),
    venceEn: instante('vence_en').notNull(),
    usadaEn: instante('usada_en'),
    usadaPorId: uuid('usada_por_id'),
    revocadaEn: instante('revocada_en'),
    correoEnviado: boolean('correo_enviado').notNull().default(false),
    createdAt: creadoEn(),
    updatedAt: actualizadoEn(),
  },
  (t) => [
    unico([t.tokenHash]),
    indice(t.hogarId, t.venceEn),
    fk(t.hogarId, hogar.id, 'cascade'),
    fk(t.creadaPorId, usuario.id, 'cascade'),
    fk(t.usadaPorId, usuario.id, 'set null'),
  ],
);

export const tokenRecuperacion = pgTable(
  'token_recuperacion',
  {
    id: id(),
    usuarioId: uuid('usuario_id').notNull(),
    tokenHash: char('token_hash', { length: 64 }).notNull(),
    venceEn: instante('vence_en').notNull(),
    usadoEn: instante('usado_en'),
    createdAt: creadoEn(),
  },
  (t) => [unico([t.tokenHash]), indice(t.usuarioId), fk(t.usuarioId, usuario.id, 'cascade')],
);

/** Refresh token rotativo; `familia` agrupa una cadena de rotaciones para detectar reutilización. */
export const refreshToken = pgTable(
  'refresh_token',
  {
    id: id(),
    usuarioId: uuid('usuario_id').notNull(),
    tokenHash: char('token_hash', { length: 64 }).notNull(),
    familia: uuid('familia').notNull(),
    dispositivo: varchar('dispositivo', { length: 120 }),
    venceEn: instante('vence_en').notNull(),
    revocadoEn: instante('revocado_en'),
    reemplazadoPorId: uuid('reemplazado_por_id'),
    createdAt: creadoEn(),
  },
  (t) => [
    unico([t.tokenHash]),
    unico([t.reemplazadoPorId]),
    indice(t.usuarioId, t.revocadoEn),
    indice(t.familia),
    fk(t.usuarioId, usuario.id, 'cascade'),
    fk(t.reemplazadoPorId, t.id, 'set null'),
  ],
);

export const comensal = pgTable(
  'comensal',
  {
    id: id(),
    hogarId: uuid('hogar_id').notNull(),
    nombre: varchar('nombre', { length: 60 }).notNull(),
    nombreNormalizado: varchar('nombre_normalizado', { length: 60 }).notNull(),
    tipo: tipoComensal('tipo').notNull(),
    /** D-02 / RN-07: 0.25 a 2.00 en pasos de 0.25 (CHECK en 0002). */
    factorPorcion: decimal('factor_porcion', 3, 2).notNull().default('1.00'),
    activo: boolean('activo').notNull().default(true),
    createdAt: creadoEn(),
    updatedAt: actualizadoEn(),
  },
  (t) => [
    unico([t.hogarId, t.nombreNormalizado]),
    indice(t.hogarId, t.activo),
    fk(t.hogarId, hogar.id, 'cascade'),
  ],
);

/** Configuración vigente del hogar (1:1). `version` = bloqueo optimista (CU-02.3 E1). */
export const configuracion = pgTable(
  'configuracion',
  {
    id: id(),
    hogarId: uuid('hogar_id').notNull(),
    presupuestoSemanal: dinero('presupuesto_semanal').notNull().default('250.00'),
    diaInicioSemana: diaSemana('dia_inicio_semana').notNull().default('DOMINGO'),
    diaPlanificacion: diaSemana('dia_planificacion').notNull().default('DOMINGO'),
    /** Hora local America/Guatemala (0-23) del recordatorio (D-08). */
    horaPlanificacion: smallint('hora_planificacion').notNull().default(8),
    pesoPreferencia: decimal('peso_preferencia', 3, 2).notNull().default('0.40'),
    pesoNovedad: decimal('peso_novedad', 3, 2).notNull().default('0.25'),
    pesoAhorro: decimal('peso_ahorro', 3, 2).notNull().default('0.20'),
    pesoAfinidad: decimal('peso_afinidad', 3, 2).notNull().default('0.15'),
    /** Umbral de similitud para proponer asociación en importación (CU-04.3). */
    umbralSimilitud: decimal('umbral_similitud', 3, 2).notNull().default('0.80'),
    version: integer('version').notNull().default(1),
    actualizadoPorId: uuid('actualizado_por_id'),
    createdAt: creadoEn(),
    updatedAt: actualizadoEn(),
  },
  (t) => [
    unico([t.hogarId]),
    fk(t.hogarId, hogar.id, 'cascade'),
    fk(t.actualizadoPorId, usuario.id, 'set null'),
  ],
);

/** Siempre 3 filas por configuración; inactivas con porcentaje 0 (RF-05, RF-06, RN-06). */
export const tiempoComidaConfig = pgTable(
  'tiempo_comida_config',
  {
    id: id(),
    configuracionId: uuid('configuracion_id').notNull(),
    tiempo: tiempoComida('tiempo').notNull(),
    activo: boolean('activo').notNull().default(false),
    porcentaje: decimal('porcentaje', 5, 2).notNull().default('0'),
    createdAt: creadoEn(),
    updatedAt: actualizadoEn(),
  },
  (t) => [unico([t.configuracionId, t.tiempo]), fk(t.configuracionId, configuracion.id, 'cascade')],
);

/** Supermercados preferidos del hogar (RF-09). Al menos uno preferido. */
export const hogarSupermercado = pgTable(
  'hogar_supermercado',
  {
    id: id(),
    hogarId: uuid('hogar_id').notNull(),
    supermercadoId: uuid('supermercado_id').notNull(),
    preferido: boolean('preferido').notNull().default(true),
    createdAt: creadoEn(),
    updatedAt: actualizadoEn(),
  },
  (t) => [
    unico([t.hogarId, t.supermercadoId]),
    fk(t.hogarId, hogar.id, 'cascade'),
    fk(t.supermercadoId, supermercado.id, 'restrict'),
  ],
);

/** Marca preferida por producto (RF-09); se compara con producto_supermercado.marca_normalizada. */
export const marcaPreferida = pgTable(
  'marca_preferida',
  {
    id: id(),
    hogarId: uuid('hogar_id').notNull(),
    productoId: uuid('producto_id').notNull(),
    marca: varchar('marca', { length: 60 }).notNull(),
    marcaNormalizada: varchar('marca_normalizada', { length: 60 }).notNull(),
    createdAt: creadoEn(),
    updatedAt: actualizadoEn(),
  },
  (t) => [
    unico([t.hogarId, t.productoId]),
    fk(t.hogarId, hogar.id, 'cascade'),
    fk(t.productoId, producto.id, 'cascade'),
  ],
);

/** Ingredientes que el hogar no come (RF-10); prevalece sobre favorito. */
export const ingredienteExcluido = pgTable(
  'ingrediente_excluido',
  {
    id: id(),
    hogarId: uuid('hogar_id').notNull(),
    productoId: uuid('producto_id').notNull(),
    createdAt: creadoEn(),
  },
  (t) => [
    unico([t.hogarId, t.productoId]),
    fk(t.hogarId, hogar.id, 'cascade'),
    fk(t.productoId, producto.id, 'cascade'),
  ],
);

/** Cabecera Idempotency-Key de POST/PUT reintentables (offline). Vence a las 24 h. */
export const claveIdempotencia = pgTable(
  'clave_idempotencia',
  {
    id: id(),
    usuarioId: uuid('usuario_id').notNull(),
    clave: varchar('clave', { length: 64 }).notNull(),
    metodo: varchar('metodo', { length: 7 }).notNull(),
    ruta: varchar('ruta', { length: 200 }).notNull(),
    hashSolicitud: char('hash_solicitud', { length: 64 }).notNull(),
    estadoRespuesta: smallint('estado_respuesta').notNull(),
    cuerpoRespuesta: jsonb('cuerpo_respuesta'),
    venceEn: instante('vence_en').notNull(),
    createdAt: creadoEn(),
  },
  (t) => [unico([t.usuarioId, t.clave]), indice(t.venceEn), fk(t.usuarioId, usuario.id, 'cascade')],
);

// -----------------------------------------------------------------------------
// Relaciones (consultas relacionales `db.query.*`; no generan SQL)
// -----------------------------------------------------------------------------

export const usuarioRelaciones = relations(usuario, ({ one, many }) => ({
  membresia: one(miembroHogar),
  invitacionesCreadas: many(invitacion, { relationName: 'invitacion_creada_por' }),
  invitacionesUsadas: many(invitacion, { relationName: 'invitacion_usada_por' }),
  tokensRecuperacion: many(tokenRecuperacion),
  refreshTokens: many(refreshToken),
  configuracionesEditadas: many(configuracion),
  menusAprobados: many(menuSemanal, { relationName: 'menu_aprobado_por' }),
  gastosRegistrados: many(menuSemanal, { relationName: 'menu_gasto_registrado_por' }),
  detallesModificados: many(menuDetalle),
  calificaciones: many(calificacion),
  itemsComprados: many(listaItem),
  cambiosSync: many(syncCambio),
  preciosRegistrados: many(precio),
  tickets: many(ticket),
  vinculosCreados: many(productoSupermercado),
  supermercadosRevisados: many(supermercado),
  suscripcionesPush: many(suscripcionPush),
  avisosLeidos: many(aviso),
  importaciones: many(importacion),
  clavesIdempotencia: many(claveIdempotencia),
}));

export const hogarRelaciones = relations(hogar, ({ one, many }) => ({
  miembros: many(miembroHogar),
  invitaciones: many(invitacion),
  comensales: many(comensal),
  configuracion: one(configuracion),
  supermercados: many(hogarSupermercado),
  marcasPreferidas: many(marcaPreferida),
  ingredientesExcluidos: many(ingredienteExcluido),
  platillos: many(platillo),
  etiquetas: many(etiqueta),
  aliases: many(platilloAlias),
  menus: many(menuSemanal),
  listas: many(listaCompras),
  despensa: many(despensaItem),
  precios: many(precio),
  resumenesPrecio: many(precioResumen),
  tickets: many(ticket),
  vinculosCreados: many(productoSupermercado),
  avisos: many(aviso),
  notificaciones: many(notificacionEnviada),
  importaciones: many(importacion),
}));

export const miembroHogarRelaciones = relations(miembroHogar, ({ one }) => ({
  hogar: one(hogar, { fields: [miembroHogar.hogarId], references: [hogar.id] }),
  usuario: one(usuario, { fields: [miembroHogar.usuarioId], references: [usuario.id] }),
}));

export const invitacionRelaciones = relations(invitacion, ({ one }) => ({
  hogar: one(hogar, { fields: [invitacion.hogarId], references: [hogar.id] }),
  creadaPor: one(usuario, {
    fields: [invitacion.creadaPorId],
    references: [usuario.id],
    relationName: 'invitacion_creada_por',
  }),
  usadaPor: one(usuario, {
    fields: [invitacion.usadaPorId],
    references: [usuario.id],
    relationName: 'invitacion_usada_por',
  }),
}));

export const tokenRecuperacionRelaciones = relations(tokenRecuperacion, ({ one }) => ({
  usuario: one(usuario, { fields: [tokenRecuperacion.usuarioId], references: [usuario.id] }),
}));

export const refreshTokenRelaciones = relations(refreshToken, ({ one, many }) => ({
  usuario: one(usuario, { fields: [refreshToken.usuarioId], references: [usuario.id] }),
  reemplazadoPor: one(refreshToken, {
    fields: [refreshToken.reemplazadoPorId],
    references: [refreshToken.id],
    relationName: 'rotacion_refresh',
  }),
  // Lado inverso de la rotación. Drizzle no admite `one()` inverso con nombre sobre la misma
  // tabla; se modela como `many` (a lo sumo 1 fila por el índice único de reemplazado_por_id).
  reemplazaA: many(refreshToken, { relationName: 'rotacion_refresh' }),
}));

export const comensalRelaciones = relations(comensal, ({ one }) => ({
  hogar: one(hogar, { fields: [comensal.hogarId], references: [hogar.id] }),
}));

export const configuracionRelaciones = relations(configuracion, ({ one, many }) => ({
  hogar: one(hogar, { fields: [configuracion.hogarId], references: [hogar.id] }),
  actualizadoPor: one(usuario, {
    fields: [configuracion.actualizadoPorId],
    references: [usuario.id],
  }),
  tiempos: many(tiempoComidaConfig),
}));

export const tiempoComidaConfigRelaciones = relations(tiempoComidaConfig, ({ one }) => ({
  configuracion: one(configuracion, {
    fields: [tiempoComidaConfig.configuracionId],
    references: [configuracion.id],
  }),
}));

export const hogarSupermercadoRelaciones = relations(hogarSupermercado, ({ one }) => ({
  hogar: one(hogar, { fields: [hogarSupermercado.hogarId], references: [hogar.id] }),
  supermercado: one(supermercado, {
    fields: [hogarSupermercado.supermercadoId],
    references: [supermercado.id],
  }),
}));

export const marcaPreferidaRelaciones = relations(marcaPreferida, ({ one }) => ({
  hogar: one(hogar, { fields: [marcaPreferida.hogarId], references: [hogar.id] }),
  producto: one(producto, { fields: [marcaPreferida.productoId], references: [producto.id] }),
}));

export const ingredienteExcluidoRelaciones = relations(ingredienteExcluido, ({ one }) => ({
  hogar: one(hogar, { fields: [ingredienteExcluido.hogarId], references: [hogar.id] }),
  producto: one(producto, {
    fields: [ingredienteExcluido.productoId],
    references: [producto.id],
  }),
}));

export const claveIdempotenciaRelaciones = relations(claveIdempotencia, ({ one }) => ({
  usuario: one(usuario, { fields: [claveIdempotencia.usuarioId], references: [usuario.id] }),
}));
