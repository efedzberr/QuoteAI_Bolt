import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { ObjetoSeguridad, AccionObjeto } from '../lib/seguridad';

export interface Permissions {
  loading: boolean;
  isAdmin: boolean;
  fullName: string | null;
  verInventario: boolean;
  perfil: string | null;
  rol: string | null;
  verTodosDatos: boolean;
  modificarTodosDatos: boolean;
  administrarConfiguracion: boolean;
  can: (objeto: ObjetoSeguridad, accion: AccionObjeto) => boolean;
  reload: () => Promise<void>;
}

const INVENTARIO_HABILITADO = false;

interface MisPermisos {
  is_active: boolean;
  is_admin: boolean;
  full_name: string | null;
  perfil: string | null;
  rol: string | null;
  ver_todos_datos: boolean;
  modificar_todos_datos: boolean;
  administrar_usuarios: boolean;
  administrar_configuracion: boolean;
  ver_inventario: boolean;
  objetos: Partial<Record<ObjetoSeguridad, Partial<Record<AccionObjeto, boolean>>>>;
}

const EMPTY: MisPermisos = {
  is_active: false, is_admin: false, full_name: null, perfil: null, rol: null,
  ver_todos_datos: false, modificar_todos_datos: false, administrar_usuarios: false,
  administrar_configuracion: false, ver_inventario: false, objetos: {},
};

export function usePermissions(): Permissions {
  const [p, setP] = useState<MisPermisos>(EMPTY);
  const [verInventarioUsuario, setVerInventarioUsuario] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const [{ data: perms, error }, { data: perm }] = await Promise.all([
      supabase.rpc('mis_permisos'),
      supabase.from('user_permissions').select('ver_inventario').eq('user_id', user.id).maybeSingle(),
    ]);
    if (error) console.error('[usePermissions] mis_permisos error:', error);
    setP(perms ? { ...EMPTY, ...(perms as MisPermisos) } : EMPTY);
    setVerInventarioUsuario(perm?.ver_inventario === true);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    load().catch(e => { if (!cancelled) { console.error('[usePermissions]', e); setLoading(false); } });
    return () => { cancelled = true; };
  }, [load]);

  const can = useCallback((objeto: ObjetoSeguridad, accion: AccionObjeto) => {
    if (!p.is_active) return false;
    return p.objetos?.[objeto]?.[accion] === true;
  }, [p]);

  return {
    loading,
    isAdmin: p.is_admin,
    fullName: p.full_name,
    verInventario: INVENTARIO_HABILITADO && (p.ver_inventario || verInventarioUsuario),
    perfil: p.perfil,
    rol: p.rol,
    verTodosDatos: p.ver_todos_datos,
    modificarTodosDatos: p.modificar_todos_datos,
    administrarConfiguracion: p.administrar_configuracion,
    can,
    reload: load,
  };
}
