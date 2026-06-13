import { useState, useCallback, useRef } from 'react';
import HomeDashboard from './components/HomeDashboard';
import QuoteUploadScreen from './components/QuoteUploadScreen';
import PayloadPreviewScreen from './components/PayloadPreviewScreen';
import ProcessingScreen from './components/ProcessingScreen';
import QuoteReviewScreen from './components/QuoteReviewScreen';
import PDFPreviewScreen from './components/PDFPreviewScreen';
import AdminScreen from './components/AdminScreen';
import AuthScreen from './components/AuthScreen';
import AppLayout from './components/layout/AppLayout';
import { useAuth } from './hooks/useAuth';
import { normalizeLines } from './lib/normalizeLines';
import { createJob, updateJobPayload, updateJobStatus, updateJobProgreso, getJobByReferencia } from './lib/jobs';
import { createJobLines, bulkUpsertJobLines, fetchJobLines, type JobLine } from './lib/jobLines';

const WEBHOOK_URL = 'https://hook.us2.make.com/3p4n696w3n2jpplghxvnaa21t3ihselx';

const PROCESSING_RULES = [
  'If the row does not contain a clear product request with a quantity, it is likely a header, title, or section label. In that case return: { "original_text": "<the row text>", "quantity": null, "unit_of_measure": null, "product_code_hint": null, "description": null, "keywords": [], "attributes": { "material": null, "size": null, "color": null, "other": null }, "notes": "SKIP - this row is a header or label, not a product" }',
  'If the original_text looks like a JSON object or contains multiple products concatenated together, extract only the FIRST product mentioned and ignore the rest.',
  'A valid product row must have at least a description and ideally a quantity.',
];

type Screen = 'home' | 'upload' | 'preview' | 'processing' | 'review' | 'generate' | 'admin';

const EXPECTED_LINE_FIELDS = [
  'original_text',
  'quantity',
  'matched_product_code',
  'matched_product_name',
  'matched_unit_price',
  'confidence',
];

function parseLineItem(line: any): any {
  if (typeof line === 'string') {
    try {
      return JSON.parse(line);
    } catch (e) {
      console.warn('[Parse] Failed to parse line as JSON string:', line, e);
      return line;
    }
  }
  if (line && typeof line === 'object' && 'value' in line && typeof line.value === 'string') {
    try {
      return JSON.parse(line.value);
    } catch (e) {
      console.warn('[Parse] Failed to parse line.value as JSON string:', line.value, e);
      return line;
    }
  }
  return line;
}

function unwrapMakeResponse(parsed: any): any {
  if (Array.isArray(parsed) && parsed.length > 0) {
    const first = parsed[0];
    if (first && typeof first === 'object' && 'body' in first && typeof first.body === 'object') {
      console.log('[Webhook] Detected Make wrapper format: [{ body: { ... } }]. Unwrapping body.');
      return first.body;
    }
    if (first && typeof first === 'object' && 'lines' in first) {
      console.log('[Webhook] Detected array wrapper: [{ lines: [...] }]. Unwrapping first element.');
      return first;
    }
  }
  return parsed;
}

function mapLineFields(line: any): any {
  let parsed = parseLineItem(line);

  if (typeof parsed !== 'object' || parsed === null) {
    console.warn('[MapLine] Line is not an object after parsing:', parsed);
    return parsed;
  }

  const mapped: any = { ...parsed };

  if ('codigo' in mapped && !('matched_product_code' in mapped)) {
    mapped.matched_product_code = mapped.codigo;
  }
  if ('nombre_catalogo' in mapped && !('matched_product_name' in mapped)) {
    mapped.matched_product_name = mapped.nombre_catalogo;
  }
  if ('precio' in mapped && !('matched_unit_price' in mapped)) {
    const price = typeof mapped.precio === 'string' ? parseFloat(mapped.precio) : mapped.precio;
    mapped.matched_unit_price = isNaN(price) ? null : price;
  }
  if ('confianza' in mapped && !('confidence' in mapped)) {
    mapped.confidence = mapped.confianza;
  }
  if ('requiere_revision' in mapped && !('needs_review' in mapped)) {
    mapped.needs_review = mapped.requiere_revision;
  }
  if ('descripcion_original' in mapped && !('original_text' in mapped)) {
    mapped.original_text = mapped.descripcion_original;
  }

  if (!('original_code' in mapped)) {
    const originalCode =
      mapped.codigo_original ??
      mapped.CodigoOriginal ??
      mapped.original_code ??
      mapped.Codigo ??
      mapped.codigo_cliente ??
      null;
    mapped.original_code = originalCode ? String(originalCode).trim() || null : null;
  }

  if (!('quantity' in mapped) || mapped.quantity === undefined) {
    const qty = mapped.cant || mapped.Cant || mapped.cantidad || mapped.qty;
    mapped.quantity = qty !== undefined ? (typeof qty === 'string' ? parseFloat(qty) : qty) : 1;
    if (isNaN(mapped.quantity)) mapped.quantity = 1;
  }
  if (!('matched_unit_of_measure' in mapped)) {
    mapped.matched_unit_of_measure = mapped.unid || mapped.Unid || mapped.unidad_medida || 'PZA';
  }
  if (!('needs_review' in mapped)) {
    mapped.needs_review = false;
  }

  return mapped;
}

