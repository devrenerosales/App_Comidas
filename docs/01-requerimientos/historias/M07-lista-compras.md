# M07 — Lista de compras

| Campo | Valor |
|---|---|
| SRS | SRS-MF-001 v1.0 (aprobado 2026-10-22) |
| Requerimientos | RF-28 a RF-32 |
| Caso de uso macro | CU-07 |
| Sprint(s) | S4 (RF-28, RF-29, RF-30, RF-32) · S5 (RF-31) |
| Fase del ciclo de vida | 2. Requerimientos — análisis de casos de uso |

Convierte el menú aprobado en una lista de compras: ingredientes consolidados en unidad de compra y escalados por comensales, más la despensa que toca esa semana. La lista se usa en el supermercado (también sin conexión), se agrupa por supermercado más barato y se comparte por WhatsApp. No incluye artículos de limpieza (fuera de alcance v1). El registro del gasto real (RF-27) pertenece a M06.

## 1. Diagrama de casos de uso del módulo

```mermaid
flowchart LR
  MIE(("Miembro del hogar"))
  ADM(("Administrador del hogar"))
  ADM -. "hereda" .-> MIE

  subgraph M07["M07 Lista de compras"]
    C1(["CU-07.1 Consolidar ingredientes del menú"])
    C2(["CU-07.2 Agregar despensa según frecuencia"])
    C3(["CU-07.3 Editar y marcar lista (offline)"])
    C4(["CU-07.4 Agrupar por supermercado y categoría"])
    C5(["CU-07.5 Compartir lista"])
  end

  C06(["CU-06 Ajustar y aprobar menú"])
  C092(["CU-09.2 Calcular mínimo y mediana"])

  MIE --> C06
  MIE --> C3
  MIE --> C4
  MIE --> C5
  C06 -. "«include»" .-> C1
  C1 -. "«include»" .-> C2
  C4 -. "«extend»" .-> C3
  C5 -. "«extend»" .-> C3
  C4 -. "usa precios" .-> C092
```

## 2. Casos de uso e historias

### CU-07.1 — Consolidar ingredientes del menú aprobado · RF-28 · HU-28

#### Especificación

| Campo | Detalle |
|---|---|
| Actor(es) | Miembro del hogar (al aprobar el menú); API (ejecuta la consolidación) |
| Prioridad / Sprint | M · S4 |
| Precondiciones | Menú semanal en estado "Aprobado" (RF-25); comensales registrados (RF-03); platillos con ingredientes, cantidad y unidad (RF-12); productos con unidad de compra y presentación (RF-13) |
| Disparador | El usuario aprueba el menú semanal |
| Flujo principal | 1. La API lee los detalles del menú aprobado (todos los días y tiempos activos).<br>2. Por cada platillo calcula el factor de escala = comensales del hogar ÷ porciones base (RN-07).<br>3. Multiplica cada ingrediente por el factor.<br>4. Convierte cada cantidad a la unidad de la presentación de compra del producto.<br>5. Suma las cantidades del mismo producto.<br>6. Calcula presentaciones a comprar = redondeo hacia arriba de (cantidad total ÷ tamaño de presentación).<br>7. Incluye la despensa de la semana (CU-07.2).<br>8. Guarda la lista con origen "Menú" por ítem y la muestra al usuario. |
| Flujos alternos | 8a. El menú se reabre y se vuelve a aprobar → la lista se regenera conservando ítems agregados manualmente y la marca "comprado" de los productos que siguen en la lista. |
| Excepciones | E1. Ingrediente sin equivalencia entre su unidad y la de compra → se agrega con la unidad de la receta y la marca "Sin conversión"; el resto de la lista se genera.<br>E2. Menú no aprobado → no se genera lista y se indica "Aprueba el menú para generar la lista". |
| Postcondiciones | Existe una LISTA_COMPRAS ligada al MENU_SEMANAL con sus LISTA_ITEM consolidados. |
| Reglas y RNF | RN-07, RNF-04 (la lista generada queda disponible offline), RNF-06 |

Supuesto: cada comensal cuenta como una porción, sea adulto o niño (el SRS no define un factor para niños).
Supuesto: la conversión usa equivalencias fijas de masa y volumen (g, kg, lb, oz; ml, L) y unidades enteras; otras unidades de receta (taza, cucharadita) requieren equivalencia registrada en el producto.
Supuesto: la cantidad se redondea hacia arriba a presentaciones enteras (no se compra media bolsa).

