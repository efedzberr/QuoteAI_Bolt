import { useState, useEffect, useRef } from 'react';
import { FileText, Sparkles, Search, ClipboardList, Check, Loader2, AlertTriangle } from 'lucide-react';
import Header from './Header';

type StepState = 'pending' | 'active' | 'complete';

interface Step {
  label: string;
  icon: React.ReactNode;
  state: StepState;
}

interface ProcessingScreenProps {
  customerName: string;
  totalRows: number;
  responseData: any | null;
  errorMessage: string | null;
  rawResponse?: string;
  onCancel: () => void;
  onProcessingComplete?: (data: any) => void;
}

const STEP_SCHEDULE = [
  { activeAt: 0, completeAt: 3000 },
  { activeAt: 3000, completeAt: 8000 },
  { activeAt: 8000, completeAt: 20000 },
  { activeAt: 20000, completeAt: null },
];

const TIMEOUT_MS = 180000;

export default function ProcessingScreen({
  customerName,
  totalRows,
  responseData,
  errorMessage,
  rawResponse,
  onCancel,
  onProcessingComplete,
}: ProcessingScreenProps) {
  const [stepStates, setStepStates] = useState<StepState[]>(['pending', 'pending', 'pending', 'pending']);
  const [currentRow, setCurrentRow] = useState(1);
  const [timedOut, setTimedOut] = useState(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const rowIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const finished = responseData !== null;
  const hasError = errorMessage !== null || timedOut;

  useEffect(() => {
    STEP_SCHEDULE.forEach((schedule, index) => {
      const activateTimer = setTimeout(() => {
        setStepStates(prev => {
          const next = [...prev];
          if (next[index] !== 'complete') next[index] = 'active';
          return next;
        });
      }, schedule.activeAt);
      timersRef.current.push(activateTimer);

      if (schedule.completeAt !== null) {
        const completeTimer = setTimeout(() => {
          setStepStates(prev => {
            const next = [...prev];
            next[index] = 'complete';
            return next;
          });
        }, schedule.completeAt);
        timersRef.current.push(completeTimer);
      }
    });

    const timeoutTimer = setTimeout(() => {
      setTimedOut(true);
    }, TIMEOUT_MS);
    timersRef.current.push(timeoutTimer);

    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (totalRows <= 1) return;
    const interval = totalRows > 50 ? 600 : 1500;
    rowIntervalRef.current = setInterval(() => {
      setCurrentRow(prev => (prev >= totalRows ? totalRows : prev + 1));
    }, interval);

    return () => {
      if (rowIntervalRef.current) clearInterval(rowIntervalRef.current);
    };
  }, [totalRows]);

  useEffect(() => {
    if (finished) {
      setStepStates(['complete', 'complete', 'complete', 'complete']);
      if (rowIntervalRef.current) clearInterval(rowIntervalRef.current);
      setCurrentRow(totalRows);

      if (onProcessingComplete && responseData) {
        const transitionTimer = setTimeout(() => {
          onProcessingComplete(responseData);
        }, 1500);
        return () => clearTimeout(transitionTimer);
      }
    }
  }, [finished, totalRows, onProcessingComplete, responseData]);

  const activeStepIndex = stepStates.findIndex(s => s === 'active');
  const progressPercent = finished
    ? 100
    : activeStepIndex === -1
    ? 0
    : Math.min(95, ((activeStepIndex) / 4) * 100 + 12);

  const stepDefinitions = [
    { label: 'Leyendo tu archivo', icon: <FileText className="w-5 h-5" /> },
    { label: 'Normalizando descripciones de productos', icon: <Sparkles className="w-5 h-5" /> },
    { label: 'Buscando productos en el catálogo', icon: <Search className="w-5 h-5" /> },
    { label: 'Construyendo tu cotización', icon: <ClipboardList className="w-5 h-5" /> },
  ];

  const steps: Step[] = stepDefinitions.map((def, i) => ({
    ...def,
    state: stepStates[i],
  }));

  if (hasError) {
    return (
      <div className="min-h-screen bg-[#F3F3F3]" style={{ fontFamily: "'Manrope', sans-serif" }}>
        <Header hideHeader />
        <div className="flex items-center justify-center pt-16 px-4 pb-12">
          <div
            className="max-w-[640px] w-full bg-white rounded-xl p-10 text-center border border-[#E5E5E5]"
            style={{ boxShadow: '0 1px 2px rgba(0,0,0,.05)' }}
          >
            <div className="w-16 h-16 rounded-full bg-[#FEDED7] flex items-center justify-center mx-auto mb-5">
              <AlertTriangle className="w-8 h-8 text-[#BA0517]" strokeWidth={2} />
            </div>
            <h2
              className="text-[#181818] mb-2 tracking-[-0.02em]"
              style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.2 }}
            >
              Ocurrió un error al procesar
            </h2>
            <p className="text-[#747474] mb-6" style={{ fontSize: 14 }}>
              Algo salió mal. Revisa el detalle y vuelve a intentarlo.
            </p>
            {!errorMessage && !timedOut ? null : (
              <div className="mb-5 text-left">
                {timedOut && !errorMessage && (
                  <p className="text-[#444444] mb-4" style={{ fontSize: 13, lineHeight: 1.5 }}>
                    La solicitud excedió el tiempo de espera. No recibimos respuesta del orquestador en 3 minutos.
                  </p>
                )}
                {errorMessage && (
                  <div
                    className="rounded-lg overflow-auto mb-4 border"
                    style={{
                      backgroundColor: '#FEF1EE',
                      borderColor: '#FECACA',
                      padding: '14px 16px',
                      maxHeight: '280px',
                    }}
                  >
                    <p
                      className="uppercase mb-2 text-[#BA0517]"
                      style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em' }}
                    >
                      Detalle del error
                    </p>
                    <pre
                      style={{
                        color: '#7F1D1D',
                        fontSize: '12px',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        margin: 0,
                        fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
                      }}
                    >
                      {errorMessage}
                    </pre>
                  </div>
                )}
              </div>
            )}
            {rawResponse && (
              <div className="mb-7 text-left">
                <p
                  className="uppercase mb-2 text-[#747474]"
                  style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em' }}
                >
                  Respuesta cruda del orquestador
                </p>
                <div
                  className="rounded-lg overflow-auto"
                  style={{
                    maxHeight: '280px',
                    backgroundColor: '#0F172A',
                    padding: '14px 16px',
                  }}
                >
                  <pre
                    style={{
                      color: '#E2E8F0',
                      fontSize: '12px',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      margin: 0,
                      fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
                    }}
                  >
                    {rawResponse}
                  </pre>
                </div>
              </div>
            )}
            <button
              onClick={onCancel}
              className="px-7 py-3 bg-[#0176D3] text-white rounded-lg hover:bg-[#014486] transition-colors"
              style={{ fontSize: 14, fontWeight: 700 }}
            >
              Volver a subir archivo
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F3F3F3]" style={{ fontFamily: "'Manrope', sans-serif" }}>
      <Header hideHeader />

      <div className="flex justify-center pt-12 px-4 pb-10">
        <div
          className="max-w-[640px] w-full bg-white rounded-xl p-10 border border-[#E5E5E5]"
          style={{ boxShadow: '0 1px 2px rgba(0,0,0,.05)' }}
        >
          <div className="flex flex-col items-center mb-9">
            <div className="relative w-20 h-20 mb-6">
              <div className="absolute inset-0 rounded-full border-4 border-[#EAF5FE]" />
              <div className="absolute inset-0 rounded-full border-4 border-[#0176D3] border-t-transparent animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles className="w-7 h-7 text-[#0176D3]" />
              </div>
            </div>
            <h2
              className="text-[#181818] mb-1.5 tracking-[-0.02em] text-center"
              style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.2 }}
            >
              Procesando tu cotización
            </h2>
            <p className="text-[#747474] text-center" style={{ fontSize: 14 }}>
              Preparando cotización para: <span className="text-[#181818]" style={{ fontWeight: 600 }}>{customerName}</span>
            </p>
          </div>

          <div className="space-y-0.5 mb-8">
            {steps.map((step, index) => (
              <StepRow key={index} step={step} />
            ))}
          </div>

          <div className="mb-3">
            <div className="w-full h-2 bg-[#F0F0F0] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#0176D3] rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <p className="text-[#444444] text-center mb-1" style={{ fontSize: 13, fontWeight: 500 }}>
            Procesando fila {Math.min(currentRow, totalRows)} de {totalRows}…
          </p>
          <p className="text-[#747474] text-center" style={{ fontSize: 12 }}>
            Esto suele tomar entre 30 y 90 segundos dependiendo del tamaño del archivo.
          </p>
        </div>
      </div>

      <div className="text-center pb-10">
        <button
          onClick={onCancel}
          className="text-[#747474] hover:text-[#0176D3] underline transition-colors"
          style={{ fontSize: 13, fontWeight: 500 }}
        >
          Cancelar y comenzar de nuevo
        </button>
      </div>
    </div>
  );
}

