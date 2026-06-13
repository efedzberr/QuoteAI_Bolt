# PROMPT PARA BOLT — Máquina de estados de 7 etapas + navegación bidireccional

## CONTEXTO

La app Cotizador tiene un flujo de pantallas: `upload` (carga) → `preview` ("Revisar antes de procesar", editable) → `processing` (extracción) → `review` ("Validar productos") → `generate` (PDF). Ya existe la tabla `jobs` (con columnas `referencia`, `cliente`, `status`, `progreso`, `payload`, `total_lineas`, etc.) y `job_lines`. El job se crea al soltar el archivo (mantener así). `jobs.status` es columna `text` sin constraint, así que admite nuevos valores sin cambio de esquema.

Vamos a formalizar una máquina de estados de 7 etapas, registrar cada transición en `jobs.status`, mostrarla en la lista de Inicio, permitir navegación ida y vuelta entre pantallas, y normalizar el nombre del cliente a MAYÚSCULAS.

---

## ⛔ PROHIBIDO

- PROHIBIDO crear/alterar tablas ni columnas (todo el esquema ya existe; `status` es texto libre).
- PROHIBIDO usar Bolt Database; único backend = proyecto Supabase conectado.
- PROHIBIDO tocar el matching, la búsqueda de productos, Docling/n8n, la Edge Function y la tabla `products`.
- PROHIBIDO romper la persistencia ya funcionando en `job_lines`.

---

## 1. LAS 7 ETAPAS (valores de `jobs.status`)

Usar estos valores string exactos en la columna `status`:

| # | Etiqueta visible (UI) | Valor en `status` | Pantalla | Tipo |
|---|---|---|---|---|
| 1 | Nueva Solicitud | `nueva_solicitud` | upload (recién creado) | reposo |
| 2 | Extracción Inteligente | `extraccion` | processing/extracción | procesando |
| 3 | Revisión de Datos | `revision_datos` | preview ("Revisar antes de procesar") | reposo |
| 4 | Matching de Productos | `matching` | (transición Railway) | procesando |
| 5 | Validación Comercial | `validacion` | review ("Validar productos") | reposo |
| 6 | Generación de Propuesta | `generacion` | (transición a PDF) | procesando |
| 7 | Completada | `completado` | generate (PDF listo) | final |
| – | Error | `error` | — | error |

Crear un helper central (ej. `src/lib/jobStages.ts`) que mapee `status` → etiqueta visible, color de badge y orden, para usarlo tanto en la lista de Inicio como en cualquier indicador. Colores sugeridos: reposo en azul/gris neutro, procesando en azul con spinner/“…”, completado en verde, error en rojo. Mantener consistencia con el sistema de badges actual.

## 2. ESCRITURA DE CADA ETAPA (transiciones)

En `App.tsx`, registrar la etapa con `updateJobStatus(referencia, <status>)` en cada punto:

- Al soltar el archivo y crear el job → `nueva_solicitud` (hoy se crea como `procesando`; cambiar al nuevo valor).
- Al iniciar la extracción (Docling/LLM) → `extraccion`.
- Al recibir el resultado y mostrar "Revisar antes de procesar" → `revision_datos` (hoy pone `en_revision`; cambiar a `revision_datos`).
- Al dar "Confirmar y enviar a procesamiento" e iniciar el matching → `matching`.
- Al completarse el matching y mostrar "Validar productos" → `validacion`.
- Al dar generar PDF (inicio de generación) → `generacion`, e inmediatamente después de generarse → `completado`.
- Si cualquier paso falla → `error` con mensaje en `jobs.error`.

`jobs.progreso` (0-100) se sigue actualizando solo durante `validacion` como ya ocurre.

## 3. LISTA EN INICIO ("Archivos procesados")

- Cada renglón muestra el badge de etapa según `status` (vía el helper de la sección 1).
- Botón de acción según etapa:
  - Etapas de **reposo** (`revision_datos`, `validacion`): botón **"Reanudar"** → abre la pantalla correspondiente a esa etapa con el avance guardado.
  - `nueva_solicitud` / etapas **procesando** (`extraccion`, `matching`, `generacion`): botón deshabilitado con tooltip "En proceso…".
  - `completado`: botón **"Ver PDF"** → abre la pantalla de PDF (hidratada desde `job_lines`/`payload`, sin cambiar status).
  - `error`: mostrar el mensaje de error y un botón "Reintentar" que regrese a la etapa de reposo previa con los datos guardados.