#### Diagrama de actividad

```mermaid
flowchart TD
  INI(("Inicio")) --> A["Usuario aprueba el menú"]
  A --> B["Leer detalles del menú aprobado"]
  B --> C["Calcular factor = comensales ÷ porciones base (RN-07)"]
  C --> D["Escalar cantidades de cada ingrediente"]
  D --> E{"¿Existe conversión a unidad de compra?"}
  E -- "Sí" --> F["Convertir a unidad de compra"]
  E -- "No" --> G["Marcar ítem 'Sin conversión'"]
  F --> H["Sumar por producto"]
  G --> H
  H --> I["Redondear hacia arriba a presentaciones"]
  I --> J["Incluir despensa de la semana (CU-07.2)"]
  J --> K["Guardar lista e ítems"]
  K --> L["Mostrar lista"]
  L --> FIN(("Fin"))
```

#### Diagrama de secuencia

```mermaid
sequenceDiagram
  actor U as Miembro
  participant APP as App Ionic
  participant API as API NestJS
  participant DB as PostgreSQL
  U->>APP: Aprobar menú de la semana
  APP->>API: POST /menus/{id}/aprobar
  API->>DB: Actualizar estado del menú a Aprobado
  API->>DB: Leer detalles, ingredientes, porciones base y comensales
  DB-->>API: Datos del menú
  API->>API: Escalar, convertir, sumar y redondear
  API->>DB: Leer despensa que toca (CU-07.2)
  DB-->>API: Productos de despensa
  API->>DB: Insertar LISTA_COMPRAS y LISTA_ITEM
  alt Hay ítems sin conversión
    API-->>APP: 201 lista con advertencias
  else Todo convertido
    API-->>APP: 201 lista generada
  end
  APP-->>U: Mostrar lista de compras
```

#### Historia de usuario HU-28 · 8 puntos

> **Como** miembro del hogar, **quiero** que al aprobar el menú se genere una lista con los ingredientes sumados y en la unidad en que se compran, **para** no calcular a mano cuánto comprar de cada producto.

#### Criterios de aceptación

```gherkin
# language: es
Característica: Consolidar ingredientes del menú aprobado

  # CA-28.1 Flujo principal: escalado y suma del mismo producto
  Escenario: Pollo usado en dos platillos para 6 comensales
    Dado un hogar con 6 comensales
    Y el menú de la semana del 25/10/2026 al 31/10/2026 con "Pollo en crema" el domingo y "Pepián de pollo" el miércoles
    Y "Pollo en crema" usa 2 lb de "Pollo en piezas" para 4 porciones base
    Y "Pepián de pollo" usa 2.5 lb de "Pollo en piezas" para 4 porciones base
    Y "Pollo en piezas" se compra en presentación de 1 lb
    Cuando apruebo el menú
    Entonces la lista contiene una sola línea "Pollo en piezas" con 6.75 lb requeridas
    Y la cantidad a comprar es 7 lb

  # CA-28.2 Conversión de gramos a unidad de compra
  Escenario: Tomate en gramos se convierte a libras
    Dado un hogar con 4 comensales
    Y el menú aprobado incluye "Carne guisada" con 500 g de tomate y "Tortitas de carne" con 300 g de tomate, ambos para 4 porciones base
    Y "Tomate" se compra por libra
    Cuando se genera la lista
    Entonces "Tomate" muestra 800 g requeridos equivalentes a 1.76 lb
    Y la cantidad a comprar es 2 lb

  # CA-28.3 Excepción: ingrediente sin conversión
  Escenario: Unidad de receta sin equivalencia
    Dado que "Spaghetti con carne" usa 1 cucharadita de "Orégano"
    Y "Orégano" se compra en sobre de 10 g sin equivalencia registrada para cucharadita
    Cuando se genera la lista
    Entonces "Orégano" aparece con "1 cucharadita" y la marca "Sin conversión"
    Y los demás productos de la lista se generan normalmente

  # CA-28.4 Validación: menú en borrador
  Escenario: Intentar generar la lista de un menú no aprobado
    Dado que el menú de la semana del 25/10/2026 está en estado "Borrador"
    Cuando abro la lista de compras de esa semana
    Entonces veo el mensaje "Aprueba el menú para generar la lista"
    Y no se crea ninguna lista
```

