# 8. Precios

| Campo | Valor |
|---|---|
| Historias | HU-34 Registrar precios a mano o por ticket (S5, parte manual) |
| Versión de la app | Sprint 5 (rama `feature/HU-34-registrar-precios`) |
| Estado del capítulo | Parcial: registrar un precio a mano; faltan el ticket con foto, el precio mínimo y la mediana, el histórico y las capturas |

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

## 8.2 Escanear un ticket — próximamente (HU-34, segunda parte)

Se completará cuando se implemente la lectura de tickets con foto.
