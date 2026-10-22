# Inventario de pantallas del prototipo

Canvas de diseño (privado, compartir desde el menú Share del canvas): https://claude.ai/artifact/E5BNpQxh3ianZUmYpBmSLz

Estilo común: Plus Jakarta Sans; verde #2F6B4F (oscuro #1F4D38); fondo #F7F4EE; bordes #E4DED3; texto #1E2A23 / #5B665F; radios 12–16 px; botones 44–46 px; rojo de exceso #B42318 sobre #FDECEA. Móvil 390×844; web 1280 de ancho fluido.

| Pantalla (artboard) | Historias | Estado | Notas de interacción |
|---|---|---|---|
| `Main.dc.html` · Login | HU-01 | Existente | Correo y contraseña; "Entrar" lleva a Inicio. Enlaces "¿Olvidaste tu contraseña?" (HU-04) y "Crear mi hogar" (HU-02). |
| `Main.dc.html` · Inicio | HU-19, HU-26, HU-06, HU-27 | Existente | Costo estimado vs presupuesto con barra; contadores de personas y presupuesto (±Q10); botón "Sugerir menú de la semana"; próximos almuerzos. |
| `Main.dc.html` · Semana | HU-19, HU-23, HU-24, HU-25, HU-26 | Existente | Lista de 7 almuerzos; candado para fijar platillo; "Cambiar" abre hoja inferior con alternativas; "Otra sugerencia" y "Aceptar menú". |
| `Main.dc.html` · Lista de compras | HU-28, HU-30, HU-31 | Existente | Ítems agrupados por categoría con casilla; totales estimado vs en el carrito. |
| `Main.dc.html` · Platillos | HU-11, HU-12 | Existente | Búsqueda, "Agregar platillo nuevo" y catálogo con costo por platillo. |
| `Web.dc.html` · Panel web semana | HU-19, HU-24, HU-25, HU-26, HU-36, HU-39 | Existente | Menú lateral; resumen (costo, personas, semana pasada, precios); 7 días con "Cambiar"; tabla de precios por tienda; semanas anteriores con "repetir". |
| `Config-tiempos.dc.html` · Configuración de tiempos | HU-05, HU-06, HU-07 | Nueva S0 | Radio: solo almuerzo / dos tiempos (casillas desayuno, almuerzo, cena) / tres tiempos. Presupuesto semanal Q500. Vista previa "Sin guardar": de Almuerzo Q500 (100 %) a Almuerzo 60 % Q300 / Cena 40 % Q200; porcentajes editables que deben sumar 100 % (indicador de suma, "Restablecer 60/40"). Nota D-04: menús aprobados conservan su configuración. Cancelar / Guardar. |
| `Comensales.dc.html` · Comensales | HU-03 (D-02) | Nueva S0 | Total de porciones = suma de factores (Rene 1.0 + Ana 1.0 + Mateo 0.5 = 2.5). Cada tarjeta con −/+ en pasos de 0.25 (rango 0.25–2.0, sugerido 1.0) y botón editar. "Agregar comensal" y "Guardar cambios". |
| `Semana-3-tiempos.dc.html` · Semana con 3 tiempos | HU-19, HU-24, HU-25, HU-26 (D-03) | Nueva S0 | Barra roja "Excede por Q18" (Q518 de Q500) con desglose por tiempo (Q103/Q100, Q262/Q250, Q153/Q150). Selector de 7 días (martes activo); desayuno, almuerzo y cena con costo y "Cambiar". "Aprobar menú" activo junto al aviso de exceso ("Excede por Q18"): el exceso no bloquea ni abre diálogo de confirmación (D-03). |
| `Importar-historial.dc.html` · Importar historial | HU-16, HU-17 | Nueva S0 | Paso 2 de 3. Resumen del archivo: 16 semanas, 112 filas válidas, 3 por resolver. Resolución de platillo nuevo: "Pollo encremado" ↔ "Pollo en crema" (86 %): Asociar / Crear nuevo / elegir otro. Lista de pendientes; "Continuar" deshabilitado hasta resolver todos. |
| `Precio-manual.dc.html` · Registrar precio | HU-34 (D-05) | Nueva S0 | Supermercado (Super Fresh) y fecha comunes. Formulario de un producto: producto, presentación, precio, "Guardar precio". "Leer ticket" propone líneas con casilla; líneas no reconocidas se marcan para editar; "Confirmar 2 líneas". |
| `Notificaciones.dc.html` · Centro de notificaciones | HU-41, HU-42 (D-08) | Nueva S0 | Alerta de exceso >10 %: "El costo estimado Q281 supera tu presupuesto Q250 en 12 %" con "Ver menú" / "Ajustar presupuesto". Recordatorio dom 08:00: "Tu menú de la semana 1–7 nov está listo para revisar" con "Revisar menú". Anteriores leídas; "Marcar todas como leídas". |
| `Lista-progreso.dc.html` · Lista: avance por comida y precio real | HU-30, HU-43, HU-44 (RF-43, RF-44) | Nueva S0 | Avance general "18 de 31 productos · 58 %" con barra y gasto real "Q142.60 de Q250 estimado". Avance por comida: Dom Pepián de pollo 6 de 6 "Lista para preparar" (verde con check), Lun Carne guisada 4 de 6, Mar Pollo en crema 2 de 5. Ingredientes con estado Comprado (check y precio real), Pendiente (casilla vacía) o "Ya lo tengo" (etiqueta gris), y las comidas a las que aporta cada uno. Al marcar "Pechuga de pollo 1 lb" se abre una hoja inferior con "Precio pagado (opcional)" Q27.00, "Promedio de compra: Q27.20 · Mediana mercado: Q27.75" y los botones "Ya lo tengo" / "Marcar comprado". |

Las pantallas nuevas son estáticas (sin interacción en modo Play); el flujo interactivo sigue en `Main.dc.html`.
