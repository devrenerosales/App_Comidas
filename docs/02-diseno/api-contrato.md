# Contrato de la API REST v1 — Menú Familiar

| Campo | Valor |
|---|---|
| Documento | DIS-MF-003 |
| Versión | 1.3 (HU-02: hogar e invitaciones) |
| Fecha | 2026-10-22 |
| Fase del ciclo de vida | 3. Diseño |
| Base | `https://<host>/api/v1` |
| Fuente | SRS-MF-001 v1.3, historias M01–M10, [`modelo-datos.md`](modelo-datos.md), [`packages/db/src/schema`](../../packages/db/src/schema/) (Drizzle, ADR-010) |

La especificación OpenAPI 3.1 se generará desde los controladores NestJS (`@nestjs/swagger`) en S1 y debe coincidir con este contrato; las diferencias se resuelven actualizando este documento en la misma rama.

## 1. Convenciones

### 1.1 Autenticación y roles

- `Authorization: Bearer <accessToken>`. JWT HS256 con `sub` (usuarioId), `hogarId`, `rol` (nulos si el usuario no tiene hogar), `iat`, `exp`; vigencia **15 min** (ADR-004, reemplaza el supuesto de 24 h de M01). Refresh token opaco de 30 días, rotativo (`POST /auth/refresh`); reutilizar uno ya rotado revoca su familia.
- **Transporte del refresh (ADR-004):** la PWA lo recibe y lo envía en la cookie `mf_refresh` (`HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth`) y las respuestas **no** traen `refreshToken`. La app Android envía `X-Cliente: android` en todas las solicitudes y recibe/envía `refreshToken` en el cuerpo.
- Errores 401 de autenticación: `NO_AUTENTICADO` (sin token), `TOKEN_EXPIRADO`, `TOKEN_INVALIDO`, `CREDENCIALES_INVALIDAS`, `SESION_INVALIDA` (refresh inexistente, vencido o cerrado), `SESION_REVOCADA` (reutilización detectada).
- **El hogar se toma del token, nunca de la ruta.** Las rutas `/hogares/{id}/…` de las historias se normalizan a `/hogar/…` para evitar acceso a otro hogar por cambiar el id (RNF-06).
- Roles en las tablas: **Público** (sin token) · **Auth** (token sin hogar) · **MIEMBRO** (incluye ADMIN, que hereda) · **ADMIN** (solo administrador, RN-10) · **ADMIN_SISTEMA** (`Usuario.esAdminSistema`, datos globales, D-07). El worker de precios no usa la API: escribe en la base y en la cola.

### 1.2 Formato de datos

| Tipo | Formato | Ejemplo |
|---|---|---|
| Dinero (GTQ) | **string** decimal con 2 decimales, sin símbolo | `"248.50"` |
| Porcentaje, peso, factor, cantidad | string decimal | `"60.00"`, `"0.40"`, `"1.25"`, `"2.500"` |
| Fecha de calendario | ISO 8601 `AAAA-MM-DD` (semana, día del menú, fecha de precio) | `"2026-11-01"` |
| Instante | ISO 8601 UTC con `Z` | `"2026-10-25T14:00:00.000Z"` |
| Identificador | uuid v4 | `"3f1c…"` |
| Enumeraciones | MAYÚSCULAS del esquema | `"ALMUERZO"`, `"BORRADOR"` |

Los montos se calculan en el servidor con aritmética decimal; el cliente no recalcula costos, solo los muestra. Campos JSON en camelCase.

### 1.3 Paginación, filtros y orden

- Listas paginadas: `?pagina=1&tamano=20` (máx. 100). Respuesta:

```json
{ "datos": [], "paginacion": { "pagina": 1, "tamano": 20, "total": 134, "totalPaginas": 7 } }
```

- Orden: `?orden=nombre` o `?orden=-fechaInicio` (prefijo `-` descendente). Búsqueda por texto: `?q=`.
- Listas pequeñas y acotadas (comensales, tiempos, supermercados, unidades) no se paginan.

### 1.4 Errores — RFC 7807

Todas las respuestas de error usan `Content-Type: application/problem+json`:

```json
{
  "type": "https://menufamiliar.local/problemas/validacion",
  "title": "Datos no válidos",
  "status": 422,
  "detail": "Faltan 5 % por asignar",
  "instance": "/api/v1/hogar/configuracion/presupuesto",
  "codigo": "PORCENTAJES_NO_SUMAN_100",
  "errores": [ { "campo": "distribucion", "mensaje": "Faltan 5 % por asignar" } ]
}
```

| Código | Uso |
|---|---|
| 400 | Cuerpo mal formado, tipo incorrecto, parámetro faltante (validación de DTO). |
| 401 | Sin token, token vencido o inválido; credenciales incorrectas (mensaje genérico). |
| 403 | Rol insuficiente (p. ej. MIEMBRO cambia presupuesto, RN-10). |
| 404 | No existe **o pertenece a otro hogar** (no se revela la diferencia, RNF-06). |
| 409 | Conflicto de estado o unicidad: duplicado, menú ya aprobado, versión desactualizada, corrida en curso, confirmación requerida. |
| 422 | Formato correcto pero viola una regla de negocio (suma ≠ 100 %, calificación fuera de 1–5, espacios vacíos al aprobar). |
| Otros usados por las historias | 410 enlace vencido o usado (invitación, recuperación) · 413 archivo demasiado grande · 415 tipo de archivo no permitido · 423 cuenta bloqueada · 429 límite de solicitudes. |

`codigo` es estable y lo usa la app para elegir el texto; `detail` trae el mensaje en español de los criterios de aceptación.

### 1.5 Concurrencia, idempotencia y sincronización offline

- **Versión optimista:** `Configuracion`, `MenuSemanal` y `ListaCompras` exponen `version`; las escrituras la reciben y responden 409 `VERSION_DESACTUALIZADA` si cambió (CU-02.3 E1). En la edición de espacios del menú se aplica "último guardado gana" (CU-06.1 E3), por lo que `version` es opcional allí.
- **`Idempotency-Key: <uuid>`** (recomendada en todo POST/PUT y obligatoria en los marcados con ⟳): el servidor guarda la respuesta 24 h por usuario y clave; un reintento con la misma clave y el mismo cuerpo devuelve la respuesta guardada; con otro cuerpo, 422 `CLAVE_IDEMPOTENCIA_REUTILIZADA`.
- **Lista de compras offline:** cada cambio lleva un `id` uuid generado en el dispositivo y su `marcaTiempo`; `POST /listas/{id}/sync` es idempotente por `id` y resuelve conflictos por ítem con "última escritura gana" (CU-07.3). `PATCH /listas/{id}/items/{itemId}` sigue la misma regla: exige `Idempotency-Key` = id del cambio (se registra en `SyncCambio`), de modo que reenviar el mismo cambio de estado o de precio no duplica nada, y un cambio con `marcaTiempo` anterior a la vigente responde 200 con el ítem vigente y `resultado: OBSOLETO`.
- **Menú aprobado offline:** `GET /menus/{id}` y `GET /listas/{id}` envían `ETag`; la app usa `If-None-Match` (304) para refrescar su copia local (RNF-04).

### 1.6 Otros

- `Accept-Language: es-GT` (único idioma v1). Zona horaria de negocio `America/Guatemala` (R-02).
- Límite: 100 solicitudes/min por usuario; `/auth/*` 10/min por IP (429).
- Eventos internos (BullMQ, no REST): `menu.aprobado` → consolidar lista; `costo.recalculado` → evaluar alerta RF-42; `precios.recalcular` → resumen RF-36; `precios.corrida` (cron `0 21 * * 6,0` GT); `notificaciones.recordatorio` (cada hora).

## 2. Endpoints por módulo

Columnas: método · ruta · rol · RF/HU · solicitud → respuesta (resumen) · errores principales.

### 2.1 M01 — Cuenta y hogar

