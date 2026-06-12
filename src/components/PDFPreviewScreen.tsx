import { useState, useEffect } from 'react';
import { PDFViewer, PDFDownloadLink } from '@react-pdf/renderer';
import { Download, ArrowLeft, FileText, Loader2 } from 'lucide-react';
import Header from './Header';
import QuoteDocument from './pdf/QuoteDocument';
import { normalizeLines } from '../lib/normalizeLines';
import type { QuoteData } from '../types/quote';
import { useAppSettings } from '../hooks/useAppSettings';

interface PDFPreviewScreenProps {
  quoteData: QuoteData;
  onBack: () => void;
}

function buildFileName(quoteData: QuoteData): string {
  const refNumber = quoteData.quoteReference.replace(/[^0-9]/g, '') || quoteData.quoteReference;
  const today = new Date();
  const dd = String(today.getDate()).padStart(2, '0');
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const yyyy = today.getFullYear();
  return `Cotizacion_${refNumber}_${dd}-${mm}-${yyyy}.pdf`;
}

export default function PDFPreviewScreen({ quoteData, onBack }: PDFPreviewScreenProps) {
  const [viewerReady, setViewerReady] = useState(false);
  const fileName = buildFileName(quoteData);
  const { pdfLogoUrl, pdfLogoWidthPx, pdfLogoHeightPx } = useAppSettings();

  useEffect(() => {
    const timer = setTimeout(() => setViewerReady(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  const normalizedLinesList = normalizeLines(quoteData.lines);
  const activeLines = normalizedLinesList.filter((l) => !l.ignored);
  const subtotal = activeLines.reduce(
    (sum, line) => sum + (line.quantity || 0) * (line.matched_unit_price || 0),
    0
  );
  const iva = subtotal * 0.16;
  const total = subtotal + iva;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Header hideHeader />

      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver a Revision
            </button>
            <div className="h-6 w-px bg-gray-300" />
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#E8521A]" />
              <h2 className="text-lg font-bold text-gray-900">Vista Previa de Cotizacion</h2>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-6 text-sm text-gray-500">
              <span>
                <span className="font-medium text-gray-700">{activeLines.length}</span> partidas
              </span>
              <span>
                Subtotal: <span className="font-medium text-gray-700">${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </span>
              <span>
                Total c/IVA: <span className="font-bold text-gray-900">${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </span>
            </div>

            <PDFDownloadLink
              document={<QuoteDocument quoteData={{ ...quoteData, lines: activeLines }} pdfLogoUrl={pdfLogoUrl} pdfLogoWidthPx={pdfLogoWidthPx} pdfLogoHeightPx={pdfLogoHeightPx} />}
              fileName={fileName}
            >
              {({ loading }) => (
                <button
                  disabled={loading}
                  className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold text-sm transition-all ${
                    loading
                      ? 'bg-gray-300 text-gray-500 cursor-wait'
                      : 'bg-[#E8521A] text-white hover:bg-[#d14815] hover:shadow-lg active:scale-[0.98]'
                  }`}
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  {loading ? 'Generando...' : 'Descargar PDF'}
                </button>
              )}
            </PDFDownloadLink>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center p-6">
        <div className="w-full max-w-5xl flex-1 bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200 relative">
          {!viewerReady && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white z-10">
              <Loader2 className="w-10 h-10 text-[#E8521A] animate-spin mb-4" />
              <p className="text-sm text-gray-500 font-medium">Generando vista previa del documento...</p>
            </div>
          )}
          <PDFViewer
            width="100%"
            height="100%"
            style={{ minHeight: 'calc(100vh - 220px)', border: 'none' }}
            showToolbar={false}
          >
            <QuoteDocument quoteData={{ ...quoteData, lines: activeLines }} pdfLogoUrl={pdfLogoUrl} pdfLogoWidthPx={pdfLogoWidthPx} pdfLogoHeightPx={pdfLogoHeightPx} />
          </PDFViewer>
        </div>

        <div className="mt-4 flex items-center gap-6 text-xs text-gray-400">
          <span>Archivo: {fileName}</span>
          <span>IVA: ${iva.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
        </div>
      </div>
    </div>
  );
}
