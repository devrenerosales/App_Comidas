/**
 * Dominio 4 — Precios y notificaciones (M08, M10).
 * Fuente: docs/02-diseno/modelo-datos.md §3.4 y §4.
 */
import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
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
  canalPush,
  disparoCorrida,
  estadoCorrida,
  estadoCorridaSitio,
  estadoLineaTicket,
  estadoTicket,
  origenPrecio,
  resultadoEnvio,
  tipoAviso,
  tipoErrorExtraccion,
  tipoNotificacion,
} from './enums';
import { hogar, hogarSupermercado, usuario } from './hogar-config';
import { menuSemanal, producto, unidad } from './catalogo-menus';

/** Catálogo global. extraccion_permitida apagada por defecto (D-07, PA-02, R-03). */
export const supermercado = pgTable(
  'supermercado',
  {
    id: id(),
    codigo: varchar('codigo', { length: 20 }).notNull(),
    nombre: varchar('nombre', { length: 40 }).notNull(),
    /** Dominio para validar URLs de vínculos; null = sin sitio consultable. */
    dominio: varchar('dominio', { length: 100 }),
    /** Tiene extractor implementado (Walmart, Paiz; La Torre fase 2). */
    soportaExtraccion: boolean('soporta_extraccion').notNull().default(false),
    /** Sitio habilitado para corridas (fase). */
    habilitado: boolean('habilitado').notNull().default(false),
    /** Permiso tras revisar términos de uso (D-07). */
    extraccionPermitida: boolean('extraccion_permitida').notNull().default(false),
    permisoRevisadoPorId: uuid('permiso_revisado_por_id'),
    permisoRevisadoEn: instante('permiso_revisado_en'),
    notaTerminos: varchar('nota_terminos', { length: 500 }),
    solicitudesPorSegundo: decimal('solicitudes_por_segundo', 4, 2).notNull().default('1.00'),
    activo: boolean('activo').notNull().default(true),
    createdAt: creadoEn(),
    updatedAt: actualizadoEn(),
  },
  (t) => [unico([t.codigo]), fk(t.permisoRevisadoPorId, usuario.id, 'set null')],
);

/**
 * Vínculo global producto ↔ producto en tienda (RF-35).
 * Máx. 1 activo por (producto, supermercado): índice parcial en la migración 0002.
 */
export const productoSupermercado = pgTable(
  'producto_supermercado',
  {
    id: id(),
    productoId: uuid('producto_id').notNull(),
    supermercadoId: uuid('supermercado_id').notNull(),
    nombreTienda: varchar('nombre_tienda', { length: 150 }).notNull(),
    marca: varchar('marca', { length: 60 }),
    marcaNormalizada: varchar('marca_normalizada', { length: 60 }),
    presentacionCantidad: decimal('presentacion_cantidad', 10, 3).notNull(),
    presentacionUnidadId: uuid('presentacion_unidad_id').notNull(),
    /** Presentación en tienda ÷ presentación de compra del catálogo; precio_normalizado = precio ÷ factor. */
    factor: decimal('factor', 12, 6).notNull(),
    url: varchar('url', { length: 500 }),
    sku: varchar('sku', { length: 60 }),
    activo: boolean('activo').notNull().default(true),
    inactivadoEn: instante('inactivado_en'),
    creadoPorHogarId: uuid('creado_por_hogar_id'),
    creadoPorUsuarioId: uuid('creado_por_usuario_id'),
    createdAt: creadoEn(),
    updatedAt: actualizadoEn(),
  },
  (t) => [
    indice(t.productoId, t.supermercadoId, t.activo),
    indice(t.supermercadoId, t.activo),
    fk(t.productoId, producto.id, 'restrict'),
    fk(t.supermercadoId, supermercado.id, 'restrict'),
    fk(t.presentacionUnidadId, unidad.id, 'restrict'),
    fk(t.creadoPorHogarId, hogar.id, 'set null'),
    fk(t.creadoPorUsuarioId, usuario.id, 'set null'),
  ],
);

