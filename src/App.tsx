import { useState, useCallback } from 'react';
import HomeDashboard from './components/HomeDashboard';
import QuoteUploadScreen from './components/QuoteUploadScreen';
import PayloadPreviewScreen from './components/PayloadPreviewScreen';
import QuoteReviewScreen from './components/QuoteReviewScreen';
import PDFPreviewScreen from './components/PDFPreviewScreen';
import AdminScreen from './components/AdminScreen';
import AuthScreen from './components/AuthScreen';
import JobProgressScreen from './components/JobProgressScreen';
import AppLayout from './components/layout/AppLayout';
import { useAuth } from './hooks/useAuth';
import { createJob, updateJobPayload, updateJobPayloadDebounced, updateJobStatus } from './lib/jobs';
import { createJobLines, fetchJobLines, type JobLine } from './lib/jobLines';
import type { Job } from './lib/jobs';

const PROCESSING_RULES = [
  'If the row does not contain a clear product request with a quantity, it is likely a header, title, or section label. In that case return: { "original_text": "<the row text>", "quantity": null, "unit_of_measure": null, "product_code_hint": null, "description": null, "keywords": [], "attributes": { "material": null, "size": null, "color": null, "other": null }, "notes": "SKIP - this row is a header or label, not a product" }',
  'If the original_text looks like a JSON object or contains multiple products concatenated together, extract only the FIRST product mentioned and ignore the rest.',
  'A valid product row must have at least a description and ideally a quantity.',
];

type Screen = 'home' | 'upload' | 'preview' | 'review' | 'generate' | 'admin' | 'job_progress';

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

interface UploadData {
  customerName: string;
  rows: Record<string, any>[];
  rawDoclingResponse?: any;
  mappingNotice?: string;
}

