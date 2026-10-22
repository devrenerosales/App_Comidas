CREATE TYPE "public"."canal_push" AS ENUM('WEB_PUSH', 'FCM');--> statement-breakpoint
CREATE TYPE "public"."decision_platillo" AS ENUM('PENDIENTE', 'ASOCIAR', 'CREAR');--> statement-breakpoint
CREATE TYPE "public"."decision_semana" AS ENUM('CREAR', 'OMITIR', 'REEMPLAZAR');--> statement-breakpoint
CREATE TYPE "public"."dia_semana" AS ENUM('DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO');--> statement-breakpoint
CREATE TYPE "public"."disparo_corrida" AS ENUM('PROGRAMADA', 'MANUAL');--> statement-breakpoint
CREATE TYPE "public"."estado_alerta_presupuesto" AS ENUM('NORMAL', 'ALERTADO');--> statement-breakpoint
CREATE TYPE "public"."estado_corrida" AS ENUM('EN_CURSO', 'COMPLETADA', 'PARCIAL', 'FALLIDA', 'OMITIDA');--> statement-breakpoint
CREATE TYPE "public"."estado_corrida_sitio" AS ENUM('EN_CURSO', 'COMPLETADA', 'PARCIAL', 'FALLIDA', 'BLOQUEADO', 'NO_HABILITADO', 'DETENIDO');--> statement-breakpoint
CREATE TYPE "public"."estado_importacion" AS ENUM('CON_ERRORES', 'VISTA_PREVIA', 'CONFIRMADA', 'CANCELADA');--> statement-breakpoint
CREATE TYPE "public"."estado_item_lista" AS ENUM('PENDIENTE', 'COMPRADO', 'YA_LO_TENGO');--> statement-breakpoint
CREATE TYPE "public"."estado_linea_ticket" AS ENUM('SIN_ASIGNAR', 'PROPUESTA', 'ASIGNADA', 'DESCARTADA');--> statement-breakpoint
CREATE TYPE "public"."estado_menu" AS ENUM('BORRADOR', 'APROBADO', 'HISTORICO');--> statement-breakpoint
CREATE TYPE "public"."estado_ticket" AS ENUM('PROCESANDO', 'PENDIENTE_CONFIRMACION', 'SIN_LECTURA', 'CONFIRMADO', 'DESCARTADO');--> statement-breakpoint
CREATE TYPE "public"."formato_archivo" AS ENUM('CSV', 'XLSX');--> statement-breakpoint
CREATE TYPE "public"."frecuencia_despensa" AS ENUM('SEMANAL', 'QUINCENAL', 'MENSUAL');--> statement-breakpoint
CREATE TYPE "public"."hoja_importacion" AS ENUM('MENUS', 'LISTAS');--> statement-breakpoint
CREATE TYPE "public"."magnitud_unidad" AS ENUM('MASA', 'VOLUMEN', 'CONTEO');--> statement-breakpoint
CREATE TYPE "public"."medio_invitacion" AS ENUM('CORREO', 'ENLACE');--> statement-breakpoint
CREATE TYPE "public"."operacion_sync" AS ENUM('AGREGAR', 'ACTUALIZAR', 'MARCAR_COMPRADO', 'MARCAR_YA_LO_TENGO', 'DESMARCAR_COMPRADO', 'REGISTRAR_PRECIO', 'ELIMINAR');--> statement-breakpoint
CREATE TYPE "public"."origen_alias" AS ENUM('IMPORTACION', 'MANUAL');--> statement-breakpoint
CREATE TYPE "public"."origen_asignacion" AS ENUM('MOTOR', 'REEMPLAZO_PRESUPUESTO', 'ALTERNATIVA', 'USUARIO', 'HISTORICO');--> statement-breakpoint
CREATE TYPE "public"."origen_importacion" AS ENUM('ARCHIVO', 'CUADERNO');--> statement-breakpoint
CREATE TYPE "public"."origen_item_lista" AS ENUM('MENU', 'DESPENSA', 'MENU_Y_DESPENSA', 'MANUAL');--> statement-breakpoint
CREATE TYPE "public"."origen_menu" AS ENUM('MOTOR', 'CAPTURA_MANUAL', 'IMPORTACION', 'CUADERNO');--> statement-breakpoint
CREATE TYPE "public"."origen_precio" AS ENUM('AUTOMATICO', 'MANUAL', 'TICKET');--> statement-breakpoint
CREATE TYPE "public"."proteina_principal" AS ENUM('POLLO', 'RES', 'CERDO', 'PESCADO', 'HUEVO', 'EMBUTIDO', 'VEGETARIANA', 'OTRA');--> statement-breakpoint
CREATE TYPE "public"."resultado_envio" AS ENUM('ENVIADA', 'PARCIAL', 'SIN_DESTINATARIOS', 'FALLIDA');--> statement-breakpoint
CREATE TYPE "public"."resultado_sync" AS ENUM('APLICADO', 'OBSOLETO', 'RECHAZADO');--> statement-breakpoint
CREATE TYPE "public"."rol_hogar" AS ENUM('ADMIN', 'MIEMBRO');--> statement-breakpoint
CREATE TYPE "public"."tiempo_comida" AS ENUM('DESAYUNO', 'ALMUERZO', 'CENA');--> statement-breakpoint
CREATE TYPE "public"."tipo_aviso" AS ENUM('CORRIDA_PARCIAL', 'CORRIDA_FALLIDA', 'SITIO_BLOQUEADO', 'PRESUPUESTO_NO_CONFIGURADO');--> statement-breakpoint
CREATE TYPE "public"."tipo_comensal" AS ENUM('ADULTO', 'NINO');--> statement-breakpoint
CREATE TYPE "public"."tipo_error_extraccion" AS ENUM('TIEMPO_AGOTADO', 'HTTP', 'ESTRUCTURA', 'PRECIO_INVALIDO', 'ROBOTS', 'OTRO');--> statement-breakpoint
CREATE TYPE "public"."tipo_notificacion" AS ENUM('RECORDATORIO_PLANIFICACION', 'ALERTA_PRESUPUESTO');--> statement-breakpoint
CREATE TYPE "public"."tipo_producto" AS ENUM('INGREDIENTE', 'DESPENSA', 'AMBOS');--> statement-breakpoint
CREATE TABLE "clave_idempotencia" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"clave" varchar(64) NOT NULL,
	"metodo" varchar(7) NOT NULL,
	"ruta" varchar(200) NOT NULL,
	"hash_solicitud" char(64) NOT NULL,
	"estado_respuesta" smallint NOT NULL,
	"cuerpo_respuesta" jsonb,
	"vence_en" timestamp (3) with time zone NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comensal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hogar_id" uuid NOT NULL,
	"nombre" varchar(60) NOT NULL,
	"nombre_normalizado" varchar(60) NOT NULL,
	"tipo" "tipo_comensal" NOT NULL,
	"factor_porcion" numeric(3, 2) DEFAULT '1.00' NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "configuracion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hogar_id" uuid NOT NULL,
	"presupuesto_semanal" numeric(10, 2) DEFAULT '250.00' NOT NULL,
	"dia_inicio_semana" "dia_semana" DEFAULT 'DOMINGO' NOT NULL,
	"dia_planificacion" "dia_semana" DEFAULT 'DOMINGO' NOT NULL,
	"hora_planificacion" smallint DEFAULT 8 NOT NULL,
	"peso_preferencia" numeric(3, 2) DEFAULT '0.40' NOT NULL,
	"peso_novedad" numeric(3, 2) DEFAULT '0.25' NOT NULL,
	"peso_ahorro" numeric(3, 2) DEFAULT '0.20' NOT NULL,
	"peso_afinidad" numeric(3, 2) DEFAULT '0.15' NOT NULL,
	"umbral_similitud" numeric(3, 2) DEFAULT '0.80' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"actualizado_por_id" uuid,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hogar" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" varchar(80) NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hogar_supermercado" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hogar_id" uuid NOT NULL,
	"supermercado_id" uuid NOT NULL,
	"preferido" boolean DEFAULT true NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingrediente_excluido" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hogar_id" uuid NOT NULL,
	"producto_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitacion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hogar_id" uuid NOT NULL,
	"creada_por_id" uuid NOT NULL,
	"medio" "medio_invitacion" NOT NULL,
	"correo" varchar(254),
	"token_hash" char(64) NOT NULL,
	"vence_en" timestamp (3) with time zone NOT NULL,
	"usada_en" timestamp (3) with time zone,
	"usada_por_id" uuid,
	"revocada_en" timestamp (3) with time zone,
	"correo_enviado" boolean DEFAULT false NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marca_preferida" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hogar_id" uuid NOT NULL,
	"producto_id" uuid NOT NULL,
	"marca" varchar(60) NOT NULL,
	"marca_normalizada" varchar(60) NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "miembro_hogar" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hogar_id" uuid NOT NULL,
	"usuario_id" uuid NOT NULL,
	"rol" "rol_hogar" DEFAULT 'MIEMBRO' NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_token" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"token_hash" char(64) NOT NULL,
	"familia" uuid NOT NULL,
	"dispositivo" varchar(120),
	"vence_en" timestamp (3) with time zone NOT NULL,
	"revocado_en" timestamp (3) with time zone,
	"reemplazado_por_id" uuid,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tiempo_comida_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"configuracion_id" uuid NOT NULL,
	"tiempo" "tiempo_comida" NOT NULL,
	"activo" boolean DEFAULT false NOT NULL,
	"porcentaje" numeric(5, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "token_recuperacion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"token_hash" char(64) NOT NULL,
	"vence_en" timestamp (3) with time zone NOT NULL,
	"usado_en" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usuario" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" varchar(80) NOT NULL,
	"correo" varchar(254) NOT NULL,
	"hash_contrasena" varchar(255) NOT NULL,
	"intentos_fallidos" smallint DEFAULT 0 NOT NULL,
	"primer_intento_fallido_en" timestamp (3) with time zone,
	"bloqueado_hasta" timestamp (3) with time zone,
	"sesiones_invalidas_antes_de" timestamp (3) with time zone,
	"es_admin_sistema" boolean DEFAULT false NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calificacion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"menu_detalle_id" uuid NOT NULL,
	"platillo_id" uuid NOT NULL,
	"valor" smallint NOT NULL,
	"usuario_id" uuid,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categoria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"codigo" varchar(20) NOT NULL,
	"nombre" varchar(40) NOT NULL,
	"orden" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "etiqueta" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hogar_id" uuid NOT NULL,
	"nombre" varchar(30) NOT NULL,
	"nombre_normalizado" varchar(30) NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "importacion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hogar_id" uuid NOT NULL,
	"usuario_id" uuid,
	"origen" "origen_importacion" DEFAULT 'ARCHIVO' NOT NULL,
	"nombre_archivo" varchar(200) NOT NULL,
	"formato" "formato_archivo" NOT NULL,
	"tamano_bytes" integer NOT NULL,
	"estado" "estado_importacion" NOT NULL,
	"total_filas" integer DEFAULT 0 NOT NULL,
	"filas_con_error" integer DEFAULT 0 NOT NULL,
	"reporte" jsonb,
	"confirmada_en" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "importacion_fila" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"importacion_id" uuid NOT NULL,
	"hoja" "hoja_importacion" NOT NULL,
	"numero_fila" integer NOT NULL,
	"datos" jsonb NOT NULL,
	"errores" jsonb,
	"valida" boolean NOT NULL,
	"semana_inicio" date
);
--> statement-breakpoint
CREATE TABLE "importacion_platillo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"importacion_id" uuid NOT NULL,
	"nombre_original" varchar(80) NOT NULL,
	"nombre_normalizado" varchar(80) NOT NULL,
	"platillo_sugerido_id" uuid,
	"similitud" numeric(5, 4),
	"decision" "decision_platillo" DEFAULT 'PENDIENTE' NOT NULL,
	"platillo_id" uuid,
	"nombre_final" varchar(80),
	"proteina_principal" "proteina_principal"
);
--> statement-breakpoint
CREATE TABLE "importacion_semana" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"importacion_id" uuid NOT NULL,
	"semana_inicio" date NOT NULL,
	"ya_existe" boolean DEFAULT false NOT NULL,
	"decision" "decision_semana" DEFAULT 'CREAR' NOT NULL,
	"gasto_semana" numeric(10, 2)
);
--> statement-breakpoint
CREATE TABLE "menu_alternativa_mostrada" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"menu_detalle_id" uuid NOT NULL,
	"platillo_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_detalle" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"menu_id" uuid NOT NULL,
	"fecha" date NOT NULL,
	"tiempo" "tiempo_comida" NOT NULL,
	"platillo_id" uuid,
	"fijado" boolean DEFAULT false NOT NULL,
	"origen" "origen_asignacion" DEFAULT 'MOTOR' NOT NULL,
	"puntaje" numeric(6, 4),
	"factor_preferencia" numeric(5, 4),
	"factor_novedad" numeric(5, 4),
	"factor_ahorro" numeric(5, 4),
	"factor_afinidad" numeric(5, 4),
	"costo_estimado" numeric(10, 2),
	"costo_incompleto" boolean DEFAULT false NOT NULL,
	"reglas_aplicadas" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"notas" varchar(200),
	"modificado_por_id" uuid,
	"modificado_en" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_semanal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hogar_id" uuid NOT NULL,
	"fecha_inicio" date NOT NULL,
	"fecha_fin" date NOT NULL,
	"es_transicion" boolean DEFAULT false NOT NULL,
	"estado" "estado_menu" DEFAULT 'BORRADOR' NOT NULL,
	"desactualizado" boolean DEFAULT false NOT NULL,
	"origen" "origen_menu" DEFAULT 'MOTOR' NOT NULL,
	"configuracion_version" integer,
	"presupuesto_semanal" numeric(10, 2),
	"suma_factores_porcion" numeric(5, 2),
	"peso_preferencia" numeric(3, 2),
	"peso_novedad" numeric(3, 2),
	"peso_ahorro" numeric(3, 2),
	"peso_afinidad" numeric(3, 2),
	"costo_estimado" numeric(10, 2),
	"costo_incompleto" boolean DEFAULT false NOT NULL,
	"generado_en" timestamp (3) with time zone,
	"aprobado_por_id" uuid,
	"aprobado_en" timestamp (3) with time zone,
	"exceso_al_aprobar" numeric(10, 2),
	"estado_alerta_presupuesto" "estado_alerta_presupuesto" DEFAULT 'NORMAL' NOT NULL,
	"gasto_real" numeric(10, 2),
	"nota_gasto" varchar(200),
	"gasto_registrado_por_id" uuid,
	"gasto_registrado_en" timestamp (3) with time zone,
	"importacion_id" uuid,
	"notas" varchar(500),
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_tiempo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"menu_id" uuid NOT NULL,
	"tiempo" "tiempo_comida" NOT NULL,
	"porcentaje" numeric(5, 2) NOT NULL,
	"presupuesto" numeric(10, 2) NOT NULL,
	"costo_estimado" numeric(10, 2),
	"exceso" numeric(10, 2) DEFAULT '0' NOT NULL,
	"intentos_ajuste" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platillo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hogar_id" uuid NOT NULL,
	"nombre" varchar(80) NOT NULL,
	"nombre_normalizado" varchar(80) NOT NULL,
	"proteina_principal" "proteina_principal" DEFAULT 'OTRA' NOT NULL,
	"porciones_base" smallint DEFAULT 4 NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"favorito" boolean DEFAULT false NOT NULL,
	"incompleto" boolean DEFAULT true NOT NULL,
	"calificacion_promedio" numeric(3, 2),
	"calificacion_conteo" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platillo_alias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hogar_id" uuid NOT NULL,
	"platillo_id" uuid NOT NULL,
	"alias" varchar(80) NOT NULL,
	"alias_normalizado" varchar(80) NOT NULL,
	"origen" "origen_alias" DEFAULT 'IMPORTACION' NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platillo_etiqueta" (
	"platillo_id" uuid NOT NULL,
	"etiqueta_id" uuid NOT NULL,
	CONSTRAINT "platillo_etiqueta_pkey" PRIMARY KEY("platillo_id","etiqueta_id")
);
--> statement-breakpoint
CREATE TABLE "platillo_ingrediente" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platillo_id" uuid NOT NULL,
	"producto_id" uuid NOT NULL,
	"cantidad" numeric(10, 3) NOT NULL,
	"unidad_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platillo_tiempo" (
	"platillo_id" uuid NOT NULL,
	"tiempo" "tiempo_comida" NOT NULL,
	CONSTRAINT "platillo_tiempo_pkey" PRIMARY KEY("platillo_id","tiempo")
);
--> statement-breakpoint
CREATE TABLE "producto" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" varchar(80) NOT NULL,
	"nombre_normalizado" varchar(80) NOT NULL,
	"tipo" "tipo_producto" NOT NULL,
	"categoria_id" uuid NOT NULL,
	"unidad_compra" varchar(20) NOT NULL,
	"presentacion_cantidad" numeric(10, 3) NOT NULL,
	"presentacion_unidad_id" uuid NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "producto_equivalencia" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"producto_id" uuid NOT NULL,
	"unidad_id" uuid NOT NULL,
	"factor" numeric(14, 6) NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unidad" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"codigo" varchar(10) NOT NULL,
	"nombre" varchar(30) NOT NULL,
	"magnitud" "magnitud_unidad" NOT NULL,
	"factor_base" numeric(14, 6),
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "despensa_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hogar_id" uuid NOT NULL,
	"producto_id" uuid NOT NULL,
	"cantidad" numeric(10, 3) NOT NULL,
	"frecuencia" "frecuencia_despensa" DEFAULT 'MENSUAL' NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"ultima_inclusion_semana" date,
	"ultima_inclusion_lista_id" uuid,
	"precio_referencia" numeric(10, 2),
	"notas" varchar(200),
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lista_compras" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hogar_id" uuid NOT NULL,
	"menu_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"generada_en" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lista_item" (
	"id" uuid PRIMARY KEY NOT NULL,
	"lista_id" uuid NOT NULL,
	"producto_id" uuid,
	"texto_libre" varchar(80),
	"origen" "origen_item_lista" NOT NULL,
	"cantidad_requerida" numeric(12, 3),
	"unidad_requerida_id" uuid,
	"cantidad_comprar" numeric(10, 3) NOT NULL,
	"sin_conversion" boolean DEFAULT false NOT NULL,
	"estado" "estado_item_lista" DEFAULT 'PENDIENTE' NOT NULL,
	"comprado_en" timestamp (3) with time zone,
	"comprado_por_id" uuid,
	"precio_real" numeric(10, 2),
	"contenido_comprado" numeric(12, 3),
	"precio_normalizado" numeric(10, 2),
	"eliminado" boolean DEFAULT false NOT NULL,
	"modificado_en_dispositivo" timestamp (3) with time zone NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lista_item_origen" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lista_item_id" uuid NOT NULL,
	"menu_detalle_id" uuid NOT NULL,
	"cantidad_requerida" numeric(12, 3),
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_cambio" (
	"id" uuid PRIMARY KEY NOT NULL,
	"lista_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"usuario_id" uuid,
	"operacion" "operacion_sync" NOT NULL,
	"datos" jsonb,
	"marca_tiempo_dispositivo" timestamp (3) with time zone NOT NULL,
	"resultado" "resultado_sync" NOT NULL,
	"motivo" varchar(200),
	"recibido_en" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aviso" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hogar_id" uuid NOT NULL,
	"tipo" "tipo_aviso" NOT NULL,
	"titulo" varchar(120) NOT NULL,
	"mensaje" varchar(500) NOT NULL,
	"datos" jsonb,
	"corrida_id" uuid,
	"leido_en" timestamp (3) with time zone,
	"leido_por_id" uuid,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "corrida" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"disparo" "disparo_corrida" DEFAULT 'PROGRAMADA' NOT NULL,
	"programada_para" timestamp (3) with time zone NOT NULL,
	"iniciada_en" timestamp (3) with time zone,
	"finalizada_en" timestamp (3) with time zone,
	"estado" "estado_corrida" DEFAULT 'EN_CURSO' NOT NULL,
	"total_consultados" integer DEFAULT 0 NOT NULL,
	"total_actualizados" integer DEFAULT 0 NOT NULL,
	"total_fallidos" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "corrida_error" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"corrida_sitio_id" uuid NOT NULL,
	"producto_supermercado_id" uuid,
	"tipo" "tipo_error_extraccion" NOT NULL,
	"mensaje" varchar(500) NOT NULL,
	"intentos" smallint DEFAULT 1 NOT NULL,
	"ocurrido_en" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "corrida_sitio" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"corrida_id" uuid NOT NULL,
	"supermercado_id" uuid NOT NULL,
	"estado" "estado_corrida_sitio" DEFAULT 'EN_CURSO' NOT NULL,
	"total_vinculos" integer DEFAULT 0 NOT NULL,
	"total_ok" integer DEFAULT 0 NOT NULL,
	"total_fallidos" integer DEFAULT 0 NOT NULL,
	"detenido_por_estructura" boolean DEFAULT false NOT NULL,
	"iniciada_en" timestamp (3) with time zone,
	"finalizada_en" timestamp (3) with time zone
);
--> statement-breakpoint
CREATE TABLE "notificacion_enviada" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hogar_id" uuid NOT NULL,
	"tipo" "tipo_notificacion" NOT NULL,
	"semana_inicio" date NOT NULL,
	"menu_id" uuid,
	"clave_deduplicacion" varchar(120) NOT NULL,
	"resultado" "resultado_envio" NOT NULL,
	"destinatarios" smallint DEFAULT 0 NOT NULL,
	"entregados" smallint DEFAULT 0 NOT NULL,
	"contenido" jsonb NOT NULL,
	"enviada_en" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "precio" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"producto_supermercado_id" uuid NOT NULL,
	"origen" "origen_precio" NOT NULL,
	"hogar_id" uuid,
	"precio" numeric(10, 2) NOT NULL,
	"precio_normalizado" numeric(10, 2) NOT NULL,
	"fecha_precio" date NOT NULL,
	"corrida_id" uuid,
	"ticket_linea_id" uuid,
	"registrado_por_id" uuid,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "precio_resumen" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"producto_id" uuid NOT NULL,
	"hogar_id" uuid NOT NULL,
	"precio_mediana" numeric(10, 2) NOT NULL,
	"precio_minimo" numeric(10, 2) NOT NULL,
	"supermercado_minimo_id" uuid NOT NULL,
	"fecha_precio_minimo" date NOT NULL,
	"cantidad_precios" smallint NOT NULL,
	"desactualizado" boolean DEFAULT false NOT NULL,
	"fecha_precio_mas_antiguo" date NOT NULL,
	"calculado_en" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "producto_supermercado" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"producto_id" uuid NOT NULL,
	"supermercado_id" uuid NOT NULL,
	"nombre_tienda" varchar(150) NOT NULL,
	"marca" varchar(60),
	"marca_normalizada" varchar(60),
	"presentacion_cantidad" numeric(10, 3) NOT NULL,
	"presentacion_unidad_id" uuid NOT NULL,
	"factor" numeric(12, 6) NOT NULL,
	"url" varchar(500),
	"sku" varchar(60),
	"activo" boolean DEFAULT true NOT NULL,
	"inactivado_en" timestamp (3) with time zone,
	"creado_por_hogar_id" uuid,
	"creado_por_usuario_id" uuid,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supermercado" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"codigo" varchar(20) NOT NULL,
	"nombre" varchar(40) NOT NULL,
	"dominio" varchar(100),
	"soporta_extraccion" boolean DEFAULT false NOT NULL,
	"habilitado" boolean DEFAULT false NOT NULL,
	"extraccion_permitida" boolean DEFAULT false NOT NULL,
	"permiso_revisado_por_id" uuid,
	"permiso_revisado_en" timestamp (3) with time zone,
	"nota_terminos" varchar(500),
	"solicitudes_por_segundo" numeric(4, 2) DEFAULT '1.00' NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suscripcion_push" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"canal" "canal_push" NOT NULL,
	"endpoint" varchar(1000) NOT NULL,
	"p256dh" varchar(200),
	"auth" varchar(100),
	"dispositivo" varchar(120),
	"ultimo_envio_en" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hogar_id" uuid NOT NULL,
	"supermercado_id" uuid NOT NULL,
	"fecha_compra" date NOT NULL,
	"archivo_ruta" varchar(300) NOT NULL,
	"archivo_mime" varchar(20) NOT NULL,
	"archivo_bytes" integer NOT NULL,
	"estado" "estado_ticket" DEFAULT 'PROCESANDO' NOT NULL,
	"texto_ocr" text,
	"subido_por_id" uuid,
	"confirmado_en" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_linea" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"orden" smallint NOT NULL,
	"descripcion" varchar(150) NOT NULL,
	"precio" numeric(10, 2),
	"producto_supermercado_id" uuid,
	"similitud" numeric(5, 4),
	"estado" "estado_linea_ticket" DEFAULT 'SIN_ASIGNAR' NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clave_idempotencia" ADD CONSTRAINT "clave_idempotencia_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "comensal" ADD CONSTRAINT "comensal_hogar_id_fkey" FOREIGN KEY ("hogar_id") REFERENCES "public"."hogar"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "configuracion" ADD CONSTRAINT "configuracion_hogar_id_fkey" FOREIGN KEY ("hogar_id") REFERENCES "public"."hogar"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "configuracion" ADD CONSTRAINT "configuracion_actualizado_por_id_fkey" FOREIGN KEY ("actualizado_por_id") REFERENCES "public"."usuario"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "hogar_supermercado" ADD CONSTRAINT "hogar_supermercado_hogar_id_fkey" FOREIGN KEY ("hogar_id") REFERENCES "public"."hogar"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "hogar_supermercado" ADD CONSTRAINT "hogar_supermercado_supermercado_id_fkey" FOREIGN KEY ("supermercado_id") REFERENCES "public"."supermercado"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ingrediente_excluido" ADD CONSTRAINT "ingrediente_excluido_hogar_id_fkey" FOREIGN KEY ("hogar_id") REFERENCES "public"."hogar"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ingrediente_excluido" ADD CONSTRAINT "ingrediente_excluido_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "public"."producto"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "invitacion" ADD CONSTRAINT "invitacion_hogar_id_fkey" FOREIGN KEY ("hogar_id") REFERENCES "public"."hogar"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "invitacion" ADD CONSTRAINT "invitacion_creada_por_id_fkey" FOREIGN KEY ("creada_por_id") REFERENCES "public"."usuario"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "invitacion" ADD CONSTRAINT "invitacion_usada_por_id_fkey" FOREIGN KEY ("usada_por_id") REFERENCES "public"."usuario"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "marca_preferida" ADD CONSTRAINT "marca_preferida_hogar_id_fkey" FOREIGN KEY ("hogar_id") REFERENCES "public"."hogar"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "marca_preferida" ADD CONSTRAINT "marca_preferida_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "public"."producto"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "miembro_hogar" ADD CONSTRAINT "miembro_hogar_hogar_id_fkey" FOREIGN KEY ("hogar_id") REFERENCES "public"."hogar"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "miembro_hogar" ADD CONSTRAINT "miembro_hogar_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "refresh_token" ADD CONSTRAINT "refresh_token_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "refresh_token" ADD CONSTRAINT "refresh_token_reemplazado_por_id_fkey" FOREIGN KEY ("reemplazado_por_id") REFERENCES "public"."refresh_token"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "tiempo_comida_config" ADD CONSTRAINT "tiempo_comida_config_configuracion_id_fkey" FOREIGN KEY ("configuracion_id") REFERENCES "public"."configuracion"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "token_recuperacion" ADD CONSTRAINT "token_recuperacion_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "calificacion" ADD CONSTRAINT "calificacion_menu_detalle_id_fkey" FOREIGN KEY ("menu_detalle_id") REFERENCES "public"."menu_detalle"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "calificacion" ADD CONSTRAINT "calificacion_platillo_id_fkey" FOREIGN KEY ("platillo_id") REFERENCES "public"."platillo"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "calificacion" ADD CONSTRAINT "calificacion_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "etiqueta" ADD CONSTRAINT "etiqueta_hogar_id_fkey" FOREIGN KEY ("hogar_id") REFERENCES "public"."hogar"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "importacion" ADD CONSTRAINT "importacion_hogar_id_fkey" FOREIGN KEY ("hogar_id") REFERENCES "public"."hogar"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "importacion" ADD CONSTRAINT "importacion_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "importacion_fila" ADD CONSTRAINT "importacion_fila_importacion_id_fkey" FOREIGN KEY ("importacion_id") REFERENCES "public"."importacion"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "importacion_platillo" ADD CONSTRAINT "importacion_platillo_importacion_id_fkey" FOREIGN KEY ("importacion_id") REFERENCES "public"."importacion"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "importacion_platillo" ADD CONSTRAINT "importacion_platillo_platillo_sugerido_id_fkey" FOREIGN KEY ("platillo_sugerido_id") REFERENCES "public"."platillo"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "importacion_platillo" ADD CONSTRAINT "importacion_platillo_platillo_id_fkey" FOREIGN KEY ("platillo_id") REFERENCES "public"."platillo"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "importacion_semana" ADD CONSTRAINT "importacion_semana_importacion_id_fkey" FOREIGN KEY ("importacion_id") REFERENCES "public"."importacion"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "menu_alternativa_mostrada" ADD CONSTRAINT "menu_alternativa_mostrada_menu_detalle_id_fkey" FOREIGN KEY ("menu_detalle_id") REFERENCES "public"."menu_detalle"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "menu_alternativa_mostrada" ADD CONSTRAINT "menu_alternativa_mostrada_platillo_id_fkey" FOREIGN KEY ("platillo_id") REFERENCES "public"."platillo"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "menu_detalle" ADD CONSTRAINT "menu_detalle_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "public"."menu_semanal"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "menu_detalle" ADD CONSTRAINT "menu_detalle_platillo_id_fkey" FOREIGN KEY ("platillo_id") REFERENCES "public"."platillo"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "menu_detalle" ADD CONSTRAINT "menu_detalle_modificado_por_id_fkey" FOREIGN KEY ("modificado_por_id") REFERENCES "public"."usuario"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "menu_semanal" ADD CONSTRAINT "menu_semanal_hogar_id_fkey" FOREIGN KEY ("hogar_id") REFERENCES "public"."hogar"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "menu_semanal" ADD CONSTRAINT "menu_semanal_aprobado_por_id_fkey" FOREIGN KEY ("aprobado_por_id") REFERENCES "public"."usuario"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "menu_semanal" ADD CONSTRAINT "menu_semanal_gasto_registrado_por_id_fkey" FOREIGN KEY ("gasto_registrado_por_id") REFERENCES "public"."usuario"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "menu_semanal" ADD CONSTRAINT "menu_semanal_importacion_id_fkey" FOREIGN KEY ("importacion_id") REFERENCES "public"."importacion"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "menu_tiempo" ADD CONSTRAINT "menu_tiempo_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "public"."menu_semanal"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "platillo" ADD CONSTRAINT "platillo_hogar_id_fkey" FOREIGN KEY ("hogar_id") REFERENCES "public"."hogar"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "platillo_alias" ADD CONSTRAINT "platillo_alias_hogar_id_fkey" FOREIGN KEY ("hogar_id") REFERENCES "public"."hogar"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "platillo_alias" ADD CONSTRAINT "platillo_alias_platillo_id_fkey" FOREIGN KEY ("platillo_id") REFERENCES "public"."platillo"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "platillo_etiqueta" ADD CONSTRAINT "platillo_etiqueta_platillo_id_fkey" FOREIGN KEY ("platillo_id") REFERENCES "public"."platillo"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "platillo_etiqueta" ADD CONSTRAINT "platillo_etiqueta_etiqueta_id_fkey" FOREIGN KEY ("etiqueta_id") REFERENCES "public"."etiqueta"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "platillo_ingrediente" ADD CONSTRAINT "platillo_ingrediente_platillo_id_fkey" FOREIGN KEY ("platillo_id") REFERENCES "public"."platillo"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "platillo_ingrediente" ADD CONSTRAINT "platillo_ingrediente_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "public"."producto"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "platillo_ingrediente" ADD CONSTRAINT "platillo_ingrediente_unidad_id_fkey" FOREIGN KEY ("unidad_id") REFERENCES "public"."unidad"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "platillo_tiempo" ADD CONSTRAINT "platillo_tiempo_platillo_id_fkey" FOREIGN KEY ("platillo_id") REFERENCES "public"."platillo"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "producto" ADD CONSTRAINT "producto_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "public"."categoria"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "producto" ADD CONSTRAINT "producto_presentacion_unidad_id_fkey" FOREIGN KEY ("presentacion_unidad_id") REFERENCES "public"."unidad"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "producto_equivalencia" ADD CONSTRAINT "producto_equivalencia_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "public"."producto"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "producto_equivalencia" ADD CONSTRAINT "producto_equivalencia_unidad_id_fkey" FOREIGN KEY ("unidad_id") REFERENCES "public"."unidad"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "despensa_item" ADD CONSTRAINT "despensa_item_hogar_id_fkey" FOREIGN KEY ("hogar_id") REFERENCES "public"."hogar"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "despensa_item" ADD CONSTRAINT "despensa_item_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "public"."producto"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "despensa_item" ADD CONSTRAINT "despensa_item_ultima_inclusion_lista_id_fkey" FOREIGN KEY ("ultima_inclusion_lista_id") REFERENCES "public"."lista_compras"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "lista_compras" ADD CONSTRAINT "lista_compras_hogar_id_fkey" FOREIGN KEY ("hogar_id") REFERENCES "public"."hogar"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "lista_compras" ADD CONSTRAINT "lista_compras_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "public"."menu_semanal"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "lista_item" ADD CONSTRAINT "lista_item_lista_id_fkey" FOREIGN KEY ("lista_id") REFERENCES "public"."lista_compras"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "lista_item" ADD CONSTRAINT "lista_item_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "public"."producto"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "lista_item" ADD CONSTRAINT "lista_item_unidad_requerida_id_fkey" FOREIGN KEY ("unidad_requerida_id") REFERENCES "public"."unidad"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "lista_item" ADD CONSTRAINT "lista_item_comprado_por_id_fkey" FOREIGN KEY ("comprado_por_id") REFERENCES "public"."usuario"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "lista_item_origen" ADD CONSTRAINT "lista_item_origen_lista_item_id_fkey" FOREIGN KEY ("lista_item_id") REFERENCES "public"."lista_item"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "lista_item_origen" ADD CONSTRAINT "lista_item_origen_menu_detalle_id_fkey" FOREIGN KEY ("menu_detalle_id") REFERENCES "public"."menu_detalle"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "sync_cambio" ADD CONSTRAINT "sync_cambio_lista_id_fkey" FOREIGN KEY ("lista_id") REFERENCES "public"."lista_compras"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "sync_cambio" ADD CONSTRAINT "sync_cambio_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "aviso" ADD CONSTRAINT "aviso_hogar_id_fkey" FOREIGN KEY ("hogar_id") REFERENCES "public"."hogar"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "aviso" ADD CONSTRAINT "aviso_corrida_id_fkey" FOREIGN KEY ("corrida_id") REFERENCES "public"."corrida"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "aviso" ADD CONSTRAINT "aviso_leido_por_id_fkey" FOREIGN KEY ("leido_por_id") REFERENCES "public"."usuario"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "corrida_error" ADD CONSTRAINT "corrida_error_corrida_sitio_id_fkey" FOREIGN KEY ("corrida_sitio_id") REFERENCES "public"."corrida_sitio"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "corrida_error" ADD CONSTRAINT "corrida_error_producto_supermercado_id_fkey" FOREIGN KEY ("producto_supermercado_id") REFERENCES "public"."producto_supermercado"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "corrida_sitio" ADD CONSTRAINT "corrida_sitio_corrida_id_fkey" FOREIGN KEY ("corrida_id") REFERENCES "public"."corrida"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "corrida_sitio" ADD CONSTRAINT "corrida_sitio_supermercado_id_fkey" FOREIGN KEY ("supermercado_id") REFERENCES "public"."supermercado"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "notificacion_enviada" ADD CONSTRAINT "notificacion_enviada_hogar_id_fkey" FOREIGN KEY ("hogar_id") REFERENCES "public"."hogar"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "notificacion_enviada" ADD CONSTRAINT "notificacion_enviada_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "public"."menu_semanal"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "precio" ADD CONSTRAINT "precio_producto_supermercado_id_fkey" FOREIGN KEY ("producto_supermercado_id") REFERENCES "public"."producto_supermercado"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "precio" ADD CONSTRAINT "precio_hogar_id_fkey" FOREIGN KEY ("hogar_id") REFERENCES "public"."hogar"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "precio" ADD CONSTRAINT "precio_corrida_id_fkey" FOREIGN KEY ("corrida_id") REFERENCES "public"."corrida"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "precio" ADD CONSTRAINT "precio_ticket_linea_id_fkey" FOREIGN KEY ("ticket_linea_id") REFERENCES "public"."ticket_linea"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "precio" ADD CONSTRAINT "precio_registrado_por_id_fkey" FOREIGN KEY ("registrado_por_id") REFERENCES "public"."usuario"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "precio_resumen" ADD CONSTRAINT "precio_resumen_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "public"."producto"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "precio_resumen" ADD CONSTRAINT "precio_resumen_hogar_id_fkey" FOREIGN KEY ("hogar_id") REFERENCES "public"."hogar"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "precio_resumen" ADD CONSTRAINT "precio_resumen_supermercado_minimo_id_fkey" FOREIGN KEY ("supermercado_minimo_id") REFERENCES "public"."supermercado"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "producto_supermercado" ADD CONSTRAINT "producto_supermercado_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "public"."producto"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "producto_supermercado" ADD CONSTRAINT "producto_supermercado_supermercado_id_fkey" FOREIGN KEY ("supermercado_id") REFERENCES "public"."supermercado"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "producto_supermercado" ADD CONSTRAINT "producto_supermercado_presentacion_unidad_id_fkey" FOREIGN KEY ("presentacion_unidad_id") REFERENCES "public"."unidad"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "producto_supermercado" ADD CONSTRAINT "producto_supermercado_creado_por_hogar_id_fkey" FOREIGN KEY ("creado_por_hogar_id") REFERENCES "public"."hogar"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "producto_supermercado" ADD CONSTRAINT "producto_supermercado_creado_por_usuario_id_fkey" FOREIGN KEY ("creado_por_usuario_id") REFERENCES "public"."usuario"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "supermercado" ADD CONSTRAINT "supermercado_permiso_revisado_por_id_fkey" FOREIGN KEY ("permiso_revisado_por_id") REFERENCES "public"."usuario"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "suscripcion_push" ADD CONSTRAINT "suscripcion_push_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ticket" ADD CONSTRAINT "ticket_hogar_id_fkey" FOREIGN KEY ("hogar_id") REFERENCES "public"."hogar"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ticket" ADD CONSTRAINT "ticket_supermercado_id_fkey" FOREIGN KEY ("supermercado_id") REFERENCES "public"."supermercado"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ticket" ADD CONSTRAINT "ticket_subido_por_id_fkey" FOREIGN KEY ("subido_por_id") REFERENCES "public"."usuario"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ticket_linea" ADD CONSTRAINT "ticket_linea_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."ticket"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ticket_linea" ADD CONSTRAINT "ticket_linea_producto_supermercado_id_fkey" FOREIGN KEY ("producto_supermercado_id") REFERENCES "public"."producto_supermercado"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "clave_idempotencia_usuario_id_clave_key" ON "clave_idempotencia" USING btree ("usuario_id","clave");--> statement-breakpoint
