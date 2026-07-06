# PROMPT PARA BOLT — Botón "Editar cotización" (reapertura a validación)

## CONTEXTO

Aplicación QuoteAI / Cotizador (React + Vite + TypeScript + TailwindCSS, Supabase,
navegación por state machine interno con useState — NO React Router).

Vamos a agregar UNA funcionalidad acotada: un botón **"Editar cotización"** que
permite reabrir una cotización ya terminada (PDF generado y/o enviada a
Salesforce) para que el usuario haga cambios manuales y vuelva a generar el PDF.

Las columnas nuevas **YA FUERON CREADAS MANUALMENTE** en Supabase por el usuario:

```
jobs.reabierta_at   TIMESTAMPTZ NULL
jobs.veces_editada  INTEGER NOT NULL DEFAULT 0
```

NO ejecutes ningún SQL. NO crees migraciones. Solo usa las columnas que ya existen.

---

## COMPORTAMIENTO REQUERIDO

### 1. Dónde aparece el botón

- En la pantalla de **"Validar productos" → pestaña "Version revisada"**, y en
  cualquier vista de detalle de una cotización terminada.
- El botón SOLO es visible cuando el job está en un estado terminal:
  `pdf_generado`, `completado`, o el estado que indique "enviada a Salesforce"
  (usa los valores de status reales que encuentres en el código).
- Si el job está en cualquier estado anterior (extracción, revisión, matching,
  validación en curso, generación), el botón NO se muestra — la cotización
  todavía está en proceso.
