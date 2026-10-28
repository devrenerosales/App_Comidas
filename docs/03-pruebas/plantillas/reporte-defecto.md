# Reporte de defecto

Cuerpo del GitHub Issue, con etiquetas `defecto`, `sev:S_`, `prio:P_` y `M__` (basado en IEEE 829, *Test Incident Report*).

| Campo | Valor |
|---|---|
| ID | DEF-___ (número del issue) |
| Título | <Qué falla, dónde y cuándo> |
| Módulo / HU | M__ · HU-__ |
| Caso de prueba | PF-M_-__.__ (CA-__.__) o "Exploratoria" |
| Severidad | S1 Crítica · S2 Alta · S3 Media · S4 Baja |
| Prioridad | P1 · P2 · P3 · P4 |
| Entorno | Local (laptop) · CI · Producción (Oracle Cloud) |
| Plataforma | Chrome __ / Edge __ / Safari __ / Android __ (APK vX.Y.Z) |
| Versión | `vX.Y.Z` · commit `abc1234` |
| Reportado por / fecha | |
| Asignado a | |
| Estado | Nuevo |
| Frecuencia | Siempre · Intermitente (_ de _) · Una vez |

## Precondiciones y datos
<Hogar, usuario y rol, configuración (presupuesto, tiempos de comida, comensales y factores), datos de semilla.>

## Pasos para reproducir
1.
2.
3.

## Resultado esperado
<Según el CA o RNF, con el texto exacto. Ej.: "Excede por Q17.00" en rojo.>

## Resultado obtenido
<Qué pasó realmente, con valores.>

## Evidencia
- Captura o video:
- Traza de Playwright o log de la API (`reqId`):
- Respuesta HTTP (sin tokens ni contraseñas):

## Análisis (lo llena quien corrige)
| Campo | Valor |
|---|---|
| Causa raíz | |
| Corrección (PR) | # |
| Prueba agregada que lo reproduce | |
| Versión donde se corrige | |

## Verificación
- [ ] El PF falla antes de la corrección y pasa después
- [ ] Regresión `@regresion` en verde
- [ ] Cerrado por QA (nombre, fecha)
