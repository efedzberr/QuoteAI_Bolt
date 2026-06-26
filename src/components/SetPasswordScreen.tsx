import { useState } from 'react';
import { FileText, Eye, EyeOff, Loader2, KeyRound } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface SetPasswordScreenProps {
  onDone: () => void;
}

export default function SetPasswordScreen({ onDone }: SetPasswordScreenProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('La contrasena debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Las contrasenas no coinciden.');
      return;
    }

    setSubmitting(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      onDone();
    } catch (err: any) {
      setError(err.message || 'Error al guardar la contrasena.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-[420px]">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-[10px] bg-gradient-to-br from-[#0EA5E9] to-brand flex items-center justify-center shadow-md">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-bold text-ink" style={{ letterSpacing: '-0.02em' }}>
            Cotizador
          </span>
        </div>

        {/* Card */}
        <div className="bg-white rounded-hero shadow-lg border border-rule-soft p-6 sm:p-8">
          <div className="flex items-center gap-2 mb-1">
            <KeyRound className="w-5 h-5 text-brand" />
            <h2 className="text-lg font-bold text-ink">Define tu contrasena</h2>
          </div>
          <p className="text-sm text-ink-faint mb-6">Crea una contrasena para acceder a Cotizador.</p>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 bg-bad-soft border border-bad/20 rounded-lg text-sm text-bad font-medium">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-ink-soft uppercase tracking-wide mb-1.5">
                Nueva contrasena
              </label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 caracteres"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="w-full h-11 px-4 pr-11 border border-rule rounded-lg text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink transition-colors"
                  tabIndex={-1}
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-soft uppercase tracking-wide mb-1.5">
                Confirmar contrasena
              </label>
              <input
                type={showPwd ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repite tu contrasena"
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full h-11 px-4 border border-rule rounded-lg text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft transition"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-11 bg-brand text-white font-semibold text-sm rounded-lg hover:bg-brand-deep active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Guardar contrasena
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
