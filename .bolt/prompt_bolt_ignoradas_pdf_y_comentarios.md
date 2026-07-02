# PROMPT PARA BOLT — Excluir líneas ignoradas del PDF + Comentarios por línea

## CONTEXTO

Aplicación QuoteAI / Cotizador (React + Vite + TypeScript + TailwindCSS, Supabase).
Vamos a hacer DOS mejoras acotadas en la pantalla **Validar productos** y en la
**generación del PDF** (que se ejecuta en el frontend):

1. Las líneas marcadas con el botón **Ignorar** NO deben aparecer en el PDF generado.
2. Agregar un **comentario opcional por línea** (máx. 200 caracteres) que se
   captura en la pantalla de validación y se imprime en el PDF debajo de la
   descripción del producto.

La columna nueva **YA FUE CREADA MANUALMENTE** en Supabase por el usuario:

```
job_lines.comentario  VARCHAR(200) NULL
```

NO ejecutes ningún SQL. NO crees migraciones. Solo usa la columna que ya existe.

---

## MEJORA 1 — Excluir líneas ignoradas del PDF

### Comportamiento requerido

- Localiza la función/módulo del frontend que **genera el PDF** de la cotización
  (el documento con el logo de IMPULSORA, tabla CLAVE / DESCRIPCION / ALMACEN /
  U.M. / CANTIDAD / PRECIO UNITARIO / IMPORTE).
- Antes de construir las filas de la tabla del PDF, **filtra las líneas cuyo
  estado sea "ignorada"** (el estado que asigna el botón Ignorar existente).
  Esas líneas no deben generar NINGUNA fila en el PDF — ni como "Especial",
  ni con precio 0.00, ni vacías.
- El **subtotal, IVA y total del PDF** deben calcularse solo con las líneas
  incluidas (esto probablemente ya es así porque las ignoradas van en 0.00,
  pero verifícalo).
- Las líneas "Sin coincidencia" que NO fueron ignoradas se mantienen EXACTAMENTE
  como hoy (aparecen como "Especial" con precio 0.00). No cambies ese comportamiento.

### Contadores en el encabezado de "Validar productos"

En el encabezado donde hoy aparecen REFERENCIA / CLIENTE / FECHA / TOTAL DE
LINEAS / POR REVISAR / SUBTOTAL:

- **TOTAL DE LINEAS**: se mantiene igual (total original de la solicitud, sin cambio).
- Agrega dos contadores nuevos con el mismo estilo visual que los existentes:
  - **IGNORADAS**: número de líneas marcadas como ignoradas.
  - **OK**: número de líneas validadas/con producto confirmado.
- El contador **POR REVISAR** existente no se toca en su lógica.
- Los contadores deben actualizarse en tiempo real cuando el usuario ignora
  o des-ignora una línea (mismo mecanismo de estado que ya usan los contadores actuales).

---

## MEJORA 2 — Comentario por línea

### Captura en la pantalla de validación

- En CADA fila de la tabla de validación (con o sin coincidencia, incluidas las
  ignoradas), agrega un **icono de comentario** de lucide-react
  (`MessageSquare` o `MessageSquarePlus`) junto a las acciones existentes de la fila.
- Al hacer clic, se abre un pequeño popover o input inline para escribir el
  comentario. Requisitos:
  - Límite duro de **200 caracteres**, con contador visible (ej. `145/200`).
  - Botones **Guardar** y **Cancelar**. Guardar hace `update` de
    `job_lines.comentario` para esa línea vía el cliente Supabase que ya usa
    la pantalla de validación.
  - Para borrar un comentario: vaciar el texto y guardar (guarda `NULL` o cadena vacía).
- Cuando una línea YA tiene comentario:
  - El icono cambia a estado "activo" (relleno o color primario `#0176D3`)
    para que se distinga de las líneas sin comentario.
  - El texto del comentario se muestra en la columna **PRODUCTO ENCONTRADO**,
    **debajo** del nombre/clave del producto encontrado (o debajo de
    "Sin coincidencia" si no hay match), en un renglón propio:
    - fuente más pequeña (ej. `text-xs`)
    - color gris suave (ej. `text-gray-500`)
    - cursiva opcional
    - prefijo visual sutil, ej. `💬 ` o icono pequeño inline.
- Todo el copy en **español de México** (ej. placeholder: "Escribe una anotación
  (color, talla, precisión)…", tooltip: "Agregar comentario").

### Impresión en el PDF

- En la tabla del PDF, cuando una línea incluida tenga `comentario` no vacío:
  - Se imprime **dentro de la misma celda de DESCRIPCION**, en un **renglón
    debajo** de la descripción del producto.
  - Fuente **más pequeña** que la descripción (aprox. 1–2 pt menos).
  - Color **gris suave** (ej. `#6B7280` o similar).
  - La altura de la fila debe ajustarse automáticamente para que el comentario
    no se encime con la siguiente fila.
- Las líneas ignoradas NUNCA se imprimen, aunque tengan comentario.

### Carga de datos

- Verifica que el query que trae las líneas para la pantalla de validación y
  para la generación del PDF incluya la columna `comentario` (agrégala al
  `select` si hace falta).

---

## PROHIBIDO (restricciones absolutas)

- PROHIBIDO tocar el flujo de Docling / n8n / Railway (upload, webhooks, matching).
- PROHIBIDO modificar el dropzone de carga de archivos.
- PROHIBIDO modificar `mapN8nToReviewData()`.
- PROHIBIDO modificar, renombrar o eliminar botones/acciones existentes
  (incluido el botón Ignorar actual — solo se CONSUME su estado, no se cambia su lógica).
- PROHIBIDO ejecutar SQL destructivo o de esquema: nada de `DROP`, `TRUNCATE`,
  `ALTER`, `CREATE TABLE`. La columna `comentario` ya existe.
- PROHIBIDO tocar la tabla `products` (catálogo de 29,647+ registros) en cualquier forma.
- PROHIBIDO cambiar el sistema de navegación: la app usa un state machine
  interno con `useState`, NO React Router. No introduzcas routing nuevo.
- PROHIBIDO conectar o crear otra instancia de Supabase: usa exclusivamente
  el cliente/proyecto ya configurado.
- PROHIBIDO cambiar la lógica actual de las líneas "Sin coincidencia" no
  ignoradas en el PDF (siguen saliendo como "Especial").

---

## CRITERIOS DE ACEPTACIÓN

1. Ignoro 3 líneas en una cotización de 86 → el PDF muestra 83 filas; no hay
   filas "Especial" vacías correspondientes a las ignoradas.
2. El encabezado de Validar productos muestra: Total de líneas 86,
   Ignoradas 3, OK y Por revisar con los valores correctos, actualizándose
   en vivo al ignorar/des-ignorar.
3. Escribo "Color rojo, talla M" en una línea, guardo, recargo la página →
   el comentario persiste (viene de Supabase) y el icono aparece activo.
4. Genero el PDF → el comentario aparece debajo de la descripción de esa línea,
   en letra más chica y gris, sin encimarse con la fila siguiente.
5. El contador de caracteres impide escribir más de 200.
6. Todo el flujo existente (upload, matching, validación, botones actuales)
   funciona exactamente igual que antes.
