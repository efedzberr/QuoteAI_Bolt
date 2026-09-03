import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, UserPlus, Shield, Ban, CheckCircle, KeyRound, MoreHorizontal, Users, Trash2, Pencil, Mail, Copy, Loader2, RefreshCw, Smartphone } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { callAdminUsers, type AdminUserRow, type LinkResult } from '../../lib/adminUsers';

interface UsersTabProps {
  onToast: (message: string, type: 'success' | 'error') => void;
}

const field = 'w-full h-10 px-3 border border-rule rounded-lg text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft transition';
const label = 'block text-xs font-semibold text-ink-soft uppercase tracking-wide mb-1.5';
const primaryBtn = 'inline-flex items-center justify-center gap-2 h-10 px-4 bg-brand text-white font-semibold text-sm rounded-lg hover:bg-brand-deep disabled:opacity-60 disabled:cursor-not-allowed transition-colors';
const secondaryBtn = 'inline-flex items-center justify-center gap-2 h-10 px-4 bg-white text-ink-soft font-semibold text-sm rounded-lg border border-rule hover:bg-rule-soft disabled:opacity-60 transition-colors';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function Modal({ title, subtitle, onClose, children, width = 'max-w-lg' }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; width?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-white rounded-hero shadow-lg border border-rule-soft w-full ${width} mx-4 p-6`}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-ink">{title}</h3>
            {subtitle && <p className="text-sm text-ink-faint mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-ink-faint hover:text-ink"><X className="w-5 h-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Toggle({ checked, onChange, text, hint }: { checked: boolean; onChange: (v: boolean) => void; text: string; hint?: string }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer select-none">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[#0176D3]" />
      <span>
        <span className="block text-sm font-medium text-ink">{text}</span>
        {hint && <span className="block text-xs text-ink-faint">{hint}</span>}
      </span>
    </label>
  );
}

export default function UsersTab({ onToast }: UsersTabProps) {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<AdminUserRow | null>(null);
  const [deleteUser, setDeleteUser] = useState<AdminUserRow | null>(null);
  const [resetMfaUser, setResetMfaUser] = useState<AdminUserRow | null>(null);
  const [linkResult, setLinkResult] = useState<LinkResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await callAdminUsers<{ users: AdminUserRow[] }>('list');
      setUsers(res.users || []);
    } catch (e: any) {
      onToast(e.message || 'No se pudieron cargar los usuarios.', 'error');
    } finally {
      setLoading(false);
    }
  }, [onToast]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuId(null); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? users.filter(u => (u.full_name || '').toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.salesforce_id || '').toLowerCase().includes(q))
    : users;

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    try { await fn(); } catch (e: any) { onToast(e.message || 'Ocurrió un error.', 'error'); } finally { setBusy(null); }
  }

  const sendLink = (u: AdminUserRow) => run(`link-${u.id}`, async () => {
    const res = await callAdminUsers<LinkResult>('send_link', { user_id: u.id });
    setLinkResult(res);
  });

  const toggleActive = (u: AdminUserRow) => run(`active-${u.id}`, async () => {
    await callAdminUsers('update_user', { user_id: u.id, is_active: !u.is_active });
    onToast(u.is_active ? 'Usuario desactivado' : 'Usuario activado', 'success');
    await loadUsers();
  });

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-ink"><Users className="w-5 h-5 text-brand" /> Usuarios</h2>
          <p className="text-sm text-ink-faint mt-1">Invita, crea y administra las cuentas que tienen acceso a Cotizador.</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={loadUsers} disabled={loading} className={secondaryBtn} title="Actualizar"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
          <button onClick={() => setShowCreate(true)} className={primaryBtn}><UserPlus className="w-4 h-4" /> Nuevo usuario</button>
        </div>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="w-4 h-4 text-ink-faint absolute left-3 top-1/2 -translate-y-1/2" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre, correo o ID Salesforce…" className={`${field} pl-9`} />
      </div>

      <div className="border border-rule rounded-card overflow-visible">
        <table className="w-full text-sm">
          <thead className="bg-rule-soft border-b border-rule">
            <tr>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-ink-soft uppercase tracking-wider">Usuario</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-ink-soft uppercase tracking-wider">Teléfono</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-ink-soft uppercase tracking-wider">ID Salesforce</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-ink-soft uppercase tracking-wider">Perfil</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-ink-soft uppercase tracking-wider">Estado</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-ink-soft uppercase tracking-wider">2FA</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-ink-soft uppercase tracking-wider">Último acceso</th>
              <th className="w-12" />
            </tr>
          </thead>
          <tbody>
            {loading && users.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-ink-faint">Cargando…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-ink-faint">{q ? `Sin resultados para "${search}".` : 'Aún no hay usuarios.'}</td></tr>
            ) : filtered.map(u => {
              const pending = !u.last_sign_in_at;
              const isMe = me?.id === u.id;
              return (
                <tr key={u.id} className="border-b border-rule-soft hover:bg-rule-soft/50">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-ink">{u.full_name || '—'}{isMe && <span className="ml-2 text-[10px] font-semibold text-brand bg-brand-soft px-1.5 py-px rounded-full">Tú</span>}</div>
                    <div className="text-xs text-ink-faint">{u.email}</div>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{u.phone || '—'}</td>
                  <td className="px-4 py-3 text-ink-soft font-mono text-xs">{u.salesforce_id || '—'}</td>
                  <td className="px-4 py-3">
                    {u.is_admin
                      ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-purple bg-purple-soft px-2 py-0.5 rounded-full"><Shield className="w-3 h-3" /> Administrador</span>
                      : <span className="text-xs font-semibold text-ink-soft bg-rule-soft px-2 py-0.5 rounded-full">Usuario</span>}
                  </td>
                  <td className="px-4 py-3">
                    {!u.is_active
                      ? <span className="text-xs font-semibold text-bad bg-bad-soft px-2 py-0.5 rounded-full">Inactivo</span>
                      : pending
                        ? <span className="text-xs font-semibold text-warn bg-warn-soft px-2 py-0.5 rounded-full">Pendiente</span>
                        : <span className="text-xs font-semibold text-good bg-good-soft px-2 py-0.5 rounded-full">Activo</span>}
                  </td>
                  <td className="px-4 py-3">
                    {u.mfa_enrolled ? <span className="inline-flex items-center gap-1 text-xs text-good"><CheckCircle className="w-3.5 h-3.5" /> Sí</span> : <span className="text-xs text-ink-faint">No</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-soft whitespace-nowrap">{formatDate(u.last_sign_in_at)}</td>
                  <td className="px-2 py-3 relative">
                    <button onClick={() => setMenuId(menuId === u.id ? null : u.id)} className="w-8 h-8 flex items-center justify-center rounded-lg text-ink-faint hover:bg-rule-soft hover:text-ink">
                      {busy && busy.endsWith(u.id) ? <Loader2 className="w-4 h-4 animate-spin" /> : <MoreHorizontal className="w-4 h-4" />}
                    </button>
                    {menuId === u.id && (
                      <div ref={menuRef} className="absolute right-2 top-10 z-30 w-60 bg-white border border-rule rounded-card shadow-md py-1">
                        <MenuItem icon={<Pencil className="w-4 h-4" />} text="Editar" onClick={() => { setMenuId(null); setEditUser(u); }} />
                        <MenuItem icon={<Mail className="w-4 h-4" />} text={pending ? 'Reenviar invitación' : 'Enviar enlace de acceso'} onClick={() => { setMenuId(null); sendLink(u); }} />
                        <MenuItem icon={<Smartphone className="w-4 h-4" />} text="Restablecer 2FA" disabled={!u.mfa_enrolled} onClick={() => { setMenuId(null); setResetMfaUser(u); }} />
                        <MenuItem icon={u.is_active ? <Ban className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />} text={u.is_active ? 'Desactivar' : 'Activar'} disabled={isMe} onClick={() => { setMenuId(null); toggleActive(u); }} />
                        <div className="my-1 border-t border-rule-soft" />
                        <MenuItem icon={<Trash2 className="w-4 h-4" />} text="Eliminar" danger disabled={isMe} onClick={() => { setMenuId(null); setDeleteUser(u); }} />
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <UserFormModal
          onClose={() => setShowCreate(false)}
          onSaved={(res) => { setShowCreate(false); loadUsers(); if (res) setLinkResult(res); }}
          onToast={onToast}
        />
      )}
      {editUser && (
        <UserFormModal
          user={editUser}
          isMe={me?.id === editUser.id}
          onClose={() => setEditUser(null)}
          onSaved={() => { setEditUser(null); onToast('Usuario actualizado', 'success'); loadUsers(); }}
          onToast={onToast}
        />
      )}

      {linkResult && (
        <Modal title={linkResult.mode === 'invite' ? 'Invitación' : 'Enlace de acceso'} subtitle={linkResult.email} onClose={() => setLinkResult(null)}>
          {linkResult.sent_user ? (
            <div className="flex items-start gap-2 text-sm text-good bg-good-soft border border-good/20 rounded-lg px-3 py-2 mb-3">
              <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>El correo fue enviado al usuario{linkResult.sent_admin ? ' y recibiste una copia en tu correo' : ''}.</span>
            </div>
          ) : (
            <div className="flex items-start gap-2 text-sm text-warn bg-warn-soft border border-warn/20 rounded-lg px-3 py-2 mb-3">
              <Ban className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>No se pudo enviar el correo{linkResult.error ? ` (${linkResult.error})` : ''}. Comparte el enlace de abajo con el usuario.</span>
            </div>
          )}
          {linkResult.link && (
            <div>
              <label className={label}>Enlace de acceso <span className="text-ink-faint font-normal normal-case tracking-normal">(un solo uso, vence en 24 h)</span></label>
              <div className="flex gap-2">
                <input readOnly value={linkResult.link} onFocus={e => e.target.select()} className={`${field} font-mono text-xs bg-rule-soft`} />
                <button onClick={() => { navigator.clipboard.writeText(linkResult.link || '').then(() => onToast('Enlace copiado', 'success')); }} className={primaryBtn}><Copy className="w-4 h-4" /> Copiar</button>
              </div>
              <p className="mt-2 text-xs text-ink-faint">Cualquier persona con el enlace puede entrar a la cuenta: compártelo solo con el usuario.</p>
            </div>
          )}
          <div className="flex justify-end mt-5"><button onClick={() => setLinkResult(null)} className={secondaryBtn}>Cerrar</button></div>
        </Modal>
      )}

      {resetMfaUser && (
        <Modal title="Restablecer 2FA" subtitle={resetMfaUser.email} onClose={() => setResetMfaUser(null)}>
          <p className="text-sm text-ink-soft mb-5">Se eliminará la app de autenticación registrada. En su siguiente inicio de sesión, el usuario deberá configurar el 2FA de nuevo. Úsalo cuando cambió de teléfono o perdió acceso a su autenticador.</p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setResetMfaUser(null)} className={secondaryBtn}>Cancelar</button>
            <button disabled={busy !== null} className={primaryBtn} onClick={() => { const u = resetMfaUser; setResetMfaUser(null); run(`mfa-${u.id}`, async () => { await callAdminUsers('reset_mfa', { user_id: u.id }); onToast('2FA restablecido', 'success'); await loadUsers(); }); }}>
              <KeyRound className="w-4 h-4" /> Restablecer
            </button>
          </div>
        </Modal>
      )}

      {deleteUser && (
        <Modal title="Eliminar usuario" subtitle={deleteUser.email} onClose={() => setDeleteUser(null)}>
          <p className="text-sm text-ink-soft mb-5">Esta acción es permanente: se elimina la cuenta y su acceso a Cotizador. Las cotizaciones existentes no se borran. Si solo quieres bloquear el acceso temporalmente, usa <strong>Desactivar</strong>.</p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setDeleteUser(null)} className={secondaryBtn}>Cancelar</button>
            <button disabled={busy !== null} className="inline-flex items-center gap-2 h-10 px-4 bg-bad text-white font-semibold text-sm rounded-lg hover:opacity-90 disabled:opacity-60" onClick={() => { const u = deleteUser; setDeleteUser(null); run(`del-${u.id}`, async () => { await callAdminUsers('delete_user', { user_id: u.id }); onToast('Usuario eliminado', 'success'); await loadUsers(); }); }}>
              <Trash2 className="w-4 h-4" /> Eliminar definitivamente
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function MenuItem({ icon, text, onClick, danger, disabled }: { icon: React.ReactNode; text: string; onClick: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left disabled:opacity-40 disabled:cursor-not-allowed ${danger ? 'text-bad hover:bg-bad-soft' : 'text-ink hover:bg-rule-soft'}`}>
      <span className={danger ? 'text-bad' : 'text-ink-faint'}>{icon}</span>{text}
    </button>
  );
}

