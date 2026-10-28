/**
 * 35 tipos enum de PostgreSQL (snake_case), equivalentes a los enums del diseño
 * (docs/02-diseno/modelo-datos.md §4). Los valores se guardan en MAYÚSCULAS.
 */
import { pgEnum } from 'drizzle-orm/pg-core';

export const rolHogar = pgEnum('rol_hogar', ['ADMIN', 'MIEMBRO']);
export const medioInvitacion = pgEnum('medio_invitacion', ['CORREO', 'ENLACE']);
export const tipoComensal = pgEnum('tipo_comensal', ['ADULTO', 'NINO']);
export const tiempoComida = pgEnum('tiempo_comida', ['DESAYUNO', 'ALMUERZO', 'CENA']);
export const diaSemana = pgEnum('dia_semana', [
  'DOMINGO',
  'LUNES',
  'MARTES',
  'MIERCOLES',
  'JUEVES',
  'VIERNES',
  'SABADO',
]);
export const proteinaPrincipal = pgEnum('proteina_principal', [
  'POLLO',
  'RES',
  'CERDO',
  'PESCADO',
  'HUEVO',
  'EMBUTIDO',
  'VEGETARIANA',
  'OTRA',
]);
export const magnitudUnidad = pgEnum('magnitud_unidad', ['MASA', 'VOLUMEN', 'CONTEO']);
export const tipoProducto = pgEnum('tipo_producto', ['INGREDIENTE', 'DESPENSA', 'AMBOS']);
export const origenAlias = pgEnum('origen_alias', ['IMPORTACION', 'MANUAL']);
export const estadoMenu = pgEnum('estado_menu', ['BORRADOR', 'APROBADO', 'HISTORICO']);
export const origenMenu = pgEnum('origen_menu', [
  'MOTOR',
  'CAPTURA_MANUAL',
  'IMPORTACION',
  'CUADERNO',
]);
export const origenAsignacion = pgEnum('origen_asignacion', [
  'MOTOR',
  'REEMPLAZO_PRESUPUESTO',
  'ALTERNATIVA',
  'USUARIO',
  'HISTORICO',
]);
export const estadoAlertaPresupuesto = pgEnum('estado_alerta_presupuesto', ['NORMAL', 'ALERTADO']);
export const origenItemLista = pgEnum('origen_item_lista', [
  'MENU',
  'DESPENSA',
  'MENU_Y_DESPENSA',
  'MANUAL',
]);
/** Estado de compra del ítem (RF-30, RF-43). YA_LO_TENGO cuenta como cubierto (RN-13) pero no se cotiza. */
export const estadoItemLista = pgEnum('estado_item_lista', [
  'PENDIENTE',
  'COMPRADO',
  'YA_LO_TENGO',
]);
export const operacionSync = pgEnum('operacion_sync', [
  'AGREGAR',
  'ACTUALIZAR',
  'MARCAR_COMPRADO',
  'MARCAR_YA_LO_TENGO',
  'DESMARCAR_COMPRADO',
  /** Registrar o corregir el precio real pagado (RF-44). */
  'REGISTRAR_PRECIO',
  'ELIMINAR',
]);
export const resultadoSync = pgEnum('resultado_sync', ['APLICADO', 'OBSOLETO', 'RECHAZADO']);
export const frecuenciaDespensa = pgEnum('frecuencia_despensa', [
  'SEMANAL',
  'QUINCENAL',
  'MENSUAL',
]);
export const origenPrecio = pgEnum('origen_precio', ['AUTOMATICO', 'MANUAL', 'TICKET']);
export const estadoTicket = pgEnum('estado_ticket', [
  'PROCESANDO',
  'PENDIENTE_CONFIRMACION',
  'SIN_LECTURA',
  'CONFIRMADO',
  'DESCARTADO',
]);
export const estadoLineaTicket = pgEnum('estado_linea_ticket', [
  'SIN_ASIGNAR',
  'PROPUESTA',
  'ASIGNADA',
  'DESCARTADA',
]);
export const disparoCorrida = pgEnum('disparo_corrida', ['PROGRAMADA', 'MANUAL']);
export const estadoCorrida = pgEnum('estado_corrida', [
  'EN_CURSO',
  'COMPLETADA',
  'PARCIAL',
  'FALLIDA',
  'OMITIDA',
]);
export const estadoCorridaSitio = pgEnum('estado_corrida_sitio', [
  'EN_CURSO',
  'COMPLETADA',
  'PARCIAL',
  'FALLIDA',
  'BLOQUEADO',
  'NO_HABILITADO',
  'DETENIDO',
]);
export const tipoErrorExtraccion = pgEnum('tipo_error_extraccion', [
  'TIEMPO_AGOTADO',
  'HTTP',
  'ESTRUCTURA',
  'PRECIO_INVALIDO',
  'ROBOTS',
  'OTRO',
]);
export const tipoAviso = pgEnum('tipo_aviso', [
  'CORRIDA_PARCIAL',
  'CORRIDA_FALLIDA',
  'SITIO_BLOQUEADO',
  'PRESUPUESTO_NO_CONFIGURADO',
]);
export const canalPush = pgEnum('canal_push', ['WEB_PUSH', 'FCM']);
export const tipoNotificacion = pgEnum('tipo_notificacion', [
  'RECORDATORIO_PLANIFICACION',
  'ALERTA_PRESUPUESTO',
]);
export const resultadoEnvio = pgEnum('resultado_envio', [
  'ENVIADA',
  'PARCIAL',
  'SIN_DESTINATARIOS',
  'FALLIDA',
]);
export const origenImportacion = pgEnum('origen_importacion', ['ARCHIVO', 'CUADERNO']);
export const formatoArchivo = pgEnum('formato_archivo', ['CSV', 'XLSX']);
export const estadoImportacion = pgEnum('estado_importacion', [
  'CON_ERRORES',
  'VISTA_PREVIA',
  'CONFIRMADA',
  'CANCELADA',
]);
export const hojaImportacion = pgEnum('hoja_importacion', ['MENUS', 'LISTAS']);
export const decisionPlatillo = pgEnum('decision_platillo', ['PENDIENTE', 'ASOCIAR', 'CREAR']);
export const decisionSemana = pgEnum('decision_semana', ['CREAR', 'OMITIR', 'REEMPLAZAR']);
