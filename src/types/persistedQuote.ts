export type QuoteStatus = 'draft' | 'review' | 'generated' | 'sent';
export type QuoteSource = 'upload' | 'manual';
export type EventType =
  | 'created' | 'file_uploaded' | 'processed' | 'line_edited'
  | 'line_added' | 'line_removed' | 'approved' | 'pdf_generated'
  | 'sent' | 'status_changed';

export interface PersistedQuote {
  id: string;
  quote_reference: string;
  customer_name: string;
  status: QuoteStatus;
  source: QuoteSource;
  original_file_path: string | null;
  original_file_name: string | null;
  original_file_size: number | null;
  pdf_file_path: string | null;
  total_lines: number;
  flagged_lines: number;
  matched_lines: number;
  unmatched_lines: number;
  high_confidence_lines: number;
  low_confidence_lines: number;
  avg_confidence: number;
  subtotal: number;
  currency: string;
  was_retried: boolean;
  processing_attempts: number;
  generated_date: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PersistedQuoteLine {
  id: string;
  quote_id: string;
  line_index: number;
  original_text: string | null;
  matched_product_code: string | null;
  matched_product_name: string | null;
  matched_unit_price: number | null;
  unit_of_measure: string | null;
  quantity: number;
  line_total: number;
  confidence: number;
  was_flagged: boolean;
  was_manual: boolean;
  was_price_overridden: boolean;
  notes: string | null;
  created_at: string;
}

export interface QuoteEvent {
  id: string;
  quote_id: string;
  event_type: EventType;
  payload: Record<string, any> | null;
  actor_id: string | null;
  created_at: string;
}
