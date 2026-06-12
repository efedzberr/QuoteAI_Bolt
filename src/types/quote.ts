export interface QuoteLine {
  original_text: string;
  original_code: string | null;
  matched_product_name: string | null;
  matched_product_code: string | null;
  confidence: number;
  quantity: number;
  matched_unit_of_measure: string;
  matched_unit_price: number | null;
  needs_review: boolean;
  ignored?: boolean;
}

export interface QuoteData {
  quoteReference: string;
  customerName: string;
  generatedDate: string;
  totalLines: number;
  currency: string;
  subtotal: number;
  lines: QuoteLine[];
}

export type QuoteStatus = 'generated' | 'sent' | 'review' | 'draft';
export type ConfidenceLevel = 'hi' | 'mid' | 'lo';

export interface Quote {
  id: string;
  client: string;
  title: string;
  createdAt: string;
  total: number;
  currency: string;
  productCount: number;
  recognizedCount: number;
  confidence: number;
  status: QuoteStatus;
}

export interface CatalogProduct {
  codigoArt: string;
  descCortaArt: string;
  marca: string;
  ump: string;
  deptoArt: string;
  categoriaArt: string;
  precio: number;
}

export type LineItemSource = 'matched' | 'fuzzy' | 'unmatched' | 'manual';

export interface LineItem {
  id: string;
  rawText: string;
  quantity: number;
  unit: string;
  matchedProduct?: CatalogProduct;
  confidence: number;
  source: LineItemSource;
  customPrice?: number;
  notes?: string;
}

export interface DraftQuote {
  id: string;
  customerRef: string;
  fileName?: string;
  fileSize?: number;
  uploadedAt: string;
  items: LineItem[];
  overallConfidence: number;
}
