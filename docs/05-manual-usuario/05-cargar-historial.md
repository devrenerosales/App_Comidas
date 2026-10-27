# 5. Cargar tu historial

## 5.1 Consultar semanas pasadas

En **Inicio**, toca **Ver historial de comidas**. Todos los miembros del hogar pueden
consultar las semanas registradas, su gasto y sus platillos. Usa **Desde**, **Hasta** y
**Filtrar** para buscar por la fecha de inicio de semana. Abre **Ver platillos de la
semana** para consultar cada comida.

## 5.2 Capturar una semana

Solo el administrador puede capturar o reemplazar semanas.

1. En el historial, toca **Capturar semana**.
2. Elige el **Domingo de inicio**. Debe ser una semana que ya haya terminado: no se puede
   registrar una semana cuyo sábado sea hoy o una fecha futura.
3. En la cuadrícula de domingo a sábado, toca **Elegir** en la comida que quieras registrar.
4. Busca el platillo y selecciónalo. Puedes dejar vacías las comidas que no recuerdes.
   Se admiten desayuno, almuerzo y cena aunque la configuración actual tenga solo almuerzo.
5. Si el platillo no existe, escribe su nombre y toca **Crear «nombre» y usar**. El platillo
   se añade inmediatamente al catálogo; después podrás completar sus ingredientes.
6. Opcionalmente, escribe el **Gasto semanal (Q)** y las **Notas**. El gasto corresponde
   a toda la semana y debe ser positivo, con hasta dos decimales y máximo Q99999.99.
7. Toca **Guardar semana histórica**. Volverás al historial y verás la semana en estado
   **Histórico**. Esta captura no genera una lista de compras.

La captura del cuaderno mantiene semanas de domingo a sábado: cambiar el inicio de las
semanas futuras no modifica las fechas de tus registros históricos. Si cambias la fecha
durante la captura, los platillos conservan su día relativo en la cuadrícula.

## 5.3 Reemplazar una semana

Si la semana ya existe, la app muestra su gasto anterior y solicita confirmación.
**Reemplazar semana** sustituye sus platillos, notas y gasto por la nueva captura.
**Cancelar reemplazo** conserva la semana registrada y deja tu formulario disponible.

Si otro administrador la cambió mientras confirmabas, se rechaza el reemplazo para que
revises el historial. Tampoco se reemplazan desde aquí menús aprobados o borradores,
ni se permiten semanas que se solapen con otra registrada con un inicio distinto.

## 5.4 Si algo sale mal

| Mensaje | Qué hacer |
|---|---|
| Solo se pueden capturar semanas terminadas | Elige un domingo de una semana cuyo sábado sea anterior a hoy. |
| Elige un domingo válido para iniciar la semana histórica | Revisa la fecha de inicio. |
| Registra al menos un platillo | Agrega alguna comida; las demás pueden quedar vacías. |
| El gasto debe ser un monto positivo en quetzales | Revisa el monto o déjalo vacío si no lo conoces. |
| La semana cambió | Revisa el historial antes de confirmar de nuevo. |

## 5.5 Importación por archivo y carga inicial

La persona administradora puede entrar en **Historial → Importar archivo**.

1. Descarga la plantilla CSV o Excel. La de Excel incluye una hoja con el diccionario.
2. Reemplaza los ejemplos por tus comidas de semanas terminadas, de domingo a sábado.
3. Carga el archivo y revisa las semanas, los gastos y los errores por fila.
4. Las semanas existentes se **omiten** por defecto. Puedes elegir **Reemplazar todo**
   para una semana histórica: sustituye todas sus comidas y su gasto, incluso si el
   archivo tiene menos comidas que el registro anterior. Las semanas protegidas se omiten.
5. Pulsa **Confirmar importación**. Todas las semanas seleccionadas se guardan juntas;
   si alguna cambió desde la revisión, no se guarda ninguna. Cancelar descarta la carga.

Se admite CSV UTF-8 separado por comas o XLSX con hoja **Menus**, hasta 5 MB y 5000 filas.
Las columnas obligatorias son `fecha`, `tiempo_comida` y `platillo`. Las opcionales son
`dia`, `proteina_principal`, `gasto_semana_gtq` y `notas`. Usa fechas `AAAA-MM-DD` o
celdas de fecha de Excel, y tiempos desayuno, almuerzo o cena. No uses fórmulas.
No repitas una fecha y tiempo. Si indicas día, debe coincidir con la fecha.

El gasto puede quedar vacío. Si lo conoces, debe ser positivo, hasta Q99,999.99,
con dos decimales como máximo, e igual en las filas de la misma semana. Se guarda
como gasto semanal, sin repartirlo entre comidas. Las notas admiten 200 caracteres
por comida y quedan visibles en el detalle del historial.

Los nombres se buscan en el catálogo del hogar y sus nombres alternativos, ignorando
mayúsculas y tildes. Si hay nombres desconocidos, agrégalos al catálogo y vuelve a
cargar el archivo. La conciliación asistida de nombres y la carga inicial del cuaderno
con listas corresponden a HU-17 y HU-18 y siguen pendientes. Las hojas con datos
distintas de Menus e Instrucciones se rechazan para evitar ignorar información.

La vista previa tiene una dirección propia que puedes volver a abrir. Después de
confirmar muestra el reporte; repetir una solicitud de confirmación no duplica menús.
