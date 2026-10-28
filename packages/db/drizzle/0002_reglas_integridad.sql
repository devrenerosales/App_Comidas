-- Migración manual (ADR-010): reglas de integridad del modelo-datos.md §6.1 que no se
-- declaran en el esquema Drizzle (CHECK e índices únicos parciales). Las migraciones
-- posteriores no repiten este bloque; si una regla cambia, se crea otra migración manual
-- con `pnpm --filter @menu/db db:generate --custom --name=<descripcion>`.

-- Unicidad parcial
CREATE UNIQUE INDEX producto_supermercado_activo_uk
  ON producto_supermercado (producto_id, supermercado_id) WHERE activo;--> statement-breakpoint
CREATE UNIQUE INDEX corrida_una_en_curso_uk
  ON corrida (estado) WHERE estado = 'EN_CURSO';--> statement-breakpoint

-- Hogar y configuración
ALTER TABLE usuario ADD CONSTRAINT usuario_correo_minusculas_ck CHECK (correo = lower(correo));--> statement-breakpoint
ALTER TABLE invitacion ADD CONSTRAINT invitacion_correo_ck CHECK (medio <> 'CORREO' OR correo IS NOT NULL);--> statement-breakpoint
ALTER TABLE comensal ADD CONSTRAINT comensal_factor_ck
  CHECK (factor_porcion BETWEEN 0.25 AND 2.00 AND mod(factor_porcion * 100, 25) = 0);--> statement-breakpoint
ALTER TABLE configuracion ADD CONSTRAINT configuracion_presupuesto_ck CHECK (presupuesto_semanal > 0);--> statement-breakpoint
ALTER TABLE configuracion ADD CONSTRAINT configuracion_hora_ck CHECK (hora_planificacion BETWEEN 0 AND 23);--> statement-breakpoint
ALTER TABLE configuracion ADD CONSTRAINT configuracion_pesos_ck CHECK (
  peso_preferencia BETWEEN 0 AND 1 AND peso_novedad BETWEEN 0 AND 1 AND
  peso_ahorro BETWEEN 0 AND 1 AND peso_afinidad BETWEEN 0 AND 1 AND
  abs(peso_preferencia + peso_novedad + peso_ahorro + peso_afinidad - 1) <= 0.001);--> statement-breakpoint
ALTER TABLE tiempo_comida_config ADD CONSTRAINT tcc_porcentaje_ck
  CHECK (porcentaje BETWEEN 0 AND 100 AND (activo OR porcentaje = 0));--> statement-breakpoint

-- Catálogo
ALTER TABLE producto ADD CONSTRAINT producto_presentacion_ck CHECK (presentacion_cantidad > 0);--> statement-breakpoint
ALTER TABLE producto_equivalencia ADD CONSTRAINT producto_equivalencia_factor_ck CHECK (factor > 0);--> statement-breakpoint
ALTER TABLE platillo ADD CONSTRAINT platillo_porciones_ck CHECK (porciones_base BETWEEN 1 AND 20);--> statement-breakpoint
ALTER TABLE platillo_ingrediente ADD CONSTRAINT platillo_ingrediente_cantidad_ck CHECK (cantidad > 0);--> statement-breakpoint
ALTER TABLE calificacion ADD CONSTRAINT calificacion_valor_ck CHECK (valor BETWEEN 1 AND 5);--> statement-breakpoint

-- Menús
ALTER TABLE menu_semanal ADD CONSTRAINT menu_fechas_ck
  CHECK (fecha_fin >= fecha_inicio AND fecha_fin - fecha_inicio <= 6);--> statement-breakpoint
ALTER TABLE menu_semanal ADD CONSTRAINT menu_gasto_ck
  CHECK (gasto_real IS NULL OR (gasto_real > 0 AND gasto_real <= 99999.99));--> statement-breakpoint