function UserFormModal({ user, isMe, onClose, onSaved, onToast }: { user?: AdminUserRow; isMe?: boolean; onClose: () => void; onSaved: (link?: LinkResult | null) => void; onToast: (m: string, t: 'success' | 'error') => void }) {
  const editing = !!user;
  const [email, setEmail] = useState(user?.email || '');
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [salesforceId, setSalesforceId] = useState(user?.salesforce_id || '');
  const [isAdmin, setIsAdmin] = useState(user?.is_admin || false);
  const [verInventario, setVerInventario] = useState(user?.ver_inventario || false);
  const [setPasswordNow, setSetPasswordNow] = useState(false);
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    if (!fullName.trim()) { setError('El nombre completo es obligatorio.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Escribe un correo válido.'); return; }
    if (!editing && setPasswordNow && password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return; }
    setSaving(true);
    try {
      if (editing && user) {
        await callAdminUsers('update_user', {
          user_id: user.id, email: email.trim(), full_name: fullName.trim(), phone: phone.trim() || null,
          salesforce_id: salesforceId.trim() || null, is_admin: isAdmin, ver_inventario: verInventario,
        });
        onSaved();
      } else {
        const res = await callAdminUsers<LinkResult & { user_id: string }>('create', {
          email: email.trim(), full_name: fullName.trim(), phone: phone.trim() || null,
          salesforce_id: salesforceId.trim() || null, is_admin: isAdmin, ver_inventario: verInventario,
          password: setPasswordNow ? password : null,
        });
        onToast(`Usuario ${email.trim()} creado`, 'success');
        onSaved(res);
      }
    } catch (e: any) {
      setError(e.message || 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={editing ? 'Editar usuario' : 'Nuevo usuario'} subtitle={editing ? undefined : 'Se enviará un correo con un enlace para definir su contraseña y configurar el 2FA.'} onClose={onClose}>
      {error && <div className="mb-4 p-3 bg-bad-soft border border-bad/20 rounded-lg text-sm text-bad font-medium">{error}</div>}
      <div className="space-y-4">
        <div>
          <label className={label}>Nombre completo *</label>
          <input value={fullName} onChange={e => setFullName(e.target.value)} className={field} placeholder="Nombre y apellidos" autoFocus />
        </div>
        <div>
          <label className={label}>Correo electrónico *</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={field} placeholder="usuario@empresa.com" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Teléfono</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} className={field} placeholder="81 1234 5678" />
          </div>
          <div>
            <label className={label}>ID Salesforce <span className="text-ink-faint font-normal normal-case tracking-normal">(opcional)</span></label>
            <input value={salesforceId} onChange={e => setSalesforceId(e.target.value)} className={`${field} font-mono`} placeholder="005…" />
          </div>
        </div>
        <div className="space-y-3 pt-1">
          <Toggle checked={isAdmin} onChange={setIsAdmin} text="Administrador" hint={isMe ? 'No puedes quitarte tu propio rol de administrador.' : 'Puede administrar usuarios y la configuración del sistema.'} />
          <Toggle checked={verInventario} onChange={setVerInventario} text="Puede ver inventario" hint="Se aplicará cuando la visualización de inventario esté habilitada." />
          {!editing && (
            <Toggle checked={setPasswordNow} onChange={v => { setSetPasswordNow(v); if (!v) setPassword(''); }} text="Definir contraseña inicial ahora" hint="Si no la defines, el usuario la creará desde el enlace del correo." />
          )}
          {!editing && setPasswordNow && (
            <div>
              <label className={label}>Contraseña inicial</label>
              <input type="text" value={password} onChange={e => setPassword(e.target.value)} className={`${field} font-mono`} placeholder="Mín. 8 caracteres" autoComplete="off" />
            </div>
          )}
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <button onClick={onClose} className={secondaryBtn} disabled={saving}>Cancelar</button>
        <button onClick={submit} className={primaryBtn} disabled={saving}>
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {editing ? 'Guardar cambios' : (setPasswordNow ? 'Crear usuario' : 'Crear e invitar')}
        </button>
      </div>
    </Modal>
  );
}