function StepRow({ step }: { step: Step }) {
  return (
    <div className="flex items-center gap-3.5 py-2.5 px-3 rounded-lg transition-colors">
      <div className="flex-shrink-0">
        {step.state === 'complete' && (
          <div className="w-9 h-9 rounded-full bg-[#DEF5E5] flex items-center justify-center">
            <Check className="w-4 h-4 text-[#2E844A]" strokeWidth={2.5} />
          </div>
        )}
        {step.state === 'active' && (
          <div className="w-9 h-9 rounded-full bg-[#EAF5FE] flex items-center justify-center">
            <Loader2 className="w-4 h-4 text-[#0176D3] animate-spin" strokeWidth={2.5} />
          </div>
        )}
        {step.state === 'pending' && (
          <div className="w-9 h-9 rounded-full bg-[#F0F0F0] flex items-center justify-center text-[#A3A3A3]">
            {step.icon}
          </div>
        )}
      </div>
      <span
        className={`transition-colors ${
          step.state === 'active'
            ? 'text-[#0176D3]'
            : step.state === 'complete'
            ? 'text-[#181818]'
            : 'text-[#A3A3A3]'
        }`}
        style={{
          fontSize: 14,
          fontWeight: step.state === 'active' || step.state === 'complete' ? 600 : 500,
        }}
      >
        {step.label}
      </span>
    </div>
  );
}
