import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface Permissions {
  verInventario: boolean;
  isAdmin: boolean;
  fullName: string | null;
  loading: boolean;
}

const INVENTARIO_HABILITADO = false;

export function usePermissions(): Permissions {
  const [verInventario, setVerInventario] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [fullName, setFullName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) {
        setLoading(false);
        return;
      }

      const [{ data: perm }, { data: profile }] = await Promise.all([
        supabase.from('user_permissions').select('ver_inventario').eq('user_id', user.id).maybeSingle(),
        supabase.from('user_profiles').select('is_admin, is_active, full_name').eq('id', user.id).maybeSingle(),
      ]);

      if (!cancelled) {
        setVerInventario(perm?.ver_inventario === true);
        setIsAdmin(profile?.is_admin === true && profile?.is_active !== false);
        setFullName((profile?.full_name as string | null) ?? null);
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return { verInventario: INVENTARIO_HABILITADO && verInventario, isAdmin, fullName, loading };
}
