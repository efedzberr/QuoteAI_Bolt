import { useState, useEffect, useRef } from 'react';
import { Upload, Trash2, Save, Loader2, Image as ImageIcon, Percent } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAppSettings } from '../../hooks/useAppSettings';

// El logo del PDF se configura en Ajustes > PDF de cotización (PdfConfigTab), junto con su alineación.

const BUCKET = 'app-assets';

const mensajeDe = (e: unknown) => (e as { message?: string })?.message || String(e);

function extensionOf(file: File): string {
  const fromName = file.name.split('.').pop()?.toLowerCase();
  if (fromName && ['png', 'jpg', 'jpeg', 'svg', 'webp'].includes(fromName)) {
    return fromName === 'jpeg' ? 'jpg' : fromName;
  }
  if (file.type.includes('svg')) return 'svg';
  if (file.type.includes('png')) return 'png';
  if (file.type.includes('jpeg') || file.type.includes('jpg')) return 'jpg';
  return 'png';
}

export default function GeneralSettingsTab() {
  const settings = useAppSettings();

  const [appWidth, setAppWidth] = useState(160);
  const [appHeight, setAppHeight] = useState(48);
  const [thresholdPct, setThresholdPct] = useState(90);

  const [savingAppLogo, setSavingAppLogo] = useState(false);
  const [savingThreshold, setSavingThreshold] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const appFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!settings.loading) {
      setAppWidth(settings.appLogoWidthPx);
      setAppHeight(settings.appLogoHeightPx);
      setThresholdPct(Math.round(settings.confidenceThreshold * 100));
    }
  }, [settings.loading, settings.appLogoWidthPx, settings.appLogoHeightPx, settings.confidenceThreshold]);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  const uploadLogo = async (file: File) => {
    setSavingAppLogo(true);
    try {
      const ext = extensionOf(file);
      const path = `app-logo.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;

      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const publicUrl = `${pub.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from('app_settings')
        .update({
          app_logo_url: publicUrl,
          app_logo_width_px: appWidth,
          app_logo_height_px: appHeight,
          updated_at: new Date().toISOString(),
        })
        .eq('id', 1);
      if (updateError) throw updateError;

      await settings.refresh();
      showToast('success', 'Logo de aplicación actualizado');
    } catch (e) {
      showToast('error', `Error al subir logo: ${mensajeDe(e)}`);
    } finally {
      setSavingAppLogo(false);
    }
  };

  const deleteLogo = async () => {
    setSavingAppLogo(true);
    try {
      const { error } = await supabase
        .from('app_settings')
        .update({ app_logo_url: null, updated_at: new Date().toISOString() })
        .eq('id', 1);
      if (error) throw error;

      await settings.refresh();
      showToast('success', 'Logo eliminado');
    } catch (e) {
      showToast('error', `Error al eliminar logo: ${mensajeDe(e)}`);
    } finally {
      setSavingAppLogo(false);
    }
  };

  const saveDimensions = async () => {
    setSavingAppLogo(true);
    try {
      const { error } = await supabase
        .from('app_settings')
        .update({ app_logo_width_px: appWidth, app_logo_height_px: appHeight, updated_at: new Date().toISOString() })
        .eq('id', 1);
      if (error) throw error;
      await settings.refresh();
      showToast('success', 'Dimensiones guardadas');
    } catch (e) {
      showToast('error', `Error: ${mensajeDe(e)}`);
    } finally {
      setSavingAppLogo(false);
    }
  };

  const saveThreshold = async () => {
    setSavingThreshold(true);
    try {
      const decimal = Math.max(0.5, Math.min(1, thresholdPct / 100));
      const { error } = await supabase
        .from('app_settings')
        .update({ confidence_threshold: decimal, updated_at: new Date().toISOString() })
        .eq('id', 1);
      if (error) throw error;
      await settings.refresh();
      showToast('success', 'Umbral guardado');
    } catch (e) {
      showToast('error', `Error: ${mensajeDe(e)}`);
    } finally {
      setSavingThreshold(false);
    }
  };

  return (
    <div className="space-y-8">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Configuración general</h2>
          <p className="text-sm text-gray-500 mt-1">
            Logo de la aplicación y umbral de confianza para revisión. El logo del PDF se configura en PDF de cotización.
          </p>
        </div>

        {/* Section A - App logo */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="flex items-start gap-3 mb-1">
            <ImageIcon className="w-5 h-5 text-[#00A99D] mt-1" />
            <h2 className="text-xl font-bold text-gray-900">Logo de la aplicación</h2>
          </div>
          <p className="text-sm text-gray-500 mb-6 ml-8">
            Este logo aparece en el encabezado de todas las pantallas de la aplicación. Recomendado: PNG con fondo transparente, entre 40 y 80 px de alto.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="border border-dashed border-gray-300 rounded-lg p-6 flex items-center justify-center bg-gray-50 min-h-[120px]">
              {settings.appLogoUrl ? (
                <img
                  src={settings.appLogoUrl}
                  alt="App logo"
                  style={{
                    width: `${settings.appLogoWidthPx}px`,
                    height: `${settings.appLogoHeightPx}px`,
                    objectFit: 'contain',
                  }}
                />
              ) : (
                <span className="text-xs text-gray-400">Sin logo</span>
              )}
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Ancho (px)</span>
                  <input
                    type="number"
                    min={20}
                    max={800}
                    value={appWidth}
                    onChange={(e) => setAppWidth(parseInt(e.target.value) || 0)}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00A99D]"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Alto (px)</span>
                  <input
                    type="number"
                    min={20}
                    max={400}
                    value={appHeight}
                    onChange={(e) => setAppHeight(parseInt(e.target.value) || 0)}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00A99D]"
                  />
                </label>
              </div>
              <button
                onClick={saveDimensions}
                disabled={savingAppLogo}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" /> Guardar dimensiones
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <input
              ref={appFileRef}
              type="file"
              accept="image/png, image/jpeg, image/svg+xml"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadLogo(f);
                e.target.value = '';
              }}
            />
            <button
              onClick={() => appFileRef.current?.click()}
              disabled={savingAppLogo}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1E3A5F] text-white font-semibold rounded-lg hover:bg-[#2a4d7f] transition-colors disabled:opacity-50"
            >
              {savingAppLogo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Subir logo
            </button>
            {settings.appLogoUrl && (
              <button
                onClick={deleteLogo}
                disabled={savingAppLogo}
                className="inline-flex items-center gap-2 px-5 py-2.5 border border-red-300 text-red-600 font-semibold rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" /> Eliminar logo
              </button>
            )}
          </div>
        </section>

        {/* Section C - Confidence threshold */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="flex items-start gap-3 mb-1">
            <Percent className="w-5 h-5 text-amber-500 mt-1" />
            <h2 className="text-xl font-bold text-gray-900">Umbral de confianza para revisión</h2>
          </div>
          <p className="text-sm text-gray-500 mb-6 ml-8">
            Las líneas con confianza por debajo de {thresholdPct}% requerirán revisión manual antes de generar el PDF.
          </p>

          <div className="flex items-center gap-6 mb-4">
            <input
              type="range"
              min={50}
              max={100}
              step={1}
              value={thresholdPct}
              onChange={(e) => setThresholdPct(parseInt(e.target.value))}
              className="flex-1 accent-[#00A99D]"
            />
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={50}
                max={100}
                value={thresholdPct}
                onChange={(e) => setThresholdPct(Math.max(50, Math.min(100, parseInt(e.target.value) || 0)))}
                className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00A99D] text-center font-bold"
              />
              <span className="text-gray-600 font-semibold">%</span>
            </div>
          </div>

          <button
            onClick={saveThreshold}
            disabled={savingThreshold}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1E3A5F] text-white font-semibold rounded-lg hover:bg-[#2a4d7f] transition-colors disabled:opacity-50"
          >
            {savingThreshold ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar
          </button>
        </section>

      {toast && (
        <div
          className={`fixed bottom-6 right-6 px-5 py-3 rounded-lg shadow-lg font-medium text-sm ${
            toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
