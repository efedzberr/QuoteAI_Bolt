import { useState, useEffect, useRef, useCallback } from 'react';
import { Smartphone, Loader2, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Props {
  onComplete: () => void;
  onSignOut: () => void;
}

export default function MfaVerify({ onComplete, onSignOut }: Props) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.mfa.listFactors();
      if (cancelled) return;
      const verified = data?.totp?.find((f) => f.status === 'verified');
      if (verified) setFactorId(verified.id);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!loading && factorId && inputRef.current) {
      inputRef.current.focus();
    }
  }, [loading, factorId]);

  const handleVerify = useCallback(async (verifyCode: string) => {
    if (!factorId || verifyCode.length !== 6) return;
    setSubmitting(true);
    setError('');

    const attemptVerify = async (retried = false): Promise<void> => {
      const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
      if (chErr || !challenge) throw chErr || new Error('Challenge failed');
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: verifyCode,
      });
      if (vErr) {
        const isExpired = vErr.message?.toLowerCase().includes('expired') ||
                          vErr.message?.toLowerCase().includes('invalid');
        if (!retried && isExpired) {
          return attemptVerify(true);
        }
        throw vErr;
      }
    };

    try {
      await attemptVerify();
      onComplete();
    } catch {
      setError('Codigo incorrecto o vencido. Genera uno nuevo en tu app e intentalo de nuevo.');
      setCode('');
      inputRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  }, [factorId, onComplete]);

  const handleCodeChange = (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 6);
    setCode(clean);
    if (clean.length === 6) {
      handleVerify(clean);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-4">
        <Loader2 className="w-6 h-6 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-[420px]">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-[10px] bg-gradient-to-br from-[#0EA5E9] to-brand flex items-center justify-center shadow-md">
            <Smartphone className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-bold text-ink" style={{ letterSpacing: '-0.02em' }}>
            Cotizador
          </span>
        </div>

        <div className="bg-white rounded-hero shadow-lg border border-rule-soft p-6 sm:p-8">
          <h2 className="text-lg font-bold text-ink mb-1">Ingresa tu codigo de verificacion</h2>
          <p className="text-sm text-ink-faint mb-6">
            Abre tu app autenticadora y escribe el codigo de 6 digitos de QuoteAI.
          </p>

          {error && (
            <div className="mb-4 p-3 bg-bad-soft border border-bad/20 rounded-lg text-sm text-bad font-medium">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-xs font-semibold text-ink-soft uppercase tracking-wide mb-1.5">
              Codigo de 6 digitos
            </label>
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => handleCodeChange(e.target.value)}
              placeholder="000000"
              disabled={submitting}
              className="w-full h-11 px-4 border border-rule rounded-lg text-sm text-ink text-center tracking-[0.3em] font-mono font-bold placeholder:text-ink-faint placeholder:tracking-[0.3em] focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft transition disabled:opacity-60"
              autoComplete="one-time-code"
            />
          </div>

          <button
            onClick={() => handleVerify(code)}
            disabled={code.length !== 6 || submitting}
            className="w-full h-11 bg-brand text-white font-semibold text-sm rounded-lg hover:bg-brand-deep active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Verificar
          </button>

          <div className="mt-5 text-center">
            <button onClick={onSignOut} className="text-xs text-ink-faint hover:text-ink transition-colors">
              Cerrar sesion
            </button>
          </div>

          <p className="mt-4 text-[11px] text-ink-faint text-center leading-relaxed">
            Perdiste tu dispositivo? Contacta al administrador para restablecer tu segundo factor.
          </p>
        </div>
      </div>
    </div>
  );
}
