# Verificación del rediseño visual

Fecha: 2026-11-06. Implementación local para revisión del PO, pedida fuera del backlog de historias («un diseño más
moderno, con colores asignados por función, agradable a la experiencia de usuario» y «que el inicio muestre gráficas,
el monto gastado y algo más interesante»). No requiere migraciones.

## Alcance

- **Tema global** (`apps/web/src/theme/variables.css`): colores con un rol fijo (acento lima para la acción principal,
  verde de marca para texto e iconos activos, éxito, advertencia, error), superficies, sombras y radios. **Claro**
  ("fresco": fondo verdoso muy suave, lima con texto oscuro, verde profundo para texto) y **oscuro** (fondo casi negro,
  acento lima). Automático según el sistema; se puede forzar en **Configuración → Apariencia** (`SelectorTema`, se recuerda
  en el dispositivo).
- **Estilos**: todos los colores fijos de los CSS pasaron a tokens; encabezado claro con título en negrita, barra inferior
  con "píldora" de acento en la pestaña activa, tarjetas con sombra suave, botón principal lima, campos y chips.
- **Inicio rediseñado** con la guía de visualización de datos: cifra principal (gasto, o costo estimado si aún no hay gasto
  real) con medidor y estado en palabras; tarjetas *Te quedan*, *Por día* y *Ahorro acumulado*; *Hoy* con las comidas del
  día; *Costo por tiempo de comida* con un medidor por tiempo; *Historial de presupuesto* con gráfica de columnas (semana
  actual resaltada, semanas excedidas en rojo, marca del presupuesto) y el detalle en lista como equivalente en tabla.
- **Lista de compras**: selector de vista en píldora, medidor de avance de compra, grupos por supermercado como tarjetas con
  su subtotal y total destacado.
- **Configuración**: cada sección es una tarjeta.
- **API**: `GET /tablero` ahora incluye `comidasDeHoy` y `tiempos`, y la semana actual ya no considera los borradores.
- Manual (1.6 Inicio, Apariencia en el capítulo 3) y contrato actualizados.

## Resultados

| Verificación | Resultado |
|---|---|
| Interfaz: regresión completa | 546 aprobadas, 60 archivos, cobertura 97,9 % (nuevas: cálculos del tablero, tema, selector de apariencia, Inicio) |
| API, `tablero` (unitarias) | 7 aprobadas |
| API, `tablero` (integración con PostgreSQL) | 6 aprobadas (comidas de hoy, costo por tiempo, un borrador no cuenta como semana actual) |
| Compilación de producción de la web | Aprobada |
| Lint y Prettier | Aprobados |
| Capturas de pantalla reales (Chrome, 390 px de ancho, claro y oscuro, datos simulados) | Inicio en claro y oscuro, Configuración en claro y oscuro, pantalla de acceso en claro |

Las capturas sirvieron para corregir: eje de la gráfica demasiado alto (ahora 300 y no 500), textos de la gráfica
demasiado pequeños, filas del detalle centradas, tarjeta de ahorro huérfana, barra inferior que se desbordaba y barras de
aviso en un marrón apagado.

## Qué NO está verificado

- **La Lista de compras no se vio en pantalla**: su rediseño solo está cubierto por las 86 pruebas existentes, que no miran
  estilos. Revísala en el navegador.
- Las demás pantallas (Semana, Platillos, Historial, Despensa, Hogar…) heredan el tema, pero no las revisé una por una,
  sobre todo en modo oscuro. Los colores fijos de los gráficos de reparto de tiempos de comida (Configuración → Tiempos) y de
  precios (Historial de precios) no se adaptaron al tema oscuro.
- Android y iPhone reales; contraste medido solo a ojo (el acento lima siempre lleva texto oscuro encima).

## Interpretaciones para el PO

1. **«Oscuro primero»** quedó como **automático según el sistema**, con claro y oscuro igual de cuidados y un selector
   manual. Elegiste el acento lima; en claro el texto de marca usa un verde profundo porque el lima no se lee sobre blanco.
2. **Alcance elegido por mí:** estilo global más Inicio y Lista (no marcaste una opción).
3. **«Consumo de comidas»** sigue siendo lo planificado hasta hoy, no lo comido de verdad.
4. **La marca del presupuesto** de cada semana es una raya negra sobre su columna; con presupuesto constante parece una
   línea punteada, que es justo lo que significa.

## Validación manual propuesta

Abrir la app en el teléfono o en el navegador (http://localhost:5173), con una semana aprobada y gasto registrado: revisar
Inicio en claro y en oscuro (Configuración → Apariencia), la Lista (vista **Por supermercado** incluida) y recorrer el resto
de pantallas buscando textos ilegibles o fondos blancos en modo oscuro.