| Método | Ruta | Rol | RF / HU | Solicitud → Respuesta | Errores |
|---|---|---|---|---|---|
| POST | `/auth/registro` | Público | RF-01 · HU-01 | `{nombre, correo, contrasena}` → 201 `{usuario: {id, nombre, correo, esAdminSistema}, accessToken, refreshToken (solo Android), expiraEn, hogar: null}` + cookie `mf_refresh` (PWA) | 400 `VALIDACION` · 409 `CORREO_REGISTRADO` · 422 `CONTRASENA_DEBIL` · 429 |
| POST | `/auth/login` | Público | RF-01 · HU-01 | `{correo, contrasena, dispositivo?}` → 200 `{usuario, accessToken, refreshToken (solo Android), expiraEn, hogar: {id, nombre, rol} \| null}` + cookie (PWA) | 400 · 401 `CREDENCIALES_INVALIDAS` · 423 `CUENTA_BLOQUEADA` (`bloqueadoHasta`) · 429 (`Retry-After`) |
| POST | `/auth/refresh` | Público | RF-01 | `{refreshToken?}` (Android) o cookie (PWA) → 200 misma forma que login con el nuevo par (rota; reutilizar uno rotado revoca la familia); trae `usuario` y `hogar` vigentes para restaurar la sesión al abrir la app | 401 `SESION_INVALIDA` · 401 `SESION_REVOCADA` · 429 |
| POST | `/auth/logout` | Auth | RF-01 | `{refreshToken?}` (Android) o cookie (PWA) → 204; revoca la familia solo si el refresh es del usuario del token y borra la cookie | 401 |
| POST | `/auth/recuperar` | Público | RF-04 · HU-04 | `{correo}` → 202 mensaje neutro siempre | 429 |
| POST | `/auth/validar-recuperacion` | Público | RF-04 · HU-04 | `{token}` → 204 si el enlace está vigente; no lo consume | 410 `ENLACE_NO_VALIDO` · 422 · 429 |
| POST | `/auth/restablecer` | Público | RF-04 · HU-04 | `{token, contrasena, confirmacion}` → 200; invalida sesiones previas | 410 `ENLACE_NO_VALIDO` · 422 |
| GET | `/usuarios/yo` | Auth | RF-01 | → 200 `{id, nombre, correo, esAdminSistema, hogar \| null}` | 401 |
| POST | `/hogares` | Auth (sin hogar) | RF-02 · HU-02 | `{nombre}` (1–80, espacios recortados) → 201 `{hogar: {id, nombre, rol}, rol: "ADMIN", configuracion: {version, presupuestoSemanal, diaInicioSemana, diaPlanificacion, horaPlanificacion, tiempos: [{tiempo, activo, porcentaje}]}, accessToken, expiraEn}`; el nuevo `accessToken` lleva `hogarId` y `rol` | 409 `YA_TIENE_HOGAR` · 422 `NOMBRE_HOGAR_INVALIDO` |
| GET | `/hogar` | MIEMBRO | RF-02 | → 200 `{id, nombre, miembros: [{usuarioId, nombre, correo, rol, desde}]}` (ADMIN primero) | 401 · 403 `SIN_HOGAR` |
| PATCH | `/hogar` | ADMIN | RF-02 | `{nombre}` → 200 `{id, nombre}` | 403 `SOLO_ADMINISTRADOR` · 422 `NOMBRE_HOGAR_INVALIDO` |
| POST | `/hogar/invitaciones` | ADMIN | RF-02 · HU-02 | `{medio: CORREO\|ENLACE, correo?}` → 201 `{id, medio, correo, estado, enlace, venceEn, creadaEn, correoEnviado, usadaEn, usadaPor}`; `enlace` = `APP_URL/invitacion/{token}` solo en esta respuesta. Por correo revoca las vigentes al mismo correo; si el SMTP falla responde 201 con `correoEnviado: false` (CU-01.2 E2) | 400 `VALIDACION` (medio) · 403 · 409 `YA_ES_MIEMBRO` · 422 `CORREO_INVALIDO` |
| GET | `/hogar/invitaciones` | ADMIN | RF-02 | → 200 `[{id, medio, correo, estado: VIGENTE\|USADA\|REVOCADA\|VENCIDA, venceEn, creadaEn, correoEnviado, usadaEn, usadaPor}]` (las 50 más recientes, sin `enlace`) | 403 |
| DELETE | `/hogar/invitaciones/{id}` | ADMIN | RF-02 | → 204 (revoca; repetir no es error) | 403 · 404 (no existe, otro hogar o id mal formado) · 409 `INVITACION_USADA` |
| GET | `/invitaciones/{token}` | Público | RF-02 · HU-02 | → 200 `{hogarNombre, invitadoPor, medio, correo (enmascarado o null), venceEn}` | 410 `INVITACION_NO_VALIDA` · 429 |
| POST | `/invitaciones/{token}/aceptar` | Auth | RF-02 · HU-02 | → 200 `{hogar: {id, nombre, rol}, rol: "MIEMBRO", accessToken, expiraEn}` | 403 `INVITACION_DE_OTRO_CORREO` · 409 `YA_TIENE_HOGAR` · 410 `INVITACION_NO_VALIDA` · 429 |
| GET | `/hogar/comensales` | MIEMBRO | RF-03 · HU-03 | `?incluirInactivos=true\|1` → 200 `{comensales: [{id, nombre, tipo, factorPorcion, activo}], totales: {activos, adultos, ninos, sumaFactores}}`. Activos primero y luego por fecha de alta; `totales` siempre sobre los activos; `sumaFactores` = **total de porciones** (Σ factores, RN-07), p. ej. `"3.50"` | 401 · 403 `SIN_HOGAR` |
| POST | `/hogar/comensales` | ADMIN | RF-03 · HU-03 | `{nombre (1–60, espacios recortados), tipo?: ADULTO\|NINO (ADULTO si se omite; solo informativa), factorPorcion?: número o texto decimal (1.00 si se omite)}` → 201 `{comensal, totales}` | 403 `SOLO_ADMINISTRADOR` ("Solo el administrador puede modificar comensales") · 409 `NOMBRE_REPETIDO` (sin distinguir mayúsculas, espacios ni tildes; si el repetido está inactivo trae `comensalId` y `activo: false`) · 422 `FACTOR_INVALIDO` · 422 `NOMBRE_COMENSAL_INVALIDO` · 400 `VALIDACION` (tipo desconocido, campos extra) |
| PATCH | `/hogar/comensales/{id}` | ADMIN | RF-03 · D-02 | `{nombre?, tipo?, factorPorcion?}` → 200 `{comensal, totales}` | 403 · 404 (no existe, otro hogar o id mal formado) · 409 `NOMBRE_REPETIDO` · 422 `FACTOR_INVALIDO`, `NOMBRE_COMENSAL_INVALIDO` |
| DELETE | `/hogar/comensales/{id}` | ADMIN | RF-03 · HU-03 | Quitar = inactivar (baja lógica; repetir no es error) → 200 `{comensal, totales}` | 403 · 404 · 422 `ULTIMO_COMENSAL` |
| POST | `/hogar/comensales/{id}/reactivar` | ADMIN | RF-03 · HU-03 | → 200 `{comensal, totales}` | 403 · 404 |

`factorPorcion` válido: 0.25 a 2.00 en pasos de 0.25 (D-02; reglas en `@menu/shared`: `esFactorPorcionValido`, `totalPorciones`; CHECK `comensal_factor_ck` en la base). Las escrituras bloquean la fila del hogar para que dos bajas simultáneas no dejen el hogar sin comensales activos. El total de porciones para HU-12/HU-28 se obtiene en la API con `ComensalesService.totalPorciones(hogarId)`.

### 2.2 M02 — Configuración

