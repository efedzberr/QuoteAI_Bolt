import { useEffect, useRef, useState } from 'react';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { urlRegistroSf } from '../../lib/sfEnvios';

interface Props {
  opportunityId: string;
  quoteId?: string;
  sentAt?: string;
  instanceUrl?: string | null;
  onClose: () => void;
}

function formatearFecha(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function RenglonId({ etiqueta, valor, instanceUrl }: { etiqueta: string; valor?: string; instanceUrl?: string | null }) {
  const [copiado, setCopiado] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const copiar = async () => {
    if (!valor) return;
    try {
      await navigator.clipboard.writeText(valor);
      setCopiado(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopiado(false), 1500);
    } catch {
      setCopiado(false);
    }
  };

  const url = urlRegistroSf(instanceUrl, valor);

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[#747474] flex-shrink-0" style={{ fontSize: 12, fontWeight: 600 }}>{etiqueta}</span>
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="font-mono text-xs text-[#181818] truncate">{valor || '\u2014'}</span>
        {valor && (
          <button
            onClick={copiar}
            className="p-1 rounded text-[#747474] hover:text-[#0176D3] hover:bg-white transition-colors"
            title={copiado ? 'Copiado' : 'Copiar'}
            aria-label={`Copiar ${etiqueta}`}
          >
            {copiado ? <Check className="w-3.5 h-3.5 text-[#2E844A]" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        )}
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            title="Abrir en Salesforce"
            className="p-1 rounded text-[#747474] hover:text-[#0176D3] hover:bg-white transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}

export default function YaEnSalesforceModal({ opportunityId, quoteId, sentAt, instanceUrl, onClose }: Props) {
  const fecha = formatearFecha(sentAt);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-col items-center text-center mb-5">
          <div className="w-14 h-14 rounded-full bg-[#DEF5E5] flex items-center justify-center mb-4">
            <Check className="w-7 h-7 text-[#2E844A]" />
          </div>
          <h3 className="text-[#181818]" style={{ fontSize: 18, fontWeight: 700 }}>
            Esta cotización ya está en Salesforce
          </h3>
          {fecha && (
            <p className="text-[#747474] mt-1" style={{ fontSize: 13 }}>Enviada el {fecha}</p>
          )}
        </div>

        <div className="bg-[#F8F9FA] rounded-lg p-4 space-y-3 mb-4">
          <RenglonId etiqueta="Opportunity ID" valor={opportunityId} instanceUrl={instanceUrl} />
          <RenglonId etiqueta="Quote ID" valor={quoteId} instanceUrl={instanceUrl} />
        </div>

        <p className="text-[#747474] mb-6" style={{ fontSize: 12, lineHeight: 1.5 }}>
          No se volvió a enviar. Si editas la cotización, al validarla de nuevo se actualizará en Salesforce.
        </p>

        <button
          onClick={onClose}
          className="w-full py-3 rounded-lg bg-[#E5E7EB] text-[#181818] hover:bg-[#D1D5DB] transition-colors"
          style={{ fontSize: 14, fontWeight: 600 }}
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
