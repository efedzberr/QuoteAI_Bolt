import { useState, useEffect, useRef } from 'react';
import { Loader2, CheckCircle, AlertCircle, ArrowLeft, Eye } from 'lucide-react';
import { getJobByReferencia, type Job } from '../lib/jobs';

interface JobProgressScreenProps {
  job: Job;
  onViewResults: (job: Job) => void;
  onBack: () => void;
}

export default function JobProgressScreen({ job: initialJob, onViewResults, onBack }: JobProgressScreenProps) {
  const [job, setJob] = useState<Job>(initialJob);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (job.status === 'completado' || job.status === 'error') return;

    pollRef.current = setInterval(async () => {
      const updated = await getJobByReferencia(job.referencia);
      if (!updated) return;
      setJob(updated);
      if (updated.status === 'completado' || updated.status === 'error') {
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [job.referencia, job.status]);

  const progressPct = job.total_lineas > 0
    ? Math.min(100, Math.round((job.progreso / job.total_lineas) * 100))
    : 0;

  const isError = job.status === 'error';
  const isComplete = job.status === 'completado';

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl border border-[#E5E5E5] p-8 text-center shadow-sm">
          {isError ? (
            <>
              <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-5">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="text-lg font-bold text-[#181818] mb-2">Error en el procesamiento</h2>
              <p className="text-sm text-[#747474] mb-4">{job.referencia}</p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-left mb-6">
                <p className="text-sm text-red-700">{job.error || 'Error desconocido'}</p>
              </div>
            </>
          ) : isComplete ? (
            <>
              <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-5">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
              <h2 className="text-lg font-bold text-[#181818] mb-1">Procesamiento completado</h2>
              <p className="text-sm text-[#747474] mb-1">{job.referencia}</p>
              {job.cliente && (
                <p className="text-xs text-[#A3A3A3] mb-6">{job.cliente}</p>
              )}
              <p className="text-sm text-[#444444] mb-6">
                {job.total_lineas} lineas procesadas correctamente.
              </p>
              <button
                onClick={() => onViewResults(job)}
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-[#0176D3] rounded-lg hover:bg-[#014486] transition-colors shadow-sm"
              >
                <Eye className="w-4 h-4" />
                Ver resultados
              </button>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-5">
                <Loader2 className="w-8 h-8 text-[#0176D3] animate-spin" />
              </div>
              <h2 className="text-lg font-bold text-[#181818] mb-1">Procesando cotización</h2>
              <p className="text-sm text-[#747474] mb-1">{job.referencia}</p>
              {job.cliente && (
                <p className="text-xs text-[#A3A3A3] mb-6">{job.cliente}</p>
              )}

              <div className="mb-3">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-[#747474]">Progreso</span>
                  <span className="font-semibold text-[#181818]">
                    {job.progreso} de {job.total_lineas} ({progressPct}%)
                  </span>
                </div>
                <div className="w-full h-3 bg-[#F0F0F0] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#0176D3] to-[#4DB8FF] transition-all duration-700 ease-out"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>

              <p className="text-xs text-[#A3A3A3] mt-4">
                Se actualiza automaticamente cada 3 segundos
              </p>
            </>
          )}

          <button
            onClick={onBack}
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-[#0176D3] border border-[#0176D3] rounded-lg hover:bg-blue-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al inicio
          </button>
        </div>
      </div>
    </div>
  );
}