| Método | Ruta | Rol | RF / HU | Solicitud → Respuesta | Errores |
|---|---|---|---|---|---|
| GET | `/hogar/configuracion` | MIEMBRO | RF-05–RF-08 | → 200 `{version, presupuestoSemanal, tiempos: [{tiempo, activo, porcentaje, monto}] (siempre las 3 filas; inactivas en "0.00"), diaInicioSemana, diaPlanificacion, horaPlanificacion, pesos: {preferencia, novedad, ahorro, afinidad}, actualizadoEn, proximaSemana: {desde, hasta}, semanaTransicion: {desde, hasta} \| null, proximaPlanificacion}`; fechas locales `AAAA-MM-DD` | 403 `SIN_HOGAR` |
| POST | `/hogar/configuracion/vista-previa` | ADMIN | RF-07 · HU-07 | `{tiempos: [..], presupuestoSemanal?, distribucion?: [{tiempo, porcentaje}]}` → 200 `{version, presupuestoSemanal, actual: [{tiempo, porcentaje, monto}], nuevo: [..], impacto: [{tiempo, cambio: AGREGADO\|QUITADO\|MODIFICADO\|SIN_CAMBIO, actual \| null, nuevo \| null, diferenciaMonto}], aplicaDesde, menusAprobadosConservados: [{id, fechaInicio, fechaFin}], borradoresADesactualizar: [..]}` sin guardar; sin `distribucion` propone RN-06 / D-01 | 400 · 403 `SOLO_ADMINISTRADOR` · 422 `COMBINACION_TIEMPOS_INVALIDA`, `PORCENTAJES_NO_SUMAN_100`, `DISTRIBUCION_INVALIDA`, `PRESUPUESTO_INVALIDO` |
| PUT | `/hogar/configuracion/tiempos` | ADMIN | RF-05, RF-07 · HU-05, HU-07 | `{version, tiempos: [{tiempo, porcentaje}], presupuestoSemanal?}` (solo los tiempos activos) → 200 configuración (forma del GET) + `borradoresDesactualizados: [{id, fechaInicio, fechaFin}]` | 400 · 403 · 409 `VERSION_DESACTUALIZADA` · 422 (mismos códigos que la vista previa) |
| PUT | `/hogar/configuracion/presupuesto` | ADMIN | RF-06 · HU-06 | `{version, presupuestoSemanal, modo?: PORCENTAJE\|MONTO, distribucion?: [{tiempo, porcentaje? , monto?}]}` → 200 configuración + `borradoresDesactualizados` (guarda en %; sin `distribucion` conserva los % y recalcula montos) | 400 · 403 · 409 · 422 `PRESUPUESTO_INVALIDO`, `PORCENTAJES_NO_SUMAN_100`, `MONTOS_NO_SUMAN_PRESUPUESTO`, `DISTRIBUCION_INVALIDA` |
| POST | `/hogar/configuracion/semana/vista-previa` | ADMIN | RF-08 · HU-08 | `{version, diaInicioSemana, diaPlanificacion}` → 200 `{version, semanaTransicion, proximaSemana, proximaPlanificacion}`; sin escrituras | 403 · 409 `VERSION_DESACTUALIZADA` · 422 `DIA_SEMANA_INVALIDO` |
| PUT | `/hogar/configuracion/semana` | ADMIN | RF-08 · HU-08 | `{version, diaInicioSemana, diaPlanificacion}` → 200 configuración completa con `semanaTransicion`, `proximaSemana` y `proximaPlanificacion`; crea o ajusta el borrador de transición vacío en la misma transacción | 403 · 409 `VERSION_DESACTUALIZADA` / `SEMANA_EN_CONFLICTO` · 422 `DIA_SEMANA_INVALIDO` |
| GET | `/hogar/preferencias/supermercados` | MIEMBRO | RF-09 · HU-09 | → 200 `[{supermercadoId, nombre, preferido}]` | — |
| PUT | `/hogar/preferencias/supermercados` | MIEMBRO | RF-09 · HU-09 | `{preferidos: [supermercadoId]}` → 200 | 422 `SIN_SUPERMERCADO_PREFERIDO` |
| GET | `/hogar/preferencias/marcas` | MIEMBRO | RF-09 | → 200 `[{productoId, producto, marca}]` | — |
| PUT | `/hogar/preferencias/marcas/{productoId}` | MIEMBRO | RF-09 · HU-09 | `{marca: "Ideal" \| null}` (null = cualquier marca) → 200 | 404 · 422 `MARCA_SIN_VINCULO` |
| GET | `/hogar/preferencias/gustos` | MIEMBRO | RF-10 · HU-10 | → 200 `{ingredientesExcluidos: [producto], favoritos: [platillo]}` | — |
| PUT | `/hogar/preferencias/gustos` | MIEMBRO | RF-10 · HU-10 | `{ingredientesExcluidos: [productoId], favoritos: [platilloId]}` → 200 `{…, impacto: {platillosExcluidos: [{id, nombre}]}, advertencias: [FAVORITO_CON_EXCLUIDO]}` | 404 · 422 `INACTIVO` |

Notas de implementación de la configuración (HU-05, HU-06, HU-07, rama `feature/HU-05-07-configuracion`):
- Montos calculados con enteros (centavos) en `@menu/shared`: monto = presupuesto × % redondeado a centavos; la diferencia de redondeo va al almuerzo (o al tiempo de mayor %). El modo monto convierte a % con 2 decimales y su redondeo también va al almuerzo.
- RN-10: los guardados y la vista previa responden 403 `SOLO_ADMINISTRADOR` antes de validar el cuerpo; el `detail` es "Solo el administrador puede cambiar los tiempos de comida" (vista previa y tiempos) o "Solo el administrador puede cambiar esta configuración" (presupuesto).
- Versión optimista: la escritura se hace con `UPDATE … WHERE version = :version`; si no actualiza filas, 409 `VERSION_DESACTUALIZADA` "La configuración cambió, revisa de nuevo". Guardar valores idénticos no sube la versión.
- Al guardar un cambio efectivo (tiempos, % o presupuesto) se marcan `desactualizado = true` los menús en BORRADOR con `fechaFin` ≥ hoy (America/Guatemala); los APROBADOS e HISTÓRICOS no se tocan (D-04).
- `aplicaDesde` = inicio de la próxima semana (primer `diaInicioSemana` posterior a hoy), saltando las semanas consecutivas con menú aprobado.

### 2.3 M03 — Catálogo