function normalizeResponse(data: any, customerName: string): any {
  if (!data || typeof data !== 'object') return data;

  if (!Array.isArray(data.lines) && typeof data.lines === 'object' && data.lines !== null) {
    console.log('[Normalize] Detected Make format with lines as object. Converting to array.');
    const linesArray = Object.values(data.lines);
    console.log('[Normalize] Converted lines object to array:', linesArray.length, 'items');
    data.lines = linesArray;
  }

  if (Array.isArray(data.lines)) {
    console.log('[Normalize] Processing lines array, first element:', data.lines[0]);

    const firstLine = data.lines[0];
    if (firstLine && typeof firstLine === 'object' && 'key' in firstLine && 'value' in firstLine) {
      console.log('[Normalize] Detected Make format with {key, value} objects. Extracting values.');
      data.lines = data.lines.map((item: any) => mapLineFields(item.value || item));
    } else {
      data.lines = data.lines.map(mapLineFields);
    }
  }

  if (!data.quoteReference) {
    data.quoteReference = `QAI-${Date.now()}`;
  }
  if (!data.customerName) {
    data.customerName = customerName;
  }
  if (!data.generatedDate) {
    data.generatedDate = new Date().toLocaleDateString('es-MX');
  }
  if (!data.totalLines && data.lines) {
    data.totalLines = data.total || data.lines.length;
  }
  if (!data.currency) {
    data.currency = 'MXN';
  }
  if (data.subtotal === undefined) {
    data.subtotal = data.lines
      ? data.lines.reduce((sum: number, l: any) => {
          if (l.ignored) return sum;
          return sum + (l.quantity || 0) * (l.matched_unit_price || 0);
        }, 0)
      : 0;
  }

  return data;
}

function diagnoseResponse(parsed: any): { valid: boolean; message: string } {
  if (parsed === null || parsed === undefined) {
    return { valid: false, message: 'Parsed response is null/undefined.' };
  }

  if (typeof parsed !== 'object') {
    return {
      valid: false,
      message: `Expected a JSON object, but received type "${typeof parsed}".\n\nValue: ${JSON.stringify(parsed).substring(0, 300)}`,
    };
  }

  if (Array.isArray(parsed)) {
    const topKeys = parsed.length > 0 ? Object.keys(parsed[0]) : [];
    return {
      valid: false,
      message: [
        'Response is an array, not an object with a "lines" property.',
        '',
        `Array length: ${parsed.length}`,
        topKeys.length > 0 ? `First element keys: ${topKeys.join(', ')}` : 'Array is empty',
        '',
        'EXPECTED structure:',
        '  { "lines": [ { "original_text": "...", "quantity": 1, ... } ] }',
        '',
        'RECEIVED structure:',
        `  [ ${parsed.length > 0 ? JSON.stringify(parsed[0]).substring(0, 200) + '...' : '(empty)'} ]`,
        '',
        'Hint: The response might contain the lines directly as an array. Wrap it inside { "lines": [...] }.',
      ].join('\n'),
    };
  }

  const topKeys = Object.keys(parsed);

  if (!('lines' in parsed)) {
    return {
      valid: false,
      message: [
        'Response object is missing the "lines" property.',
        '',
        `Top-level keys found: ${topKeys.length > 0 ? topKeys.join(', ') : '(none)'}`,
        '',
        'EXPECTED structure:',
        '  { "lines": [ { "original_text": "...", "quantity": 1, ... } ] }',
        '',
        'RECEIVED structure:',
        `  { ${topKeys.map(k => `"${k}": ${JSON.stringify(parsed[k]).substring(0, 80)}`).join(', ')} }`,
      ].join('\n'),
    };
  }

  if (!Array.isArray(parsed.lines)) {
    return {
      valid: false,
      message: [
        `"lines" exists but is not an array (type: ${typeof parsed.lines}).`,
        '',
        `Value of "lines": ${JSON.stringify(parsed.lines).substring(0, 300)}`,
        '',
        'EXPECTED: "lines" should be an array of line objects.',
      ].join('\n'),
    };
  }

  if (parsed.lines.length === 0) {
    return {
      valid: false,
      message: [
        '"lines" is an empty array - no product lines were returned.',
        '',
        `Other top-level keys: ${topKeys.filter(k => k !== 'lines').join(', ') || '(none)'}`,
        '',
        'The orchestration layer returned zero results. Check that your Make scenario is processing rows and producing output.',
      ].join('\n'),
    };
  }

  const firstLine = parsed.lines[0];
  const lineKeys = typeof firstLine === 'object' && firstLine !== null ? Object.keys(firstLine) : [];
  const missingFields = EXPECTED_LINE_FIELDS.filter(f => !(f in firstLine));

  if (missingFields.length > 0) {
    console.warn(
      `[Webhook] Lines present but first line is missing fields: ${missingFields.join(', ')}`,
      '\nFirst line keys:', lineKeys,
      '\nFirst line:', firstLine
    );
  }

  return { valid: true, message: '' };
}

