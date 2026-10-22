# Reporte de ejecución de pruebas — Sprint S_

Se copia como `docs/03-pruebas/reportes/RE-S_-AAAA-MM-DD.md` al cierre de cada sprint (basado en IEEE 829, *Test Summary Report*).

| Campo | Valor |
|---|---|
| ID del reporte | RE-S_-AAAA-MM-DD |
| Sprint | S_ (del AAAA-MM-DD al AAAA-MM-DD) |
| Versión probada | `vX.Y.Z` · commit `abc1234` |
| Entorno | CI (GitHub Actions run #___) · Servidor de casa |
| Elaborado por | |
| Fecha | |

## 1. Resumen
<Qué se probó, resultado global y recomendación: aceptar, aceptar con observaciones o no aceptar.>

## 2. Resultado por historia
| HU | Prioridad | PF ejecutados | Aprobados | Fallidos | Bloqueados | No ejecutados | Estado |
|---|---|---|---|---|---|---|---|
| HU-__ | M | | | | | | Aprobada / Rechazada |
| **Total** | | | | | | | |

## 3. Resultado por nivel
| Nivel | Pruebas | Aprobadas | Fallidas | Omitidas | Duración |
|---|---|---|---|---|---|
| Unitarias (Vitest / Jest) | | | | | |
| Integración (Jest + Supertest) | | | | | |
| E2E (Playwright) | | | | | |

## 4. Regresión acumulada
| Suite | Casos | Aprobados | Fallidos | Inestables |
|---|---|---|---|---|
| `@regresion` acumulada | | | | |
| Casos nuevos del sprint | | | | |

## 5. RNF verificados en el sprint
| RNF | Prueba | Meta | Resultado medido | Estado |
|---|---|---|---|---|
| RNF-09 | Cobertura API / worker / shared | ≥ 70 % | __ % / __ % / __ % | |

## 6. Defectos
| Severidad | Encontrados | Corregidos | Abiertos | Diferidos |
|---|---|---|---|---|
| S1 Crítica | | | | |
| S2 Alta | | | | |
| S3 Media | | | | |
| S4 Baja | | | | |

## 7. Métricas
| Métrica | Meta | Valor |
|---|---|---|
| CA aprobados (prioridad M) | 100 % | |
| CA aprobados (prioridad S/C) | ≥ 90 % | |
| Cobertura de código | ≥ 70 % | |
| Pruebas inestables | ≤ 2 % | |
| Defectos escapados a producción | ≤ 10 % | |

## 8. Desviaciones y riesgos
<Pruebas no ejecutadas y por qué, cambios al plan, riesgos nuevos.>

## 9. Criterios de salida
- [ ] 100 % de los PF de prioridad M aprobados
- [ ] ≥ 90 % de los PF S/C aprobados
- [ ] Suite `@regresion` acumulada en verde
- [ ] Cobertura ≥ 70 % (RNF-09)
- [ ] 0 defectos S1/S2 abiertos
- [ ] RNF del sprint verificados

## 10. Aprobación
| Rol | Nombre | Decisión | Fecha |
|---|---|---|---|
| QA | | | |
| Product Owner | Rene Rosales | Aceptado / Con observaciones / Rechazado | |