| Método | Ruta | Rol | RF / HU | Solicitud → Respuesta | Errores |
|---|---|---|---|---|---|
| GET | `/platillos` | MIEMBRO | RF-11 · HU-11 | `?q&tiempo&proteina&etiqueta&ingrediente&estado=ACTIVO\|INACTIVO\|INCOMPLETO&pagina&tamano` (por defecto `ACTIVO`; `INCOMPLETO` = activos sin ingredientes) → 200 paginado `{id, nombre, tiempos, proteinaPrincipal, etiquetas, porcionesBase, favorito, incompleto, activo, calificacionPromedio, ingredientesInactivos}`; con `q`, ordenado por similitud | 400 |
| POST | `/platillos` | MIEMBRO | RF-11 · HU-11 | `{nombre, tiempos[], proteinaPrincipal?, etiquetas[]?}` → 201 detalle (proteína por defecto `OTRA`) | 409 `PLATILLO_DUPLICADO` (`existenteId`, `existenteNombre`) · 422 `NOMBRE_OBLIGATORIO`, `NOMBRE_LARGO`, `SIN_TIEMPO`, `MAX_ETIQUETAS`, `ETIQUETA_LARGA` |
| GET | `/platillos/{id}` | MIEMBRO | RF-11, RF-12 | → 200 resumen + `ingredientes: [{id, producto: {id, nombre, etiqueta, activo, presentacionUnidad}, cantidad, unidad}]` + `advertencias: [{codigo: INGREDIENTE_INACTIVO, mensaje, productoId}]` | 404 (no existe, otro hogar o id mal formado) |
| PATCH | `/platillos/{id}` | MIEMBRO | RF-11 | `{nombre?, tiempos?, proteinaPrincipal?, etiquetas?, favorito?}` → 200 detalle | 404 · 409 · 422 |
| POST | `/platillos/{id}/inactivar` · `/reactivar` | MIEMBRO | RF-11 · HU-11 | → 200 detalle | 404 |
| PUT | `/platillos/{id}/ingredientes` | MIEMBRO | RF-12 · HU-12 | `{porcionesBase: 1..20, ingredientes: [{productoId, cantidad, unidadId}]}` (máx. 50; lista vacía = "Incompleto") → 200 detalle + `vistaPrevia` | 404 · 422 `PORCIONES_INVALIDAS`, `CANTIDAD_INVALIDA`, `UNIDAD_INCOMPATIBLE`, `PRODUCTO_REPETIDO`, `PRODUCTO_INACTIVO`, `PRODUCTO_NO_EXISTE`, `UNIDAD_NO_EXISTE` con `errores[].campo = ingredientes.N.<campo>` |
| GET | `/platillos/{id}/vista-previa` | MIEMBRO | RF-12 · RN-07 | `?sumaFactores=0.25..200` (opcional) → 200 `{porcionesBase, sumaFactores, origen: COMENSALES\|PARAMETRO\|PORCIONES_BASE, ingredientes: [{productoId, nombre, cantidadBase, cantidadEscalada, unidad}]}` | 400 · 404 |
| GET / POST / DELETE | `/platillos/{id}/alias[/{aliasId}]` | MIEMBRO | RF-17 | `{alias}` → 201 / 204 (S2) | 409 `ALIAS_EN_USO` |
| GET | `/productos` | MIEMBRO | RF-13 · HU-13 | `?q&tipo&categoria=<codigo>&activo=true\|false\|todos&pagina&tamano` (por defecto solo activos) → 200 paginado `{id, nombre, tipo, categoria: {id, codigo, nombre}, unidadCompra, presentacion: {cantidad, unidad}, etiqueta: "Arroz · bolsa 2 lb", activo}`; `tipo=DESPENSA` o `INGREDIENTE` incluye `AMBOS` | 400 |
| GET | `/productos/{id}` | MIEMBRO | RF-13 | → 200 producto | 404 |
| POST | `/productos` | MIEMBRO | RF-13 · HU-13 | `{nombre, tipo, categoriaId, unidadCompra, presentacionCantidad, presentacionUnidadId}` → 201 | 409 `PRODUCTO_DUPLICADO` (`existenteId`, `existente`) · 422 `PRESENTACION_INVALIDA`, `NOMBRE_OBLIGATORIO`, `NOMBRE_LARGO`, `UNIDAD_COMPRA_INVALIDA`, `CATEGORIA_NO_EXISTE`, `UNIDAD_NO_EXISTE` |
| PATCH | `/productos/{id}` | ADMIN_SISTEMA | RF-13 | parcial → 200 | 403 `SOLO_ADMIN_SISTEMA` · 404 · 409 · 422 `MAGNITUD_EN_USO` |
| POST | `/productos/{id}/inactivar` · `/reactivar` | ADMIN_SISTEMA | RF-13 · HU-13 | → 200 `{producto, platillosAfectados: [{id, nombre}]}` (solo platillos del hogar de quien llama) | 403 · 404 |
| PUT | `/productos/{id}/equivalencias` | MIEMBRO | RF-12, RF-28 | `[{unidadId, factor}]` → 200 (S4) | 422 |
| GET | `/unidades` · `/categorias` · `/supermercados` | MIEMBRO | RF-12, RF-13, RF-09 | → 200 catálogos semilla | — |
| PUT | `/menus/{menuId}/detalles/{detalleId}/calificacion` | MIEMBRO | RF-14 · HU-14 | `{valor: 1..5}` → 200 `{valor, platillo: {id, calificacionPromedio, calificacionConteo}}` | 404 · 409 `MENU_NO_APROBADO` · 422 `CALIFICACION_FUERA_DE_RANGO`, `FECHA_FUTURA` |

Notas de implementación (HU-11, HU-12, HU-13, rama `feature/HU-11-13-catalogo-platillos`):
- Editar, inactivar y reactivar productos pasa de MIEMBRO a **ADMIN_SISTEMA** porque el catálogo es común a todos los hogares (D-05); crear sigue abierto a cualquier miembro (CA-12.2, CA-13.1).
- Nuevo `GET /platillos/{id}/vista-previa`: la Σ factores sale de los comensales activos del hogar (RN-07) o del parámetro `sumaFactores`; sin comensales activos no se escala (`PORCIONES_BASE`).
- Cantidades y presentaciones se aceptan como número o texto decimal (> 0, hasta 3 decimales) y se devuelven como texto (`"2.000"`); `cantidadEscalada` con 3 decimales.
- Búsqueda `?q` sin tildes ni mayúsculas: `LIKE` o `word_similarity` (pg_trgm) ≥ 0.5 sobre `nombre_normalizado`.

### 2.4 M04 — Carga histórica

| Método | Ruta | Rol | RF / HU | Solicitud → Respuesta | Errores |
|---|---|---|---|---|---|
| POST | `/historial/semanas` | ADMIN | RF-15 · HU-15 | `{fechaInicio, detalles: [{fecha, tiempo, platilloId}], gastoReal?, notas?, reemplazar?: false, version?}` → 201 `{id, fechaInicio, fechaFin, estado: HISTORICO, origen: CAPTURA_MANUAL, gastoReal, notas, version}`; domingo–sábado, al menos una comida y máximo 21; gasto opcional positivo hasta 99999.99 | 403 · 409 `SEMANA_EXISTENTE` (trae `semana: {id, version, fechaInicio, gastoReal}`; confirmar con `reemplazar: true` y esa `version`), `VERSION_DESACTUALIZADA`, `SEMANA_PROTEGIDA`, `SEMANA_SOLAPADA` · 422 `INICIO_SEMANA_INVALIDO`, `SEMANA_NO_TERMINADA`, `SIN_PLATILLOS`, `FECHA_FUERA_DE_SEMANA`, `COMIDA_DUPLICADA`, `PLATILLO_NO_VALIDO`, `GASTO_INVALIDO` |
| GET | `/historial/semanas` | MIEMBRO | RF-15 | `?desde&hasta&pagina&tamano` → 200 `{datos: [{id, fechaInicio, fechaFin, estado, origen, gastoReal, notas, version, detalles: [{fecha, tiempo, platilloId, nombre}]}], paginacion}`; filtro inclusivo por inicio, orden de semanas descendente y comidas cronológico; 20 por página por defecto, máximo 100 | 400 paginación inválida · 422 `FECHAS_INVALIDAS` |
| GET | `/importaciones/plantilla` | ADMIN | RF-16 | `?formato=xlsx\|csv&hoja=menus\|listas\|cuaderno` (predeterminado `menus`) → 200 archivo. `hoja=listas` con `csv` devuelve la plantilla de listas; `hoja=cuaderno` con `xlsx` añade la hoja Listas | 403 |
| POST | `/importaciones` | ADMIN | RF-16 · RF-18 · HU-16 · HU-18 | `multipart: archivo, listas?, origen=ARCHIVO\|CUADERNO` → 201 vista previa. `listas` (CSV) y la hoja Listas del Excel solo con `CUADERNO`; no pueden venir las dos a la vez | 403 · 413 (> 5 MB) · 415 · 422 `COLUMNA_FALTANTE`, `DEMASIADAS_FILAS`, `LISTAS_REQUIEREN_CUADERNO`, `LISTAS_DUPLICADAS` |
| GET | `/importaciones/{id}` | ADMIN | RF-16 | → 200 `{id, nombreArchivo, estado, revision, totalFilas, filasConError, pendientes, semanas, puedeConfirmar, reporte}`; `pendientes` lista los nombres de platillo sin decisión (HU-17) | 404 |
| GET | `/importaciones/{id}/filas` | ADMIN | RF-16 | `?hoja=MENUS\|LISTAS&soloErrores=true&pagina&tamano` (predeterminado `MENUS`) → 200 `{datos: [{numeroFila, datos, errores: [{columna, motivo}]}], paginacion}` | 404 |
| GET | `/importaciones/{id}/platillos` | ADMIN | RF-17 · HU-17 | `?estado=pendientes\|revisar\|todos&pagina&tamano` (predeterminado `pendientes`; `revisar` excluye los asociados automáticamente) → 200 `{datos: [{nombreOriginal, nombreNormalizado, proteinaPrincipal, decision, automatica, propuesta: {accion: ASOCIAR\|CREAR, platilloId, platillo, similitud}, platilloId, platillo, nombreFinal}], resumen: {total, pendientes}, paginacion}` | 404 |
| PUT | `/importaciones/{id}/platillos` | ADMIN | RF-17 · HU-17 | `{revision, aceptarPropuestas?, decisiones?: [{nombreNormalizado, decision: ASOCIAR\|CREAR, platilloId?, nombreFinal?}]}` → 200 vista con nueva revisión. Al menos uno de los dos campos; las decisiones explícitas ganan sobre `aceptarPropuestas` | 404 · 409 `IMPORTACION_CERRADA`, `VISTA_DESACTUALIZADA`, `NOMBRE_EN_USO` · 422 `DECISION_INVALIDA`, `SIN_DECISIONES`, `NOMBRE_DUPLICADO` |
| PUT | `/importaciones/{id}/semanas` | ADMIN | RF-16 · HU-16 | `{revision, decisiones: [{semanaInicio, decision: OMITIR\|REEMPLAZAR}]}` → 200 vista previa con nueva revisión | 404 · 409 · 422 |
| POST | `/importaciones/{id}/confirmar` ⟳ | ADMIN | RF-16 · HU-16 | `{revision}` → 201 `{semanasCreadas, reemplazadas, omitidas, platillosCreados, aliasCreados, despensaCargada}`; repetir devuelve el mismo reporte | 404 · 409 `IMPORTACION_CERRADA`, `VISTA_DESACTUALIZADA`, `SEMANA_MODIFICADA` · 422 `FILAS_CON_ERROR`, `PLATILLOS_PENDIENTES` ("Faltan N platillos por resolver"), `SIN_SEMANAS` · 409 `CATALOGO_MODIFICADO` |
| POST | `/importaciones/{id}/cancelar` | ADMIN | RF-16 | `{revision}` → 201 vista cerrada, idempotente | 404 · 409 |
| GET | `/importaciones/{id}/conciliacion` | ADMIN | RF-18 · HU-18 | **No se implementó como ruta aparte.** El reporte de conciliación viaja en la respuesta de `POST /{id}/confirmar` y en `reporte` de la vista: `gastoSemanal {semanas, minimo, maximo, promedio}`, `listas [{lista, tipo, productos, total, nuevos}]`, `productosCreados`, `despensaCargada`. La vista previa trae `listas` y `origen` | — |