function App() {
  const auth = useAuth();
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [uploadData, setUploadData] = useState<UploadData | null>(null);
  const [webhookResponse, setWebhookResponse] = useState<any>(null);
  const [rawResponse, setRawResponse] = useState<string>('');
  const [webhookError, setWebhookError] = useState<string | null>(null);
  const [approvedData, setApprovedData] = useState<{ lines: any[]; quoteData: any } | null>(null);
  const [editedQuoteData, setEditedQuoteData] = useState<any>(null);
  const [manualQuoteData, setManualQuoteData] = useState<any>(null);
  const [reexecJob, setReexecJob] = useState<any>(null);
  const [resumeExtraction, setResumeExtraction] = useState<{ rows: any[]; customerName: string } | null>(null);
  const [jobReferencia, setJobReferencia] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progressJob, setProgressJob] = useState<Job | null>(null);

  const handleExtractionComplete = useCallback((rows: any[], customerName: string) => {
    // Anti-duplicate: if we already have a jobId for this session, skip
    if (jobId) return;

    const upperCustomer = customerName.toLocaleUpperCase('es-MX');
    const ref = `QAI-${Date.now()}`;
    setJobReferencia(ref);
    createJob(ref, upperCustomer).then((job) => {
      if (job) {
        setJobId(job.id);
        updateJobStatus(ref, 'extraccion');
        updateJobPayloadDebounced(ref, rows, rows.length);
        const jobLines = rows.map((row, i) => ({
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
  }, [jobId]);

  const handleFileReady = useCallback((data: UploadData) => {
    const upperCustomer = data.customerName.toLocaleUpperCase('es-MX');
    const normalizedData = { ...data, customerName: upperCustomer };
    setUploadData(normalizedData);
    setWebhookResponse(null);
    setRawResponse('');
    setWebhookError(null);
    setCurrentScreen('preview');

    if (jobReferencia) {
      updateJobStatus(jobReferencia, 'revision_datos');
    }
  }, [jobReferencia]);

  const handleCreateManualQuote = useCallback((customerName: string) => {
    const upperCustomer = customerName.toLocaleUpperCase('es-MX');
    const emptyQuoteData = {
      status: 'manual',
      quoteReference: `QAI-MANUAL-${Date.now()}`,
      customerName: upperCustomer,
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

    if (jobReferencia) {
      updateJobStatus(jobReferencia, 'matching');
    }

    const sanitizedRows = editedRows.map((row: any) => {
      const cantInt = Math.max(1, Math.round(parseFloat(row?.Cant) || 1));
      return { ...row, Cant: String(cantInt) };
    });

    fetch('https://quoteai-production.up.railway.app/match/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        referencia: jobReferencia,
        customerName: uploadData.customerName,
        rows: sanitizedRows,
      }),
    }).catch((err) => {
      console.error('[match/start] Error:', err);
    });

    setCurrentScreen('home');
    setUploadData(null);
    setWebhookResponse(null);
    setRawResponse('');
    setWebhookError(null);
    setJobReferencia(null);
    setJobId(null);
  }, [uploadData, jobReferencia]);


  const handleApproved = useCallback((approvedLines: any[], quoteData: any) => {
    const edited = { ...quoteData, lines: approvedLines };
    if (jobReferencia) {
      updateJobStatus(jobReferencia, 'generacion');
    }
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
    setResumeExtraction(null);
  }, []);

  const handleBackToPreview = useCallback(() => {
    if (uploadData) {
      setWebhookResponse(null);
      setRawResponse('');
      setWebhookError(null);
      setCurrentScreen('preview');
      if (jobReferencia) {
        updateJobStatus(jobReferencia, 'revision_datos');
      }
    } else {
      setCurrentScreen('home');
    }
  }, [uploadData, jobReferencia]);

  const handleBackFromPdfToReview = useCallback(() => {
    setCurrentScreen('review');
    if (jobReferencia) {
      updateJobStatus(jobReferencia, 'validacion');
    }
  }, [jobReferencia]);

  const handleReexecNewQuote = useCallback(() => {
    if (!reexecJob) return;
    const newRef = `QAI-${Date.now()}`;
    const cliente = reexecJob.cliente || '';
    setReexecJob(null);
    setJobReferencia(newRef);
    createJob(newRef, cliente).then((job) => {
      if (job) {
        setJobId(job.id);
        if (reexecJob.payload) {
          updateJobPayload(newRef, reexecJob.payload, reexecJob.total_lineas || 0);
          updateJobStatus(newRef, 'revision_datos');
          const rows = reexecJob.payload.rows || reexecJob.payload.lines || [];
          setUploadData({ customerName: cliente, rows });
          setCurrentScreen('preview');
        }
      }
    });
  }, [reexecJob]);

  const handleReexecSameJob = useCallback(() => {
    if (!reexecJob) return;
    const ref = reexecJob.referencia;
    setJobReferencia(ref);
    setJobId(reexecJob.id);
    setReexecJob(null);
    updateJobStatus(ref, 'validacion');
    fetchJobLines(reexecJob.id).then((jobLines) => {
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
          customerName: reexecJob.cliente || '',
          generatedDate: new Date(reexecJob.created_at).toLocaleDateString('es-MX'),
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
      }
    });
  }, [reexecJob]);

  const openJobResults = useCallback((job: Job) => {
    setJobReferencia(job.referencia);
    setJobId(job.id);
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
          quoteReference: job.referencia,
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
        setProgressJob(null);
        setCurrentScreen('review');
      }
    });
  }, []);

  const handleJobClick = useCallback((job: Job) => {
    if (job.status === 'completado') {
      openJobResults(job);
    } else if (job.status === 'error') {
      setProgressJob(job);
      setCurrentScreen('job_progress');
    } else {
      setProgressJob(job);
      setCurrentScreen('job_progress');
    }
  }, [openJobResults]);

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
      setCurrentScreen('upload');
    }
    else if (section === 'ajustes') setCurrentScreen('admin');
  };

  if (currentScreen === 'home') {
    return (
    <>
      <HomeDashboard
        onNewQuote={() => {
          setResumeExtraction(null);
          setJobReferencia(null);
          setJobId(null);
          setCurrentScreen('upload');
        }}
        onNewQuoteDocling={() => {
          setResumeExtraction(null);
          setJobReferencia(null);
          setJobId(null);
          setCurrentScreen('upload');
        }}
        onOpenAdmin={() => setCurrentScreen('admin')}
        onReexecuteJob={(job) => setReexecJob(job)}
        onJobClick={handleJobClick}
        onResumeJob={(job) => {
          const ref = job.referencia;
          setJobReferencia(ref);
          setJobId(job.id);

          if (job.status === 'extraccion') {
            const rows = job.payload?.rows || (Array.isArray(job.payload) ? job.payload : []);
            setResumeExtraction({ rows, customerName: job.cliente || '' });
            setCurrentScreen('upload');
          } else if (job.status === 'revision_datos') {
            if (job.payload && job.payload.rows) {
              setUploadData({
                customerName: job.cliente || '',
                rows: job.payload.rows || job.payload,
              });
              setCurrentScreen('preview');
            } else if (job.payload) {
              const rows = Array.isArray(job.payload) ? job.payload : [];
              setUploadData({ customerName: job.cliente || '', rows });
              setCurrentScreen('preview');
            }
          } else if (job.status === 'validacion' || job.status === 'en_revision' || job.status === 'enviado_validacion') {
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
            setApprovedData({ lines: normalized.lines || [], quoteData: normalized });
            setEditedQuoteData(normalized);
            setCurrentScreen('generate');
          }
        }}
      />
      {reexecJob && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-7 max-w-md w-full mx-4 border border-[#E5E5E5]" style={{ boxShadow: '0 12px 24px rgba(0,0,0,.15)' }}>
            <h3 className="text-[#181818] mb-2" style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em' }}>
              Reejecutar cotizacion
            </h3>
            <p className="text-[#444444] mb-1" style={{ fontSize: 13, lineHeight: 1.5 }}>
              Esta cotizacion ya fue completada. ¿Que deseas hacer?
            </p>
            <p className="text-[#747474] mb-6" style={{ fontSize: 12 }}>
              Ref: {reexecJob.referencia} — {reexecJob.cliente}
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleReexecNewQuote}
                className="w-full px-4 py-3 text-white bg-[#0176D3] rounded-lg hover:bg-[#014486] transition-colors text-left"
                style={{ fontSize: 13, fontWeight: 600 }}
              >
                Crear nueva cotizacion
                <span className="block text-white/70 mt-0.5" style={{ fontSize: 11, fontWeight: 400 }}>
                  Genera un job nuevo con los datos como punto de partida
                </span>
              </button>
              <button
                onClick={handleReexecSameJob}
                className="w-full px-4 py-3 text-[#0176D3] bg-[#EAF5FE] border border-[#0176D3]/20 rounded-lg hover:bg-[#D6EDFB] transition-colors text-left"
                style={{ fontSize: 13, fontWeight: 600 }}
              >
                Regenerar sobre la misma
                <span className="block text-[#747474] mt-0.5" style={{ fontSize: 11, fontWeight: 400 }}>
                  Reutiliza la misma referencia y sobreescribe el resultado
                </span>
              </button>
              <button
                onClick={() => setReexecJob(null)}
                className="w-full px-4 py-2.5 text-[#444444] bg-[#F0F0F0] rounded-lg hover:bg-[#E5E5E5] transition-colors"
                style={{ fontSize: 13, fontWeight: 600 }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
    );
  }

  if (currentScreen === 'job_progress' && progressJob) {
    return (
      <AppLayout
        active="home"
        breadcrumbs={[
          { label: 'Inicio', onClick: () => setCurrentScreen('home') },
          { label: 'Progreso' },
        ]}
        onNavigate={handleLayoutNavigate}
      >
        <JobProgressScreen
          job={progressJob}
          onComplete={(completedJob) => openJobResults(completedJob)}
          onBack={() => { setProgressJob(null); setCurrentScreen('home'); }}
        />
      </AppLayout>
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
          onBack={handleBackFromPdfToReview}
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
          onBackToPreview={handleBackToPreview}
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
        onFileReady={handleFileReady}
        onExtractionComplete={handleExtractionComplete}
        onCreateManualQuote={handleCreateManualQuote}
        onOpenAdmin={() => setCurrentScreen('admin')}
        onBackToHome={() => setCurrentScreen('home')}
        initialRows={resumeExtraction?.rows}
        initialCustomerName={resumeExtraction?.customerName}
      />
    </AppLayout>
  );
}

export default App;