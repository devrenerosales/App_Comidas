# Verificación: editar un menú ya aprobado

Fecha: 2026-11-08. Implementación pedida fuera del backlog («dejar editable la lista de la semana de platillos aunque ya
estén aprobados»). No requiere migraciones.

## Alcance

- **API**: cambiar un platillo, mover, fijar y pedir otra opción funcionan con un menú Borrador **o Aprobado**; el
  historial sigue de solo lectura (`SEMANA_HISTORICA`). Se eliminó el 409 `MENU_APROBADO` de esas rutas.
- **Lista de compras**: cuando cambia algún platillo de un menú aprobado, la lista se ajusta en la misma transacción
  (`menus.repositorio.ts`, `sincronizarLista`), con el mismo cálculo que al aprobar (`menus.lista.ts`):
  actualiza cantidades, agrega lo nuevo, quita lo pendiente que ya no hace falta, conserva lo ya comprado, devuelve a
  pendiente lo comprado si ahora hace falta más cantidad, respeta lo quitado y lo agregado a mano, conserva la despensa,
  rehace las comidas de origen y sube la versión de la lista.
- **Pantalla Semana**: el menú aprobado conserva Cambiar, Otra opción, Fijar y Mover, avisa que la lista se actualiza sola y
  confirma «Cambio guardado. La lista de compras se actualizó.». El botón Aprobar solo sale en el borrador.
- Manual (6.4) y contrato actualizados.

## Resultados

| Verificación | Resultado |
|---|---|
| API, unitarias | 650 aprobadas, 64 archivos |
| API, integración completa con PostgreSQL | 469 aprobadas, 36 archivos (12 nuevas en `menus-editar-aprobado.e2e-spec.ts`) |
| Interfaz, regresión completa | 555 aprobadas, 60 archivos |
| Lint y Prettier | Aprobados |

Comprobación de las pruebas nuevas: con la sincronización desactivada, las 6 que verifican ajustes fallan.

## Interpretaciones para el PO

1. **Un producto ya comprado que ahora necesita más cantidad vuelve a pendiente** y se borra el precio real anotado de ese
   producto (afecta al gasto sugerido de la lista). Si necesita menos, sigue comprado.
2. **Lo ya comprado que deja de hacer falta se queda en la lista**; solo lo pendiente se quita.
3. **Los productos de despensa toman la cantidad actual de la despensa** si se cambió después de aprobar y luego se edita
   un platillo.
4. **El presupuesto y el exceso al aprobar no se recalculan** (D-03, D-04); sí el costo estimado.
5. Las reglas RN-02 y RN-03 piden confirmación igual que en un borrador.

## Límites

- Lo ya comprado y quitado de la lista no se avisa en pantalla (no hay detalle de qué cambió en la lista).
- Un teléfono sin conexión con cambios pendientes en la lista los reconcilia por «última escritura gana»: el cambio del
  servidor lleva la hora del servidor.
- No se probó en un navegador real ni en Android.