La implementación local de HU-16 y su contrato completo se detallan en
[Importación histórica](importacion-historica.md). Las rutas marcadas HU-17/HU-18 siguen pendientes.

### 2.5 M05 — Motor de sugerencias

| Método | Ruta | Rol | RF / HU | Solicitud → Respuesta | Errores |
|---|---|---|---|---|---|
| POST | `/menus/generar` ⟳ | MIEMBRO | RF-19–RF-21 · HU-19–HU-21 | `{semana, regenerar?}` → 201 (nuevo) o 200 (regenerado; conserva fijados) con el menú completo — ver §3.1 | 409 `MENU_APROBADO`, `BORRADOR_EXISTENTE` (enviar `regenerar: true`) · 422 `FALTAN_PLATILLOS` (`faltantes: [{tiempo, cantidad}]`), `CONFIGURACION_INCOMPLETA`, `SEMANA_INVALIDA` |
| GET | `/menus/{menuId}/detalles/{detalleId}/motivo` | MIEMBRO | RF-22 · HU-22 | → 200 `{origen, puntaje, factores: {preferencia, novedad, ahorro, afinidad}, pesos, costo, reglasAplicadas, resumen}`; si `origen = USUARIO`: `{resumen: "Elegido por el usuario"}` | 404 |
| POST | `/menus/{menuId}/detalles/{detalleId}/alternativa` | MIEMBRO | RF-23 · HU-23 | → 200 `{detalle, costos: {tiempo, total}, excede}` | 404 · 409 `MENU_APROBADO`, `ESPACIO_FIJADO` · 422 `SIN_ALTERNATIVAS` |
| PUT | `/hogar/configuracion/pesos-motor` | ADMIN | RF-20 · HU-20 | `{version, preferencia, novedad, ahorro, afinidad}` → 200 | 403 · 409 · 422 `PESOS_NO_SUMAN_1` |

### 2.6 M06 — Plan semanal

| Método | Ruta | Rol | RF / HU | Solicitud → Respuesta | Errores |
|---|---|---|---|---|---|
| GET | `/menus` | MIEMBRO | RF-24–RF-27 | `?desde&hasta&estado&pagina` → 200 paginado `{id, fechaInicio, fechaFin, estado, desactualizado, costoEstimado, presupuestoSemanal, excede}` | — |
| GET | `/menus/semana/{fecha}` | MIEMBRO | RF-24, RF-41 | Menú cuya semana contiene `fecha` → 200 | 404 `SIN_MENU` |
| GET | `/menus/{id}` | MIEMBRO | RF-24, RF-26 | → 200 menú con `tiempos[]`, `detalles[]`, `costos`, `ETag` | 404 |
| PATCH | `/menus/{id}/detalles/{detalleId}` | MIEMBRO | RF-24 · HU-24 | `{platilloId, confirmar?: false}` → 200 detalle (queda fijado, origen USUARIO) + costos | 404 · 409 `MENU_APROBADO`, `CONFIRMACION_REQUERIDA` (`advertencias: [RN02_PROTEINA_CONSECUTIVA, RN03_PLATILLO_REPETIDO]`) · 422 `TIEMPO_NO_APLICABLE` |
| POST | `/menus/{id}/mover` | MIEMBRO | RF-24 · HU-24 | `{origenDetalleId, destinoDetalleId, confirmar?}` → 200 ambos detalles (intercambio) + costos | 404 · 409 · 422 `TIEMPO_NO_APLICABLE` |
| PUT | `/menus/{id}/detalles/{detalleId}/fijado` | MIEMBRO | RF-24 · HU-24 | `{fijado: true\|false}` → 200 | 404 · 409 `MENU_APROBADO` |
| GET | `/menus/{id}/costos` | MIEMBRO | RF-26 · HU-26 | → 200 `{total, presupuesto, diferencia, excede, costoIncompleto, porTiempo: [{tiempo, costo, presupuesto, exceso}], porDia: [{fecha, tiempos: [{tiempo, costo, incompleto}]}]}` | 404 |
| POST | `/menus/{id}/aprobar` ⟳ | MIEMBRO | RF-25 · HU-25 · D-03 | `{version}` → 200 menú APROBADO + `lista` + `excede` — ver §3.2 | 404 · 409 `MENU_YA_APROBADO`, `VERSION_DESACTUALIZADA` · 422 `ESPACIOS_VACIOS` (`espacios: [{fecha, tiempo}]`) |
| PUT | `/menus/{id}/gasto-real` ⟳ | MIEMBRO | RF-27 · HU-27 | `{monto, nota?}` → 200 `{gastoReal, diferenciaVsEstimado, diferenciaVsPresupuesto, registradoPor, registradoEn}` | 404 · 409 `MENU_NO_APROBADO` · 422 `MONTO_INVALIDO` |

### 2.7 M07 — Lista de compras y despensa

