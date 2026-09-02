import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface Permissions {
  verInventario: boolean;
  loading: boolean;
}

const INVENTARIO_HABILITADO = false;

export function usePermissions(): Permissions {
  const [verInventario, setVerInventario] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('user_permissions')
        .select('ver_inventario')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!cancelled) {
        if (error || !data) {
          setVerInventario(false);
        } else {
          setVerInventario(data.ver_inventario === true);
        }
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return { verInventario: INVENTARIO_HABILITADO && verInventario, loading };
}
