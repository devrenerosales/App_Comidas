# Verificación del tablero de Inicio

Fecha: 2026-11-06. Implementación local para revisión del PO, pedida fuera del backlog de historias («que el inicio muestre
un dashboard con el gasto actual y el consumo de comidas al día de hoy, y el historial de presupuesto»). No requiere
migraciones.

## Alcance verificado

- **API** (`apps/api/src/tablero`): `GET /tablero?semanas=n` para cualquier miembro. Devuelve la semana en curso (presupuesto,
  costo estimado, gasto real, comidas planificadas, comidas ya transcurridas y su costo estimado) y el historial de las
  últimas semanas Aprobadas o Históricas (por defecto 8, máximo 26).
- **Pantalla Inicio**: tarjeta «Esta semana» con **Gasto actual** (barra frente al presupuesto) y **Comidas al día de hoy**
  (barra de avance), y tarjeta «Historial de presupuesto» con «Dentro del presupuesto» o «Excede por Q__» por semana.
  Sustituye al texto anterior; el enlace «Ver historial de comidas» se conserva.
- Contrato (`GET /tablero`) y manual (1.6 Tu pantalla de Inicio; seguridad pasó a 1.7).

## Resultados

| Verificación | Resultado |
|---|---|
| API, pruebas unitarias del servicio | 7 aprobadas (semana actual, sin semana, límites de `semanas`) |
| API, integración con PostgreSQL | 5 aprobadas (`tablero.e2e-spec.ts`): consumo hasta hoy, sin menú, orden y filtro del historial, aislamiento entre hogares, 401 |
| Interfaz | 5 nuevas (`Inicio.test.tsx`); `pages.test.tsx`, `App.test.tsx` y `auth` siguen aprobadas |
| Lint, tipos y Prettier | Aprobados |

## Interpretaciones para el PO

1. **«Consumo de comidas» = comidas planificadas de días ya transcurridos.** La app no registra qué se comió realmente; si
   quieres consumo real habría que añadir un «ya comimos esto» por comida.
2. **El gasto actual es el gasto real registrado** de la semana (HU-27). Sin él se muestra «Sin registrar» y el costo
   estimado del menú.
3. **Historial = semanas Aprobadas o Históricas**, sin borradores; las semanas importadas sin presupuesto muestran «—».
4. La barra de gasto se llena hasta el presupuesto; si lo supera, el historial lo dice, pero la barra de la semana en curso
   no muestra el exceso.

## Límites

- Sin gráficas de tendencia (solo lista y barras); sin selector de periodo en pantalla (la API acepta `?semanas`).
- No se probó en un navegador real ni en Android.

## Validación manual propuesta

Abrir **Inicio** con una semana aprobada que tenga gasto registrado: comprobar el gasto frente al presupuesto, «N de M»
comidas y el historial. Probar también con una semana sin gasto («Sin registrar») y con un hogar sin menú aprobado.