| Método | Ruta | Rol | RF / HU | Solicitud → Respuesta | Errores |
|---|---|---|---|---|---|
| GET | `/listas/{id}` | MIEMBRO | RF-28, RF-31 · HU-28, HU-31 | `?agrupar=SUPERMERCADO\|CATEGORIA\|NINGUNO` → 200 `{id, menuId, semana, version, excede, comprados, total, grupos: [{supermercado, subtotal, categorias: [{categoria, items: [{id, producto, cantidadComprar, presentacion, origen, estado, precioReal, precioMinimo, fechaPrecio, promedioCompra, advertencia, comidas: [menuDetalleId]}]}]}], sinPrecio: [...], avance: {cubiertos, total, porcentaje}, gastoSugerido}` + `ETag` (incluye los vínculos ítem ↔ comida para calcular el avance sin conexión) | 404 · 304 |
| GET | `/menus/{id}/lista` | MIEMBRO | RF-25 | → 303 a `/listas/{listaId}` | 404 · 409 `MENU_NO_APROBADO` |
| POST | `/listas/{id}/items` ⟳ | MIEMBRO | RF-30 · HU-30 | `{id (uuid cliente), productoId \| textoLibre, cantidadComprar}` → 201 ítem + `version` | 404 · 422 `CANTIDAD_INVALIDA` |
| PATCH | `/listas/{id}/items/{itemId}` ⟳ | MIEMBRO | RF-30, RF-43, RF-44 · HU-30, HU-43, HU-44 | `Idempotency-Key: <id del cambio>` `{cantidadComprar?, estado?: PENDIENTE\|COMPRADO\|YA_LO_TENGO, precioReal?: "28.10" \| null, contenidoComprado?: "2.000", marcaTiempo}` → 200 `{item: {id, estado, compradoEn, compradoPor, precioReal, contenidoComprado, precioNormalizado}, resultado: APLICADO\|OBSOLETO, version, promedioCompra?: {promedio, compras, desde}, gastoSugerido}`. Pasar a PENDIENTE o YA_LO_TENGO borra el precio. Ver §3.3 | 404 · 422 `PRECIO_INVALIDO` (≤ 0, más de 2 decimales, > 99999.99), `PRECIO_SIN_COMPRA` (precio con estado ≠ COMPRADO), `CONTENIDO_INVALIDO` · 422 `CLAVE_IDEMPOTENCIA_REUTILIZADA` |
| DELETE | `/listas/{id}/items/{itemId}` | MIEMBRO | RF-30 | → 200 (borrado lógico) | 404 |
| POST | `/listas/{id}/sync` | MIEMBRO | RF-30 · HU-30 · RNF-04 | `{versionBase, cambios: [{id, itemId, operacion: AGREGAR\|ACTUALIZAR\|MARCAR_COMPRADO\|MARCAR_YA_LO_TENGO\|DESMARCAR_COMPRADO\|REGISTRAR_PRECIO\|ELIMINAR, datos, marcaTiempo}]}` (`datos` de MARCAR_COMPRADO y REGISTRAR_PRECIO admite `precioReal` y `contenidoComprado`) → 200 `{version, resultados: [{id, resultado: APLICADO\|OBSOLETO\|RECHAZADO, motivo?}], items: [ítems cambiados desde versionBase]}` | 404 (lista de otro hogar: todos RECHAZADO) · 422 lote > 500 |
| GET | `/listas/{id}/avance` | MIEMBRO | RF-43 · HU-43 · RN-13 | → 200 `{general: {cubiertos: 18, total: 31, porcentaje: 58}, comidas: [{menuDetalleId, fecha, tiempo, platillo, cubiertos, total, listaParaPreparar, sinIngredientes, pendientes: [{itemId, producto}]}]}` + `ETag`. Cubierto = estado COMPRADO o YA_LO_TENGO; ítems sin comida cuentan solo en `general` | 404 · 304 |
| GET | `/listas/{id}/texto` | MIEMBRO | RF-32 · HU-32 | `?incluirComprados=false&agrupar=` → 200 `text/plain` (la app también puede armarlo offline) | 404 · 422 `SIN_PENDIENTES` |
| GET | `/despensa` | MIEMBRO | RF-29 · HU-29 | → 200 `[{id, producto, cantidad, frecuencia, ultimaInclusionSemana, tocaEstaSemana}]` | — |
| POST | `/despensa` | MIEMBRO | RF-29 · HU-29 | `{productoId, cantidad, frecuencia}` → 201 | 409 `YA_EN_DESPENSA` · 422 |
| PATCH / DELETE | `/despensa/{id}` | MIEMBRO | RF-29 | parcial → 200 / 204 (inactiva) | 404 · 422 |

### 2.8 M08 — Precios

| Método | Ruta | Rol | RF / HU | Solicitud → Respuesta | Errores |
|---|---|---|---|---|---|
| PATCH | `/supermercados/{id}/extraccion` | ADMIN_SISTEMA | RF-33 · D-07 | `{extraccionPermitida, habilitado, dominio?, notaTerminos}` → 200 | 403 · 404 |
| GET | `/productos/{id}/vinculos` | MIEMBRO | RF-35, RF-09 · HU-35, HU-09 | → 200 `[{id, supermercado, nombreTienda, marca, presentacion, factor, url, sku, activo, ultimoPrecio: {precio, fecha, origen}}]` | 404 |
| POST | `/productos/{id}/vinculos` | MIEMBRO | RF-35 · HU-35 | `?reemplazar=false` `{supermercadoId, nombreTienda, marca?, presentacionCantidad, presentacionUnidadId, url?, sku?}` → 201 `{…, factor}` | 404 · 409 `VINCULO_ACTIVO_EXISTE` · 422 `UNIDAD_NO_CONVERTIBLE`, `URL_FUERA_DE_DOMINIO`, `URL_O_SKU_REQUERIDO` |
| PATCH | `/vinculos/{id}` | MIEMBRO | RF-35 | `{nombreTienda?, marca?, url?, sku?}` → 200 (presentación no editable: se reemplaza) | 404 · 422 |
| POST | `/vinculos/{id}/inactivar` | MIEMBRO | RF-35 | → 200 | 404 |
| POST | `/precios` ⟳ | MIEMBRO | RF-34 · HU-34 | `{productoSupermercadoId \| {productoId, supermercadoId, presentacion…}, precio, fechaPrecio}` → 201 `{precio, precioNormalizado, origen: MANUAL}`; encola recálculo | 404 · 422 `PRECIO_INVALIDO`, `FECHA_FUTURA` |
| POST | `/tickets` | MIEMBRO | RF-34 · HU-34 | `multipart: imagen, supermercadoId, fechaCompra` → 202 `{id, estado: PROCESANDO}` | 413 (> 10 MB) · 415 · 422 |
| GET | `/tickets/{id}` | MIEMBRO | RF-34 | → 200 `{estado, imagenUrl, lineas: [{id, descripcion, precio, propuesta: {vinculoId, nombreTienda, similitud}, estado}]}` | 404 |
| PUT | `/tickets/{id}/lineas` | MIEMBRO | RF-34 · HU-34 | `{lineas: [{id, productoSupermercadoId \| null, precio, estado: ASIGNADA\|DESCARTADA}]}` → 200 | 404 · 409 `TICKET_CONFIRMADO` · 422 |
| POST | `/tickets/{id}/confirmar` ⟳ | MIEMBRO | RF-34 · HU-34 | → 201 `{preciosCreados}`; encola recálculo | 404 · 409 · 422 `LINEAS_SIN_ASIGNAR` |
| POST | `/tickets/{id}/descartar` | MIEMBRO | RF-34 | → 200 | 404 · 409 |
| GET | `/productos/{id}/precios` | MIEMBRO | RF-37 · HU-37 | `?semanas=12\|4` → 200 `{series: [{supermercado, puntos: [{fecha, precioNormalizado, origen}], variacionAnterior, variacionPeriodo}]}` | 404 |
| GET | `/productos/{id}/resumen-precio` | MIEMBRO | RF-36, RF-44 · HU-36, HU-44 | → 200 `{precioMediana, precioMinimo, supermercadoMinimo, fechaPrecioMinimo, cantidadPrecios, desactualizado, promedioCompra, precioRespaldo: {valor, fuente: MINIMO_VIGENTE\|PROMEDIO_COMPRA\|ULTIMO_PRECIO, advertencia}}` | 404 `SIN_PRECIO` (sin precios de mercado ni de compra) |
| GET | `/productos/{id}/promedio-compra` | MIEMBRO | RF-44 · HU-44 · RN-12 | `?semanas=12` (fijo en v1) → 200 `{productoId, presentacion: "bolsa 2 lb", promedio: "27.20", compras: 3, desde: "2026-08-02", hasta: "2026-10-25", detalle: [{fecha, precioReal, contenidoComprado, precioNormalizado}]}`; sin compras en la ventana → `promedio: null, compras: 0`. Solo precios del hogar del token | 404 |
| GET | `/corridas` | ADMIN | RF-33, RF-38 · HU-33, HU-38 | `?pagina` → 200 paginado con estado y totales por sitio | 403 |
| GET | `/corridas/{id}` | ADMIN | RF-38 | → 200 con `sitios[]` y `errores[]` | 403 · 404 |
| POST | `/corridas` | ADMIN_SISTEMA | RF-33 | `{supermercados?: [codigo]}` → 202 `{id, estado: EN_CURSO}` (disparo manual) | 403 · 409 `CORRIDA_EN_CURSO` |
| GET | `/avisos` | ADMIN | RF-38 · HU-38 | `?noLeidos=true` → 200 `[{id, tipo, titulo, mensaje, createdAt}]` | 403 |
| POST | `/avisos/{id}/leido` | ADMIN | RF-38 | → 204 | 403 · 404 |

