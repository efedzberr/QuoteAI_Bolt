import { useState } from 'react';
import { FileText, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ConfirmLinkScreenProps {
  tokenHash: string;
  type: 'recovery' | 'invite';
  onVerified: () => void;
  onCancel: () => void;
}

/**
 * Pantalla de aterrizaje de los enlaces de invitacion / restablecimiento.
 * El correo apunta aqui (y no a la URL directa de Supabase) porque los escaneres de
 * correo corporativo pre-abren los enlaces y consumirian el token de un solo uso.
 * Esta pagina es segura de pre-abrir: el token solo se verifica al presionar el boton.
 */
export default function ConfirmLinkScreen({ tokenHash, type, onVerified, onCancel }: ConfirmLinkScreenProps) {
  const [state, setState] = useState<'idle' | 'verifying' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleContinue = async () => {
    setState('verifying');
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) {
      const msg = (error.message || '').toLowerCase();
      setErrorMsg(
        msg.includes('expired') || msg.includes('invalid')
          ? 'Este enlace ya venció o ya fue utilizado. Pide a tu administrador que te envíe uno nuevo.'
          : error.message,
      );
      setState('error');
      return;
    }
    onVerified();
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-[420px]">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-[10px] bg-gradient-to-br from-[#0EA5E9] to-brand flex items-center justify-center shadow-md">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-bold text-ink" style={{ letterSpacing: '-0.02em' }}>Cotizador</span>
        </div>

        <div className="bg-white rounded-hero shadow-lg border border-rule-soft p-6 sm:p-8 text-center">
          {state !== 'error' ? (
            <>
              <div className="mx-auto w-12 h-12 rounded-full bg-brand-soft flex items-center justify-center mb-4">
                <ShieldCheck className="w-6 h-6 text-brand" />
              </div>
              <h2 className="text-lg font-bold text-ink mb-1">
                {type === 'invite' ? 'Bienvenido a Cotizador' : 'Continuar con tu acceso'}
              </h2>
              <p className="text-sm text-ink-faint mb-6">
                En la siguiente pantalla definirás tu contraseña.
              </p>
              <button
                onClick={handleContinue}
                disabled={state === 'verifying'}
                className="w-full h-11 bg-brand text-white font-semibold text-sm rounded-lg hover:bg-brand-deep disabled:opacity-60 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {state === 'verifying' ? (<><Loader2 className="w-4 h-4 animate-spin" /> Verificando...</>) : 'Continuar'}
              </button>
              <p className="mt-4 text-xs text-ink-faint">Este enlace es de un solo uso y vence 24 horas después de haberse enviado.</p>
            </>
          ) : (
            <>
              <div className="mx-auto w-12 h-12 rounded-full bg-bad-soft flex items-center justify-center mb-4">
                <AlertCircle className="w-6 h-6 text-bad" />
              </div>
              <h2 className="text-lg font-bold text-ink mb-2">Enlace no válido</h2>
              <p className="text-sm text-ink-soft mb-6">{errorMsg}</p>
              <button onClick={onCancel} className="text-sm font-semibold text-brand hover:text-brand-deep">Ir a iniciar sesión</button>
            </>
          )}
        </div>
        <p className="mt-6 text-center text-xs text-ink-faint">Cotizador · Acceso restringido</p>
      </div>
    </div>
  );
}
