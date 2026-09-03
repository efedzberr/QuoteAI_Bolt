import { useState, useEffect } from 'react';
import { Search, X, ChevronDown, Lock } from 'lucide-react';
import { usePermissions } from '../hooks/usePermissions';
import GeneralSettingsTab from './admin/GeneralSettingsTab';
import UsersTab from './admin/UsersTab';

interface AdminScreenProps {
  onBack: () => void;
}

type AdminItemId = 'users' | 'profiles' | 'roles' | 'general';

interface MenuItem { id: AdminItemId; label: string; adminOnly?: boolean; soon?: boolean }
interface MenuSection { id: string; label: string; items: MenuItem[] }

const MENU: MenuSection[] = [
  {
    id: 'users_permissions', label: 'Usuarios y permisos', items: [
      { id: 'users', label: 'Usuarios', adminOnly: true },
      { id: 'profiles', label: 'Perfiles', adminOnly: true, soon: true },
      { id: 'roles', label: 'Roles y jerarquía', adminOnly: true, soon: true },
    ],
  },
  {
    id: 'configuration', label: 'Configuración', items: [
      { id: 'general', label: 'Configuración general' },
    ],
  },
];

const MENU_STORAGE_KEY = 'qai_admin_menu_state';

function loadMenuState(): { collapsed: string[]; last: string | null } {
  try {
    const raw = window.localStorage.getItem(MENU_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { collapsed: Array.isArray(parsed.collapsed) ? parsed.collapsed : [], last: typeof parsed.last === 'string' ? parsed.last : null };
    }
  } catch { /* ignore */ }
  return { collapsed: [], last: null };
}

function saveMenuState(collapsed: Set<string>, last: string) {
  try { window.localStorage.setItem(MENU_STORAGE_KEY, JSON.stringify({ collapsed: [...collapsed], last })); } catch { /* ignore */ }
}

export default function AdminScreen(_props: AdminScreenProps) {
  const { isAdmin, loading: permLoading } = usePermissions();

  const visibleSections = MENU
    .map(sec => ({ ...sec, items: sec.items.filter(i => !i.adminOnly || isAdmin) }))
    .filter(sec => sec.items.length > 0);
  const visibleItems = visibleSections.flatMap(sec => sec.items);

  const initial = loadMenuState();
  const [active, setActive] = useState<AdminItemId>(() => {
    const last = initial.last as AdminItemId | null;
    return last && MENU.some(s => s.items.some(i => i.id === last)) ? last : 'general';
  });
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set(initial.collapsed));
  const [quickFind, setQuickFind] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (!permLoading && visibleItems.length > 0 && !visibleItems.some(i => i.id === active)) setActive(visibleItems[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permLoading, visibleItems.map(i => i.id).join(',')]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const handleToast = (message: string, type: 'success' | 'error') => setToast({ type, message });

  const selectItem = (id: AdminItemId) => { setActive(id); saveMenuState(collapsed, id); };
  const toggleSection = (id: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      saveMenuState(next, active);
      return next;
    });
  };

  const find = quickFind.trim().toLowerCase();
  const filteredSections = find
    ? visibleSections.map(sec => ({ ...sec, items: sec.items.filter(i => i.label.toLowerCase().includes(find)) })).filter(sec => sec.items.length > 0)
    : visibleSections;

  const activeItem = visibleItems.find(i => i.id === active);

  return (
    <div className="min-h-full bg-bg">
      <div className="max-w-[1480px] mx-auto px-7 py-6">
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-ink" style={{ letterSpacing: '-0.01em' }}>Ajustes</h1>
          <p className="mt-1 text-sm text-ink-faint">Administra usuarios, permisos y la configuración del sistema.</p>
        </div>

        <div className="flex gap-6 items-start">
          {/* Menú vertical */}
          <aside className="w-[272px] flex-shrink-0 bg-white rounded-card shadow-sm border border-rule py-3 sticky top-[76px]">
            <div className="px-3 pb-3">
              <div className="relative">
                <Search className="w-4 h-4 text-ink-faint absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={quickFind}
                  onChange={e => setQuickFind(e.target.value)}
                  placeholder="Buscar…"
                  className="w-full h-9 pl-8 pr-7 text-sm border border-rule rounded-lg focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft"
                />
                {quickFind && (
                  <button onClick={() => setQuickFind('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink"><X className="w-3.5 h-3.5" /></button>
                )}
              </div>
            </div>
            <nav className="max-h-[calc(100vh-220px)] overflow-y-auto">
              {filteredSections.map(sec => {
                const isCollapsed = !find && collapsed.has(sec.id);
                return (
                  <div key={sec.id}>
                    <button onClick={() => toggleSection(sec.id)} className="w-full flex items-center justify-between px-4 pt-4 pb-1 text-[10.5px] font-bold tracking-[0.12em] text-ink-faint uppercase hover:text-ink-soft">
                      {sec.label}
                      <ChevronDown className={`w-3.5 h-3.5 text-ink-faint transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                    </button>
                    {!isCollapsed && sec.items.map(item => (
                      <button
                        key={item.id}
                        onClick={() => selectItem(item.id)}
                        className={`w-full text-left flex items-center gap-2 py-1.5 text-[13.5px] transition-colors ${
                          active === item.id
                            ? 'bg-brand-soft text-brand font-semibold border-l-[3px] border-brand pl-[23px] pr-3'
                            : 'text-ink-soft hover:bg-rule-soft pl-[26px] pr-3'
                        }`}
                      >
                        {item.label}
                        {item.soon && <span className="ml-auto text-[10px] px-1.5 py-px rounded-full border border-rule bg-rule-soft text-ink-faint">Próximamente</span>}
                        {!item.soon && item.adminOnly && <Lock className="ml-auto w-3 h-3 text-ink-faint" />}
                      </button>
                    ))}
                  </div>
                );
              })}
              {filteredSections.length === 0 && (
                <p className="px-4 py-6 text-sm text-ink-faint">Sin opciones para "{quickFind}".</p>
              )}
            </nav>
          </aside>

          {/* Contenido */}
          <div className="flex-1 min-w-0">
            <div className="mb-2 text-xs text-ink-faint">
              Ajustes {activeItem ? <>&rsaquo; <span className="text-ink-soft">{activeItem.label}</span></> : null}
            </div>
            <div className="bg-white rounded-card shadow-sm border border-rule p-6">
              {active === 'general' && <GeneralSettingsTab />}
              {active === 'users' && isAdmin && <UsersTab onToast={handleToast} />}
              {(active === 'profiles' || active === 'roles') && isAdmin && (
                <div className="border-2 border-dashed border-rule rounded-card p-12 text-center">
                  <p className="text-sm font-semibold text-ink">{activeItem?.label}</p>
                  <p className="text-sm text-ink-faint mt-1">Esta sección estará disponible próximamente.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-lg shadow-lg font-medium text-sm text-white ${toast.type === 'success' ? 'bg-good' : 'bg-bad'}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
