# Prompt Bolt — Fix Tablero: parpadeo de KPIs, click mudo y botón eliminar

## Contexto
El Tablero (`HomeDashboard`) refresca cada 3s de forma incondicional y sin candado, lo que provoca re-render constante y valores "locos" en los KPIs (p. ej. Precisión de lectura salta a 475% y regresa a 51%). Además, al hacer click en cotizaciones que quedaron incompletas (sin `job_lines`), la pantalla no abre nada: es un no-op silencioso. Finalmente, no hay forma de eliminar cotizaciones rotas desde la UI.

Este prompt corrige las tres cosas de forma quirúrgica.

## Archivos que SÍ se tocan (SOLO estos 4)
1. `src/lib/jobLines.ts` — función `fetchSingleJobStats` (una sola query, sin carrera de conteos).
2. `src/components/HomeDashboard.tsx` — candado de polling + snapshot atómico + clamps + botón eliminar + modal de confirmación.
3. `src/lib/jobs.ts` — agregar función `deleteJobCascade`.
4. `src/App.tsx` — guard en `openJobResults` y `openJobPdf` para que el click no sea mudo.

## PROHIBIDO (no tocar bajo ninguna circunstancia)
- NO tocar la tabla `products` ni ninguna query contra ella.
- NO tocar el flujo Docling/Railway, el dropzone, `processWithRailway`, ni `QuoteUploadScreen`.
- NO tocar `mapN8nToReviewData()`, la lógica del botón "Ignorar", ni ninguna configuración de webhooks n8n/Make.
- NO tocar la tabla `productos_nuevos` (al eliminar un job NO se deben borrar productos nuevos).
- NO cambiar la navegación por máquina de estados (NO meter React Router).
- NO refactorizar componentes no listados arriba. NO cambiar estilos globales, tokens de Tailwind, ni otros KPIs que no se mencionen.
- NO cambiar la lógica de mapeo de líneas existente en `App.tsx` (`mapLineFields`, `normalizeResponse`, `openJobResults` salvo el `else` que se indica).

---

## Cambio 1 — `src/lib/jobLines.ts`: eliminar la carrera de conteos

**Problema:** `fetchSingleJobStats` dispara 3 queries (dos `count head` + un `select`). Los dos conteos (`productos` y `reconocidos`) se resuelven en snapshots ligeramente distintos mientras el matching escribe líneas, así que `reconocidos` alcanza a rebasar a `productos` → precisión > 100%.

**Solución:** reemplazar el cuerpo de `fetchSingleJobStats` por UNA sola query y contar en JS. Esto garantiza `reconocidos <= productos` (mismo snapshot) y reduce a 1 request por job.

Reemplaza la función completa `fetchSingleJobStats` por:

```ts
async function fetchSingleJobStats(jobId: string): Promise<JobLineStat> {
  const { data, error } = await supabase
    .from('job_lines')
    .select('producto_codigo, total_linea, confianza')
    .eq('job_id', jobId);

  if (error) {
    console.error('[jobLines] fetchSingleJobStats error:', error);
    return { productos: 0, reconocidos: 0, total: 0, confianza: 0 };
  }

  const rows = data || [];
  const productos = rows.length;
  let reconocidos = 0;
  let total = 0;
  let confianzaSum = 0;
  let confianzaCount = 0;

  for (const row of rows) {
    if (row.producto_codigo !== null && row.producto_codigo !== undefined) reconocidos++;
    total += row.total_linea || 0;
    if (row.confianza !== null && row.confianza !== undefined) {
      confianzaSum += row.confianza;
      confianzaCount++;
    }
  }

  // Salvaguarda: reconocidos nunca puede exceder el total de líneas
  reconocidos = Math.min(reconocidos, productos);

  return {
    productos,
    reconocidos,
    total,
    confianza: confianzaCount > 0 ? Math.round((confianzaSum / confianzaCount) * 100) : 0,
  };
}
```

No cambies `fetchJobLineStats` ni ninguna otra función del archivo.

---

## Cambio 2 — `src/components/HomeDashboard.tsx`: candado de polling + snapshot atómico + clamps

### 2a. Refs de control
Junto a los `useRef`/`useState` existentes del componente `HomeDashboard`, agrega dos refs:

```ts
const loadingRef = useRef(false);   // evita que se enciman llamadas
const seqRef = useRef(0);           // descarta respuestas viejas
```

(`useRef` ya está importado.)

### 2b. Reescribir `loadJobs` para que sea atómico y no se traslape
Reemplaza la función `loadJobs` completa por:

