import { useState, useRef, useEffect } from 'react';
import { Search, HelpCircle, Bell, LogOut } from 'lucide-react';

interface Breadcrumb {
  label: string;
  onClick?: () => void;
}

interface AppTopbarProps {
  breadcrumbs: Breadcrumb[];
  displayName: string;
  initials: string;
  email: string | undefined;
  onSignOut: () => void;
}

function AppTopbar({ breadcrumbs, displayName, initials, email, onSignOut }: AppTopbarProps) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowMenu(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, []);

  return (
    <header
      className="flex items-center sticky top-0 z-10"
      style={{
        height: 60,
        background: 'white',
        borderBottom: '1px solid #E5E5E5',
        paddingLeft: 28,
        paddingRight: 28,
        gap: 20,
      }}
    >
      {/* Breadcrumbs */}
      <div className="flex items-center" style={{ gap: 8, fontSize: 13 }}>
        {breadcrumbs.map((bc, i) => (
          <span key={i} className="flex items-center" style={{ gap: 8 }}>
            {i > 0 && <span style={{ color: '#747474', opacity: 0.5 }}>/</span>}
            {bc.onClick ? (
              <button
                onClick={bc.onClick}
                className="border-none bg-transparent cursor-pointer hover:text-[#0176D3] transition-colors"
                style={{ color: '#747474', fontSize: 13, padding: 0 }}
              >
                {bc.label}
              </button>
            ) : (
              <span
                style={{
                  color: i === breadcrumbs.length - 1 ? '#181818' : '#747474',
                  fontWeight: i === breadcrumbs.length - 1 ? 600 : 400,
                }}
              >
                {bc.label}
              </span>
            )}
          </span>
        ))}
      </div>

      {/* Search */}
      <div className="flex-1 mx-auto" style={{ maxWidth: 560 }}>
        <div className="relative">
          <Search
            size={16}
            className="absolute top-1/2 -translate-y-1/2"
            style={{ left: 14, color: '#747474' }}
          />
          <input
            type="text"
            placeholder="Buscar cotizaciones, clientes, productos..."
            className="w-full border outline-none transition-all"
            style={{
              height: 38,
              borderRadius: 999,
              border: '1px solid #E5E5E5',
              background: 'white',
              paddingLeft: 42,
              paddingRight: 16,
              fontSize: 13,
              color: '#181818',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#0176D3';
              e.currentTarget.style.boxShadow = '0 0 0 3px #EAF5FE';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#E5E5E5';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center" style={{ gap: 6 }}>
        <button
          className="flex items-center justify-center rounded-full hover:bg-[#F5F5F5] transition-colors"
          style={{ width: 36, height: 36, border: 'none', background: 'transparent', cursor: 'pointer' }}
        >
          <HelpCircle size={18} style={{ color: '#747474' }} />
        </button>

        <button
          className="flex items-center justify-center rounded-full hover:bg-[#F5F5F5] transition-colors relative"
          style={{ width: 36, height: 36, border: 'none', background: 'transparent', cursor: 'pointer' }}
        >
          <Bell size={18} style={{ color: '#747474' }} />
          <span
            className="absolute"
            style={{
              top: 6,
              right: 6,
              width: 8,
              height: 8,
              background: '#E03E3E',
              borderRadius: '50%',
              border: '2px solid white',
            }}
          />
        </button>

        {/* Avatar + dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="flex items-center justify-center rounded-full cursor-pointer"
            style={{
              width: 36,
              height: 36,
              background: 'linear-gradient(135deg, #7F56D9, #0176D3)',
              color: 'white',
              fontWeight: 700,
              fontSize: 13,
              border: '2px solid white',
              boxShadow: '0 0 0 1px #E5E5E5',
            }}
          >
            {initials}
          </button>

          {showMenu && (
            <div
              className="absolute"
              style={{
                top: '100%',
                right: 0,
                marginTop: 8,
                width: 240,
                background: 'white',
                border: '1px solid #E5E5E5',
                borderRadius: 8,
                boxShadow: '0 8px 24px rgba(0,0,0,.12)',
                zIndex: 50,
              }}
            >
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #F0F0F0' }}>
                <p className="truncate" style={{ fontWeight: 600, fontSize: 14, color: '#181818' }}>
                  {displayName}
                </p>
                <p className="truncate" style={{ fontSize: 12, color: '#747474', marginTop: 2 }}>
                  {email}
                </p>
              </div>
              <button
                onClick={onSignOut}
                className="flex items-center w-full text-left hover:bg-[#FAFAFA] transition-colors"
                style={{
                  padding: '10px 16px',
                  fontSize: 13,
                  color: '#555',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  gap: 10,
                }}
              >
                <LogOut size={14} />
                Cerrar sesion
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default AppTopbar;
