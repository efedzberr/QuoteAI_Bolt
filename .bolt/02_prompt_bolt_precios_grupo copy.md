# QuoteAI — Precios por grupo de cliente, inventario y permiso de visibilidad

## Contexto

El backend de Python (Railway) ahora enriquece cada línea de `job_lines` al momento del match con el snapshot de precios e inventario. La base de datos ya fue actualizada manualmente (NO ejecutes ningún DDL). Estos son los campos nuevos que ya existen y que el backend ya está llenando:

**Tabla `jobs` (columnas nuevas):**
- `no_cliente` (text | null) — número de cliente de Salesforce
- `grupo` (text | null) — grupo de precios del cliente (ej. "Mostrador", "Revendedor", "General")
- `precio_seleccionado` (text, `'grupo'` | `'lista'`, default `'grupo'`) — selección GLOBAL de precio de la cotización

**Tabla `job_lines` (columnas nuevas):**
- `precio_lista` (numeric | null) — precio de lista del catálogo
- `precio_grupo` (numeric | null) — precio del grupo del cliente; `null` si el grupo no tiene precio para ese artículo
- `descuento_pct` (numeric | null) — descuento calculado: `(precio_lista − precio_grupo) / precio_lista × 100`
- `inventario_total` (numeric | null) — existencia consolidada de todos los almacenes; `0` = sin disponibilidad; `null` = línea sin match
- `inventario_almacenes` (jsonb | null) — arreglo `[{ "almacen_id": string, "almacen_nombre": string, "cantidad": number }, ...]` ordenado por cantidad descendente

**Tabla nueva `user_permissions`:**
- `user_id` (uuid, = `auth.uid()`), `email` (text), `ver_inventario` (boolean)
- RLS activo: cada usuario solo puede hacer SELECT de su propia fila
- Si el usuario NO tiene fila → tratar como `ver_inventario = false`

**Función RPC nueva `aplicar_precio_seleccionado(p_job_id uuid, p_modo text)`:**
- Recalcula `precio_unitario` y `total_linea` de TODAS las líneas del job según el modo (`'grupo'` o `'lista'`) y guarda la selección en `jobs.precio_seleccionado`
- IMPORTANTE: `precio_unitario` en `job_lines` es SIEMPRE el precio efectivo vigente. El PDF ya lo usa y por eso el PDF NO se toca.

---

## Cambio 1 — Enviar `noCliente` a `/match/start` (App.tsx)

En la llamada `fetch('https://quoteai-production.up.railway.app/match/start', ...)` de `App.tsx`, agrega el número de cliente de la cuenta Salesforce seleccionada al body:

```json
{
  "referencia": "...",
  "customerName": "...",
  "noCliente": "<salesforceAccount.noCliente o null>",
  "rows": [...]
}
```

El `salesforceAccount` ya viaja en `uploadData` (interface en App.tsx). Si el usuario no seleccionó cuenta de Salesforce, manda `noCliente: null` (el backend usará el grupo "General").

## Cambio 2 — Interfaces TypeScript

- En `src/lib/jobs.ts`, interface `Job`: agrega `no_cliente?: string | null`, `grupo?: string | null`, `precio_seleccionado?: 'grupo' | 'lista'`.
- En `src/lib/jobLines.ts`, interface `JobLine`: agrega `precio_lista?: number | null`, `precio_grupo?: number | null`, `descuento_pct?: number | null`, `inventario_total?: number | null`, `inventario_almacenes?: { almacen_id: string; almacen_nombre: string; cantidad: number }[] | null`.
- Todos opcionales para no romper flujos existentes ni datos históricos (jobs viejos tendrán estos campos en `null` — la UI debe mostrar "—" en esos casos, nunca `NaN` ni `undefined`).

## Cambio 3 — Hook de permisos `src/hooks/usePermissions.ts` (nuevo)

Hook que al montar consulta una sola vez:

```ts
supabase.from('user_permissions').select('ver_inventario').eq('user_id', user.id).maybeSingle()
```

Devuelve `{ verInventario: boolean, loading: boolean }`. Sin fila, error o consulta fallida → `verInventario = false` (oculto por default, es lo seguro). Usa el cliente `supabase` existente de `src/lib/supabase.ts`.

## Cambio 4 — Cabecera de "Validar productos" en DOS líneas

Reorganizar la cabecera actual (que hoy tiene todo en una línea) en dos renglones para que no se apriete:

**Línea 1 (identidad del cliente):**
- REFERENCIA: `QAI-...`
- CLIENTE: nombre del cliente
- NO. CLIENTE: `jobs.no_cliente` (o "—" si null)
- GRUPO: `jobs.grupo` como badge/pill azul (paleta Salesforce #0176D3) (o "—" si null)
- TOGGLE DE PRECIO (ver Cambio 6)

**Línea 2 (métricas, las que ya existen):**
- FECHA · TOTAL DE LÍNEAS · POR REVISAR · IGNORADAS · OK · SUBTOTAL

Los datos del job ya se leen con `getJobByReferencia` en `QuoteReviewScreen.tsx`; reutiliza esa lectura (no agregues polling nuevo).

## Cambio 5 — Columnas nuevas en la tabla de líneas

Después de la columna TOTAL LÍNEA y antes de ACCIONES, agregar en este orden:

1. **DESC.** — `descuento_pct` formateado `"20.5%"`. Si es `null` (sin precio de grupo o sin match) → "—". Si es negativo (precio grupo mayor que lista) mostrarlo tal cual en rojo, ej. "-3.2%".
2. **PRECIO C/DESC.** — `precio_grupo` formateado como moneda `MX$`. Si es `null` → "—".
3. **DISPONIB.** — `inventario_total`. Reglas: número > 0 → mostrar el número; `0` → texto "Sin disponibilidad" en rojo; `null` (línea sin match o job viejo) → "—".
4. **ALMACÉN** — según `inventario_almacenes`:
   - 2 o más almacenes con `cantidad > 0` → texto "Varios almacenes" con un chevron (lucide `ChevronDown`/`ChevronUp`) que EXPANDE la línea: debajo de la fila se muestra una sub-fila con el desglose `almacen_nombre — N pzas` por cada almacén (ordenados como vienen, ya llegan por cantidad descendente). Solo listar almacenes con cantidad > 0.
   - Exactamente 1 almacén con existencia → mostrar directamente el nombre de ese almacén, sin expandible.
   - `inventario_total = 0` o arreglo vacío → "—".
   - `null` → "—".

La columna PRECIO UNIT. existente ahora debe mostrar `precio_lista` (con fallback a `precio_unitario` cuando `precio_lista` sea null, para jobs viejos). TOTAL LÍNEA sigue mostrando `total_linea` (que ya refleja el precio efectivo).

**Permiso:** las columnas DISPONIB. y ALMACÉN (y sus sub-filas expandibles) solo se renderizan si `usePermissions().verInventario === true`. Si es false, esas dos columnas NO existen en el DOM (no solo ocultas con CSS).

## Cambio 6 — Toggle global de precio (grupo | lista)

En la línea 1 de la cabecera, un control segmentado de dos opciones: **"Precio grupo"** | **"Precio lista"**. Estado inicial: `jobs.precio_seleccionado` (default `'grupo'`).

Al cambiar de opción:
1. Mostrar modal de confirmación: "¿Cambiar todos los precios de la cotización a [precio de grupo / precio de lista]? Esto recalculará todas las líneas y sobrescribirá precios editados manualmente." Botones Cancelar / Confirmar.
2. Al confirmar: `await supabase.rpc('aplicar_precio_seleccionado', { p_job_id: jobId, p_modo: 'grupo' | 'lista' })`.
3. Después del RPC, recargar las líneas con el `fetchJobLines` existente y recalcular el subtotal en pantalla.
4. Mientras corre el RPC, deshabilitar el toggle (spinner pequeño).

Reglas:
- El toggle se deshabilita en modo `readOnly` (cotizaciones completadas/pdf_generado sin reabrir).
- El toggle aplica a TODA la cotización — no existe selección de precio por línea individual.
- Si el RPC falla, mostrar error y NO cambiar el estado visual del toggle.

## PROHIBIDO (no tocar nada de esto)

- NO modificar el pipeline de Docling/n8n/Make, el dropzone, ni los flujos de webhooks existentes
- NO tocar `mapN8nToReviewData()`
- NO tocar `processWithRailway.ts` ni `normalizeLines.ts`
- NO modificar los componentes de PDF (`src/components/pdf/QuoteDocument.tsx`, `src/components/pdf/styles.ts`) — el PDF ya usa `precio_unitario` que siempre es el precio efectivo
- NO ejecutar ni generar DDL/SQL — todas las columnas, tablas y funciones YA EXISTEN en Supabase
- NO introducir React Router ni un segundo cliente de Supabase
- NO tocar la columna `payload` de `jobs`
- NO renumerar `line_index` de `job_lines`
- NO modificar la lógica de `fetchSingleJobStats`, `HomeDashboard.tsx` ni los contadores del dashboard
- NO cambiar la lógica de estados/status de jobs

## Archivos a modificar (únicamente estos)

- `src/App.tsx` — body de `/match/start` con `noCliente`
- `src/lib/jobs.ts` — interface `Job`
- `src/lib/jobLines.ts` — interface `JobLine`
- `src/hooks/usePermissions.ts` — NUEVO
- `src/components/QuoteReviewScreen.tsx` — cabecera 2 líneas, toggle, modal de confirmación
- `src/components/QuoteReviewTable.tsx` (o el componente que renderiza las filas de la tabla de validación) — columnas nuevas + fila expandible de almacenes

## Criterios de aceptación

1. Subo un documento seleccionando una cuenta de Salesforce → al llegar a "Validar productos" la cabecera muestra en la línea 1: referencia, cliente, no. de cliente, grupo (badge) y el toggle en "Precio grupo"; línea 2: fecha y contadores.
2. Las líneas con precio de grupo muestran su % de descuento y el precio con descuento; las que no tienen precio de grupo muestran "—" en ambas y su total usa precio de lista.
3. Con permiso de inventario: veo disponibilidad total y "Varios almacenes" expandible con el desglose. Sin permiso (o sin fila en `user_permissions`): las columnas de inventario no existen.
4. Cambio el toggle a "Precio lista" → modal → confirmo → todas las líneas y el subtotal se recalculan; recargo la página y el toggle sigue en "Precio lista".
5. Un job antiguo (sin campos nuevos) abre sin errores mostrando "—" en las columnas nuevas.
6. El PDF genera con los precios efectivos vigentes sin haber modificado ningún archivo de `pdf/`.
