/**
 * Tipos inferidos de cada tabla: `Xxx` = fila leída (select) y `XxxInsert` = valores para insertar.
 * Los decimales llegan como `string` y las fechas de calendario como `AAAA-MM-DD`.
 */
import type {
  aviso,
  calificacion,
  categoria,
  claveIdempotencia,
  comensal,
  configuracion,
  corrida,
  corridaError,
  corridaSitio,
  despensaItem,
  etiqueta,
  hogar,
  hogarSupermercado,
  importacion,
  importacionFila,
  importacionPlatillo,
  importacionSemana,
  ingredienteExcluido,
  invitacion,
  listaCompras,
  listaItem,
  listaItemOrigen,
  marcaPreferida,
  menuAlternativaMostrada,
  menuDetalle,
  menuSemanal,
  menuTiempo,
  miembroHogar,
  notificacionEnviada,
  platillo,
  platilloAlias,
  platilloEtiqueta,
  platilloIngrediente,
  platilloTiempo,
  precio,
  precioResumen,
  producto,
  productoEquivalencia,
  productoSupermercado,
  refreshToken,
  supermercado,
  suscripcionPush,
  syncCambio,
  ticket,
  ticketLinea,
  tiempoComidaConfig,
  tokenRecuperacion,
  unidad,
  usuario,
} from './schema';