/** Histórico de precios (RF-37). hogar_id solo en MANUAL/TICKET (D-05) — CHECK en 0002. */
export const precio = pgTable(
  'precio',
  {
    id: id(),
    productoSupermercadoId: uuid('producto_supermercado_id').notNull(),
    origen: origenPrecio('origen').notNull(),
    hogarId: uuid('hogar_id'),
    /** Precio de la presentación en tienda. */
    precio: dinero('precio').notNull(),
    /** precio ÷ factor del vínculo, redondeado a centavos (half-up). */
    precioNormalizado: dinero('precio_normalizado').notNull(),
    fechaPrecio: fecha('fecha_precio').notNull(),
    corridaId: uuid('corrida_id'),
    ticketLineaId: uuid('ticket_linea_id'),
    registradoPorId: uuid('registrado_por_id'),
    createdAt: creadoEn(),
  },
  (t) => [
    unico([t.ticketLineaId]),
    index('precio_producto_supermercado_id_fecha_precio_idx').on(
      t.productoSupermercadoId,
      t.fechaPrecio.desc(),
    ),
    indice(t.hogarId, t.fechaPrecio),
    indice(t.corridaId),
    fk(t.productoSupermercadoId, productoSupermercado.id, 'restrict'),
    fk(t.hogarId, hogar.id, 'cascade'),
    fk(t.corridaId, corrida.id, 'restrict'),
    fk(t.ticketLineaId, ticketLinea.id, 'restrict'),
    fk(t.registradoPorId, usuario.id, 'set null'),
  ],
);

/** Resumen por (producto, hogar): mediana con todos los supermercados, mínimo con preferidos (RF-36, RN-08). */
export const precioResumen = pgTable(
  'precio_resumen',
  {
    id: id(),
    productoId: uuid('producto_id').notNull(),
    hogarId: uuid('hogar_id').notNull(),
    precioMediana: dinero('precio_mediana').notNull(),
    precioMinimo: dinero('precio_minimo').notNull(),
    supermercadoMinimoId: uuid('supermercado_minimo_id').notNull(),
    fechaPrecioMinimo: fecha('fecha_precio_minimo').notNull(),
    cantidadPrecios: smallint('cantidad_precios').notNull(),
    /** Ningún precio con antigüedad ≤ 14 días (RN-08). */
    desactualizado: boolean('desactualizado').notNull().default(false),
    fechaPrecioMasAntiguo: fecha('fecha_precio_mas_antiguo').notNull(),
    calculadoEn: instante('calculado_en').notNull().defaultNow(),
  },
  (t) => [
    unico([t.productoId, t.hogarId]),
    indice(t.hogarId),
    fk(t.productoId, producto.id, 'cascade'),
    fk(t.hogarId, hogar.id, 'cascade'),
    fk(t.supermercadoMinimoId, supermercado.id, 'restrict'),
  ],
);

export const ticket = pgTable(
  'ticket',
  {
    id: id(),
    hogarId: uuid('hogar_id').notNull(),
    supermercadoId: uuid('supermercado_id').notNull(),
    fechaCompra: fecha('fecha_compra').notNull(),
    /** Ruta en el almacenamiento de archivos (volumen Docker). */
    archivoRuta: varchar('archivo_ruta', { length: 300 }).notNull(),
    archivoMime: varchar('archivo_mime', { length: 20 }).notNull(),
    archivoBytes: integer('archivo_bytes').notNull(),
    estado: estadoTicket('estado').notNull().default('PROCESANDO'),
    textoOcr: text('texto_ocr'),
    subidoPorId: uuid('subido_por_id'),
    confirmadoEn: instante('confirmado_en'),
    createdAt: creadoEn(),
    updatedAt: actualizadoEn(),
  },
  (t) => [
    indice(t.hogarId, t.createdAt),
    fk(t.hogarId, hogar.id, 'cascade'),
    fk(t.supermercadoId, supermercado.id, 'restrict'),
    fk(t.subidoPorId, usuario.id, 'set null'),
  ],
);

