import { useState, useEffect } from 'react';
import { ShieldAlert } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function MfaExencionBanner() {
  const [hasta, setHasta] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.rpc('mi_exencion_mfa').then(({ data }) => {
      if (!cancelled && data) setHasta(data as string);
    });
    return () => { cancelled = true; };
  }, []);

  if (!hasta) return null;

  const fechaHora = new Date(hasta).toLocaleString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between gap-4 px-6 py-2 bg-[#FEF1DC] text-[#92400E] border-b border-[#F5C26B]">
      <div className="flex items-center gap-2 text-sm">
        <ShieldAlert className="w-4 h-4 flex-shrink-0" />
        <span>
          Acceso temporal sin verificacion en dos pasos hasta el <strong>{fechaHora}</strong>.
          Configurala ahora para no perder el acceso.
        </span>
      </div>
      <button
        onClick={() => window.dispatchEvent(new Event('mfa:configurar'))}
        className="inline-flex items-center gap-1.5 h-8 px-3 bg-[#92400E] text-white text-xs font-semibold rounded-lg hover:opacity-90 flex-shrink-0"
      >
        Configurar ahora
      </button>
    </div>
  );
}