export type Aviso = typeof aviso.$inferSelect;
export type AvisoInsert = typeof aviso.$inferInsert;
export type Calificacion = typeof calificacion.$inferSelect;
export type CalificacionInsert = typeof calificacion.$inferInsert;
export type Categoria = typeof categoria.$inferSelect;
export type CategoriaInsert = typeof categoria.$inferInsert;
export type ClaveIdempotencia = typeof claveIdempotencia.$inferSelect;
export type ClaveIdempotenciaInsert = typeof claveIdempotencia.$inferInsert;
export type Comensal = typeof comensal.$inferSelect;
export type ComensalInsert = typeof comensal.$inferInsert;
export type Configuracion = typeof configuracion.$inferSelect;
export type ConfiguracionInsert = typeof configuracion.$inferInsert;
export type Corrida = typeof corrida.$inferSelect;
export type CorridaInsert = typeof corrida.$inferInsert;
export type CorridaError = typeof corridaError.$inferSelect;
export type CorridaErrorInsert = typeof corridaError.$inferInsert;
export type CorridaSitio = typeof corridaSitio.$inferSelect;
export type CorridaSitioInsert = typeof corridaSitio.$inferInsert;
export type DespensaItem = typeof despensaItem.$inferSelect;
export type DespensaItemInsert = typeof despensaItem.$inferInsert;
export type Etiqueta = typeof etiqueta.$inferSelect;
export type EtiquetaInsert = typeof etiqueta.$inferInsert;
export type Hogar = typeof hogar.$inferSelect;
export type HogarInsert = typeof hogar.$inferInsert;
export type HogarSupermercado = typeof hogarSupermercado.$inferSelect;
export type HogarSupermercadoInsert = typeof hogarSupermercado.$inferInsert;
export type Importacion = typeof importacion.$inferSelect;
export type ImportacionInsert = typeof importacion.$inferInsert;
export type ImportacionFila = typeof importacionFila.$inferSelect;
export type ImportacionFilaInsert = typeof importacionFila.$inferInsert;
export type ImportacionPlatillo = typeof importacionPlatillo.$inferSelect;
export type ImportacionPlatilloInsert = typeof importacionPlatillo.$inferInsert;
export type ImportacionSemana = typeof importacionSemana.$inferSelect;
export type ImportacionSemanaInsert = typeof importacionSemana.$inferInsert;
export type IngredienteExcluido = typeof ingredienteExcluido.$inferSelect;
export type IngredienteExcluidoInsert = typeof ingredienteExcluido.$inferInsert;
export type Invitacion = typeof invitacion.$inferSelect;
export type InvitacionInsert = typeof invitacion.$inferInsert;
export type ListaCompras = typeof listaCompras.$inferSelect;
export type ListaComprasInsert = typeof listaCompras.$inferInsert;
export type ListaItem = typeof listaItem.$inferSelect;
export type ListaItemInsert = typeof listaItem.$inferInsert;
export type ListaItemOrigen = typeof listaItemOrigen.$inferSelect;
export type ListaItemOrigenInsert = typeof listaItemOrigen.$inferInsert;
export type MarcaPreferida = typeof marcaPreferida.$inferSelect;
export type MarcaPreferidaInsert = typeof marcaPreferida.$inferInsert;
export type MenuAlternativaMostrada = typeof menuAlternativaMostrada.$inferSelect;
export type MenuAlternativaMostradaInsert = typeof menuAlternativaMostrada.$inferInsert;
export type MenuDetalle = typeof menuDetalle.$inferSelect;
export type MenuDetalleInsert = typeof menuDetalle.$inferInsert;
export type MenuSemanal = typeof menuSemanal.$inferSelect;
export type MenuSemanalInsert = typeof menuSemanal.$inferInsert;
export type MenuTiempo = typeof menuTiempo.$inferSelect;
export type MenuTiempoInsert = typeof menuTiempo.$inferInsert;
export type MiembroHogar = typeof miembroHogar.$inferSelect;
export type MiembroHogarInsert = typeof miembroHogar.$inferInsert;
export type NotificacionEnviada = typeof notificacionEnviada.$inferSelect;
export type NotificacionEnviadaInsert = typeof notificacionEnviada.$inferInsert;
export type Platillo = typeof platillo.$inferSelect;
export type PlatilloInsert = typeof platillo.$inferInsert;
export type PlatilloAlias = typeof platilloAlias.$inferSelect;
export type PlatilloAliasInsert = typeof platilloAlias.$inferInsert;
export type PlatilloEtiqueta = typeof platilloEtiqueta.$inferSelect;
export type PlatilloEtiquetaInsert = typeof platilloEtiqueta.$inferInsert;
export type PlatilloIngrediente = typeof platilloIngrediente.$inferSelect;
export type PlatilloIngredienteInsert = typeof platilloIngrediente.$inferInsert;
export type PlatilloTiempo = typeof platilloTiempo.$inferSelect;
export type PlatilloTiempoInsert = typeof platilloTiempo.$inferInsert;
export type Precio = typeof precio.$inferSelect;
export type PrecioInsert = typeof precio.$inferInsert;
export type PrecioResumen = typeof precioResumen.$inferSelect;
export type PrecioResumenInsert = typeof precioResumen.$inferInsert;
export type Producto = typeof producto.$inferSelect;
export type ProductoInsert = typeof producto.$inferInsert;
export type ProductoEquivalencia = typeof productoEquivalencia.$inferSelect;
export type ProductoEquivalenciaInsert = typeof productoEquivalencia.$inferInsert;
export type ProductoSupermercado = typeof productoSupermercado.$inferSelect;
export type ProductoSupermercadoInsert = typeof productoSupermercado.$inferInsert;
export type RefreshToken = typeof refreshToken.$inferSelect;
export type RefreshTokenInsert = typeof refreshToken.$inferInsert;
export type Supermercado = typeof supermercado.$inferSelect;
export type SupermercadoInsert = typeof supermercado.$inferInsert;
export type SuscripcionPush = typeof suscripcionPush.$inferSelect;
export type SuscripcionPushInsert = typeof suscripcionPush.$inferInsert;
export type SyncCambio = typeof syncCambio.$inferSelect;
export type SyncCambioInsert = typeof syncCambio.$inferInsert;
export type Ticket = typeof ticket.$inferSelect;
export type TicketInsert = typeof ticket.$inferInsert;
export type TicketLinea = typeof ticketLinea.$inferSelect;
export type TicketLineaInsert = typeof ticketLinea.$inferInsert;
export type TiempoComidaConfig = typeof tiempoComidaConfig.$inferSelect;
export type TiempoComidaConfigInsert = typeof tiempoComidaConfig.$inferInsert;
export type TokenRecuperacion = typeof tokenRecuperacion.$inferSelect;
export type TokenRecuperacionInsert = typeof tokenRecuperacion.$inferInsert;
export type Unidad = typeof unidad.$inferSelect;
export type UnidadInsert = typeof unidad.$inferInsert;
export type Usuario = typeof usuario.$inferSelect;
export type UsuarioInsert = typeof usuario.$inferInsert;
