import { FileSpreadsheet, Home, Settings } from 'lucide-react';
import { useAppSettings } from '../hooks/useAppSettings';

interface HeaderProps {
  onAdminClick?: () => void;
  onHomeClick?: () => void;
  hideHeader?: boolean;
}

export default function Header({ onAdminClick, onHomeClick, hideHeader }: HeaderProps) {
  if (hideHeader) return null;
  const { appLogoUrl, appLogoWidthPx, appLogoHeightPx } = useAppSettings();

  return (
    <header className="w-full h-[60px] border-b border-gray-200 flex items-center justify-between px-8">
      <div className="flex items-center gap-2">
        {appLogoUrl ? (
          <img
            src={appLogoUrl}
            alt="Logo"
            style={{
              width: `${appLogoWidthPx}px`,
              height: `${appLogoHeightPx}px`,
              objectFit: 'contain',
            }}
          />
        ) : (
          <>
            <FileSpreadsheet className="w-7 h-7 text-[#1E3A5F]" />
            <h1 className="text-2xl font-bold text-[#1E3A5F]">QuoteAI</h1>
          </>
        )}
      </div>
      <div className="flex items-center gap-3">
        {onHomeClick && (
          <button
            onClick={onHomeClick}
            className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-700 transition-colors"
            aria-label="Inicio"
            title="Inicio"
          >
            <Home className="w-5 h-5" />
          </button>
        )}
        <span className="text-sm text-gray-600">Internal Portal</span>
        {onAdminClick && (
          <button
            onClick={onAdminClick}
            className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-700 transition-colors"
            aria-label="Administración"
            title="Administración"
          >
            <Settings className="w-5 h-5" />
          </button>
        )}
        <div className="w-9 h-9 rounded-full bg-[#00A99D] flex items-center justify-center text-white font-semibold">
          U
        </div>
      </div>
    </header>
  );
}