export const ticketLinea = pgTable(
  'ticket_linea',
  {
    id: id(),
    ticketId: uuid('ticket_id').notNull(),
    orden: smallint('orden').notNull(),
    descripcion: varchar('descripcion', { length: 150 }).notNull(),
    precio: dinero('precio'),
    productoSupermercadoId: uuid('producto_supermercado_id'),
    similitud: decimal('similitud', 5, 4),
    estado: estadoLineaTicket('estado').notNull().default('SIN_ASIGNAR'),
    createdAt: creadoEn(),
    updatedAt: actualizadoEn(),
  },
  (t) => [
    unico([t.ticketId, t.orden]),
    fk(t.ticketId, ticket.id, 'cascade'),
    fk(t.productoSupermercadoId, productoSupermercado.id, 'set null'),
  ],
);

/** Corrida del worker (RF-33). Solo una EN_CURSO a la vez — índice parcial en 0002. */
export const corrida = pgTable(
  'corrida',
  {
    id: id(),
    disparo: disparoCorrida('disparo').notNull().default('PROGRAMADA'),
    programadaPara: instante('programada_para').notNull(),
    iniciadaEn: instante('iniciada_en'),
    finalizadaEn: instante('finalizada_en'),
    estado: estadoCorrida('estado').notNull().default('EN_CURSO'),
    totalConsultados: integer('total_consultados').notNull().default(0),
    totalActualizados: integer('total_actualizados').notNull().default(0),
    totalFallidos: integer('total_fallidos').notNull().default(0),
    createdAt: creadoEn(),
    updatedAt: actualizadoEn(),
  },
  (t) => [indice(t.estado, t.programadaPara)],
);

export const corridaSitio = pgTable(
  'corrida_sitio',
  {
    id: id(),
    corridaId: uuid('corrida_id').notNull(),
    supermercadoId: uuid('supermercado_id').notNull(),
    estado: estadoCorridaSitio('estado').notNull().default('EN_CURSO'),
    totalVinculos: integer('total_vinculos').notNull().default(0),
    totalOk: integer('total_ok').notNull().default(0),
    totalFallidos: integer('total_fallidos').notNull().default(0),
    /** Corte al superar 50 % de fallas por estructura (CU-09.3). */
    detenidoPorEstructura: boolean('detenido_por_estructura').notNull().default(false),
    iniciadaEn: instante('iniciada_en'),
    finalizadaEn: instante('finalizada_en'),
  },
  (t) => [
    unico([t.corridaId, t.supermercadoId]),
    fk(t.corridaId, corrida.id, 'cascade'),
    fk(t.supermercadoId, supermercado.id, 'restrict'),
  ],
);

export const corridaError = pgTable(
  'corrida_error',
  {
    id: id(),
    corridaSitioId: uuid('corrida_sitio_id').notNull(),
    productoSupermercadoId: uuid('producto_supermercado_id'),
    tipo: tipoErrorExtraccion('tipo').notNull(),
    mensaje: varchar('mensaje', { length: 500 }).notNull(),
    intentos: smallint('intentos').notNull().default(1),
    ocurridoEn: instante('ocurrido_en').notNull().defaultNow(),
  },
  (t) => [
    indice(t.corridaSitioId),
    indice(t.productoSupermercadoId),
    fk(t.corridaSitioId, corridaSitio.id, 'cascade'),
    fk(t.productoSupermercadoId, productoSupermercado.id, 'set null'),
  ],
);