#### Subtareas

| ID | Tipo | Subtarea | Estimación (h) |
|---|---|---|---|
| ST-28.1 | DB | Tablas LISTA_COMPRAS y LISTA_ITEM (origen, cantidad requerida, cantidad a comprar, marca sin conversión) y migración Prisma | 3 |
| ST-28.2 | BE | Servicio de consolidación: escalado RN-07 y suma por producto | 6 |
| ST-28.3 | BE | Conversión de unidades y redondeo a presentaciones; regeneración al reaprobar (8a) | 5 |
| ST-28.4 | FE | Pantalla de lista generada con advertencias "Sin conversión" | 4 |
| ST-28.5 | QA | Casos PF-M7-28.1..4 y pruebas unitarias de escalado y conversión | 4 |
| ST-28.6 | DOC | Manual: "Cómo se genera tu lista de compras" | 1 |

---

### CU-07.2 — Agregar despensa según frecuencia · RF-29 · HU-29

#### Especificación

| Campo | Detalle |
|---|---|
| Actor(es) | Miembro del hogar (mantiene la despensa); API (la incluye en la lista) |
| Prioridad / Sprint | M · S4 |
| Precondiciones | Productos de despensa registrados con cantidad y frecuencia (DESPENSA_ITEM) |
| Disparador | Generación de la lista (incluido por CU-07.1) |
| Flujo principal | 1. El miembro registra en Despensa: producto, cantidad y frecuencia (semanal, quincenal o mensual).<br>2. Al generar la lista, la API calcula las semanas transcurridas desde la última inclusión de cada producto.<br>3. Si las semanas transcurridas ≥ intervalo (1, 2 o 4), el producto "toca" esta semana.<br>4. Agrega los productos que tocan con origen "Despensa".<br>5. Actualiza la fecha de última inclusión con la semana de la lista. |
| Flujos alternos | 3a. Producto sin inclusión previa → toca en la primera lista generada.<br>4a. El producto ya está en la lista por ingredientes → suma las cantidades en una línea con origen "Menú + Despensa". |
| Excepciones | E1. Cantidad ≤ 0 o frecuencia vacía al registrar → no se guarda y se indica el campo. |
| Postcondiciones | La lista contiene la despensa de la semana; cada DESPENSA_ITEM incluido tiene su última inclusión actualizada. |
| Reglas y RNF | RN-09 (semanas de domingo a sábado), RNF-06 |

Supuesto: frecuencias en v1 = semanal (cada semana), quincenal (cada 2 semanas) y mensual (cada 4 semanas), contadas desde la última inclusión; los valores reales por producto se confirman con la lista de Q814 (PA-03).
Supuesto: el catálogo de despensa solo admite categorías de alimentos; no existe categoría de limpieza en v1.
Supuesto: si un menú se regenera para la misma semana, la despensa no avanza dos veces la última inclusión.

#### Diagrama de actividad

```mermaid
flowchart TD
  INI(("Inicio")) --> A["Recibir semana de la lista"]
  A --> B["Leer productos de despensa del hogar"]
  B --> C{"¿Quedan productos?"}
  C -- "No" --> FIN(("Fin"))
  C -- "Sí" --> D{"¿Tiene última inclusión?"}
  D -- "No" --> G["Toca esta semana"]
  D -- "Sí" --> E["Semanas transcurridas = (semana actual − última inclusión) ÷ 7"]
  E --> F{"¿Semanas ≥ intervalo?"}
  F -- "No" --> C
  F -- "Sí" --> G
  G --> H{"¿Ya está en la lista por menú?"}
  H -- "Sí" --> I["Sumar cantidad, origen 'Menú + Despensa'"]
  H -- "No" --> J["Agregar con origen 'Despensa'"]
  I --> K["Actualizar última inclusión"]
  J --> K
  K --> C
```

#### Diagrama de secuencia

