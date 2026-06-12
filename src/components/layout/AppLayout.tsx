import { ReactNode } from 'react';
import AppSidebar from './AppSidebar';
import AppTopbar from './AppTopbar';
import { useAuth } from '../../hooks/useAuth';

type Section = 'home' | 'cotizar' | 'catalogo' | 'clientes' | 'reportes' | 'ajustes';

interface AppLayoutProps {
  active: Section;
  breadcrumbs: Array<{ label: string; onClick?: () => void }>;
  onNavigate: (section: Section) => void;
  children: ReactNode;
  contentBackground?: string;
  contentPadding?: boolean;
}

function AppLayout({
  active,
  breadcrumbs,
  onNavigate,
  children,
  contentBackground = 'bg-[#F3F3F3]',
  contentPadding = true,
}: AppLayoutProps) {
  const { displayName, initials, user, signOut } = useAuth();

  return (
    <div className="flex min-h-screen">
      <AppSidebar active={active} onNavigate={onNavigate} />
      <div className="flex-1 min-w-0 flex flex-col">
        <AppTopbar
          breadcrumbs={breadcrumbs}
          displayName={displayName}
          initials={initials}
          email={user?.email}
          onSignOut={signOut}
        />
        <main className={`flex-1 ${contentBackground}`}>
          {contentPadding ? (
            <div className="max-w-[1480px] mx-auto px-7 py-6">{children}</div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}

export default AppLayout;