/** Aviso dentro de la app para administradores del hogar (CU-09.1 3a, CU-09.3 paso 5). */
export const aviso = pgTable(
  'aviso',
  {
    id: id(),
    hogarId: uuid('hogar_id').notNull(),
    tipo: tipoAviso('tipo').notNull(),
    titulo: varchar('titulo', { length: 120 }).notNull(),
    mensaje: varchar('mensaje', { length: 500 }).notNull(),
    datos: jsonb('datos'),
    corridaId: uuid('corrida_id'),
    leidoEn: instante('leido_en'),
    leidoPorId: uuid('leido_por_id'),
    createdAt: creadoEn(),
  },
  (t) => [
    indice(t.hogarId, t.leidoEn),
    fk(t.hogarId, hogar.id, 'cascade'),
    fk(t.corridaId, corrida.id, 'set null'),
    fk(t.leidoPorId, usuario.id, 'set null'),
  ],
);

/** Dispositivo registrado para Web Push o FCM (IE-04). endpoint = URL Web Push o token FCM. */
export const suscripcionPush = pgTable(
  'suscripcion_push',
  {
    id: id(),
    usuarioId: uuid('usuario_id').notNull(),
    canal: canalPush('canal').notNull(),
    endpoint: varchar('endpoint', { length: 1000 }).notNull(),
    p256dh: varchar('p256dh', { length: 200 }),
    auth: varchar('auth', { length: 100 }),
    dispositivo: varchar('dispositivo', { length: 120 }),
    ultimoEnvioEn: instante('ultimo_envio_en'),
    createdAt: creadoEn(),
    updatedAt: actualizadoEn(),
  },
  (t) => [unico([t.endpoint]), indice(t.usuarioId), fk(t.usuarioId, usuario.id, 'cascade')],
);

/** Registro de envíos. clave_deduplicacion: "RECORDATORIO:{hogar}:{semana}" o "ALERTA:{menu}:{n}". */
export const notificacionEnviada = pgTable(
  'notificacion_enviada',
  {
    id: id(),
    hogarId: uuid('hogar_id').notNull(),
    tipo: tipoNotificacion('tipo').notNull(),
    semanaInicio: fecha('semana_inicio').notNull(),
    menuId: uuid('menu_id'),
    claveDeduplicacion: varchar('clave_deduplicacion', { length: 120 }).notNull(),
    resultado: resultadoEnvio('resultado').notNull(),
    destinatarios: smallint('destinatarios').notNull().default(0),
    entregados: smallint('entregados').notNull().default(0),
    contenido: jsonb('contenido').notNull(),
    enviadaEn: instante('enviada_en').notNull().defaultNow(),
  },
  (t) => [
    unico([t.claveDeduplicacion]),
    indice(t.hogarId, t.tipo, t.semanaInicio),
    fk(t.hogarId, hogar.id, 'cascade'),
    fk(t.menuId, menuSemanal.id, 'set null'),
  ],
);

// -----------------------------------------------------------------------------
// Relaciones
// -----------------------------------------------------------------------------

export const supermercadoRelaciones = relations(supermercado, ({ one, many }) => ({
  permisoRevisadoPor: one(usuario, {
    fields: [supermercado.permisoRevisadoPorId],
    references: [usuario.id],
  }),
  hogares: many(hogarSupermercado),
  vinculos: many(productoSupermercado),
  resumenesMinimo: many(precioResumen),
  tickets: many(ticket),
  corridasSitio: many(corridaSitio),
}));

export const productoSupermercadoRelaciones = relations(productoSupermercado, ({ one, many }) => ({
  producto: one(producto, {
    fields: [productoSupermercado.productoId],
    references: [producto.id],
  }),
  supermercado: one(supermercado, {
    fields: [productoSupermercado.supermercadoId],
    references: [supermercado.id],
  }),
  presentacionUnidad: one(unidad, {
    fields: [productoSupermercado.presentacionUnidadId],
    references: [unidad.id],
  }),
  creadoPorHogar: one(hogar, {
    fields: [productoSupermercado.creadoPorHogarId],
    references: [hogar.id],
  }),
  creadoPorUsuario: one(usuario, {
    fields: [productoSupermercado.creadoPorUsuarioId],
    references: [usuario.id],
  }),
  precios: many(precio),
  lineasTicket: many(ticketLinea),
  erroresCorrida: many(corridaError),
}));