### 2.9 M09 — Reportes

| Método | Ruta | Rol | RF / HU | Solicitud → Respuesta | Errores |
|---|---|---|---|---|---|
| GET | `/reportes/gasto` | MIEMBRO | RF-39 · HU-39 | `?semanas=12` → 200 `{semanasMostradas, semanas: [{fechaInicio, estimado \| null, real \| null, presupuesto, difRealPresupuesto: {monto, porcentaje}, difRealEstimado, excede}]}` | 422 `SEMANAS_FUERA_DE_RANGO` (1–52) |
| GET | `/reportes/platillos` | MIEMBRO | RF-40 · HU-40 | `?semanas=12&top=10&diasOlvido=28` → 200 `{frecuentes: [{platillo, veces, ultimaFecha}], olvidados: [{platillo, ultimaFecha \| null, dias \| null}]}` | — |

### 2.10 M10 — Notificaciones

| Método | Ruta | Rol | RF / HU | Solicitud → Respuesta | Errores |
|---|---|---|---|---|---|
| GET | `/notificaciones/web-push/clave-publica` | Auth | RF-41 · IE-04 | → 200 `{vapidPublicKey}` | — |
| POST | `/notificaciones/suscripciones` | MIEMBRO | RF-41, RF-42 · HU-41 | `{canal: WEB_PUSH\|FCM, endpoint, p256dh?, auth?, dispositivo?}` → 201 (o 200 si el endpoint ya existía: upsert) | 422 `SUSCRIPCION_INVALIDA` |
| GET | `/notificaciones/suscripciones` | MIEMBRO | RF-41 | → 200 dispositivos del usuario | — |
| DELETE | `/notificaciones/suscripciones/{id}` | MIEMBRO | RF-41 | → 204 | 404 |
| GET | `/notificaciones` | MIEMBRO | RF-41, RF-42 | `?pagina` → 200 historial del hogar `{tipo, semanaInicio, resultado, enviadaEn}` | — |

El recordatorio (domingo 08:00, D-08) y la alerta de 10 % (RF-42) los emite el servidor; no tienen endpoint de disparo.

## 3. Ejemplos

### 3.1 `POST /menus/generar`

Hogar con almuerzo y cena, presupuesto Q500.00 (60/40), 4 comensales con Σ factores 3.50.

**Solicitud**

```http
POST /api/v1/menus/generar
Authorization: Bearer eyJhbGciOi...
Idempotency-Key: 7d4b2f0e-3c1a-4e55-9f6a-1a2b3c4d5e6f
Content-Type: application/json

{ "semana": "2026-11-01", "regenerar": false }
```

**Respuesta 201** (se muestran 2 de los 14 detalles)

```json
{
  "id": "0b8e6a52-6f0e-4a3f-9d8e-5c1f2a7b9e10",
  "fechaInicio": "2026-11-01",
  "fechaFin": "2026-11-07",
  "estado": "BORRADOR",
  "desactualizado": false,
  "version": 1,
  "presupuestoSemanal": "500.00",
  "sumaFactoresPorcion": "3.50",
  "pesos": { "preferencia": "0.40", "novedad": "0.25", "ahorro": "0.20", "afinidad": "0.15" },
  "costoEstimado": "512.40",
  "costoIncompleto": false,
  "excede": { "monto": "12.40", "texto": "Excede por Q12.40" },
  "tiempos": [
    { "tiempo": "ALMUERZO", "porcentaje": "60.00", "presupuesto": "300.00", "costoEstimado": "293.15", "exceso": "0.00", "intentosAjuste": 1, "estado": "DENTRO_DEL_PRESUPUESTO" },
    { "tiempo": "CENA", "porcentaje": "40.00", "presupuesto": "200.00", "costoEstimado": "219.25", "exceso": "19.25", "intentosAjuste": 3, "estado": "EXCEDE",
      "alternativas": [ { "fecha": "2026-11-03", "platillos": [ { "id": "c2…", "nombre": "Huevos rancheros", "costo": "18.50" } ] } ] }
  ],
  "detalles": [
    { "id": "9a1…", "fecha": "2026-11-01", "tiempo": "ALMUERZO",
      "platillo": { "id": "51e…", "nombre": "Pollo en crema", "proteinaPrincipal": "POLLO" },
      "fijado": false, "origen": "MOTOR", "puntaje": "0.6375",
      "factores": { "preferencia": "0.9000", "novedad": "0.5000", "ahorro": "0.2000", "afinidad": "0.7500" },
      "costoEstimado": "38.75", "costoIncompleto": false, "reglasAplicadas": [] },
    { "id": "9a2…", "fecha": "2026-11-02", "tiempo": "ALMUERZO",
      "platillo": { "id": "77b…", "nombre": "Carne guisada", "proteinaPrincipal": "RES" },
      "fijado": false, "origen": "REEMPLAZO_PRESUPUESTO", "puntaje": "0.6075",
      "factores": { "preferencia": "0.7500", "novedad": "1.0000", "ahorro": "0.1000", "afinidad": "0.2500" },
      "costoEstimado": "41.20", "costoIncompleto": false, "reglasAplicadas": ["REEMPLAZO_PRESUPUESTO"] }
  ],
  "avisos": [ { "codigo": "SIN_SUGERENCIA", "fecha": "2026-11-06", "tiempo": "CENA", "mensaje": "Ningún platillo cumple RN-02 y RN-03 para este día" } ]
}
```

`excede` y `tiempos[].exceso` alimentan el texto rojo "Excede por Q__" (RN-11). Regenerar (`"regenerar": true`) responde 200 con la misma forma y conserva los detalles `fijado: true`.

**Errores**

```json
{
  "type": "https://menufamiliar.local/problemas/faltan-platillos",
  "title": "No hay suficientes platillos",
  "status": 422,
  "detail": "Faltan 3 platillos de Cena",
  "instance": "/api/v1/menus/generar",
  "codigo": "FALTAN_PLATILLOS",
  "faltantes": [ { "tiempo": "CENA", "cantidad": 3 } ]
}
```

```json
{
  "type": "https://menufamiliar.local/problemas/conflicto",
  "title": "La semana ya tiene un menú aprobado",
  "status": 409,
  "detail": "El menú del 01/11 al 07/11 ya está aprobado y no se puede regenerar",
  "instance": "/api/v1/menus/generar",
  "codigo": "MENU_APROBADO",
  "menuId": "0b8e6a52-6f0e-4a3f-9d8e-5c1f2a7b9e10"
}
```

### 3.2 `POST /menus/{id}/aprobar`

Aprobar con exceso está permitido (D-03): no hay confirmación extra; la respuesta trae el exceso para mostrarlo en rojo.

**Solicitud**

```http
POST /api/v1/menus/0b8e6a52-6f0e-4a3f-9d8e-5c1f2a7b9e10/aprobar
Authorization: Bearer eyJhbGciOi...
Idempotency-Key: 1f0a9c77-2b4e-4d1b-8a55-0e9d8c7b6a51
Content-Type: application/json

{ "version": 4 }
```

