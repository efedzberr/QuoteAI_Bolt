import { useEffect, useMemo, useState } from 'react';
import { pdf } from '@react-pdf/renderer';
import { Loader2 } from 'lucide-react';
import QuoteDocument from '../../pdf/QuoteDocument';
import type { PdfConfig } from '../../../lib/pdf/pdfConfig';
import { COTIZACION_MUESTRA, DATOS_MUESTRA } from '../../../lib/pdf/pdfMuestra';

interface Props {
  config: PdfConfig;
  pdfLogoUrl: string | null;
  pdfLogoWidthPx: number;
  pdfLogoHeightPx: number;
  /** 'pagina' muestra la hoja completa; 'ancho' la ajusta al ancho disponible (se lee mejor, con desplazamiento). */
  ajuste: 'pagina' | 'ancho';
}

// Parámetros del visor de PDF del navegador: sin barra de herramientas y con el ajuste elegido
const VISOR = {
  pagina: 'toolbar=0&navpanes=0&view=Fit&zoom=page-fit',
  ancho: 'toolbar=0&navpanes=0&view=FitH&zoom=page-width',
};

/** Vista previa del PDF con datos de ejemplo. Se vuelve a generar cada vez que cambia la plantilla. */
export default function PdfVistaPrevia({ config, pdfLogoUrl, pdfLogoWidthPx, pdfLogoHeightPx, ajuste }: Props) {
  const documento = useMemo(
    () => (
      <QuoteDocument
        quoteData={COTIZACION_MUESTRA}
        datos={DATOS_MUESTRA}
        config={config}
        pdfLogoUrl={pdfLogoUrl}
        pdfLogoWidthPx={pdfLogoWidthPx}
        pdfLogoHeightPx={pdfLogoHeightPx}
      />
    ),
    [config, pdfLogoUrl, pdfLogoWidthPx, pdfLogoHeightPx]
  );
  const [url, setUrl] = useState<string | null>(null);
  const [generando, setGenerando] = useState(true);
  const [error, setError] = useState(false);

  // Cada cambio genera el PDF desde cero (igual que al descargarlo), en lugar de actualizar el anterior:
  // así la vista previa siempre coincide con lo que se va a imprimir.
  useEffect(() => {
    let vigente = true;
    setGenerando(true);
    pdf(documento)
      .toBlob()
      .then((blob) => {
        if (!vigente) return;
        setUrl(URL.createObjectURL(blob));
        setError(false);
        setGenerando(false);
      })
      .catch((e) => {
        console.error('[PdfVistaPrevia]', e);
        if (!vigente) return;
        setError(true);
        setGenerando(false);
      });
    return () => {
      vigente = false;
    };
  }, [documento]);

  // Libera el PDF anterior cuando llega uno nuevo y al salir de la pantalla
  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  return (
    <div className="relative w-full h-full bg-rule-soft">
      {url ? (
        <iframe key={ajuste} title="Vista previa del PDF" src={`${url}#${VISOR[ajuste]}`} className="w-full h-full" style={{ border: 'none' }} />
      ) : null}
      {!url && !error ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-sm text-ink-faint">
          <Loader2 className="w-6 h-6 animate-spin text-brand" />
          Generando la vista previa…
        </div>
      ) : null}
      {url && generando ? (
        <div className="absolute top-2 right-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white border border-rule shadow-sm text-xs text-ink-soft">
          <Loader2 className="w-3 h-3 animate-spin" /> Actualizando…
        </div>
      ) : null}
      {error ? (
        <div className="absolute inset-x-3 top-3 px-3 py-2 rounded-lg bg-bad-soft border border-bad text-sm text-bad">
          No se pudo generar la vista previa con el último cambio.
        </div>
      ) : null}
    </div>
  );
}
