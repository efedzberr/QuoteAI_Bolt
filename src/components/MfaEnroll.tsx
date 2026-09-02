import { useState, useEffect, useRef, useCallback } from 'react';
import { ShieldCheck, Copy, Loader2, LogOut, AlertCircle, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Props {
  onComplete: () => void;
  onSignOut: () => void;
}

export default function MfaEnroll({ onComplete, onSignOut }: Props) {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [setupError, setSetupError] = useState('');
  const [setupErrorDetail, setSetupErrorDetail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const enrollInFlight = useRef(false);

  const initEnroll = useCallback(async () => {
    if (enrollInFlight.current) return;
    enrollInFlight.current = true;
    setInitializing(true);
    setSetupError('');
    setSetupErrorDetail('');
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const stale = (factors?.totp ?? []).filter(f => f.status === 'unverified');
      for (const f of stale) {
        try {
          await supabase.auth.mfa.unenroll({ factorId: f.id });
        } catch (e) {
          console.warn('[MfaEnroll] Failed to unenroll stale factor', f.id, e);
        }
      }
      const friendlyName = `QuoteAI ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;
      const { data, error: enrollErr } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName,
      });
      if (enrollErr || !data) throw enrollErr || new Error('No data');
      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
    } catch (err: any) {
      setSetupError('No pudimos iniciar la configuracion. Vuelve a intentarlo.');
      if (err?.message) setSetupErrorDetail(err.message);
    } finally {
      setInitializing(false);
      enrollInFlight.current = false;
    }
  }, []);

  useEffect(() => {
    initEnroll();
  }, [initEnroll]);

  useEffect(() => {
    if (!initializing && !setupError && inputRef.current) {
      inputRef.current.focus();
    }
  }, [initializing, setupError]);

  const handleVerify = useCallback(async (verifyCode: string) => {
    if (!factorId || verifyCode.length !== 6) return;
    setSubmitting(true);
    setError('');
    try {
      const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
      if (chErr || !challenge) throw chErr || new Error('Challenge failed');
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: verifyCode,
      });
      if (vErr) throw vErr;
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

  const handleCopy = async () => {
    if (!secret) return;
    await navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (initializing) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-4">
        <Loader2 className="w-6 h-6 animate-spin text-brand" />
      </div>
    );
  }

  if (setupError) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-[420px]">
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-[10px] bg-gradient-to-br from-[#0EA5E9] to-brand flex items-center justify-center shadow-md">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-ink" style={{ letterSpacing: '-0.02em' }}>
              Cotizador
            </span>
          </div>
          <div className="bg-white rounded-hero shadow-lg border border-rule-soft p-6 sm:p-8 text-center">
            <AlertCircle className="w-10 h-10 text-bad mx-auto mb-4" />
            <p className="text-sm text-ink mb-2">{setupError}</p>
            {setupErrorDetail && (
              <p className="text-[11px] text-ink-faint mb-6 font-mono break-all">{setupErrorDetail}</p>
            )}
            {!setupErrorDetail && <div className="mb-6" />}
            <button
              onClick={initEnroll}
              className="inline-flex items-center gap-2 h-11 px-6 bg-brand text-white font-semibold text-sm rounded-lg hover:bg-brand-deep active:scale-[0.98] transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              Reintentar
            </button>
            <div className="mt-4">
              <button onClick={onSignOut} className="text-xs text-ink-faint hover:text-ink transition-colors">
                Cerrar sesion
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-[420px]">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-[10px] bg-gradient-to-br from-[#0EA5E9] to-brand flex items-center justify-center shadow-md">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-bold text-ink" style={{ letterSpacing: '-0.02em' }}>
            Cotizador
          </span>
        </div>

        <div className="bg-white rounded-hero shadow-lg border border-rule-soft p-6 sm:p-8">
          <h2 className="text-lg font-bold text-ink mb-1">Configura tu segundo factor</h2>
          <p className="text-sm text-ink-faint mb-6">
            Para proteger tu cuenta, QuoteAI requiere un codigo adicional al iniciar sesion.
            Escanea el codigo QR con Google Authenticator, Microsoft Authenticator o cualquier app compatible.
          </p>

          {qrCode && (
            <div className="flex justify-center mb-4">
              <div className="bg-white p-3 rounded-lg border border-rule-soft">
                <img src={qrCode} alt="Codigo QR" width={200} height={200} />
              </div>
            </div>
          )}

          <div className="mb-6">
            <button
              onClick={() => setShowSecret(!showSecret)}
              className="text-xs text-brand hover:text-brand-deep font-medium transition-colors"
            >
              {showSecret ? 'Ocultar clave manual' : 'No puedes escanear? Captura esta clave manualmente'}
            </button>
            {showSecret && secret && (
              <div className="mt-2 flex items-center gap-2 p-3 bg-[#F5F5F5] rounded-lg border border-rule-soft">
                <code className="text-xs text-ink font-mono break-all flex-1">{secret}</code>
                <button
                  onClick={handleCopy}
                  className="flex-shrink-0 p-1.5 rounded hover:bg-white transition-colors"
                  title="Copiar"
                >
                  <Copy className="w-3.5 h-3.5 text-ink-faint" />
                </button>
                {copied && <span className="text-[10px] text-ok font-medium">Copiado</span>}
              </div>
            )}
          </div>

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
            Activar y continuar
          </button>

          <div className="mt-5 text-center">
            <button onClick={onSignOut} className="text-xs text-ink-faint hover:text-ink transition-colors">
              Cerrar sesion
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
