import { useState } from 'react';
import { FileText, Eye, EyeOff, Loader2, Shield } from 'lucide-react';
import { supabase } from '../lib/supabase';

type Tab = 'login' | 'register';

function translateError(msg: string): string {
  const lower = msg.toLowerCase();
  if (lower.includes('invalid login credentials') || lower.includes('invalid_credentials'))
    return 'Email o contrasena incorrectos.';
  if (lower.includes('user already registered') || lower.includes('already been registered'))
    return 'Este email ya esta registrado.';
  if (lower.includes('password') && lower.includes('least'))
    return 'La contrasena debe tener al menos 6 caracteres.';
  if (lower.includes('email') && lower.includes('valid'))
    return 'Ingresa un email valido.';
  if (lower.includes('rate') || lower.includes('too many'))
    return 'Demasiados intentos. Espera un momento antes de reintentar.';
  return msg;
}

export default function AuthScreen() {
  const [tab, setTab] = useState<Tab>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      if (tab === 'login') {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      } else {
        const { error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName.trim() } },
        });
        if (err) throw err;
        setSuccess('Cuenta creada correctamente. Iniciando sesion...');
      }
    } catch (err: any) {
      setError(translateError(err.message || 'Error desconocido'));
    } finally {
      setSubmitting(false);
    }
  };

  const switchTab = (t: Tab) => {
    setTab(t);
    setError('');
    setSuccess('');
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
          {/* Tabs */}
          <div className="flex bg-rule-soft rounded-lg p-1 mb-6">
            <button
              type="button"
              onClick={() => switchTab('login')}
              className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${
                tab === 'login'
                  ? 'bg-white text-ink shadow-sm'
                  : 'text-ink-faint hover:text-ink'
              }`}
            >
              Iniciar sesion
            </button>
            <button
              type="button"
              onClick={() => switchTab('register')}
              className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${
                tab === 'register'
                  ? 'bg-white text-ink shadow-sm'
                  : 'text-ink-faint hover:text-ink'
              }`}
            >
              Crear cuenta
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 bg-bad-soft border border-bad/20 rounded-lg text-sm text-bad font-medium">
              {error}
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="mb-4 p-3 bg-good-soft border border-good/20 rounded-lg text-sm text-good font-medium">
              {success}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {tab === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-ink-soft uppercase tracking-wide mb-1.5">
                  Nombre completo
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Roberto Martinez"
                  required
                  className="w-full h-11 px-4 border border-rule rounded-lg text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft transition"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-ink-soft uppercase tracking-wide mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@empresa.com"
                required
                autoComplete="email"
                className="w-full h-11 px-4 border border-rule rounded-lg text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-soft uppercase tracking-wide mb-1.5">
                Contrasena
              </label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 6 caracteres"
                  required
                  minLength={6}
                  autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
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

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-11 bg-brand text-white font-semibold text-sm rounded-lg hover:bg-brand-deep active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {tab === 'login' ? 'Iniciar sesion' : 'Crear cuenta'}
            </button>
          </form>

          {/* Footer copy */}
          <div className="mt-5 flex items-start gap-2 text-[11px] text-ink-faint">
            <Shield className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>Tu informacion se guarda de forma segura en nuestra plataforma.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
