import {
  Home,
  FileText,
  LayoutGrid,
  Users,
  TrendingUp,
  Settings,
} from 'lucide-react';

export type SidebarSection = 'home' | 'cotizar' | 'catalogo' | 'clientes' | 'reportes' | 'ajustes';

interface AppSidebarProps {
  active: SidebarSection;
  onNavigate: (section: SidebarSection) => void;
}

const NAV_ITEMS: Array<{ section: SidebarSection; icon: React.ElementType; label: string }> = [
  { section: 'home', icon: Home, label: 'Inicio' },
  { section: 'cotizar', icon: FileText, label: 'Cotizar' },
  { section: 'catalogo', icon: LayoutGrid, label: 'Catálogo' },
  { section: 'clientes', icon: Users, label: 'Clientes' },
  { section: 'reportes', icon: TrendingUp, label: 'Reportes' },
  { section: 'ajustes', icon: Settings, label: 'Ajustes' },
];

function AppSidebar({ active, onNavigate }: AppSidebarProps) {
  return (
    <aside
      className="flex flex-col items-center shrink-0 sticky top-0 h-screen"
      style={{ width: 72, background: '#032D60', paddingTop: 18, paddingBottom: 18 }}
    >
      {/* Logo */}
      <div
        className="flex items-center justify-center"
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: 'linear-gradient(135deg, #0EA5E9, #0176D3)',
          boxShadow: '0 4px 12px rgba(1,118,211,0.35)',
          marginBottom: 20,
        }}
      >
        <span style={{ fontSize: 18, fontWeight: 800, color: 'white' }}>C</span>
      </div>

      {/* Nav items */}
      <nav className="flex flex-col flex-1 w-full" style={{ gap: 4, padding: '0 8px' }}>
        {NAV_ITEMS.map((item) => {
          const isActive = active === item.section;
          const Icon = item.icon;
          return (
            <button
              key={item.section}
              onClick={() => onNavigate(item.section)}
              className="flex flex-col items-center cursor-pointer"
              style={{
                width: 56,
                paddingTop: 10,
                paddingBottom: 10,
                borderRadius: 10,
                transition: 'all .15s',
                background: isActive ? '#0B5CAB' : 'transparent',
                color: isActive ? 'white' : 'rgba(255,255,255,.7)',
                gap: 4,
                border: 'none',
                margin: '0 auto',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'rgba(255,255,255,.08)';
                  e.currentTarget.style.color = 'white';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'rgba(255,255,255,.7)';
                }
              }}
            >
              <Icon size={22} strokeWidth={1.8} />
              <span style={{ fontSize: 10, fontWeight: 600 }}>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

export default AppSidebar;