```mermaid
sequenceDiagram
  actor U as Miembro
  participant APP as App Ionic
  participant API as API NestJS
  participant DB as PostgreSQL
  U->>APP: Registrar "Aceite 1 L" quincenal
  APP->>API: POST /despensa
  alt Datos válidos
    API->>DB: Insertar DESPENSA_ITEM
    API-->>APP: 201 creado
  else Cantidad o frecuencia inválida
    API-->>APP: 400 con campo inválido
  end
  Note over API,DB: Al generar la lista (CU-07.1)
  API->>DB: Leer DESPENSA_ITEM con última inclusión
  DB-->>API: Productos de despensa
  API->>API: Evaluar si cada producto toca
  API->>DB: Insertar o sumar LISTA_ITEM y actualizar última inclusión
```

#### Historia de usuario HU-29 · 5 puntos

> **Como** miembro del hogar, **quiero** que la lista incluya automáticamente los productos de despensa que tocan esa semana, **para** no olvidar arroz, aceite o azúcar cuando se terminan.

#### Criterios de aceptación

```gherkin
# language: es
Característica: Agregar despensa según frecuencia

  # CA-29.1 Flujo principal
  Escenario: Solo se agregan los productos que tocan
    Dado la despensa del hogar:
      | Producto          | Cantidad | Frecuencia | Última inclusión |
      | Arroz blanco 2 lb | 2        | semanal    | 18/10/2026       |
      | Aceite 1 L        | 1        | quincenal  | 11/10/2026       |
      | Azúcar 5 lb       | 1        | mensual    | 04/10/2026       |
    Cuando se genera la lista de la semana del 25/10/2026
    Entonces la lista incluye "Arroz blanco 2 lb" x2 y "Aceite 1 L" x1 con origen "Despensa"
    Y no incluye "Azúcar 5 lb" porque solo han pasado 3 de 4 semanas
    Y la última inclusión de arroz y aceite queda en 25/10/2026

  # CA-29.2 Flujo alterno: producto también usado en el menú
  Escenario: Aceite requerido por un platillo y por la despensa
    Dado que "Pescado frito" requiere 0.5 L de "Aceite" y se compra 1 botella de 1 L por el menú
    Y "Aceite 1 L" de despensa toca esta semana con cantidad 1
    Cuando se genera la lista
    Entonces aparece una sola línea "Aceite 1 L" con 2 botellas y origen "Menú + Despensa"

  # CA-29.3 Flujo alterno: producto nuevo en despensa
  Escenario: Producto sin inclusión previa
    Dado que agrego "Frijol negro 1 lb" x2 semanal a la despensa el 22/10/2026
    Cuando se genera la lista de la semana del 25/10/2026
    Entonces la lista incluye "Frijol negro 1 lb" x2

  # CA-29.4 Validación
  Escenario: Cantidad inválida
    Cuando intento guardar "Café 400 g" en la despensa con cantidad 0
    Entonces veo "La cantidad debe ser mayor que 0"
    Y el producto no se guarda
```

#### Subtareas

| ID | Tipo | Subtarea | Estimación (h) |
|---|---|---|---|
| ST-29.1 | DB | Tabla DESPENSA_ITEM (cantidad, frecuencia, última inclusión) y migración | 2 |
| ST-29.2 | BE | CRUD de despensa y regla "toca esta semana" con fusión a la lista | 4 |
| ST-29.3 | FE | Pantalla Despensa (alta, edición, frecuencia) | 4 |
| ST-29.4 | QA | Casos PF-M7-29.1..4 y unitarias de frecuencia | 3 |
| ST-29.5 | DOC | Manual: "Configurar tu despensa" | 1 |

---

### CU-07.3 — Editar y marcar la lista (también sin conexión) · RF-30 · HU-30

#### Especificación

| Campo | Detalle |
|---|---|
| Actor(es) | Miembro del hogar |
| Prioridad / Sprint | M · S4 |
| Precondiciones | Lista de compras generada y descargada al dispositivo al menos una vez |
| Disparador | El usuario abre la lista de compras |
| Flujo principal | 1. La app muestra la lista desde el almacén local.<br>2. El usuario agrega un producto (del catálogo o texto libre) con cantidad, quita un producto o marca/desmarca "comprado".<br>3. La app aplica el cambio en el almacén local y lo encola con marca de tiempo.<br>4. Con conexión, envía la cola a la API.<br>5. La API aplica los cambios y devuelve la versión vigente de la lista.<br>6. La app actualiza el almacén local y el contador "comprados / total". |
| Flujos alternos | 4a. Sin conexión → los cambios quedan en cola con indicador "n cambios pendientes"; al reconectar se envían automáticamente (RNF-04).<br>5a. Dos dispositivos cambiaron el mismo ítem → gana el cambio con marca de tiempo más reciente; si un ítem eliminado recibe después una marca de "comprado", se restaura como comprado. |
| Excepciones | E1. Cantidad ≤ 0 al agregar → se rechaza en la app.<br>E2. La API rechaza un cambio (p. ej. lista de otro hogar, RNF-06) → se descarta de la cola y se avisa al usuario. |
| Postcondiciones | Lista igual en servidor y dispositivos tras sincronizar; cola vacía. |
| Reglas y RNF | RNF-04, RNF-06, RNF-07 |

