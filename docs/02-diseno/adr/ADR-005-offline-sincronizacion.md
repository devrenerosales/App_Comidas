# ADR-005 — Estrategia offline y sincronización

| Estado | Fecha | Decisores |
|---|---|---|
| Propuesto | 2026-10-22 | Claude (arquitectura); requiere visto bueno del PO |

## Contexto
En el supermercado la señal es mala. RNF-04 pide la lista de compras y el menú aprobado disponibles sin conexión y que los cambios se sincronicen al volver. Dos personas pueden marcar la misma lista desde teléfonos distintos (M07 CU-07.3 CA-30.3). El servidor en casa puede estar caído (RG-02).

## Decisión
- **Alcance offline:** lista de compras (lectura/escritura) y menú aprobado (lectura). Lo demás requiere conexión.
- **Almacén local:** IndexedDB con Dexie (`menus`, `listas`, `cola_cambios`, `meta`), igual en PWA y Android.
- **Shell:** service worker Workbox en PWA (precache); en Android los archivos van dentro del APK.
- **Cola de cambios** en la capa de datos de la app (no en el service worker): cada cambio tiene `cambioId` UUID v7, `itemId`, `op`, `valores`, `ts`, `dispositivoId`.
- **Sincronización:** `POST /api/v1/listas/:id/sync` en lote al detectar conexión, al abrir la app o con Background Sync donde exista.
- **Resolución:** **último cambio gana por ítem** con `ts` del dispositivo corregido por el desfase medido (`ahoraServidor − ahoraDispositivo`); empate por `dispositivoId`.
- **Idempotencia:** tabla `lista_cambio` con `cambioId` como clave primaria.
- **Borrado lógico** para que un "comprado" posterior restaure el ítem (CU-07.3 5a).

## Alternativas
| Opción | Por qué no |
|---|---|
| CRDT (Yjs, Automerge) | Complejidad alta para una lista de casillas |
| Bloqueo optimista con versión y conflicto al usuario | Molesto en tienda; la regla de M07 es automática |
| Último cambio gana por lista completa | Pierde marcas de la otra persona |
| Solo caché del service worker | No permite escribir sin conexión ni funciona igual en Capacitor |

## Consecuencias
- (+) Uso fluido en tienda; la cola sobrevive al cierre de la app.
- (+) Reintentos seguros gracias a la idempotencia.
- (−) Un reloj muy desfasado y sin conexión prolongada puede ganar o perder un conflicto incorrectamente; impacto bajo (una casilla).
- (−) La app debe migrar el esquema de IndexedDB por versión.
- (−) Pruebas e2e en modo avión obligatorias en cada sprint que toque M07.
