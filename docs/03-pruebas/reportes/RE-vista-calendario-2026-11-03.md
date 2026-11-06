# Verificación de la vista de calendario del menú

Fecha: 2026-11-03. Mejora pedida por el PO el 2026-11-03 sobre la pantalla Semana (HU-19 a HU-26); no es una
historia del backlog. Solo cambia la interfaz: no hay cambios en la API ni migraciones.

## Alcance verificado

- **Selector Tabla / Calendario** sobre el menú. Abre en tabla; la elección se guarda por navegador y, si el
  almacenamiento no está disponible, se usa la tabla sin errores.
- **Calendario**: una tarjeta por día con el platillo de cada tiempo, su costo (con `*` si es incompleto), las
  marcas "Fijado" y "Ajustado al presupuesto", "Sin sugerencia" y, con más de un tiempo, el costo del día. El borde
  de cada espacio es verde o rojo según el estado de su tiempo frente al presupuesto.
- **Mismas acciones que la tabla:** ¿Por qué?, Cambiar, Otra opción, Fijar, Mover (tocando) y arrastrar. Para no
  duplicar lógica los botones y el arrastre salen de componentes compartidos (`AccionesEspacio`,
  `propiedadesDeArrastre`), que la tabla también usa. Menú aprobado o histórico: solo consulta.

## Resultados

| Verificación | Resultado |
|---|---|
| Interfaz: regresión completa | 313 aprobadas, 41 archivos (antes 304 y 40); la tabla sigue pasando todas sus pruebas |
| Pruebas nuevas (9) | Selector y persistencia, almacenamiento bloqueado, tarjetas por día, marcas, dos tiempos, acciones (motivo, fijar, otra opción, mover) y solo lectura |
| Lint, tipos y Prettier | Aprobados, sin avisos |

## Interpretaciones para el PO

1. **Ancho:** las tarjetas se reparten en columnas según el espacio (mínimo 150 px); en la pantalla angosta de la
   app son 4 por fila y en celular 1 o 2. No es una cuadrícula fija de 7 columnas.
2. **Arrastrar:** funciona igual que en la tabla (escritorio). En celular se usa **Mover** y **Mover aquí**.
3. **Vista por navegador:** la preferencia no viaja entre dispositivos.

## Límites

- No se probó en un navegador real ni en Android; el aspecto (colores, tamaños) lo valida el PO.
- Sin capturas en el manual todavía.

## Validación manual propuesta

Con el hogar de prueba (`prueba21@correo.com`): sugerir menú, pulsar **Calendario**, comprobar las tarjetas y los
bordes con presupuesto Q100 (rojo) y Q250 (verde), fijar y mover un día, y volver a **Tabla** y recargar la página
para ver que recuerda la vista.