Supuesto: los productos de texto libre se permiten para no bloquear el uso en tienda; no se cotizan.
Supuesto: resolución de conflictos por ítem con "última escritura gana" usando la hora del dispositivo; la sincronización es idempotente (cada cambio tiene un identificador único).

#### Diagrama de actividad

```mermaid
flowchart TD
  INI(("Inicio")) --> A["Abrir lista desde almacén local"]
  A --> B["Agregar, quitar o marcar producto"]
  B --> V{"¿Cantidad válida?"}
  V -- "No" --> X["Mostrar error"] --> B
  V -- "Sí" --> C["Aplicar en almacén local y encolar cambio"]
  C --> D{"¿Hay conexión?"}
  D -- "No" --> E["Mostrar 'n cambios pendientes'"]
  E --> R["Esperar reconexión"] --> F
  D -- "Sí" --> F["Enviar cola a la API"]
  F --> G{"¿Conflicto en algún ítem?"}
  G -- "Sí" --> H["Aplicar última escritura gana"]
  G -- "No" --> I["Aplicar cambios"]
  H --> J["Devolver versión vigente"]
  I --> J
  J --> K["Actualizar almacén local y contador"]
  K --> FIN(("Fin"))
```

#### Diagrama de secuencia

```mermaid
sequenceDiagram
  actor U as Miembro
  participant APP as App Ionic
  participant LOC as Almacén local IndexedDB
  participant API as API NestJS
  participant DB as PostgreSQL
  U->>APP: Marcar "Pollo en piezas" como comprado
  APP->>LOC: Guardar cambio y encolarlo con marca de tiempo
  alt Sin conexión
    APP-->>U: Indicador "1 cambio pendiente"
    Note over APP,LOC: Al recuperar conexión
    APP->>LOC: Leer cola de cambios
  else Con conexión
    APP->>LOC: Leer cola de cambios
  end
  APP->>API: POST /listas/{id}/sync con cambios
  API->>DB: Validar hogar_id y aplicar cambios por ítem
  alt Conflicto
    API->>API: Resolver por marca de tiempo más reciente
  end
  DB-->>API: Lista vigente
  API-->>APP: 200 lista vigente
  APP->>LOC: Reemplazar lista y vaciar cola
  APP-->>U: Contador "comprados / total" actualizado
```

#### Historia de usuario HU-30 · 8 puntos

> **Como** miembro del hogar, **quiero** agregar, quitar y marcar productos comprados aunque no tenga señal en el supermercado, **para** llevar el control de la compra sin depender de la conexión.

#### Criterios de aceptación

```gherkin
# language: es
Característica: Editar y marcar la lista de compras

  # CA-30.1 Flujo principal con conexión
  Escenario: Marcar un producto como comprado
    Dado una lista con 12 productos y ninguno comprado
    Cuando marco "Pollo en piezas 7 lb" como comprado
    Entonces el producto aparece tachado
    Y el contador muestra "1 / 12 comprados"
    Y el cambio queda guardado en el servidor

  # CA-30.2 Flujo alterno sin conexión
  Escenario: Cambios en modo avión se sincronizan al reconectar
    Dado que el teléfono está en modo avión con la lista abierta
    Cuando marco 3 productos como comprados
    Y agrego "Tortillas" con cantidad 30
    Entonces veo "4 cambios pendientes"
    Y al desactivar el modo avión los 4 cambios se envían sin acción del usuario
    Y el indicador de pendientes desaparece

  # CA-30.3 Flujo alterno: conflicto entre dispositivos
  Escenario: Producto eliminado en un dispositivo y comprado en otro
    Dado que Rene quita "Azúcar 5 lb" de la lista a las 10:00 con conexión
    Y su esposa, sin conexión, marca "Azúcar 5 lb" como comprado a las 10:05
    Cuando el teléfono de su esposa se sincroniza
    Entonces "Azúcar 5 lb" vuelve a la lista marcado como comprado en ambos dispositivos

  # CA-30.4 Validación
  Escenario: Agregar producto con cantidad inválida
    Cuando agrego "Cebolla" con cantidad 0
    Entonces veo "La cantidad debe ser mayor que 0"
    Y el producto no se agrega
```