## 4. NAVEGACIÓN BIDIRECCIONAL (ida y vuelta)

Habilitar que el usuario navegue hacia atrás y reejecute, sin perder datos guardados en `job_lines`:

- **upload → extracción**: ya existe ("Procesar").
- **extracción/revisión de datos → upload**: botón "Volver" debe permitir subir OTRO archivo. Si se sube uno nuevo distinto, ver sección 5 (reejecución).
- **revisión de datos → re-ejecutar extracción**: permitir volver a lanzar la extracción del archivo actual.
- **revisión de datos → matching → validación**: "Confirmar y enviar a procesamiento" (ya existe).
- **validación → revisión de datos**: agregar un "Volver" en "Validar productos" que regrese a "Revisar antes de procesar" conservando lo editado, para corregir y volver a mandar a matching. Al re-mandar, se sobreescriben los `job_lines` con el nuevo resultado del matching (mismo job).
- **validación → PDF → validación**: "Volver" desde el PDF regresa a "Validar productos" sin perder el avance.

En todas las transiciones hacia atrás: `status` se actualiza a la etapa de reposo a la que se regresa (ej. de `validacion` de vuelta a `revision_datos` ⇒ `status='revision_datos'`).

## 5. RE-EJECUCIÓN: MISMO JOB vs NUEVO

Regla:
- **Mientras el job NO esté `completado`**: cualquier reejecución (corregir datos y volver a matching, resubir archivo dentro del mismo flujo) usa el MISMO `jobId` y la MISMA `referencia`; se sobreescriben `job_lines` y `payload`. No se crean registros nuevos en Inicio.
- **Si el job YA está `completado`** y el usuario lo reabre y lanza una nueva ejecución: mostrar un diálogo de confirmación con dos opciones:
  - **"Crear nueva cotización"**: genera un job nuevo (nueva `referencia` QAI), copiando el `payload` como punto de partida. El job original queda intacto como histórico.
  - **"Regenerar sobre la misma"**: reutiliza el mismo job/referencia, sobreescribe `job_lines` y vuelve a `validacion`.
  - Botón "Cancelar" que no hace nada.

## 6. CONSISTENCIA DE `line_index` (corrección importante)

Hoy "Revisar antes de procesar" (`PayloadPreviewScreen`) persiste con `upsertJobLine(jobId, row, ...)` usando `row` (posición del arreglo), mientras "Validar productos" usa `_lineIndex`. DEBEN usar el MISMO criterio de `line_index` por línea para que las escrituras de ambas pantallas apunten a la misma fila de `job_lines`. Unificar: que ambas pantallas usen un `line_index` estable y consistente (el mismo con el que se creó la fila en `createJobLines`). Verificar que editar una línea en "Revisar antes de procesar" y luego verla en "Validar productos" mantenga el mismo registro, sin filas huérfanas.

## 7. NOMBRE DE CLIENTE EN MAYÚSCULAS

Cualquier valor que el usuario escriba en el campo "Cliente o referencia" se transforma a MAYÚSCULAS:
- Al capturarlo (mostrar en mayúsculas en el input conforme escribe, o al confirmar).
- Al guardarlo en `jobs.cliente` y en el payload/quoteData.
- Aplicar también en la creación de cotización manual.
- Usar mayúsculas con soporte de acentos español (ej. `toLocaleUpperCase('es-MX')`).

## 8. PRUEBA DE ACEPTACIÓN

1. Subir archivo → en Inicio el job aparece avanzando por las etapas (Nueva Solicitud → Extracción → Revisión de Datos…).
2. En "Revisar antes de procesar", editar una descripción → verificar en Supabase que `job_lines` se actualizó (mismo `line_index` que verá la validación).
3. Confirmar y enviar → etapa "Validación Comercial"; volver atrás a "Revisión de Datos", corregir, reenviar → sigue siendo el MISMO job/referencia.
4. Generar PDF → etapa "Completada"; en Inicio el botón dice "Ver PDF" y abre el PDF.
5. Reabrir el job completado y lanzar nueva ejecución → aparece el diálogo "Crear nueva cotización / Regenerar sobre la misma".
6. Escribir "andina internacional" como cliente → se guarda y muestra "ANDINA INTERNACIONAL".

Reporta qué archivos modificaste. Todo el copy en español de México. No modificar nada fuera de lo listado.