export const precioRelaciones = relations(precio, ({ one }) => ({
  productoSupermercado: one(productoSupermercado, {
    fields: [precio.productoSupermercadoId],
    references: [productoSupermercado.id],
  }),
  hogar: one(hogar, { fields: [precio.hogarId], references: [hogar.id] }),
  corrida: one(corrida, { fields: [precio.corridaId], references: [corrida.id] }),
  ticketLinea: one(ticketLinea, {
    fields: [precio.ticketLineaId],
    references: [ticketLinea.id],
  }),
  registradoPor: one(usuario, { fields: [precio.registradoPorId], references: [usuario.id] }),
}));

export const precioResumenRelaciones = relations(precioResumen, ({ one }) => ({
  producto: one(producto, { fields: [precioResumen.productoId], references: [producto.id] }),
  hogar: one(hogar, { fields: [precioResumen.hogarId], references: [hogar.id] }),
  supermercadoMinimo: one(supermercado, {
    fields: [precioResumen.supermercadoMinimoId],
    references: [supermercado.id],
  }),
}));

export const ticketRelaciones = relations(ticket, ({ one, many }) => ({
  hogar: one(hogar, { fields: [ticket.hogarId], references: [hogar.id] }),
  supermercado: one(supermercado, {
    fields: [ticket.supermercadoId],
    references: [supermercado.id],
  }),
  subidoPor: one(usuario, { fields: [ticket.subidoPorId], references: [usuario.id] }),
  lineas: many(ticketLinea),
}));

export const ticketLineaRelaciones = relations(ticketLinea, ({ one }) => ({
  ticket: one(ticket, { fields: [ticketLinea.ticketId], references: [ticket.id] }),
  productoSupermercado: one(productoSupermercado, {
    fields: [ticketLinea.productoSupermercadoId],
    references: [productoSupermercado.id],
  }),
  precioGenerado: one(precio),
}));

export const corridaRelaciones = relations(corrida, ({ many }) => ({
  sitios: many(corridaSitio),
  precios: many(precio),
  avisos: many(aviso),
}));

export const corridaSitioRelaciones = relations(corridaSitio, ({ one, many }) => ({
  corrida: one(corrida, { fields: [corridaSitio.corridaId], references: [corrida.id] }),
  supermercado: one(supermercado, {
    fields: [corridaSitio.supermercadoId],
    references: [supermercado.id],
  }),
  errores: many(corridaError),
}));

export const corridaErrorRelaciones = relations(corridaError, ({ one }) => ({
  corridaSitio: one(corridaSitio, {
    fields: [corridaError.corridaSitioId],
    references: [corridaSitio.id],
  }),
  productoSupermercado: one(productoSupermercado, {
    fields: [corridaError.productoSupermercadoId],
    references: [productoSupermercado.id],
  }),
}));

export const avisoRelaciones = relations(aviso, ({ one }) => ({
  hogar: one(hogar, { fields: [aviso.hogarId], references: [hogar.id] }),
  corrida: one(corrida, { fields: [aviso.corridaId], references: [corrida.id] }),
  leidoPor: one(usuario, { fields: [aviso.leidoPorId], references: [usuario.id] }),
}));

export const suscripcionPushRelaciones = relations(suscripcionPush, ({ one }) => ({
  usuario: one(usuario, { fields: [suscripcionPush.usuarioId], references: [usuario.id] }),
}));

export const notificacionEnviadaRelaciones = relations(notificacionEnviada, ({ one }) => ({
  hogar: one(hogar, { fields: [notificacionEnviada.hogarId], references: [hogar.id] }),
  menu: one(menuSemanal, {
    fields: [notificacionEnviada.menuId],
    references: [menuSemanal.id],
  }),
}));
