import { useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  displayName: string;
  initials: string;
}

function deriveName(user: User | null): { displayName: string; initials: string } {
  if (!user) return { displayName: '', initials: '' };
  const meta = (user.user_metadata || {}) as Record<string, any>;
  const full = (meta.full_name || meta.name || '').trim();
  const fromEmail = user.email?.split('@')[0] || '';
  const displayName = full || fromEmail || 'Usuario';
  const parts = displayName.split(/[\s._-]+/).filter(Boolean).slice(0, 2);
  const initials = parts.map((p: string) => p[0]?.toUpperCase() || '').join('') || 'U';
  return { displayName, initials };
}

export function useAuth(): AuthState & {
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
} {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  const user = session?.user ?? null;
  const { displayName, initials } = deriveName(user);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName } }
    });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return { session, user, loading, displayName, initials, signIn, signUp, signOut };
}