#### Subtareas

| ID | Tipo | Subtarea | Estimación (h) |
|---|---|---|---|
| ST-30.1 | DB | Campos de versión, actualizado_en, eliminado y texto libre en LISTA_ITEM | 2 |
| ST-30.2 | BE | Endpoints de ítems y endpoint de sincronización idempotente con resolución de conflictos | 6 |
| ST-30.3 | FE | UI de lista: agregar, quitar, marcar, contador | 5 |
| ST-30.4 | FE | Almacén local IndexedDB, cola de cambios y sincronización al reconectar (service worker) | 6 |
| ST-30.5 | QA | Casos PF-M7-30.1..4, prueba en modo avión y prueba con dos dispositivos | 5 |
| ST-30.6 | DOC | Manual: "Usar la lista en el supermercado sin conexión" | 1 |

---

### CU-07.4 — Agrupar por supermercado sugerido y categoría · RF-31 · HU-31

#### Especificación

| Campo | Detalle |
|---|---|
| Actor(es) | Miembro del hogar |
| Prioridad / Sprint | S · S5 |
| Precondiciones | Lista generada; precios mínimos calculados (CU-09.2) |
| Disparador | El usuario elige la vista "Por supermercado" |
| Flujo principal | 1. La app pide la lista agrupada.<br>2. La API obtiene por producto el precio mínimo vigente (≤ 14 días) y su supermercado (RN-08).<br>3. Asigna cada ítem al supermercado de precio mínimo.<br>4. Dentro de cada supermercado agrupa por categoría del producto.<br>5. Calcula costo por ítem = cantidad a comprar × precio mínimo, y subtotal por supermercado.<br>6. La app muestra grupos, categorías, precios y subtotales. |
| Flujos alternos | 2a. Sin precio vigente → usa el último precio conocido y su supermercado con la advertencia "Precio del dd/mm/aaaa" (RN-08).<br>2b. Sin ningún precio o ítem de texto libre → grupo "Sin precio"; no suma a subtotales.<br>3a. Empate de precio mínimo → se asigna al supermercado preferido del hogar (RF-09); si ninguno es preferido, al primero en orden alfabético. |
| Excepciones | E1. Sin conexión → muestra la última agrupación descargada con su fecha. |
| Postcondiciones | Lista visible por supermercado y categoría con subtotales. |
| Reglas y RNF | RN-08, RNF-02, RNF-04 |

Supuesto: la regla de desempate es la misma que usa CU-09.2.
Supuesto: la agrupación es una vista; no cambia los ítems ni las marcas de comprado.

#### Diagrama de actividad

```mermaid
flowchart TD
  INI(("Inicio")) --> A["Elegir vista 'Por supermercado'"]
  A --> B["Por cada ítem buscar precio mínimo"]
  B --> C{"¿Precio vigente ≤ 14 días?"}
  C -- "Sí" --> D["Asignar al supermercado del mínimo"]
  C -- "No" --> E{"¿Existe algún precio?"}
  E -- "Sí" --> F["Asignar al último precio con advertencia"]
  E -- "No" --> G["Grupo 'Sin precio'"]
  D --> H["Agrupar por categoría"]
  F --> H
  G --> H
  H --> I["Calcular costo por ítem y subtotales"]
  I --> J["Mostrar lista agrupada"]
  J --> FIN(("Fin"))
```

#### Diagrama de secuencia

