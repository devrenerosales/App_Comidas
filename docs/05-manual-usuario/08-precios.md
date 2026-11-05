# 8. Precios

| Campo | Valor |
|---|---|
| Historias | HU-34 Registrar precios a mano o por ticket (S5, parte manual) · HU-36 Costo con mediana y precio mínimo (S5) |
| Versión de la app | Sprint 5 (rama `feature/HU-34-registrar-precios`) |
| Estado del capítulo | Parcial: registrar un precio a mano, costo estimado y compra sugerida; faltan el ticket con foto, el histórico y las capturas |

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

## 8.3 Escanear un ticket — próximamente (HU-34, segunda parte)

Se completará cuando se implemente la lectura de tickets con foto.
