import { useState, useEffect } from 'react';
import { Eye, LogOut, Loader2 } from 'lucide-react';
import { fetchVistaActual, salirVistaComo, type VistaComo } from '../../lib/vistaComo';

export default function VistaComoBanner() {
  const [vista, setVista] = useState<VistaComo | null>(null);
  const [saliendo, setSaliendo] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchVistaActual().then(v => { if (!cancelled) setVista(v); });
    return () => { cancelled = true; };
  }, []);

  if (!vista) return null;

  const caduca = new Date(vista.expires_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

  const salir = async () => {
    setSaliendo(true);
    try {
      await salirVistaComo();
      window.location.reload();
    } catch (e: any) {
      setSaliendo(false);
      alert(e.message || 'No se pudo salir de la vista.');
    }
  };

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between gap-4 px-6 py-2 bg-[#FE9339] text-[#181818] border-b border-[#DD7A01]">
      <div className="flex items-center gap-2 text-sm">
        <Eye className="w-4 h-4" />
        <span>
          Estás viendo Cotizador como <strong>{vista.full_name || vista.email}</strong>
          {vista.full_name && <span className="opacity-80"> ({vista.email})</span>}
          <span className="opacity-80"> · la vista caduca a las {caduca}</span>
        </span>
      </div>
      <button
        onClick={salir}
        disabled={saliendo}
        className="inline-flex items-center gap-1.5 h-8 px-3 bg-[#181818] text-white text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-60"
      >
        {saliendo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
        Salir de la vista
      </button>
    </div>
  );
}
