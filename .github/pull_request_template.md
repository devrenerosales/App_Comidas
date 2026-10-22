## Historia de usuario

HU-__ — <!-- título de la historia, p. ej. HU-19 Generar propuesta semanal -->

Enlace: `docs/01-requerimientos/historias/M__-____.md`

## Tipo de cambio

- [ ] `feat` — nueva funcionalidad
- [ ] `fix` — corrección de defecto (DEF-__)
- [ ] `test` — pruebas
- [ ] `docs` — documentación / manual
- [ ] `refactor` — sin cambio de comportamiento
- [ ] `chore` / `ci` — mantenimiento, dependencias, pipeline

## Descripción

<!-- Qué cambia y por qué. Criterios de aceptación (CA-nn.k) cubiertos. -->

## Cómo probar

1.
2.

## Checklist — Definición de terminado (DoD)

- [ ] El código está revisado y fusionado en `develop` (el PO hace el push).
- [ ] Las pruebas unitarias pasan con cobertura ≥ 70 % en el módulo (RNF-09).
- [ ] Todos sus CA-nn.k pasan como pruebas funcionales y se agregan a la regresión.
- [ ] Cumple los RNF que cita (rendimiento, seguridad, offline, accesibilidad).
- [ ] La sección del manual de usuario está escrita (`docs/05-manual-usuario/`).
- [ ] El PO aceptó la historia en la revisión del sprint.

### Verificación técnica

- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` y `pnpm build` pasan localmente.
- [ ] Sin secretos ni datos familiares (fotos, `.env`) en el diff.
- [ ] Commits con Conventional Commits citando la historia: `feat(menu): ... (HU-19)`.
