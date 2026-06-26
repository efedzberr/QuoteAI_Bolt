# Prompt para Bolt — Código de producto nuevo: obligatorio y único

## Contexto

En el formulario de "Crear producto nuevo" (validación de cotizaciones), el campo **código** hoy es opcional. A partir de ahora debe ser **obligatorio** y **único**: no puede repetirse ni contra el catálogo principal (`products`, columna `CodigoArt`) ni contra los productos nuevos ya creados (`productos_nuevos`, columna `codigo`).

> A nivel base de datos ya se aplicó la garantía dura (índice único + trigger contra el catálogo), así que aunque algo se escape, el insert será rechazado. Este prompt es la validación **en el formulario**, para que el usuario reciba el aviso al instante y con un mensaje claro.

## Normalización del código (importante)

Antes de validar y de guardar, **normaliza** el código así:
- Quita espacios al inicio y al final (`trim`).
- Conviértelo a **mayúsculas**.
- **Conserva los espacios internos** (NO los elimines): existen códigos válidos con espacio interno, p.ej. `RUG TA700`.
- Guarda en la columna `codigo` el valor ya normalizado (ej. `" rug ta700 "` → `RUG TA700`).

Toda comparación de unicidad se hace sobre ese valor normalizado.

## Validaciones a implementar (en el formulario "Crear producto nuevo")

1. **Obligatorio:** si el código queda vacío (tras `trim`), no permitir guardar y mostrar error: *"El código es obligatorio."*

2. **Único contra el catálogo principal (`products`):** consulta si ya existe un producto del catálogo con ese código normalizado. **Reutiliza el mismo cliente/consulta que ya usa la búsqueda/matching de productos** para leer el catálogo (ahí ya está resuelto el nombre de la columna del código). La comparación debe ser **case-insensitive** (compara en mayúsculas).
   - Si existe → error: *"Ese código ya existe en el catálogo de productos. Usa uno diferente."*

3. **Único contra productos nuevos (`productos_nuevos`):** consulta si ya hay una fila con ese código normalizado (case-insensitive).
   - Si existe → error: *"Ese código ya existe en productos nuevos. Usa uno diferente."*

4. **Red de seguridad ante el guardado:** aunque las validaciones de arriba pasen, el `insert` puede fallar por la garantía de base de datos (índice único o trigger del catálogo) si hubo una coincidencia simultánea. Envuelve el `insert` en try/catch: si el error es de violación de unicidad (código `23505`) o el mensaje menciona que el código ya existe, muestra *"Ese código ya existe, usa uno diferente."* en lugar de un error crudo.

## Notas técnicas

- Al consultar por el código, **escapa los caracteres especiales** (comas, paréntesis, decimales) para no romper la sintaxis de los filtros de PostgREST; usa filtros parametrizados (`.eq` / `.ilike` con el valor escapado), no concatenación de strings en `.or()`.
- Las consultas de unicidad deben usar el cliente con la sesión del usuario donde aplique; para el catálogo, reutiliza el mismo acceso que ya usa la búsqueda de productos.

## PROHIBIDO (no tocar)

- NO tocar el flujo de Docling / n8n / extracción / dropzone / `mapN8nToReviewData()`.
- NO tocar la tabla del catálogo `products` ni sus consultas existentes (solo se reutilizan para leer).
- NO tocar `job_lines`, la cadena de envío a Salesforce, ni los endpoints de Railway.
- NO cambiar el esquema de `productos_nuevos` desde Bolt (la columna y las restricciones ya las maneja el admin por SQL).
- NO introducir react-router ni librerías nuevas.
- El cambio vive solo en el formulario/lógica de "Crear producto nuevo".