**Respuesta 200**

```json
{
  "menu": {
    "id": "0b8e6a52-6f0e-4a3f-9d8e-5c1f2a7b9e10",
    "fechaInicio": "2026-11-01",
    "fechaFin": "2026-11-07",
    "estado": "APROBADO",
    "version": 5,
    "aprobadoPor": { "id": "e4c…", "nombre": "Ana" },
    "aprobadoEn": "2026-10-25T15:12:08.000Z",
    "presupuestoSemanal": "500.00",
    "costoEstimado": "512.40",
    "excesoAlAprobar": "12.40",
    "tiempos": [
      { "tiempo": "ALMUERZO", "porcentaje": "60.00", "presupuesto": "300.00", "costoEstimado": "293.15", "exceso": "0.00" },
      { "tiempo": "CENA", "porcentaje": "40.00", "presupuesto": "200.00", "costoEstimado": "219.25", "exceso": "19.25" }
    ]
  },
  "excede": { "monto": "12.40", "texto": "Excede por Q12.40" },
  "lista": {
    "id": "5d3e1b0a-8c2f-4f7e-a1b2-c3d4e5f60718",
    "version": 1,
    "totalItems": 31,
    "itemsMenu": 24,
    "itemsDespensa": 7,
    "url": "/api/v1/listas/5d3e1b0a-8c2f-4f7e-a1b2-c3d4e5f60718"
  }
}
```

En la misma transacción el menú pasa a APROBADO, se congelan presupuesto, tiempos y Σ factores (D-04), se registra `excesoAlAprobar` (RN-11) y se crea la lista; luego se publica `menu.aprobado` (consolidación y despensa) y `costo.recalculado` (RF-42).

**Errores**

```json
{
  "type": "https://menufamiliar.local/problemas/validacion",
  "title": "El menú tiene espacios vacíos",
  "status": 422,
  "detail": "Asigna un platillo a todos los espacios antes de aprobar",
  "instance": "/api/v1/menus/0b8e6a52-6f0e-4a3f-9d8e-5c1f2a7b9e10/aprobar",
  "codigo": "ESPACIOS_VACIOS",
  "espacios": [ { "fecha": "2026-11-06", "tiempo": "CENA" } ]
}
```

```json
{
  "type": "https://menufamiliar.local/problemas/conflicto",
  "title": "El menú ya fue aprobado",
  "status": 409,
  "detail": "Otro miembro aprobó este menú a las 09:10",
  "instance": "/api/v1/menus/0b8e6a52-6f0e-4a3f-9d8e-5c1f2a7b9e10/aprobar",
  "codigo": "MENU_YA_APROBADO",
  "menuId": "0b8e6a52-6f0e-4a3f-9d8e-5c1f2a7b9e10"
}
```

Un reintento con el mismo `Idempotency-Key` (p. ej. tras perder la conexión) devuelve la misma respuesta 200 sin volver a ejecutar la aprobación.

### 3.3 `PATCH /listas/{id}/items/{itemId}` — marcar comprado con precio real

Solicitud (el teléfono puede enviarla al reconectar; la clave es el id del cambio guardado en la cola local):

```http
PATCH /api/v1/listas/5d3e1b0a-8c2f-4f7e-a1b2-c3d4e5f60718/items/9a7b6c5d-4e3f-4a2b-8c1d-0e9f8a7b6c5d
Idempotency-Key: 0c8f7e6d-5b4a-4392-8a1b-2c3d4e5f6a7b
Content-Type: application/json

{
  "estado": "COMPRADO",
  "precioReal": "28.10",
  "contenidoComprado": "2.000",
  "marcaTiempo": "2026-10-25T16:42:10.000Z"
}
```

Respuesta 200 (el mismo cuerpo se devuelve si la solicitud se repite con la misma clave):

```json
{
  "item": {
    "id": "9a7b6c5d-4e3f-4a2b-8c1d-0e9f8a7b6c5d",
    "producto": "Pechuga de pollo · bolsa 2 lb",
    "estado": "COMPRADO",
    "compradoEn": "2026-10-25T16:42:10.000Z",
    "compradoPor": "Rene",
    "precioReal": "28.10",
    "contenidoComprado": "2.000",
    "precioNormalizado": "28.10"
  },
  "resultado": "APLICADO",
  "version": 42,
  "promedioCompra": { "promedio": "27.20", "compras": 3, "desde": "2026-08-02" },
  "gastoSugerido": "99.50"
}
```

`promedioCompra` = (26.50 + 27.00 + 28.10) ÷ 3 = 27.20 (RN-12; la compra del 12/07/2026 queda fuera de las 12 semanas). `gastoSugerido` = suma de `precioReal` de la lista; la app lo usa para prellenar `PUT /menus/{id}/gasto-real` si todavía no hay gasto registrado (RF-27).

## 4. Diferencias con las rutas de las historias

Cambios de la versión 1.3 (HU-02):
- `POST /hogares` y `POST /invitaciones/{token}/aceptar` devuelven `hogar` con `rol` (además de `rol` suelto) y `expiraEn` del nuevo token.
- `GET /hogar` agrega `correo` y `desde` a cada miembro; sin hogar, las rutas `/hogar/…` responden 403 `SIN_HOGAR`.
- `HogarGuard` toma `hogarId` y `rol` de `miembro_hogar` en cada solicitud (no del token): un token anterior a unirse o a un cambio de rol no da más ni menos acceso. RN-10 responde 403 `SOLO_ADMINISTRADOR`.
- Invitaciones: respuesta completa con `estado`; `GET /invitaciones/{token}` agrega `invitadoPor`, `medio` y `correo` enmascarado; la invitación por correo solo la acepta la cuenta de ese correo (403 `INVITACION_DE_OTRO_CORREO`); `DELETE` de una ya usada → 409 `INVITACION_USADA`. 410 se usa para vencida, usada, revocada o inexistente.
- Validación del nombre del hogar y del correo invitado como 422 con código propio (`NOMBRE_HOGAR_INVALIDO`, `CORREO_INVALIDO`).
- `/invitaciones/*` comparte el límite por IP de `/auth/*` (10/min). El token es de 32 bytes base64url; se guarda su HMAC-SHA256.

Cambios de la versión 1.2 (HU-01): vigencia del acceso de 15 min; `refreshToken` en el cuerpo solo para Android (`X-Cliente: android`), cookie HttpOnly en la PWA; `refresh` y `logout` aceptan el refresh del cuerpo o de la cookie; `refresh` devuelve también `usuario` y `hogar`; `expiraEn` es el instante ISO 8601 UTC de vencimiento del acceso; los 429 incluyen `Retry-After`.


| Historia | Ruta en la historia | Ruta del contrato | Motivo |
|---|---|---|---|
| M01–M02 | `/hogares/{id}/…` | `/hogar/…` | Hogar del token (RNF-06). |
| M05 CU-05.1 | `POST /menus/sugerencias` | `POST /menus/generar` | Nombre acordado para el contrato. |
| M03 CU-11.1 | `PUT /menu-detalle/{id}/calificacion` | `PUT /menus/{menuId}/detalles/{detalleId}/calificacion` | Recursos anidados uniformes. |
| M05 CU-05.4 | `GET /menus/detalles/{id}/motivo` | `GET /menus/{menuId}/detalles/{detalleId}/motivo` | Ídem. |
| M08 CU-08.1 | `POST /precios/ticket`, `/precios/ticket/{id}/confirmar` | `POST /tickets`, `/tickets/{id}/confirmar` | El ticket es un recurso con estado propio. |
| M02 CU-02.5 | `GET /productos/{id}/equivalentes` | `GET /productos/{id}/vinculos` | Mismo recurso que RF-35. |
| M06 CU-06.2 | Sin confirmación (corregido en las historias con SRS v1.3) | Sin confirmación; la respuesta trae `excede` | D-03, ya alineado. |
| M07 CU-07.3 | Campo `comprado` (booleano) | Campo `estado` (PENDIENTE, COMPRADO, YA_LO_TENGO) | RF-43 agrega "Ya lo tengo". |