```ts
const loadJobs = async () => {
  if (loadingRef.current) return;            // hay una carga en curso: saltar este tick
  loadingRef.current = true;
  const mySeq = ++seqRef.current;

  try {
    const [data, total, generadas] = await Promise.all([
      fetchRecentJobs(20),
      countJobs(),
      countJobsByStatus(['pdf_generado']),
    ]);
    if (mySeq !== seqRef.current) return;    // llegó una carga más nueva: descartar esta

    const ids = data.map((j) => j.id).filter(Boolean);

    let stats: { perJob: Record<string, JobLineStat>; global: GlobalLineStats };
    if (ids.length > 0) {
      stats = await fetchJobLineStats(ids);
    } else {
      stats = {
        perJob: {},
        global: { totalLineas: 0, totalValor: 0, reconocidos: 0, confianzaAlta: 0, confianzaMedia: 0, confianzaBaja: 0, confianzaPromedio: 0 },
      };
    }
    if (mySeq !== seqRef.current) return;    // descartar si ya no es la última

    // Aplicar TODO junto: jobs y stats del MISMO snapshot (evita mezclar pases)
    setJobs(data);
    setTotalCotizaciones(total);
    setTotalGeneradas(generadas);
    setJobStats(stats.perJob);
    setGlobalStats(stats.global);
    setLoadingJobs(false);
  } catch (e) {
    console.error('[HomeDashboard] loadJobs error:', e);
  } finally {
    loadingRef.current = false;
  }
};
```

El `useEffect` con `setInterval(loadJobs, 3000)` se queda IGUAL (auto-refresh cada 3s, pero ahora protegido por el candado).

### 2c. Clamps defensivos en los KPIs derivados
Localiza estas líneas y envuélvelas con `Math.min(100, ...)`:

```ts
const confAltaPct = confTotal > 0 ? Math.min(100, Math.round((globalStats.confianzaAlta / confTotal) * 100)) : 0;
const confMediaPct = confTotal > 0 ? Math.min(100, Math.round((globalStats.confianzaMedia / confTotal) * 100)) : 0;
const confBajaPct = confTotal > 0 ? Math.min(100, Math.round((globalStats.confianzaBaja / confTotal) * 100)) : 0;
const precisionLectura = confTotal > 0 ? Math.min(100, Math.round((globalStats.reconocidos / confTotal) * 100)) : 0;
```

No cambies el resto de los cálculos de KPI.

---

## Cambio 3 — `src/lib/jobs.ts`: función de borrado en cascada

Agrega esta función al final de `src/lib/jobs.ts` (usa el cliente `supabase` autenticado ya importado en el archivo). Borra primero `job_lines`, luego el `job`. NO toca `productos_nuevos`.

```ts
export async function deleteJobCascade(jobId: string): Promise<boolean> {
  const { error: linesErr } = await supabase
    .from('job_lines')
    .delete()
    .eq('job_id', jobId);
  if (linesErr) {
    console.error('[jobs] deleteJobCascade job_lines error:', linesErr);
    return false;
  }

  const { error: jobErr } = await supabase
    .from('jobs')
    .delete()
    .eq('id', jobId);
  if (jobErr) {
    console.error('[jobs] deleteJobCascade jobs error:', jobErr);
    return false;
  }

  return true;
}
```

---

## Cambio 4 — `src/components/HomeDashboard.tsx`: botón eliminar + modal de confirmación

Regla: el botón de eliminar aparece en **todas las filas EXCEPTO las que ya generaron PDF** (`job.status !== 'pdf_generado'`).

### 4a. Import
En el import de `lucide-react`, agrega `Trash2`. En el import de `../lib/jobs`, agrega `deleteJobCascade`:

```ts
import { fetchRecentJobs, countJobs, countJobsByStatus, deleteJobCascade, type Job, type JobStatus } from '../lib/jobs';
```

### 4b. Estado del modal
Agrega junto a los demás `useState` del componente:

```ts
const [deleteTarget, setDeleteTarget] = useState<Job | null>(null);
const [deleting, setDeleting] = useState(false);
```

### 4c. Handler de borrado
Agrega dentro del componente (antes del `return`):

```ts
const handleConfirmDelete = async () => {
  if (!deleteTarget) return;
  setDeleting(true);
  const ok = await deleteJobCascade(deleteTarget.id);
  const removedId = deleteTarget.id;
  setDeleting(false);
  setDeleteTarget(null);
  if (ok) {
    setJobs((prev) => prev.filter((j) => j.id !== removedId));
    loadJobs();
  } else {
    alert('No se pudo eliminar la cotización. Intenta de nuevo.');
  }
};
```

