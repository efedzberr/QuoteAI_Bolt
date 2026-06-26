# Prompt para Bolt — Pausa + reintento entre crear productos y crear oportunidad

## Contexto

La cadena del botón "Enviar a Salesforce" ya hace tres pasos: (1) crear productos nuevos (`/products/create-in-salesforce`), (2) crear la oportunidad (`/quotes/send-to-salesforce`), (3) subir el PDF (`/quotes/upload-pdf`).

Detectamos un problema de **timing**: cuando se acaban de crear productos nuevos, Salesforce tarda un instante en hacerlos disponibles para referenciarlos. Si la oportunidad se crea demasiado rápido, falla con el error **"Products not found"** (aunque los productos sí se crearon correctamente). Hay que amortiguar ese tiempo.

Este cambio es **solo** sobre la transición del Paso 1 al Paso 2. Los pasos en sí no cambian.

## Cambio a implementar

### 1. Pausa después de crear productos (solo si se crearon)

- Si en el Paso 1 **sí se enviaron productos nuevos** y la respuesta fue `success: true`, esperar **3 segundos** (`await` de un sleep) **antes** de llamar a crear la oportunidad.
- Si la cotización **no tenía productos nuevos** (la lista iba vacía / no se llamó al endpoint de productos), **no esperar nada**: crear la oportunidad de inmediato.

### 2. Reintento de la oportunidad SOLO ante "Products not found"

Al crear la oportunidad (`/quotes/send-to-salesforce`):

- Si responde error y el mensaje de Salesforce **contiene "Products not found"** (o `Product` not found, según el texto que regrese):
  - Esperar **3 segundos** y **reintentar** la misma llamada.
  - Permitir hasta **2 reintentos** (es decir, **3 intentos en total**).
  - Si tras el último intento sigue fallando con "Products not found", entonces sí mostrar el error.
- Si responde **cualquier otro error** (por ejemplo `REQUIRED_FIELD_MISSING`, `[Name]`, sesión, etc.): **NO reintentar**. Mostrar el error de inmediato (reintentar no lo arreglaría y solo haría lenta la app).
- Si responde éxito en cualquier intento: continuar normal (leer `quoteId` y seguir al Paso 3 — subir PDF).

> Importante: el reintento se dispara **únicamente** por "Products not found". No reintentar a ciegas ante cualquier fallo.

### 3. Estados de la UI (español de México)

- Durante la pausa/reintentos, el botón sigue en estado de carga. El texto puede mostrarse como *"Enviando a Salesforce…"* (no es necesario un texto especial por cada reintento, pero no muestres un error intermedio mientras aún quedan reintentos por hacer).
- Solo mostrar el mensaje de error cuando se agoten los reintentos (caso "Products not found") o de inmediato (cualquier otro error).
- Mantener todos los mensajes de éxito y de caso parcial (oportunidad OK / PDF falló) que ya existen.

## Reglas

- Reutilizar el mismo `fetch`/cliente y URL base de Railway que ya se usan.
- La pausa de 3s va **solo** cuando se crearon productos nuevos; no penalizar las cotizaciones sin productos nuevos.
- El reintento es exclusivo de la llamada a la oportunidad y exclusivo del error "Products not found".

## PROHIBIDO (no tocar)

- NO modificar los endpoints ni la lógica interna de los Pasos 1, 2 y 3 (solo se ajusta la transición entre el 1 y el 2: la pausa y el reintento condicional).
- NO reintentar errores distintos a "Products not found".
- NO tocar Docling / n8n / extracción / dropzone / `mapN8nToReviewData()`.
- NO tocar el catálogo de productos, `job_lines`, ni `productos_nuevos` (ni su esquema).
- NO cambios de esquema ni DDL desde Bolt.
- NO introducir react-router ni librerías nuevas.
- El cambio vive solo en el manejador del botón "Enviar a Salesforce".
