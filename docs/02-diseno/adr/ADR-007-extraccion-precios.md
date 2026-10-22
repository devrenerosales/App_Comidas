# ADR-007 — Extracción de precios con Playwright apagada por sitio

| Estado | Fecha | Decisores |
|---|---|---|
| Aceptado | 2026-10-22 | Rene Rosales (PO), Claude (arquitectura) |

## Contexto
RF-33 pide precios de Walmart y Paiz sáb y dom 21:00 (La Torre en fase 2). Los sitios cargan precios con JavaScript. R-03 y RNF-12 obligan a respetar términos de uso, robots.txt y 1 solicitud/segundo. Los términos aún no se revisan (PA-02) y el PO decidió que la extracción quede **apagada por sitio** hasta revisarlos (D-07). Los sitios cambian su estructura sin aviso (RG-01).

## Decisión
| Elemento | Decisión |
|---|---|
| Motor | Playwright (Chromium headless) en el contenedor `worker`, aislado de la API |
| Interruptor por sitio | Tabla `supermercado` con `extraccionHabilitada` (falso por defecto) y `terminosRevisadosEn`; solo el administrador lo cambia |
| robots.txt | Se descarga al inicio de cada corrida; ruta prohibida = "Bloqueado" |
| Límite de tasa | Una cola BullMQ por sitio (`precios-sitio-<sitio>`) con `limiter {max: 1, duration: 1000}` y concurrencia 1; sitios en paralelo |
| Programación | Job scheduler BullMQ `0 21 * * 6,0` con `tz: America/Guatemala` |
| Corrida | Flow BullMQ: padre `precios-corrida`, un hijo por vínculo; al terminar marca Completada / Parcial / Fallida y encola `precios-recalculo` |
| Fallas | 1 + 2 reintentos por producto; nunca sobrescribe con precio inválido; último precio válido con su fecha (RF-38); corte del sitio si > 50 % falla |
| Adaptadores | Uno por sitio (`WalmartAdapter`, `PaizAdapter`, `LaTorreAdapter`) con selectores versionados y pruebas contra HTML guardado |
| Identificación | User-agent identificable con contacto del PO |
| Alternativa siempre disponible | Captura manual y por ticket (RF-34) |

## Alternativas
| Opción | Por qué no |
|---|---|
| Fetch HTTP + parseo de HTML | Los precios se cargan por JavaScript |
| APIs internas no documentadas de los sitios | Frágiles y posiblemente contra términos |
| Servicios de scraping pagados | Costo y envío de datos a terceros |
| Solo captura manual | Válido como respaldo; pierde el valor de comparar tiendas |

## Consecuencias
- (+) Cumplimiento legal configurable sin desplegar código.
- (+) Un fallo de sitio no afecta la API ni los demás sitios.
- (−) Chromium usa ~1 GB de RAM durante la corrida.
- (−) Mantenimiento de selectores cuando los sitios cambian.
- (−) Mientras los sitios sigan apagados, el costo depende de precios manuales.
