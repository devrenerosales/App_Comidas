# Diagramas de secuencia técnicos — Menú Familiar

| Campo | Valor |
|---|---|
| Documento | SEC-MF-001 |
| Versión | 1.0 (para aprobación del PO) |
| Fecha | 2026-10-22 |
| Base | [arquitectura.md](arquitectura.md) · historias M01, M05–M08, M10 |
| Fase del ciclo de vida | 3. Diseño |

Nombres reales del diseño: servicios NestJS (`AuthService`, `SugerenciasService`…), colas BullMQ (`precios-corrida`…) y tablas PostgreSQL (`menu_semanal`…). Rutas con prefijo `/api/v1`. Todas las consultas de datos del hogar llevan `hogar_id` del token (RNF-06).

| # | Flujo | CU / RF | Sección |
|---|---|---|---|
| 1 | Inicio de sesión | CU-01.1 · RF-01 | [1.1](#11-inicio-de-sesión) |
| 2 | Renovación de token | ADR-004 | [1.2](#12-renovación-de-token-refresh) |
| 3 | Generar menú | CU-05 · RF-19–22 | [2](#2-generar-menú-semanal-cu-05) |
| 4 | Aprobar menú y generar lista | CU-06.2 → CU-07.1/07.2 · D-03 | [3](#3-aprobar-menú-y-generar-lista-cu-062--cu-07) |
| 5 | Corrida de precios | CU-09.1–09.3 · RF-33, RF-36, RF-38 | [4](#4-corrida-automática-de-precios-cu-09) |
| 6 | Sincronización offline | CU-07.3 · RF-30 · RNF-04 | [5](#5-sincronización-offline-de-la-lista-cu-073) |
| 7 | Recordatorio de planificación | CU-12.1 · RF-41 | [6.1](#61-recordatorio-de-planificación-cu-121) |
| 8 | Alerta de costo | CU-12.2 · RF-42 | [6.2](#62-alerta-de-costo-sobre-presupuesto-cu-122) |

## 1. Autenticación

### 1.1 Inicio de sesión

```mermaid
sequenceDiagram
  actor U as Usuario
  participant APP as App Ionic
  participant WEB as Caddy HTTPS
  participant AUTH as API AuthController y AuthService
  participant DB as PostgreSQL

  U->>APP: Correo y contraseña
  APP->>WEB: POST /api/v1/auth/login
  WEB->>AUTH: reverse_proxy /api/* a api:3000
  AUTH->>DB: SELECT usuario por correo con intentos_fallidos y bloqueado_hasta
  DB-->>AUTH: Usuario
  alt Cuenta bloqueada o credenciales inválidas
    AUTH->>DB: UPDATE usuario intentos_fallidos más 1 y bloqueo si llega a 5 en 15 min
    AUTH-->>APP: 401 "Credenciales inválidas" o 423 bloqueada
    APP-->>U: Mensaje de error
  else argon2.verify correcto
    AUTH->>DB: UPDATE usuario intentos_fallidos = 0
    AUTH->>AUTH: Firmar JWT acceso 15 min con sub, hogarId, rol
    AUTH->>AUTH: Generar refresh opaco 32 bytes y nueva familiaId
    AUTH->>DB: INSERT refresh_token hash SHA-256, familia_id, vence 30 días
    alt Cliente PWA
      AUTH-->>APP: 200 accessToken y Set-Cookie refresh HttpOnly Secure SameSite=Strict
    else Cliente Android
      AUTH-->>APP: 200 accessToken y refreshToken en el cuerpo
      APP->>APP: Guardar refresh en almacenamiento seguro del dispositivo
    end
    APP->>APP: Guardar accessToken solo en memoria
    APP-->>U: Pantalla principal del hogar
  end
```

### 1.2 Renovación de token (refresh)

```mermaid
sequenceDiagram
  participant APP as App Ionic
  participant INT as Interceptor HTTP de la app
  participant AUTH as API AuthService
  participant DB as PostgreSQL

  APP->>INT: GET /api/v1/menus/semana/2026-11-01
  INT->>AUTH: Petición con Bearer vencido
  AUTH-->>INT: 401 token_expirado
  INT->>INT: Pausar peticiones en cola mientras se renueva
  INT->>AUTH: POST /api/v1/auth/refresh con cookie o refreshToken
  AUTH->>DB: SELECT refresh_token por hash
  DB-->>AUTH: Registro con familia_id, revocado y reemplazado_por
  alt No existe, vencido o familia revocada
    AUTH-->>INT: 401 sesión terminada
    INT-->>APP: Ir a inicio de sesión conservando la cola offline
  else Ya fue rotado antes (reutilización detectada)
    AUTH->>DB: UPDATE refresh_token revocado = true para toda la familia_id
    AUTH-->>INT: 401 sesión revocada
    INT-->>APP: Ir a inicio de sesión
  else Válido
    AUTH->>DB: BEGIN
    AUTH->>DB: UPDATE refresh_token actual con reemplazado_por
    AUTH->>DB: INSERT refresh_token nuevo misma familia_id
    AUTH->>DB: COMMIT
    AUTH->>DB: SELECT usuario rol y hogar_id vigentes
    AUTH-->>INT: 200 nuevo accessToken y nuevo refresh
    INT->>AUTH: Reintentar GET /api/v1/menus/semana/2026-11-01
    AUTH-->>INT: 200 menú
    INT-->>APP: Respuesta original
  end
```

## 2. Generar menú semanal (CU-05)

```mermaid
sequenceDiagram
  actor U as Usuario
  participant APP as App Ionic
  participant CTL as SugerenciasController
  participant SUG as SugerenciasService M5
  participant MOT as packages/shared motor
  participant DB as PostgreSQL
  participant EV as EventEmitter interno
  participant Q as Redis cola presupuesto-evaluar

  U->>APP: Sugerir menú semana 2026-11-01
  APP->>CTL: POST /api/v1/menus/sugerencias semana=2026-11-01
  CTL->>CTL: JwtAuthGuard y HogarGuard
  CTL->>SUG: generar(hogarId, semana)
  SUG->>DB: SELECT menu_semanal por hogar_id y semana
  DB-->>SUG: Menú existente o vacío
  alt Menú Aprobado
    SUG-->>APP: 409 "La semana ya tiene menú aprobado"
  else Borrador o sin menú
    SUG->>DB: SELECT configuracion, tiempo_comida_config, comensal, restriccion
    SUG->>DB: SELECT platillo activo con platillo_ingrediente
    SUG->>DB: SELECT menu_detalle de 16 semanas y calificacion
    SUG->>DB: SELECT precio_resumen mediana por producto
    DB-->>SUG: Datos del hogar
    alt Menos de 10 platillos en algún tiempo activo
      SUG-->>APP: 422 con faltantes por tiempo
      APP-->>U: "Faltan n platillos de cena" y enlace al catálogo
    else Datos completos
      SUG->>MOT: generarMenu(EntradaMotor con fijados y semilla)
      MOT->>MOT: puntuar 0.40 P, 0.25 N, 0.20 A, 0.15 F
      MOT->>MOT: asignar por día y tiempo con RN-02 y RN-03
      MOT->>MOT: ajustarPresupuesto hasta 3 reemplazos por tiempo
      MOT-->>SUG: Asignaciones con factores, costos y exceso por tiempo
      SUG->>DB: BEGIN
      SUG->>DB: UPSERT menu_semanal estado Borrador con pesos usados
      SUG->>DB: DELETE menu_detalle no fijados e INSERT nuevos con factores
      SUG->>DB: COMMIT
      SUG->>EV: emit menu.costo-recalculado
      EV->>Q: add evaluar menuId y versión de costo
      SUG-->>APP: 201 menú Borrador con costos y motivos
      APP-->>U: Grilla día x tiempo, costo vs. presupuesto y "Excede por Q__" si aplica
    end
  end
```

## 3. Aprobar menú y generar lista (CU-06.2 → CU-07)

Con D-03 no hay diálogo extra: el exceso se muestra en rojo antes, durante y después de aprobar, y queda registrado en `menu_semanal.exceso_aprobado_centavos`.

```mermaid
sequenceDiagram
  actor U as Usuario
  participant APP as App Ionic
  participant LOC as IndexedDB Dexie
  participant APR as AprobacionService M6
  participant COS as CostosService M6
  participant LIS as ListasService M7
  participant DES as DespensaService M7
  participant DB as PostgreSQL

  U->>APP: Aprobar menú semana 2026-11-01
  APP-->>U: Resumen costo vs. presupuesto con "Excede por Q12.50" en rojo si aplica
  APP->>APR: POST /api/v1/menus/ID/aprobar
  APR->>DB: SELECT menu_semanal y menu_detalle FOR UPDATE
  DB-->>APR: Menú Borrador
  alt Ya aprobado o espacios vacíos
    APR-->>APP: 409 con detalle
  else Válido
    APR->>COS: calcularCostos(menú)
    COS->>DB: SELECT precio_resumen mediana y comensal factor_porcion
    COS-->>APR: Costo por tiempo, total y exceso
    APR->>DB: BEGIN
    APR->>DB: UPDATE menu_semanal estado Aprobado, aprobado_por, aprobado_en
    APR->>DB: UPDATE menu_semanal config_snapshot (D-04) y exceso_aprobado_centavos (D-03)
    APR->>LIS: generarDesdeMenu(menú, tx)
    LIS->>DB: SELECT platillo_ingrediente de los detalles y producto unidad de compra
    LIS->>LIS: Escalar por suma de factores RN-07, convertir y sumar
    LIS->>DES: productosQueTocan(hogarId, semana, tx)
    DES->>DB: SELECT despensa_item con ultima_inclusion
    DES-->>LIS: Despensa de la semana
    LIS->>DB: SELECT precio_resumen mínimo y supermercado
    LIS->>DB: INSERT lista_compras con exceso_centavos y lista_item
    LIS->>DB: UPDATE despensa_item ultima_inclusion
    APR->>DB: COMMIT
    APR-->>APP: 200 menú Aprobado, listaId y exceso
    APP->>LOC: Guardar menú aprobado y lista para uso offline
    APP-->>U: Menú aprobado y lista con banda roja "Excede por Q12.50"
  end
```

## 4. Corrida automática de precios (CU-09)

Solo participan sitios con `supermercado.extraccion_habilitada = true` (D-07). Cada sitio tiene su cola con límite de 1 job por segundo (RNF-12).

```mermaid
sequenceDiagram
  participant SCH as Job scheduler BullMQ
  participant QC as Cola precios-corrida
  participant COR as CorridaProcessor worker
  participant QS as Cola precios-sitio-walmart
  participant SIT as SitioProcessor worker
  participant ROB as RobotsService
  participant PW as Playwright Chromium
  participant WM as walmart.com.gt
  participant QR as Cola precios-recalculo
  participant REC as RecalculoProcessor worker
  participant QP as Cola presupuesto-evaluar
  participant DB as PostgreSQL

  SCH->>QC: Sábado 21:00 America/Guatemala
  QC->>COR: Job corrida
  COR->>DB: INSERT corrida estado En curso
  COR->>DB: SELECT supermercado y producto_supermercado activos
  DB-->>COR: Sitios y vínculos
  loop Cada sitio
    alt extraccion_habilitada falso
      COR->>DB: INSERT corrida_sitio "Sitio no habilitado"
    else Habilitado
      COR->>ROB: permitido(sitio, rutas)
      ROB->>WM: GET /robots.txt
      WM-->>ROB: Reglas
      alt Ruta prohibida
        COR->>DB: INSERT corrida_sitio "Bloqueado por robots.txt"
      else Permitida
        COR->>QS: FlowProducer un hijo por vínculo, padre = corrida
      end
    end
  end
  loop Cada hijo, limiter 1 por segundo
    QS->>SIT: Job vínculo
    SIT->>SIT: Leer contador de fallas del sitio en Redis
    alt Más de 50 % de fallas en el sitio
      SIT->>SIT: Omitir y contar como no actualizado
    else Continuar
      SIT->>PW: Abrir URL del vínculo
      PW->>WM: GET página de producto
      WM-->>PW: HTML renderizado
      PW-->>SIT: Texto del precio
      alt Precio numérico mayor que 0
        SIT->>DB: INSERT precio origen automático, corrida_id, fecha
      else Falla o precio inválido
        SIT-->>QS: Error, reintento con backoff hasta 2 veces
        QS->>SIT: Reintento respetando el límite
        SIT->>DB: INSERT error en corrida_sitio y conserva último precio (RF-38)
      end
    end
  end
  QS-->>COR: Hijos terminados (ignoreDependencyOnFailure)
  COR->>DB: UPDATE corrida Completada, Parcial o Fallida con totales
  opt Parcial o Fallida
    COR->>DB: INSERT aviso para administrador con sitio y productos sin actualizar
  end
  COR->>QR: add productos afectados con jobId por producto
  QR->>REC: Job recálculo
  REC->>DB: SELECT último precio por supermercado con fecha
  REC->>REC: mediana y mínimo con vigencia 14 días RN-08
  REC->>DB: UPSERT precio_resumen con desactualizado y fecha
  REC->>DB: SELECT menu_semanal de semana en curso y futuras con esos productos
  REC->>QP: add evaluar por cada menú afectado
```

## 5. Sincronización offline de la lista (CU-07.3)

```mermaid
sequenceDiagram
  actor U as Usuario en el supermercado
  participant APP as App Ionic
  participant LOC as IndexedDB cola_cambios y listas
  participant SYN as SyncController y SyncService M7
  participant DB as PostgreSQL

  U->>APP: Marcar "Pollo en piezas" como comprado
  APP->>LOC: UPDATE listas item estado COMPRADO y precioReal
  APP->>LOC: INSERT cola_cambios cambioId UUIDv7, itemId, op marcar, ts
  APP-->>U: Casilla marcada y "1 cambio pendiente"
  Note over APP,LOC: Sin conexión los cambios se acumulan en la cola
  APP->>APP: Evento online, app reabierta o Background Sync
  APP->>LOC: Leer cola ordenada por ts
  LOC-->>APP: Cambios pendientes
  APP->>SYN: POST /api/v1/listas/ID/sync con cambios, ahoraDispositivo, dispositivoId
  SYN->>SYN: HogarGuard valida lista del hogar del token
  SYN->>SYN: desfase = ahoraServidor menos ahoraDispositivo
  SYN->>DB: BEGIN
  loop Cada cambio
    SYN->>DB: INSERT lista_cambio cambio_id ON CONFLICT DO NOTHING
    alt Ya aplicado antes
      SYN->>SYN: Ignorar (idempotente)
    else Nuevo
      SYN->>DB: SELECT lista_item FOR UPDATE
      alt ts más desfase mayor que modificado_en_dispositivo
        SYN->>DB: UPSERT lista_item con valores y modificado_en_dispositivo
        Note right of SYN: Marcar un ítem eliminado lo restaura como comprado
      else Cambio más viejo
        SYN->>SYN: Descartar, gana el valor vigente
      end
    end
  end
  SYN->>DB: UPDATE lista_compras version más 1
  SYN->>DB: COMMIT
  SYN->>DB: SELECT lista_item vigentes
  SYN-->>APP: 200 lista vigente, version, aplicados y rechazados
  APP->>LOC: Reemplazar lista local y borrar cambios confirmados
  alt Hay rechazados
    APP-->>U: Aviso "n cambios no se aplicaron"
  end
  APP-->>U: Contador comprados / total actualizado
```

## 6. Notificaciones (CU-12)

### 6.1 Recordatorio de planificación (CU-12.1)

```mermaid
sequenceDiagram
  participant SCH as Job scheduler BullMQ cada hora
  participant REC as RecordatorioProcessor api M10
  participant SUG as SugerenciasService M5
  participant QE as Cola notificaciones-envio
  participant ENV as EnvioProcessor api M10
  participant PUSH as Web Push o FCM
  participant DB as PostgreSQL
  actor M as Miembro
  participant APP as App Ionic

  SCH->>REC: recordatorio-planificacion domingo 08:00 GT
  REC->>DB: SELECT hogar con configuracion dia_planificacion y hora 08:00
  DB-->>REC: Hogares
  loop Cada hogar
    REC->>DB: INSERT notificacion_enviada hogar, tipo RECORDATORIO, semana ON CONFLICT DO NOTHING
    alt Ya existía
      REC->>REC: Omitir (idempotente)
    else Nuevo registro
      REC->>DB: SELECT menu_semanal de la semana objetivo
      alt Aprobado
        REC->>DB: UPDATE notificacion_enviada resultado omitido
      else Sin borrador
        REC->>SUG: generar(hogarId, semana)
        SUG-->>REC: Borrador o 422 faltan platillos
      end
      REC->>DB: SELECT suscripcion_push de miembros del hogar
      REC->>QE: add un job por suscripción con texto y deep link
    end
  end
  QE->>ENV: Job envío, hasta 4 intentos con backoff
  ENV->>PUSH: Enviar "Tu menú del 25 al 31 de octubre está listo"
  alt 404, 410 o UNREGISTERED
    PUSH-->>ENV: Token inválido
    ENV->>DB: DELETE suscripcion_push
  else Entregado
    PUSH-->>M: Notificación
  end
  M->>APP: Toca la notificación
  APP->>APP: Abrir borrador con GET /api/v1/menus/semana/2026-10-25
```

### 6.2 Alerta de costo sobre presupuesto (CU-12.2)

```mermaid
sequenceDiagram
  participant ORG as SugerenciasService, MenusService o RecalculoProcessor
  participant QP as Cola presupuesto-evaluar
  participant EVA as EvaluadorPresupuestoProcessor api M10
  participant COS as CostosService M6
  participant QE as Cola notificaciones-envio
  participant ENV as EnvioProcessor api M10
  participant PUSH as Web Push o FCM
  participant DB as PostgreSQL
  actor M as Miembro

  ORG->>QP: add menuId con jobId menu y versión de costo
  QP->>EVA: Job evaluar
  EVA->>DB: SELECT menu_semanal semana, estado_alerta y configuracion presupuesto
  alt Semana pasada o sin presupuesto
    EVA->>EVA: Terminar sin evaluar
  else Semana en curso o futura
    EVA->>COS: calcularCostos(menú) con precio mediana
    COS-->>EVA: Costo total semanal
    EVA->>EVA: umbral = presupuesto semanal x 1.10
    alt Costo mayor que umbral y estado_alerta normal
      EVA->>DB: UPDATE menu_semanal estado_alerta alertado WHERE estado_alerta normal
      EVA->>DB: SELECT suscripcion_push de miembros
      EVA->>QE: add jobs "Costo Q290.00 supera Q250.00 por Q40.00 (16 %)"
      QE->>ENV: Job envío
      ENV->>PUSH: Enviar alerta con deep link al menú
      PUSH-->>M: Notificación de exceso
    else Costo mayor que umbral y ya alertado
      EVA->>EVA: No reenviar
    else Costo menor o igual al umbral
      EVA->>DB: UPDATE menu_semanal estado_alerta normal
    end
  end
```
