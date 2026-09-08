import { supabase } from './supabase';

export type ObjetoSeguridad = 'cotizaciones' | 'productos_nuevos' | 'grupos' | 'precio_grupo';
export type AccionObjeto = 'leer' | 'crear' | 'editar' | 'eliminar';
export type PermisoSistema = 'ver_todos_datos' | 'modificar_todos_datos' | 'administrar_usuarios' | 'administrar_configuracion' | 'ver_inventario';

export const OBJETOS: { id: ObjetoSeguridad; label: string; hint: string }[] = [
  { id: 'cotizaciones', label: 'Cotizaciones', hint: 'Solicitudes, matching, validación y PDF' },
  { id: 'productos_nuevos', label: 'Productos nuevos', hint: 'Altas de productos que no están en el catálogo' },
  { id: 'grupos', label: 'Grupos', hint: 'Relación cliente → grupo de precios (tabla grupo)' },
  { id: 'precio_grupo', label: 'Precio grupo', hint: 'Lista de precios por grupo y artículo (tabla precio_grupo)' },
];

export const ACCIONES: { id: AccionObjeto; label: string; col: keyof Pick<PermisoObjeto, 'can_read' | 'can_create' | 'can_edit' | 'can_delete'> }[] = [
  { id: 'leer', label: 'Leer', col: 'can_read' },
  { id: 'crear', label: 'Crear', col: 'can_create' },
  { id: 'editar', label: 'Editar', col: 'can_edit' },
  { id: 'eliminar', label: 'Eliminar', col: 'can_delete' },
];

export const PERMISOS_SISTEMA: { id: PermisoSistema; label: string; hint: string }[] = [
  { id: 'ver_todos_datos', label: 'Ver todos los datos', hint: 'Ve todas las cotizaciones sin importar la jerarquía de roles.' },
  { id: 'modificar_todos_datos', label: 'Modificar todos los datos', hint: 'Edita, reasigna y elimina cualquier cotización. Incluye "Ver todos los datos".' },
  { id: 'administrar_usuarios', label: 'Administrar usuarios, perfiles y roles', hint: 'Acceso completo a Ajustes › Usuarios y permisos.' },
  { id: 'administrar_configuracion', label: 'Administrar configuración general', hint: 'Puede cambiar los ajustes generales del sistema.' },
  { id: 'ver_inventario', label: 'Ver inventario', hint: 'Se aplicará cuando la visualización de inventario esté habilitada.' },
];

export interface Perfil {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  ver_todos_datos: boolean;
  modificar_todos_datos: boolean;
  administrar_usuarios: boolean;
  administrar_configuracion: boolean;
  ver_inventario: boolean;
  created_at: string;
  updated_at: string;
}