### 4d. Botón en la columna Acciones
Dentro del `<td>` de Acciones (el último de cada fila), agrega este botón como PRIMER elemento del contenido de la celda, condicionado a que NO sea `pdf_generado`. Debe coexistir con los botones existentes (Revisar/Validar, Ver PDF, etc.), no reemplazarlos. Usa `stopPropagation` para no disparar el click de la fila:

```tsx
{job.status !== 'pdf_generado' && (
  <button
    onClick={(e) => { e.stopPropagation(); setDeleteTarget(job); }}
    className="inline-flex items-center justify-center w-7 h-7 mr-1 text-bad hover:bg-bad-soft rounded-md transition-colors"
    title="Eliminar cotización"
  >
    <Trash2 className="w-3.5 h-3.5" />
  </button>
)}
```

### 4e. Modal de confirmación
Agrega este bloque justo ANTES del cierre `</AppLayout>` del `return` (reutiliza el patrón de modal ya usado en la app):

```tsx
{deleteTarget && (
  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
    <div className="bg-white rounded-xl p-7 max-w-md w-full mx-4 border border-rule-soft" style={{ boxShadow: '0 12px 24px rgba(0,0,0,.15)' }}>
      <h3 className="text-ink mb-2" style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em' }}>
        Eliminar cotización
      </h3>
      <p className="text-ink-soft mb-1" style={{ fontSize: 13, lineHeight: 1.5 }}>
        Esta acción elimina la cotización y sus líneas de forma permanente. No se puede deshacer.
      </p>
      <p className="text-ink-faint mb-6" style={{ fontSize: 12 }}>
        {deleteTarget.referencia} — {deleteTarget.cliente || 'Sin cliente'}
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => setDeleteTarget(null)}
          disabled={deleting}
          className="flex-1 px-4 py-2.5 text-ink-soft bg-rule-soft rounded-lg hover:bg-rule transition-colors disabled:opacity-50"
          style={{ fontSize: 13, fontWeight: 600 }}
        >
          Cancelar
        </button>
        <button
          onClick={handleConfirmDelete}
          disabled={deleting}
          className="flex-1 px-4 py-2.5 text-white bg-bad rounded-lg hover:opacity-90 transition-colors disabled:opacity-50"
          style={{ fontSize: 13, fontWeight: 600 }}
        >
          {deleting ? 'Eliminando...' : 'Eliminar'}
        </button>
      </div>
    </div>
  </div>
)}
```

Si alguna clase de color (`text-bad`, `bg-bad`, `bg-bad-soft`) no existe en la config de Tailwind del proyecto, usa el equivalente rojo ya presente en el código (el chip de Error usa `text-bad`/`bg-bad-soft`, así que deberían existir). No agregues colores nuevos a la config.

---

## Cambio 5 — `src/App.tsx`: que el click no sea mudo

**Problema:** `openJobResults` hace `fetchJobLines(...).then(jobLines => { if (jobLines.length > 0) {...} })` sin `else`. Cuando el job no tiene líneas, el click no hace nada.

### 5a. `openJobResults`
Localiza el `.then((jobLines) => {` dentro de `openJobResults`. El bloque `if (jobLines.length > 0) { ... }` se queda IGUAL. Solo agrega un `else` al final de ese `if` (dentro del mismo `.then`):

```ts
    } else {
      alert('Esta cotización quedó incompleta durante el procesamiento y no tiene líneas guardadas. Puedes eliminarla con el botón de basura (🗑) en su fila del Tablero.');
    }
```

### 5b. `openJobPdf`
En `openJobPdf`, ya existe `} else if (job.payload) { ... }`. Agrega al final un `else`:

```ts
    } else {
      alert('Esta cotización no tiene datos para mostrar. Puedes eliminarla con el botón de basura (🗑) en su fila del Tablero.');
    }
```

No cambies ninguna otra función de `App.tsx`.

---

## Criterios de aceptación
1. El Tablero ya NO parpadea: los KPIs se mantienen estables entre refrescos si los datos no cambiaron. Precisión de lectura nunca muestra valores > 100%.
2. Con el candado, nunca se enciman dos `loadJobs`; `jobs` y `globalStats` siempre provienen del mismo pase.
3. Cada fila que NO sea `pdf_generado` tiene un botón de basura que abre un modal de confirmación; al confirmar, la cotización desaparece del Tablero y no reaparece tras el refresco.
4. Las cotizaciones ya generadas (PDF) NO muestran botón de eliminar.
5. Al hacer click en una cotización incompleta (sin líneas), aparece un mensaje claro en vez de no pasar nada.
6. Nada del flujo Docling/n8n/Make, del catálogo `products`, ni de `productos_nuevos` fue modificado.
7. El build de Vite/TypeScript compila sin errores.