```mermaid
sequenceDiagram
  actor U as Miembro
  participant APP as App Ionic
  participant API as API NestJS
  participant DB as PostgreSQL
  U->>APP: Ver lista por supermercado
  APP->>API: GET /listas/{id}?agrupar=supermercado
  API->>DB: Leer ítems y resumen de precios (mínimo, supermercado, fecha)
  DB-->>API: Ítems con precios
  API->>API: Asignar grupo, desempatar, calcular subtotales
  alt Hay precios no vigentes
    API-->>APP: 200 grupos con advertencias de fecha
  else Todos vigentes
    API-->>APP: 200 grupos
  end
  APP-->>U: Lista por supermercado y categoría
```

#### Historia de usuario HU-31 · 5 puntos

> **Como** miembro del hogar, **quiero** ver la lista agrupada por el supermercado donde cada producto está más barato y por categoría, **para** saber qué comprar en cada tienda y ahorrar.

#### Criterios de aceptación

```gherkin
# language: es
Característica: Agrupar lista por supermercado y categoría

  # CA-31.1 Flujo principal
  Escenario: Productos asignados al supermercado más barato
    Dado los precios vigentes al 24/10/2026:
      | Producto             | Walmart | Paiz   |
      | Arroz blanco 2 lb    | 12.50   | 13.00  |
      | Pollo en piezas (lb) | 22.50   | 21.90  |
      | Tomate (lb)          | 6.50    | 6.25   |
    Y la lista tiene Arroz blanco 2 lb x2, Pollo en piezas 7 lb y Tomate 2 lb
    Cuando veo la lista por supermercado
    Entonces el grupo Walmart contiene Arroz blanco 2 lb x2 por Q25.00 con subtotal Q25.00
    Y el grupo Paiz contiene Pollo en piezas 7 lb por Q153.30 en "Carnes" y Tomate 2 lb por Q12.50 en "Verduras"
    Y el subtotal de Paiz es Q165.80 y el total de la lista es Q190.80

  # CA-31.2 Flujo alterno: precio no vigente
  Escenario: Último precio con más de 14 días
    Dado que el único precio de "Aceite 1 L" es Q24.95 en Walmart del 03/10/2026
    Cuando veo la lista por supermercado el 24/10/2026
    Entonces "Aceite 1 L" aparece en Walmart con la advertencia "Precio del 03/10/2026"

  # CA-31.3 Flujo alterno: empate
  Escenario: Mismo precio en dos supermercados
    Dado que "Azúcar 5 lb" cuesta Q32.00 en Walmart y Q32.00 en Paiz
    Y el supermercado preferido del hogar es Paiz
    Cuando veo la lista por supermercado
    Entonces "Azúcar 5 lb" aparece en el grupo Paiz

  # CA-31.4 Sin precio
  Escenario: Producto sin ningún precio registrado
    Dado que "Tortillas" fue agregado como texto libre
    Cuando veo la lista por supermercado
    Entonces "Tortillas" aparece en el grupo "Sin precio"
    Y no suma a ningún subtotal
```

#### Subtareas

| ID | Tipo | Subtarea | Estimación (h) |
|---|---|---|---|
| ST-31.1 | BE | Endpoint de lista agrupada: asignación por mínimo, vigencia, desempate y subtotales | 4 |
| ST-31.2 | FE | Vista por supermercado y categoría con subtotales y advertencias | 4 |
| ST-31.3 | QA | Casos PF-M7-31.1..4 y prueba de regresión de la lista (CU-07.3) | 3 |
| ST-31.4 | DOC | Manual: "Dónde comprar cada producto" | 1 |

---

### CU-07.5 — Compartir la lista · RF-32 · HU-32

#### Especificación

| Campo | Detalle |
|---|---|
| Actor(es) | Miembro del hogar |
| Prioridad / Sprint | C · S4 |
| Precondiciones | Lista disponible en el dispositivo |
| Disparador | El usuario toca "Compartir" |
| Flujo principal | 1. La app arma un texto con encabezado "Lista de compras dd/mm–dd/mm" y los productos pendientes con cantidad, agrupados como en la vista actual.<br>2. Abre el menú nativo de compartir (Capacitor Share en Android, Web Share en PWA).<br>3. El usuario elige WhatsApp u otra app y envía. |
| Flujos alternos | 1a. El usuario activa "Incluir comprados" → el texto incluye todos los productos.<br>2a. El navegador no soporta compartir → copia el texto al portapapeles y muestra "Lista copiada". |
| Excepciones | E1. No hay productos pendientes → muestra "No hay productos pendientes" y ofrece "Incluir comprados". |
| Postcondiciones | Texto enviado o copiado; la lista no cambia. |
| Reglas y RNF | RNF-04 (funciona sin conexión), RNF-08 |

