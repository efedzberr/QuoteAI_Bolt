import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface AppSettings {
  appLogoUrl: string | null;
  appLogoWidthPx: number;
  appLogoHeightPx: number;
  pdfLogoUrl: string | null;
  pdfLogoWidthPx: number;
  pdfLogoHeightPx: number;
  confidenceThreshold: number;
  loading: boolean;
  refresh: () => Promise<void>;
}

const DEFAULTS = {
  appLogoUrl: null,
  appLogoWidthPx: 160,
  appLogoHeightPx: 48,
  pdfLogoUrl: null,
  pdfLogoWidthPx: 200,
  pdfLogoHeightPx: 80,
  confidenceThreshold: 0.9,
};

export function useAppSettings(): AppSettings {
  const [state, setState] = useState({ ...DEFAULTS, loading: true });

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('app_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    if (error || !data) {
      setState((prev) => ({ ...prev, loading: false }));
      return;
    }

    setState({
      appLogoUrl: data.app_logo_url ?? null,
      appLogoWidthPx: data.app_logo_width_px ?? DEFAULTS.appLogoWidthPx,
      appLogoHeightPx: data.app_logo_height_px ?? DEFAULTS.appLogoHeightPx,
      pdfLogoUrl: data.pdf_logo_url ?? null,
      pdfLogoWidthPx: data.pdf_logo_width_px ?? DEFAULTS.pdfLogoWidthPx,
      pdfLogoHeightPx: data.pdf_logo_height_px ?? DEFAULTS.pdfLogoHeightPx,
      confidenceThreshold: Number(data.confidence_threshold ?? DEFAULTS.confidenceThreshold),
      loading: false,
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, refresh: load };
}