ALTER TABLE menu_semanal ADD CONSTRAINT menu_aprobado_ck
  CHECK (estado <> 'APROBADO' OR (aprobado_en IS NOT NULL AND presupuesto_semanal IS NOT NULL));--> statement-breakpoint
ALTER TABLE menu_semanal ADD CONSTRAINT menu_gasto_estado_ck
  CHECK (gasto_real IS NULL OR estado IN ('APROBADO', 'HISTORICO'));--> statement-breakpoint
ALTER TABLE menu_tiempo ADD CONSTRAINT menu_tiempo_ck
  CHECK (exceso >= 0 AND intentos_ajuste BETWEEN 0 AND 3 AND porcentaje BETWEEN 0 AND 100);--> statement-breakpoint
ALTER TABLE menu_detalle ADD CONSTRAINT menu_detalle_factores_ck CHECK (
  coalesce(factor_preferencia, 0) BETWEEN 0 AND 1 AND coalesce(factor_novedad, 0) BETWEEN 0 AND 1 AND
  coalesce(factor_ahorro, 0) BETWEEN 0 AND 1 AND coalesce(factor_afinidad, 0) BETWEEN 0 AND 1);--> statement-breakpoint

-- Compras y despensa
ALTER TABLE lista_item ADD CONSTRAINT lista_item_producto_o_texto_ck
  CHECK ((producto_id IS NOT NULL) <> (texto_libre IS NOT NULL));--> statement-breakpoint
ALTER TABLE lista_item ADD CONSTRAINT lista_item_cantidad_ck CHECK (cantidad_comprar > 0);--> statement-breakpoint
-- RF-43 / RF-44: precio solo en ítems comprados; montos positivos
ALTER TABLE lista_item ADD CONSTRAINT lista_item_precio_ck CHECK (
  (precio_real IS NULL OR (estado = 'COMPRADO' AND precio_real > 0)) AND
  (contenido_comprado IS NULL OR contenido_comprado > 0) AND
  (precio_normalizado IS NULL OR precio_normalizado > 0));--> statement-breakpoint
ALTER TABLE lista_item ADD CONSTRAINT lista_item_comprado_en_ck
  CHECK ((estado = 'PENDIENTE') = (comprado_en IS NULL));--> statement-breakpoint
ALTER TABLE lista_item_origen ADD CONSTRAINT lista_item_origen_cantidad_ck
  CHECK (cantidad_requerida IS NULL OR cantidad_requerida > 0);--> statement-breakpoint
ALTER TABLE despensa_item ADD CONSTRAINT despensa_cantidad_ck CHECK (cantidad > 0);--> statement-breakpoint

-- Precios (D-05)
ALTER TABLE precio ADD CONSTRAINT precio_valor_ck CHECK (precio > 0 AND precio_normalizado > 0);--> statement-breakpoint
ALTER TABLE precio ADD CONSTRAINT precio_origen_hogar_ck CHECK (
  (origen = 'AUTOMATICO' AND hogar_id IS NULL AND corrida_id IS NOT NULL) OR
  (origen = 'MANUAL'     AND hogar_id IS NOT NULL AND ticket_linea_id IS NULL) OR
  (origen = 'TICKET'     AND hogar_id IS NOT NULL AND ticket_linea_id IS NOT NULL));--> statement-breakpoint
ALTER TABLE producto_supermercado ADD CONSTRAINT vinculo_factor_ck
  CHECK (factor > 0 AND presentacion_cantidad > 0);--> statement-breakpoint
ALTER TABLE supermercado ADD CONSTRAINT supermercado_tasa_ck
  CHECK (solicitudes_por_segundo > 0 AND solicitudes_por_segundo <= 1);--> statement-breakpoint
ALTER TABLE ticket ADD CONSTRAINT ticket_archivo_ck
  CHECK (archivo_bytes <= 10485760 AND archivo_mime IN ('image/jpeg', 'image/png'));--> statement-breakpoint
ALTER TABLE importacion ADD CONSTRAINT importacion_tamano_ck CHECK (tamano_bytes <= 5242880);