interface UploadData {
  customerName: string;
  rows: Record<string, any>[];
  rawDoclingResponse?: any;
  mappingNotice?: string;
}

type ReadEngine = 'default' | 'docling';

function App() {
  const auth = useAuth();
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [readEngine, setReadEngine] = useState<ReadEngine>('default');
  const [uploadData, setUploadData] = useState<UploadData | null>(null);
  const [webhookResponse, setWebhookResponse] = useState<any>(null);
  const [rawResponse, setRawResponse] = useState<string>('');
  const [webhookError, setWebhookError] = useState<string | null>(null);
  const [approvedData, setApprovedData] = useState<{ lines: any[]; quoteData: any } | null>(null);
  const [editedQuoteData, setEditedQuoteData] = useState<any>(null);
  const [manualQuoteData, setManualQuoteData] = useState<any>(null);
  const [jobReferencia, setJobReferencia] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const onProcessingError = useCallback((message: string, rawText?: string) => {
    setWebhookError(message);
    if (rawText) setRawResponse(rawText);
  }, []);

  const onProcessingComplete = useCallback((data: any, rawText: string) => {
    if (data.lines && Array.isArray(data.lines)) {
      data.lines = data.lines.map((line: any, i: number) => ({
        ...line,
        _lineIndex: i,
      }));
    }
    setWebhookResponse(data);
    setRawResponse(rawText);
    setCurrentScreen('review');
    if (jobReferencia) {
      updateJobStatus(jobReferencia, 'en_revision', { payload: data });
    }
    if (jobId && data.lines && Array.isArray(data.lines)) {
      const matchLines = data.lines.map((line: any, i: number) => ({
        line_index: i,
        producto_codigo: line.matched_product_code || null,
        producto_descripcion: line.matched_product_name || null,
        unidad_medida: line.matched_unit_of_measure || null,
        precio_unitario: line.matched_unit_price ?? null,
        confianza: line.confidence ?? null,
        requiere_revision: (line.confidence ?? 0) < 0.75,
        total_linea: (line.quantity || 0) * (line.matched_unit_price || 0) || null,
        origen: (line.matched_product_code && (line.confidence ?? 0) > 0) ? 'auto' : 'sin_match',
        descripcion_original: line.original_text || null,
        cantidad: line.quantity ?? 1,
        codigo_original: line.original_code || null,
      }));
      bulkUpsertJobLines(jobId, matchLines);
    }
  }, [jobReferencia, jobId]);

  const handleFileReady = useCallback((data: UploadData) => {
    setUploadData(data);
    setWebhookResponse(null);
    setRawResponse('');
    setWebhookError(null);
    setCurrentScreen('preview');

    const ref = `QAI-${Date.now()}`;
    setJobReferencia(ref);
    createJob(ref, data.customerName).then((job) => {
      if (job) {
        setJobId(job.id);
        updateJobPayload(ref, data.rows, data.rows.length);
        const jobLines = data.rows.map((row, i) => ({
          job_id: job.id,
          line_index: i,
          codigo_original: row.Codigo || row.codigo || null,
          descripcion_original: row.Descripcion || row.descripcion || row.original_text || null,
          unidad_original: row.Unid || row.unidad || null,
          cantidad: parseFloat(row.Cant || row.cantidad || '1') || 1,
          producto_codigo: null,
          producto_descripcion: null,
          unidad_medida: null,
          precio_unitario: null,
          confianza: null,
          origen: 'auto' as const,
          estado: 'pendiente' as const,
          requiere_revision: false,
          total_linea: null,
          notas: null,
        }));
        createJobLines(job.id, jobLines);
      }
    });
  }, []);

  const handleCreateManualQuote = useCallback((customerName: string) => {
    const emptyQuoteData = {
      status: 'manual',
      quoteReference: `QAI-MANUAL-${Date.now()}`,
      customerName,
      generatedDate: new Date().toLocaleDateString('es-MX'),
      totalLines: 0,
      flaggedLines: 0,
      subtotal: 0,
      currency: 'MXN',
      lines: [],
    };
    setManualQuoteData(emptyQuoteData);
    setCurrentScreen('review');
  }, []);

  const handleConfirmSend = useCallback((editedRows: Record<string, any>[]) => {
    if (!uploadData) return;

    // Update uploadData rows with the edited version
    setUploadData((prev) => prev ? { ...prev, rows: editedRows } : prev);
    setCurrentScreen('processing');

    if (jobReferencia) {
      updateJobStatus(jobReferencia, 'procesando');
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    (async () => {
      try {
        const sanitizedRows = editedRows.map((row: any) => {
          const cantInt = Math.max(1, Math.round(parseFloat(row?.Cant) || 1));
          return { ...row, Cant: String(cantInt) };
        });

        const response = await fetch(WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerName: uploadData.customerName,
            rows: sanitizedRows,
            processingRules: PROCESSING_RULES,
          }),
          signal: controller.signal,
        });

        const rawText = await response.text();

        console.group('[Webhook Response Diagnostics]');
        console.log('HTTP Status:', response.status, response.statusText);
        console.log('Content-Type:', response.headers.get('content-type'));
        console.log('Raw response length:', rawText.length);
        console.log('Raw response (full):', rawText);

        if (!response.ok) {
          console.error('Non-OK HTTP status received');
          console.groupEnd();
          onProcessingError(
            `Webhook returned HTTP ${response.status} ${response.statusText}`,
            rawText
          );
          return;
        }

        let parsed: any = null;
        let parseError: string | null = null;

        try {
          const cleaned = rawText
            .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')
            .replace(/\r?\n|\r/g, ' ')
            .replace(/\t/g, ' ')
            .trim();

          parsed = JSON.parse(cleaned);
          console.log('Parsed JSON type:', typeof parsed);
          console.log('Parsed JSON:', parsed);
        } catch (e: any) {
          parseError = e.message || 'Unknown JSON parse error';
          console.error('JSON parse failed:', parseError);
          console.log('First 500 chars of raw:', rawText.substring(0, 500));
          console.groupEnd();

          const preview = rawText.length > 200 ? rawText.substring(0, 200) + '...' : rawText;
          onProcessingError(
            `Response is not valid JSON.\n\nParse error: ${parseError}\n\nResponse preview:\n${preview}`,
            rawText
          );
          return;
        }

        const raw = unwrapMakeResponse(parsed);
        console.log('Unwrapped response:', raw);

        const normalizedLinesList = normalizeLines(raw.lines);
        const data = {
          ...raw,
          lines: normalizedLinesList,
        };

        console.log('[Webhook] Lines normalized:', normalizedLinesList.length, 'items');

        const diagnostics = diagnoseResponse(data);
        console.log('Diagnostics:', diagnostics);
        console.groupEnd();

        if (!diagnostics.valid) {
          onProcessingError(diagnostics.message, rawText);
          return;
        }

        const normalized = normalizeResponse(data, uploadData.customerName);
        console.log('[Webhook] Normalized response:', normalized);

        onProcessingComplete(normalized, rawText);
      } catch (error: any) {
        if (error.name === 'AbortError') return;
        console.error('[Webhook] Network/fetch error:', error);
        console.error('[Webhook] Error stack:', error.stack);
        const detail = [
          `Network error: ${error.message || 'Unknown error'}`,
          error.cause ? `Cause: ${String(error.cause)}` : null,
          '',
          'This usually means the webhook URL is unreachable, CORS is blocking the request, or there is a network issue.',
        ]
          .filter(Boolean)
          .join('\n');
        setWebhookError(detail);
      }
    })();
  }, [uploadData, jobReferencia, onProcessingError, onProcessingComplete]);

  const handleCancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setCurrentScreen('upload');
    setUploadData(null);
    setWebhookResponse(null);
    setRawResponse('');
    setWebhookError(null);
    setJobReferencia(null);
    setJobId(null);
  }, []);

  const handleApproved = useCallback((approvedLines: any[], quoteData: any) => {
    const edited = { ...quoteData, lines: approvedLines };
    setApprovedData({ lines: approvedLines, quoteData: edited });
    setEditedQuoteData(edited);
    setCurrentScreen('generate');
    if (jobReferencia) {
      updateJobStatus(jobReferencia, 'completado', { payload: edited });
    }
  }, [jobReferencia]);

  const handleBackToUpload = useCallback(() => {
    setCurrentScreen('upload');
    setUploadData(null);
    setWebhookResponse(null);
    setRawResponse('');
    setWebhookError(null);
    setApprovedData(null);
    setEditedQuoteData(null);
    setManualQuoteData(null);
    setJobReferencia(null);
    setJobId(null);
  }, []);

  if (auth.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F3F3F3]">
        <div className="text-gray-500 font-medium">Cargando...</div>
      </div>
    );
  }

  if (!auth.session) {
    return <AuthScreen />;
  }

  const handleLayoutNavigate = (section: string) => {
    if (section === 'home') setCurrentScreen('home');
    else if (section === 'cotizar') {
      setReadEngine('default');
      setCurrentScreen('upload');
    }
    else if (section === 'ajustes') setCurrentScreen('admin');
  };

  if (currentScreen === 'home') {
    return (
      <HomeDashboard
        onNewQuote={() => {
          setReadEngine('default');
          setCurrentScreen('upload');
        }}
        onNewQuoteDocling={() => {
          setReadEngine('docling');
          setCurrentScreen('upload');
        }}
        onOpenAdmin={() => setCurrentScreen('admin')}
        onResumeJob={(job) => {
          const ref = job.referencia;
          setJobReferencia(ref);
          setJobId(job.id);

          if (job.status === 'en_revision' || job.status === 'enviado_validacion') {
            fetchJobLines(job.id).then((jobLines) => {
              if (jobLines.length > 0) {
                const reconstructedLines = jobLines.map((jl: JobLine) => ({
                  original_text: jl.descripcion_original || '',
                  original_code: jl.codigo_original || null,
                  quantity: jl.cantidad || 1,
                  matched_product_code: jl.producto_codigo || null,
                  matched_product_name: jl.producto_descripcion || null,
                  matched_unit_price: jl.precio_unitario ?? null,
                  matched_unit_of_measure: jl.unidad_medida || jl.unidad_original || 'PZA',
                  confidence: jl.confianza ?? 0,
                  needs_review: jl.requiere_revision,
                  ignored: jl.estado === 'ignorada',
                  approved: jl.estado === 'aprobada',
                  badgeType: jl.origen === 'manual' ? 'manual' : jl.origen === 'producto_nuevo' ? 'producto_nuevo' : undefined,
                  _lineIndex: jl.line_index,
                }));
                const quoteData = {
                  quoteReference: ref,
                  customerName: job.cliente || '',
                  generatedDate: new Date(job.created_at).toLocaleDateString('es-MX'),
                  totalLines: reconstructedLines.length,
                  currency: 'MXN',
                  subtotal: reconstructedLines.reduce((sum: number, l: any) => {
                    if (l.ignored) return sum;
                    return sum + (l.quantity || 0) * (l.matched_unit_price || 0);
                  }, 0),
                  lines: reconstructedLines,
                };
                setWebhookResponse(quoteData);
                setRawResponse(JSON.stringify(quoteData));
                setCurrentScreen('review');
              } else if (job.payload) {
                const normalized = normalizeResponse(job.payload, job.cliente || '');
                setWebhookResponse(normalized);
                setRawResponse(JSON.stringify(job.payload));
                setCurrentScreen('review');
              }
            });
          } else if (job.status === 'completado' && job.payload) {
            const normalized = normalizeResponse(job.payload, job.cliente || '');
            setWebhookResponse(normalized);
            setRawResponse(JSON.stringify(job.payload));
            setCurrentScreen('review');
          }
        }}
      />
    );
  }

  if (currentScreen === 'preview' && uploadData) {
    return (
      <AppLayout
        active="cotizar"
        breadcrumbs={[
          { label: 'Inicio', onClick: () => setCurrentScreen('home') },
          { label: 'Cotizar', onClick: () => setCurrentScreen('upload') },
          { label: 'Revisar archivo' },
        ]}
        onNavigate={handleLayoutNavigate}
        contentPadding={false}
      >
        <PayloadPreviewScreen
          customerName={uploadData.customerName}
          rows={uploadData.rows}
          processingRules={PROCESSING_RULES}
          rawDoclingResponse={uploadData.rawDoclingResponse}
          notice={uploadData.mappingNotice}
          jobReferencia={jobReferencia || undefined}
          jobId={jobId || undefined}
          onConfirmSend={handleConfirmSend}
          onBack={handleBackToUpload}
        />
      </AppLayout>
    );
  }

  if (currentScreen === 'processing' && uploadData) {
    return (
      <AppLayout
        active="cotizar"
        breadcrumbs={[
          { label: 'Inicio', onClick: () => setCurrentScreen('home') },
          { label: 'Cotizar', onClick: () => setCurrentScreen('upload') },
          { label: 'Procesando' },
        ]}
        onNavigate={handleLayoutNavigate}
        contentPadding={false}
      >
        <ProcessingScreen
          customerName={uploadData.customerName}
          totalRows={uploadData.rows.length}
          responseData={webhookResponse}
          errorMessage={webhookError}
          rawResponse={rawResponse}
          onCancel={handleCancel}
        />
      </AppLayout>
    );
  }

  if (currentScreen === 'generate' && approvedData) {
    return (
      <AppLayout
        active="cotizar"
        breadcrumbs={[
          { label: 'Inicio', onClick: () => setCurrentScreen('home') },
          { label: 'Cotizar', onClick: () => setCurrentScreen('upload') },
          { label: 'PDF' },
        ]}
        onNavigate={handleLayoutNavigate}
        contentPadding={false}
      >
        <PDFPreviewScreen
          quoteData={approvedData.quoteData}
          onBack={() => setCurrentScreen('review')}
        />
      </AppLayout>
    );
  }

  if (currentScreen === 'review' && manualQuoteData) {
    return (
      <AppLayout
        active="cotizar"
        breadcrumbs={[
          { label: 'Inicio', onClick: () => setCurrentScreen('home') },
          { label: 'Cotizar', onClick: () => setCurrentScreen('upload') },
          { label: 'Cotización manual' },
        ]}
        onNavigate={handleLayoutNavigate}
        contentPadding={false}
      >
        <QuoteReviewScreen
          quoteData={manualQuoteData}
          rawResponse=""
          onApproved={handleApproved}
          onBack={handleBackToUpload}
        />
      </AppLayout>
    );
  }

  if (currentScreen === 'review' && webhookResponse) {
    return (
      <AppLayout
        active="cotizar"
        breadcrumbs={[
          { label: 'Inicio', onClick: () => setCurrentScreen('home') },
          { label: 'Cotizar', onClick: () => setCurrentScreen('upload') },
          { label: 'Validar productos' },
        ]}
        onNavigate={handleLayoutNavigate}
        contentPadding={false}
      >
        <QuoteReviewScreen
          quoteData={webhookResponse}
          editedQuoteData={editedQuoteData}
          rawResponse={rawResponse}
          onApproved={handleApproved}
          onBack={handleBackToUpload}
          jobId={jobId || undefined}
          jobReferencia={jobReferencia || undefined}
        />
      </AppLayout>
    );
  }

  if (currentScreen === 'admin') {
    return (
      <AppLayout
        active="ajustes"
        breadcrumbs={[
          { label: 'Inicio', onClick: () => setCurrentScreen('home') },
          { label: 'Ajustes' },
        ]}
        onNavigate={handleLayoutNavigate}
        contentPadding={false}
      >
        <AdminScreen onBack={() => setCurrentScreen('home')} />
      </AppLayout>
    );
  }

  return (
    <AppLayout
      active="cotizar"
      breadcrumbs={[
        { label: 'Inicio', onClick: () => setCurrentScreen('home') },
        { label: 'Cotizar' },
        { label: 'Nueva' },
      ]}
      onNavigate={handleLayoutNavigate}
      contentPadding={false}
    >
      <QuoteUploadScreen
        readEngine={readEngine}
        onFileReady={handleFileReady}
        onCreateManualQuote={handleCreateManualQuote}
        onOpenAdmin={() => setCurrentScreen('admin')}
        onBackToHome={() => setCurrentScreen('home')}
      />
    </AppLayout>
  );
}

export default App;