export interface PermisoObjeto {
  perfil_id: string;
  object_name: ObjetoSeguridad;
  can_read: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export interface Rol {
  id: string;
  name: string;
  parent_id: string | null;
  description: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ConteoUsuarios {
  porPerfil: Record<string, number>;
  porRol: Record<string, number>;
}

function fail(prefix: string, error: { message: string } | null): never {
  throw new Error(`${prefix}: ${error?.message || 'error desconocido'}`);
}

// ---------------- Perfiles ----------------
export async function fetchPerfiles(): Promise<{ perfiles: Perfil[]; permisos: PermisoObjeto[] }> {
  const [{ data: perfiles, error: e1 }, { data: permisos, error: e2 }] = await Promise.all([
    supabase.from('perfiles').select('*').order('is_system', { ascending: false }).order('name'),
    supabase.from('perfil_permisos_objeto').select('*'),
  ]);
  if (e1) fail('No se pudieron cargar los perfiles', e1);
  if (e2) fail('No se pudieron cargar los permisos', e2);
  return { perfiles: (perfiles as Perfil[]) || [], permisos: (permisos as PermisoObjeto[]) || [] };
}

export async function createPerfil(name: string, description: string | null): Promise<Perfil> {
  const { data, error } = await supabase.from('perfiles').insert({ name: name.trim(), description }).select().single();
  if (error || !data) fail('No se pudo crear el perfil', error);
  const perfil = data as Perfil;
  const rows = OBJETOS.map(o => ({ perfil_id: perfil.id, object_name: o.id, can_read: false, can_create: false, can_edit: false, can_delete: false }));
  const { error: e2 } = await supabase.from('perfil_permisos_objeto').insert(rows);
  if (e2) fail('No se pudieron inicializar los permisos del perfil', e2);
  return perfil;
}

export async function updatePerfil(id: string, patch: Partial<Omit<Perfil, 'id' | 'is_system' | 'created_at' | 'updated_at'>>): Promise<void> {
  const { error } = await supabase.from('perfiles').update(patch).eq('id', id);
  if (error) fail('No se pudo guardar el perfil', error);
}

export async function savePermisosObjeto(rows: PermisoObjeto[]): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase.from('perfil_permisos_objeto').upsert(rows, { onConflict: 'perfil_id,object_name' });
  if (error) fail('No se pudieron guardar los permisos', error);
}

export async function deletePerfil(id: string): Promise<void> {
  const { error } = await supabase.from('perfiles').delete().eq('id', id);
  if (error) fail('No se pudo eliminar el perfil', error);
}

// ---------------- Roles ----------------
export async function fetchRoles(): Promise<Rol[]> {
  const { data, error } = await supabase.from('roles').select('*').order('sort_order').order('name');
  if (error) fail('No se pudieron cargar los roles', error);
  return (data as Rol[]) || [];
}

export async function createRol(name: string, parentId: string | null, description: string | null): Promise<Rol> {
  const { data, error } = await supabase.from('roles').insert({ name: name.trim(), parent_id: parentId, description }).select().single();
  if (error || !data) fail('No se pudo crear el rol', error);
  return data as Rol;
}

export async function updateRol(id: string, patch: Partial<Pick<Rol, 'name' | 'parent_id' | 'description' | 'sort_order'>>): Promise<void> {
  const { error } = await supabase.from('roles').update(patch).eq('id', id);
  if (error) fail('No se pudo guardar el rol', error);
}

export async function deleteRol(id: string): Promise<void> {
  const { error } = await supabase.from('roles').delete().eq('id', id);
  if (error) fail('No se pudo eliminar el rol', error);
}

// ---------------- Conteo de usuarios por perfil / rol ----------------
export async function fetchConteoUsuarios(): Promise<ConteoUsuarios> {
  const { data, error } = await supabase.from('user_profiles').select('perfil_id, rol_id');
  if (error) fail('No se pudo contar usuarios', error);
  const porPerfil: Record<string, number> = {};
  const porRol: Record<string, number> = {};
  for (const r of (data as { perfil_id: string | null; rol_id: string | null }[]) || []) {
    if (r.perfil_id) porPerfil[r.perfil_id] = (porPerfil[r.perfil_id] || 0) + 1;
    if (r.rol_id) porRol[r.rol_id] = (porRol[r.rol_id] || 0) + 1;
  }
  return { porPerfil, porRol };
}

// ---------------- Usuarios visibles (para reasignar cotizaciones) ----------------
export interface UsuarioVisible { id: string; full_name: string | null; email: string; is_active: boolean }

export async function fetchUsuariosVisibles(): Promise<UsuarioVisible[]> {
  const { data, error } = await supabase.from('user_profiles').select('id, full_name, email, is_active').order('full_name');
  if (error) fail('No se pudieron cargar los usuarios', error);
  return (data as UsuarioVisible[]) || [];
}

// ---------------- Grupos existentes (selector) ----------------
export interface GrupoNombre { group_name: string; clientes: number }

export async function fetchGrupoNombres(): Promise<GrupoNombre[]> {
  const { data, error } = await supabase.rpc('grupo_nombres');
  if (error) fail('No se pudieron cargar los grupos', error);
  return (data as GrupoNombre[]) || [];
}