CREATE INDEX "clave_idempotencia_vence_en_idx" ON "clave_idempotencia" USING btree ("vence_en");--> statement-breakpoint
CREATE UNIQUE INDEX "comensal_hogar_id_nombre_normalizado_key" ON "comensal" USING btree ("hogar_id","nombre_normalizado");--> statement-breakpoint
CREATE INDEX "comensal_hogar_id_activo_idx" ON "comensal" USING btree ("hogar_id","activo");--> statement-breakpoint
CREATE UNIQUE INDEX "configuracion_hogar_id_key" ON "configuracion" USING btree ("hogar_id");--> statement-breakpoint
CREATE UNIQUE INDEX "hogar_supermercado_hogar_id_supermercado_id_key" ON "hogar_supermercado" USING btree ("hogar_id","supermercado_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ingrediente_excluido_hogar_id_producto_id_key" ON "ingrediente_excluido" USING btree ("hogar_id","producto_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invitacion_token_hash_key" ON "invitacion" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "invitacion_hogar_id_vence_en_idx" ON "invitacion" USING btree ("hogar_id","vence_en");--> statement-breakpoint
CREATE UNIQUE INDEX "marca_preferida_hogar_id_producto_id_key" ON "marca_preferida" USING btree ("hogar_id","producto_id");--> statement-breakpoint
CREATE UNIQUE INDEX "miembro_hogar_usuario_id_key" ON "miembro_hogar" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX "miembro_hogar_hogar_id_rol_idx" ON "miembro_hogar" USING btree ("hogar_id","rol");--> statement-breakpoint
CREATE UNIQUE INDEX "refresh_token_token_hash_key" ON "refresh_token" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "refresh_token_reemplazado_por_id_key" ON "refresh_token" USING btree ("reemplazado_por_id");--> statement-breakpoint
CREATE INDEX "refresh_token_usuario_id_revocado_en_idx" ON "refresh_token" USING btree ("usuario_id","revocado_en");--> statement-breakpoint
CREATE INDEX "refresh_token_familia_idx" ON "refresh_token" USING btree ("familia");--> statement-breakpoint
CREATE UNIQUE INDEX "tiempo_comida_config_configuracion_id_tiempo_key" ON "tiempo_comida_config" USING btree ("configuracion_id","tiempo");--> statement-breakpoint
CREATE UNIQUE INDEX "token_recuperacion_token_hash_key" ON "token_recuperacion" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "token_recuperacion_usuario_id_idx" ON "token_recuperacion" USING btree ("usuario_id");--> statement-breakpoint
CREATE UNIQUE INDEX "usuario_correo_key" ON "usuario" USING btree ("correo");--> statement-breakpoint
CREATE UNIQUE INDEX "calificacion_menu_detalle_id_key" ON "calificacion" USING btree ("menu_detalle_id");--> statement-breakpoint
CREATE INDEX "calificacion_platillo_id_idx" ON "calificacion" USING btree ("platillo_id");--> statement-breakpoint
CREATE UNIQUE INDEX "categoria_codigo_key" ON "categoria" USING btree ("codigo");--> statement-breakpoint
CREATE UNIQUE INDEX "etiqueta_hogar_id_nombre_normalizado_key" ON "etiqueta" USING btree ("hogar_id","nombre_normalizado");--> statement-breakpoint
CREATE INDEX "importacion_hogar_id_created_at_idx" ON "importacion" USING btree ("hogar_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "importacion_fila_importacion_id_hoja_numero_fila_key" ON "importacion_fila" USING btree ("importacion_id","hoja","numero_fila");--> statement-breakpoint
CREATE UNIQUE INDEX "importacion_platillo_importacion_id_nombre_normalizado_key" ON "importacion_platillo" USING btree ("importacion_id","nombre_normalizado");--> statement-breakpoint
CREATE UNIQUE INDEX "importacion_semana_importacion_id_semana_inicio_key" ON "importacion_semana" USING btree ("importacion_id","semana_inicio");--> statement-breakpoint
CREATE UNIQUE INDEX "menu_alternativa_mostrada_menu_detalle_id_platillo_id_key" ON "menu_alternativa_mostrada" USING btree ("menu_detalle_id","platillo_id");--> statement-breakpoint
CREATE UNIQUE INDEX "menu_detalle_menu_id_fecha_tiempo_key" ON "menu_detalle" USING btree ("menu_id","fecha","tiempo");--> statement-breakpoint
CREATE INDEX "menu_detalle_platillo_id_fecha_idx" ON "menu_detalle" USING btree ("platillo_id","fecha");--> statement-breakpoint
CREATE UNIQUE INDEX "menu_semanal_hogar_id_fecha_inicio_key" ON "menu_semanal" USING btree ("hogar_id","fecha_inicio");--> statement-breakpoint
CREATE INDEX "menu_semanal_hogar_id_estado_fecha_inicio_idx" ON "menu_semanal" USING btree ("hogar_id","estado","fecha_inicio");--> statement-breakpoint
CREATE UNIQUE INDEX "menu_tiempo_menu_id_tiempo_key" ON "menu_tiempo" USING btree ("menu_id","tiempo");--> statement-breakpoint
CREATE UNIQUE INDEX "platillo_hogar_id_nombre_normalizado_key" ON "platillo" USING btree ("hogar_id","nombre_normalizado");--> statement-breakpoint
CREATE INDEX "platillo_hogar_id_activo_proteina_principal_idx" ON "platillo" USING btree ("hogar_id","activo","proteina_principal");--> statement-breakpoint
CREATE INDEX "platillo_nombre_trgm_idx" ON "platillo" USING gin ("nombre_normalizado" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "platillo_alias_hogar_id_alias_normalizado_key" ON "platillo_alias" USING btree ("hogar_id","alias_normalizado");--> statement-breakpoint
CREATE INDEX "platillo_alias_platillo_id_idx" ON "platillo_alias" USING btree ("platillo_id");--> statement-breakpoint
CREATE INDEX "platillo_etiqueta_etiqueta_id_idx" ON "platillo_etiqueta" USING btree ("etiqueta_id");--> statement-breakpoint
CREATE UNIQUE INDEX "platillo_ingrediente_platillo_id_producto_id_key" ON "platillo_ingrediente" USING btree ("platillo_id","producto_id");--> statement-breakpoint
CREATE INDEX "platillo_ingrediente_producto_id_idx" ON "platillo_ingrediente" USING btree ("producto_id");--> statement-breakpoint
CREATE INDEX "platillo_tiempo_tiempo_idx" ON "platillo_tiempo" USING btree ("tiempo");--> statement-breakpoint
CREATE UNIQUE INDEX "producto_nombre_normalizado_presentacion_key" ON "producto" USING btree ("nombre_normalizado","presentacion_cantidad","presentacion_unidad_id");--> statement-breakpoint
CREATE INDEX "producto_tipo_categoria_id_activo_idx" ON "producto" USING btree ("tipo","categoria_id","activo");--> statement-breakpoint
CREATE INDEX "producto_nombre_trgm_idx" ON "producto" USING gin ("nombre_normalizado" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "producto_equivalencia_producto_id_unidad_id_key" ON "producto_equivalencia" USING btree ("producto_id","unidad_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unidad_codigo_key" ON "unidad" USING btree ("codigo");--> statement-breakpoint
CREATE UNIQUE INDEX "despensa_item_hogar_id_producto_id_key" ON "despensa_item" USING btree ("hogar_id","producto_id");--> statement-breakpoint
CREATE INDEX "despensa_item_hogar_id_activo_idx" ON "despensa_item" USING btree ("hogar_id","activo");--> statement-breakpoint
CREATE UNIQUE INDEX "lista_compras_menu_id_key" ON "lista_compras" USING btree ("menu_id");--> statement-breakpoint
CREATE INDEX "lista_compras_hogar_id_idx" ON "lista_compras" USING btree ("hogar_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lista_item_lista_id_producto_id_key" ON "lista_item" USING btree ("lista_id","producto_id");--> statement-breakpoint
CREATE INDEX "lista_item_lista_id_eliminado_idx" ON "lista_item" USING btree ("lista_id","eliminado");--> statement-breakpoint
CREATE INDEX "lista_item_producto_id_comprado_en_idx" ON "lista_item" USING btree ("producto_id","comprado_en");--> statement-breakpoint
CREATE UNIQUE INDEX "lista_item_origen_lista_item_id_menu_detalle_id_key" ON "lista_item_origen" USING btree ("lista_item_id","menu_detalle_id");--> statement-breakpoint
CREATE INDEX "lista_item_origen_menu_detalle_id_idx" ON "lista_item_origen" USING btree ("menu_detalle_id");--> statement-breakpoint
CREATE INDEX "sync_cambio_lista_id_recibido_en_idx" ON "sync_cambio" USING btree ("lista_id","recibido_en");--> statement-breakpoint
CREATE INDEX "aviso_hogar_id_leido_en_idx" ON "aviso" USING btree ("hogar_id","leido_en");--> statement-breakpoint
CREATE INDEX "corrida_estado_programada_para_idx" ON "corrida" USING btree ("estado","programada_para");--> statement-breakpoint
CREATE INDEX "corrida_error_corrida_sitio_id_idx" ON "corrida_error" USING btree ("corrida_sitio_id");--> statement-breakpoint
CREATE INDEX "corrida_error_producto_supermercado_id_idx" ON "corrida_error" USING btree ("producto_supermercado_id");--> statement-breakpoint
CREATE UNIQUE INDEX "corrida_sitio_corrida_id_supermercado_id_key" ON "corrida_sitio" USING btree ("corrida_id","supermercado_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notificacion_enviada_clave_deduplicacion_key" ON "notificacion_enviada" USING btree ("clave_deduplicacion");--> statement-breakpoint
CREATE INDEX "notificacion_enviada_hogar_id_tipo_semana_inicio_idx" ON "notificacion_enviada" USING btree ("hogar_id","tipo","semana_inicio");--> statement-breakpoint
CREATE UNIQUE INDEX "precio_ticket_linea_id_key" ON "precio" USING btree ("ticket_linea_id");--> statement-breakpoint
CREATE INDEX "precio_producto_supermercado_id_fecha_precio_idx" ON "precio" USING btree ("producto_supermercado_id","fecha_precio" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "precio_hogar_id_fecha_precio_idx" ON "precio" USING btree ("hogar_id","fecha_precio");--> statement-breakpoint
CREATE INDEX "precio_corrida_id_idx" ON "precio" USING btree ("corrida_id");--> statement-breakpoint
CREATE UNIQUE INDEX "precio_resumen_producto_id_hogar_id_key" ON "precio_resumen" USING btree ("producto_id","hogar_id");--> statement-breakpoint
CREATE INDEX "precio_resumen_hogar_id_idx" ON "precio_resumen" USING btree ("hogar_id");--> statement-breakpoint
CREATE INDEX "producto_supermercado_producto_id_supermercado_id_activo_idx" ON "producto_supermercado" USING btree ("producto_id","supermercado_id","activo");--> statement-breakpoint
CREATE INDEX "producto_supermercado_supermercado_id_activo_idx" ON "producto_supermercado" USING btree ("supermercado_id","activo");--> statement-breakpoint
CREATE UNIQUE INDEX "supermercado_codigo_key" ON "supermercado" USING btree ("codigo");--> statement-breakpoint
CREATE UNIQUE INDEX "suscripcion_push_endpoint_key" ON "suscripcion_push" USING btree ("endpoint");--> statement-breakpoint
CREATE INDEX "suscripcion_push_usuario_id_idx" ON "suscripcion_push" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX "ticket_hogar_id_created_at_idx" ON "ticket" USING btree ("hogar_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_linea_ticket_id_orden_key" ON "ticket_linea" USING btree ("ticket_id","orden");