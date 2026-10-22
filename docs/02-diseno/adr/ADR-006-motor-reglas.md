# ADR-006 — Motor de sugerencias por reglas como paquete puro

| Estado | Fecha | Decisores |
|---|---|---|
| Aceptado | 2026-10-22 | Rene Rosales (PO), Claude (arquitectura) |

## Contexto
El motor (M5) aplica un puntaje ponderado (RF-20), reglas de no repetición (RN-02, RN-03), novedad (RN-04) y ajuste al presupuesto (RN-05). Debe ser explicable (RF-22), rápido (RNF-01: < 3 s con 300 platillos) y con cobertura ≥ 70 % (RNF-09). Hay solo 16 semanas de historial: no alcanza para aprendizaje automático.

## Decisión
- Motor **determinista por reglas** en `packages/shared/src/motor`, **TypeScript puro**: sin NestJS, Prisma, HTTP ni reloj del sistema.
- API: `generarMenu(entrada): ResultadoMotor` y `alternativa(entrada, dia, tiempo)`. La fecha de referencia y una `semilla` de desempate vienen en la entrada.
- La API (M5 `SugerenciasService`) carga los datos en una sola lectura, invoca el motor y persiste `menu_semanal` y `menu_detalle` con factores y pesos usados.
- Montos en centavos enteros; escalado RN-07 y mediana compartidos con M7 y M8.

## Alternativas
| Opción | Por qué no |
|---|---|
| Lógica dentro de un servicio NestJS con Prisma | Pruebas lentas y acopladas a la BD |
| Recomendador ML / filtrado colaborativo | Pocos datos, no explicable, un solo hogar |
| Optimización (programación lineal) | Más compleja de explicar y mantener; las reglas actuales bastan |
| Motor en SQL / procedimientos almacenados | Difícil de probar y versionar |

## Consecuencias
- (+) Pruebas unitarias en milisegundos con tablas de casos y pruebas de propiedades.
- (+) Explicabilidad directa: el resultado trae los cuatro factores por asignación.
- (+) Podría ejecutarse en el cliente en el futuro (vista previa offline).
- (−) Hay que mantener los DTO de entrada sincronizados con el esquema Prisma (mapeadores en M5).
- (−) Las fórmulas son heurísticas; se ajustan cambiando pesos (RN-10) o en un ADR nuevo.