Supuesto: por defecto se comparten solo los productos pendientes; los precios no se incluyen en el texto.

#### Diagrama de actividad

```mermaid
flowchart TD
  INI(("Inicio")) --> A["Tocar 'Compartir'"]
  A --> B{"¿Hay pendientes o 'Incluir comprados'?"}
  B -- "No" --> C["Mostrar 'No hay productos pendientes'"] --> FIN(("Fin"))
  B -- "Sí" --> D["Armar texto de la lista"]
  D --> E{"¿Soporta compartir nativo?"}
  E -- "Sí" --> F["Abrir menú de compartir"]
  F --> G["Usuario elige WhatsApp y envía"]
  E -- "No" --> H["Copiar al portapapeles y avisar"]
  G --> FIN
  H --> FIN
```

#### Diagrama de secuencia

```mermaid
sequenceDiagram
  actor U as Miembro
  participant APP as App Ionic
  participant LOC as Almacén local IndexedDB
  participant SO as Compartir del sistema
  U->>APP: Tocar "Compartir"
  APP->>LOC: Leer ítems pendientes
  LOC-->>APP: Ítems
  APP->>APP: Armar texto
  alt Compartir disponible
    APP->>SO: share con el texto
    SO-->>U: Selector de apps
  else No disponible
    APP->>APP: Copiar al portapapeles
    APP-->>U: "Lista copiada"
  end
```

#### Historia de usuario HU-32 · 2 puntos

> **Como** miembro del hogar, **quiero** compartir la lista por WhatsApp, **para** que otra persona de la familia pueda hacer la compra.

#### Criterios de aceptación

```gherkin
# language: es
Característica: Compartir la lista de compras

  # CA-32.1 Flujo principal
  Escenario: Compartir pendientes por WhatsApp
    Dado una lista de la semana del 25/10/2026 con 12 productos y 4 marcados como comprados
    Cuando toco "Compartir" y elijo WhatsApp
    Entonces el mensaje inicia con "Lista de compras 25/10–31/10"
    Y contiene los 8 productos pendientes con su cantidad, por ejemplo "Pollo en piezas — 7 lb"

  # CA-32.2 Flujo alterno: sin conexión y sin compartir nativo
  Escenario: Navegador de escritorio sin compartir nativo
    Dado que uso la PWA en un navegador que no soporta compartir
    Y no tengo conexión
    Cuando toco "Compartir"
    Entonces el texto de la lista se copia al portapapeles
    Y veo "Lista copiada"

  # CA-32.3 Excepción: sin pendientes
  Escenario: Todos los productos comprados
    Dado que los 12 productos de la lista están marcados como comprados
    Cuando toco "Compartir"
    Entonces veo "No hay productos pendientes" y la opción "Incluir comprados"
```

#### Subtareas

| ID | Tipo | Subtarea | Estimación (h) |
|---|---|---|---|
| ST-32.1 | FE | Generador del texto de la lista (pendientes, agrupación, opción incluir comprados) | 3 |
| ST-32.2 | FE | Integración Capacitor Share / Web Share y respaldo al portapapeles | 2 |
| ST-32.3 | QA | Casos PF-M7-32.1..3 en Android y navegador | 2 |
| ST-32.4 | DOC | Manual: "Compartir la lista" | 1 |

---

## 3. Resumen del módulo

| HU | RF | CU | Prioridad | Sprint | Puntos | Horas |
|---|---|---|---|---|---|---|
| HU-28 | RF-28 | CU-07.1 | M | S4 | 8 | 23 |
| HU-29 | RF-29 | CU-07.2 | M | S4 | 5 | 14 |
| HU-30 | RF-30 | CU-07.3 | M | S4 | 8 | 25 |
| HU-31 | RF-31 | CU-07.4 | S | S5 | 5 | 12 |
| HU-32 | RF-32 | CU-07.5 | C | S4 | 2 | 8 |
| **Total** | | | | | **28** | **82** |

Por sprint: S4 = 23 puntos / 70 h; S5 = 5 puntos / 12 h.
