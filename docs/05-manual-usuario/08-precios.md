# 8. Precios

| Campo | Valor |
|---|---|
| Historias | HU-34 Registrar precios a mano o por ticket (S5, parte manual) · HU-36 Costo con mediana y precio mínimo (S5) · HU-37 Histórico y variación de precios (S5) · HU-33 Corrida automática de precios (S5, sitios apagados) · HU-38 Conservar el último precio válido (S5) |
| Versión de la app | Sprint 5 (rama `feature/HU-34-registrar-precios`) |
| Estado del capítulo | Parcial: registrar un precio a mano, costo estimado y compra sugerida, historial de precios, último precio válido y avisos; faltan el ticket con foto, los precios automáticos y las capturas |

> **Capturas:** los recuadros `[Captura …]` marcan dónde irá la imagen de la pantalla real (teléfono 390 × 844, carpeta `docs/05-manual-usuario/img/`).

## 8.1 Registrar un precio a mano

Anota el precio que viste o pagaste en una tienda, sobre todo en las que la app no consulta sola, como Super Fresh. Cualquier miembro puede hacerlo. El precio queda en **tu hogar**: otros hogares no lo ven.

1. En **Productos**, toca **Supermercados** junto al producto y luego **Registrar precio**.
2. Elige el **Supermercado**. La app te dice sobre qué presentación se registra: «Pollo PZ LB» (2 lb).
3. Escribe el **Precio (Q)**, por ejemplo 20.75. Puedes usar punto o coma.
4. Revisa la **Fecha de compra**; empieza en hoy y no puede ser futura.
5. Toca **Guardar precio**. Verás "Precio guardado: Q20.75 en Super Fresh (24/10/2026)."

Si la presentación de la tienda no es la de tu producto, la app ajusta el precio para poder compararlo: si Paiz vende la bolsa de 5 lb a Q31.25 y tu producto es de 2 lb, verás "Equivale a Q12.50 por tu presentación".

**Si el producto todavía no está vinculado con ese supermercado.** En Super Fresh o La Torre la app te pide la **cantidad** y la **unidad** de la presentación en que se vende y crea el vínculo junto con el precio. En Walmart y Paiz, que se consultan automáticamente, primero hay que crear el vínculo con la URL o el SKU del producto; la app te muestra el enlace **Crear el vínculo** (ver 4.6b).

| Mensaje | Qué hacer |
|---|---|
| El precio debe ser mayor que 0 | Escribe un precio positivo. |
| El precio admite como máximo 2 decimales | Redondea a centavos, por ejemplo 12.90 en vez de 12.905. |
| Ingresa un precio válido (usa punto para los decimales) | Escribe solo números, por ejemplo 12.90. |
| La fecha de compra no puede ser futura | Elige hoy o un día anterior. |

Si algo no es válido, la app no guarda nada y te dice qué corregir.

[Captura 8.1: pantalla Registrar precio]

## 8.2 Costo estimado y compra sugerida

Con los precios de cada supermercado la app calcula dos números por producto. Los ves arriba de **Supermercados** y de **Registrar precio**, en el recuadro **Resumen de precios**.

- **Costo estimado:** la **mediana** de los precios de todos los supermercados. Es el número que usa el menú para calcular cuánto cuesta cada platillo; es estable aunque un supermercado ponga un precio muy alto o muy bajo.
- **Compra sugerida:** el precio **más bajo** y el supermercado donde está. Solo se busca entre los supermercados que marcaste como preferidos (ver 3.7). Si dos cuestan lo mismo, gana el preferido, y si siguen empatados, el primero por orden alfabético.

Por ejemplo, con Arroz a Q12.50 en Walmart, Q13.00 en Paiz y Q14.25 en La Torre, el costo estimado es Q13.00 y la compra sugerida es Q12.50 en Walmart. Con cuatro precios (Q20.75, Q21.50, Q22.90 y Q23.40) la mediana es el promedio de los dos del medio, Q22.20.

**Solo cuentan los precios recientes.** Un precio vale hasta 14 días; de cada supermercado se toma el más reciente. Si ningún precio es de los últimos 14 días, la app usa los últimos que conoce y te avisa: "Desactualizado: ningún precio es de los últimos 14 días; el más antiguo es del …". Registra un precio nuevo para actualizarlo.

**Sin precio.** Si el producto todavía no tiene ningún precio, el recuadro dice "Sin precio".

El resumen se actualiza solo cuando registras un precio, cuando cambias tus supermercados preferidos y cuando pides que la app sugiera el menú de la semana.

[Captura 8.2: recuadro Resumen de precios]

## 8.3 Ver el historial de precios

Para ver cómo ha cambiado el precio de un producto, entra a **Productos**, toca **Supermercados** en el producto y luego **Historial de precios**.

1. Arriba eliges el **Periodo**: **12 semanas** (el que abre por defecto) o **4 semanas**.
2. El **gráfico** dibuja una línea por supermercado, con su nombre en la leyenda.
3. Debajo, cada supermercado muestra dos variaciones:
   - **Vs. anterior:** cuánto cambió el último precio respecto al anterior. Por ejemplo, de Q21.00 a Q22.00 es **+4.8 %** ▲ Subió.
   - **En el periodo:** cuánto cambió el último precio respecto al primero del periodo. De Q20.00 a Q22.00 es **+10.0 %**.
4. La **tabla** lista cada precio con su fecha, supermercado, monto y origen: **Automático** (lo trajo la app), **Manual** (lo registraste tú o alguien de tu hogar) o **Ticket**.

Una baja se muestra con signo menos y ▼ Bajó, por ejemplo **−10.0 %**. Si un supermercado tiene un solo precio en el periodo, sus variaciones aparecen como **—** porque no hay con qué comparar. Si el producto no tiene ningún precio en el periodo, la app dice "Aún no hay precios para este producto".

Los montos son por la presentación de compra del producto, para que sean comparables. Solo ves los precios automáticos y los que registró tu hogar: los de otros hogares nunca aparecen. Los precios de un vínculo que reemplazaste ya no se muestran.

[Captura 8.3: historial de precios con gráfico y variaciones]

## 8.4 Cuando un precio no se puede actualizar

Los precios de Walmart y Paiz están pensados para actualizarse solos cada sábado y domingo a las 21:00. Hoy esa función está apagada hasta revisar los términos de uso de cada sitio, pero la app ya sabe qué hacer cuando una consulta falla:

- **El último precio válido se conserva.** Si la consulta de un producto falla (la página no responde, cambió o devuelve algo que no es un precio), la app no guarda nada nuevo y sigue usando el último precio bueno, con su fecha. En **Supermercados y marcas** y en la lista verás, por ejemplo, "Q13.00 · Precio del 18/10/2026".
- **Desactualizado.** Si ese último precio tiene más de 14 días, además aparece la advertencia **Desactualizado**. Registra un precio nuevo a mano (8.1) para actualizarlo.
- **Producto sin precio.** Si nunca tuvo precio, sigue diciendo "Sin precio".

**Avisos para el administrador.** Si eres administrador, en **Configuración → Avisos de precios** ves qué pasó en la última corrida, por ejemplo "Paiz: 50 productos sin actualizar" o "Paiz bloqueado: registra precios manualmente". Cada aviso muestra su fecha y un botón **Marcar como leído**; los leídos quedan en la lista con la marca "Leído". Los miembros que no son administradores no ven esta pantalla. Abajo hay un enlace para ir a registrar a mano los precios que faltan.

[Captura 8.4: avisos de precios]

## 8.5 Escanear un ticket — próximamente (HU-34, segunda parte)

Se completará cuando se implemente la lectura de tickets con foto.