- Estilo: botón secundario con icono `Pencil` o `PenSquare` de lucide-react,
  texto **"Editar cotización"**, consistente con la paleta existente
  (#0176D3 / #032D60, fuente Manrope).

### 2. Modal de confirmación (obligatorio)

Al hacer clic en "Editar cotización", mostrar un modal de confirmación ANTES
de hacer cualquier cambio:

- Título: **"¿Editar esta cotización?"**
- Cuerpo (español de México): explicar que la cotización regresará al estado
  de validación para hacer cambios manuales, que se trabajará sobre la versión
  ya revisada (no sobre la solicitud original), y que al terminar deberá
  generarse el PDF nuevamente. Si ya fue enviada a Salesforce, al reenviarse
  se creará una nueva oportunidad allá.
- Botones: **"Cancelar"** (cierra sin cambios) y **"Sí, editar"** (primario).

### 3. Qué pasa al confirmar

Al confirmar, en una sola operación de update sobre el job:

- `status` → `'validacion'` (estado EXISTENTE del ciclo de vida; no crees estados nuevos).
- `reabierta_at` → timestamp actual (`new Date().toISOString()`).
- `veces_editada` → valor actual + 1.
- Navegar (con el state machine interno existente) a la pantalla de
  **validación normal**, la misma de siempre.

### 4. Baseline de la edición — MUY IMPORTANTE

- La pantalla de validación debe cargar **el contenido actual de `job_lines`**,
  es decir, la versión YA revisada/aprobada: productos confirmados, líneas
  ignoradas, comentarios, productos nuevos agregados. ESE es el punto de partida.
- PROHIBIDO recargar o re-mapear desde `jobs.payload` (el JSON original de
  n8n). El payload original NO se toca y NO se usa como fuente en la reapertura.
- PROHIBIDO volver a ejecutar extracción, matching, webhooks de n8n o llamadas
  a Railway. La reapertura es 100% edición manual del usuario.
- Verifica que la carga de la pantalla de validación distinga: si las líneas
  ya existen en `job_lines` para ese job, se cargan de ahí (este mecanismo de
  persistencia ya existe — es el mismo que permite retomar una validación
  interrumpida). Si ese flujo ya funciona así, NO lo modifiques; solo confirma
  que la reapertura pasa por él.

### 5. Operaciones disponibles en modo edición

Todas las que YA existen en la pantalla de validación, sin crear lógica nueva:

- Cambiar el producto matcheado de una línea (búsqueda en catálogo).
- Agregar líneas/productos nuevos (con `line_index = max + 1`, regla existente).
- Ignorar líneas.
- **Des-ignorar (revivir) líneas previamente ignoradas**: las líneas ignoradas
  deben seguir visibles en la tabla de validación con su estado de ignoradas,
  y el usuario debe poder quitarles ese estado para reincorporarlas. Si el
  botón Ignorar actual ya funciona como toggle, no cambies nada; si hoy no
  permite revertir, agrega SOLO la acción inversa sin alterar la lógica de ignorar.
- Editar/agregar/borrar comentarios por línea (funcionalidad ya entregada).
- NO agregues eliminación física de líneas. Ignorar es suficiente. No se
  renumeran `line_index` jamás.

### 6. Folio, PDF y KPIs

- El folio/referencia de la cotización SE MANTIENE IGUAL. Al regenerar el PDF,
  simplemente se produce la versión actualizada con el mismo folio.
- Los KPIs del dashboard ya se calculan con conteos reales por status desde la
  base de datos: al pasar el job a `validacion`, debe salir automáticamente
  del conteo de "Generadas" y aparecer en el estado correspondiente. Verifica
  que así ocurra; si algún KPI usa un cache local o lista en memoria,
  asegúrate de que se refresque al reabrir.
- El subtotal mostrado en el encabezado de validación se recalcula como ya lo
  hace hoy (con las líneas activas no ignoradas).

---

## PROHIBIDO (restricciones absolutas)

- PROHIBIDO tocar el flujo de Docling / n8n / Railway (upload, webhooks,
  matching, extracción). La reapertura NO dispara ningún pipeline.
- PROHIBIDO modificar el dropzone de carga de archivos.
- PROHIBIDO modificar `mapN8nToReviewData()`.
- PROHIBIDO usar `jobs.payload` como fuente de datos en la reapertura ni
  modificarlo en cualquier forma.
- PROHIBIDO renumerar, reindexar o eliminar físicamente registros de `job_lines`.
- PROHIBIDO ejecutar SQL de esquema: nada de `DROP`, `TRUNCATE`, `ALTER`,
  `CREATE TABLE`. Las columnas nuevas ya existen.
- PROHIBIDO tocar la tabla `products` (catálogo de 29,647+ registros).
- PROHIBIDO crear estados nuevos en el ciclo de vida del job. Se reutiliza
  `validacion`.
- PROHIBIDO cambiar el sistema de navegación: state machine interno con
  useState, NO introduzcas React Router.
- PROHIBIDO conectar o crear otra instancia de Supabase: usa exclusivamente
  el cliente/proyecto ya configurado.
- PROHIBIDO refactorizar componentes no relacionados con esta funcionalidad.

---

## CRITERIOS DE ACEPTACIÓN

1. Una cotización en `pdf_generado` muestra el botón "Editar cotización";
   una en `matching` o `validacion` NO lo muestra.
2. Clic en el botón → aparece modal de confirmación; "Cancelar" no cambia nada.
3. "Sí, editar" → el job pasa a `validacion`, `reabierta_at` se llena,
   `veces_editada` incrementa en 1, y se navega a la pantalla de validación.
4. La pantalla de validación muestra la versión revisada como baseline:
   productos ya confirmados, líneas ignoradas (visibles y con opción de
   revivirlas), comentarios existentes. NO muestra la solicitud original cruda.
5. Puedo revivir una línea ignorada, cambiar un producto por otro más barato,
   agregar una línea nueva y editar un comentario — todo con los mecanismos
   existentes.
6. Regenero el PDF → mismo folio, contenido actualizado, líneas ignoradas
   excluidas, comentarios impresos.
7. El dashboard deja de contar esa cotización como "Generada" mientras está
   en edición, y vuelve a contarla al completarse de nuevo.
8. No se disparó ninguna llamada a n8n/Railway durante todo el flujo de
   reapertura y edición.
