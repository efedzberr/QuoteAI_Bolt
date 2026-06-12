/**
 * Adapter: maps the n8n webhook response into the same shape consumed by
 * PayloadPreviewScreen (rows: Record<string, any>[]).
 *
 * The canonical n8n response shape will be confirmed after live testing.
 * For now this is DEFENSIVE — it won't crash on missing fields.
 */

function pickFirst(obj: any, keys: string[]): any {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null && obj[k] !== '') {
      return obj[k];
    }
  }
  return undefined;
}

function findRowsArray(raw: any): any[] | null {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== 'object') return null;
  const candidates = [
    'rows', 'lines', 'items', 'data', 'products', 'productos',
    'partidas', 'records', 'extracted', 'result', 'results', 'output',
  ];
  for (const k of candidates) {
    if (Array.isArray(raw[k])) return raw[k];
  }
  for (const v of Object.values(raw)) {
    if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'object') return v as any[];
  }
  return null;
}

function mapRow(row: any, idx: number): Record<string, any> | null {
  if (!row || typeof row !== 'object') return null;

  const codigo = String(
    pickFirst(row, [
      'Codigo', 'codigo', 'code', 'sku', 'clave', 'item_code',
      'product_code', 'matched_product_code', 'original_code',
    ]) ?? ''
  ).trim();

  const descripcion = String(
    pickFirst(row, [
      'Descripcion', 'descripcion', 'description', 'desc', 'nombre',
      'name', 'producto', 'item', 'product', 'original_text',
      'matched_product_name',
    ]) ?? ''
  ).trim();

  if (!descripcion) return null;

  const unidRaw = pickFirst(row, [
    'Unid', 'unid', 'unidad', 'unit', 'uom', 'unit_of_measure',
    'unidad_medida', 'matched_unit_of_measure',
  ]);
  const unid = String(unidRaw ?? 'PZ').trim().substring(0, 10) || 'PZ';

  const cantRaw = pickFirst(row, [
    'Cant', 'cant', 'cantidad', 'qty', 'quantity', 'count',
  ]);
  let cantNum = 1;
  if (cantRaw !== undefined) {
    const n = typeof cantRaw === 'number' ? cantRaw : parseFloat(String(cantRaw).replace(',', '.'));
    if (isFinite(n) && n > 0) cantNum = n;
  }

  return {
    'IEST-01': String(idx + 1),
    Codigo: codigo,
    Descripcion: descripcion,
    Unid: unid,
    Cant: String(cantNum),
  };
}

export interface N8nReviewResult {
  mappedRows: Record<string, any>[];
  mappingSuccessful: boolean;
}

// TODO: Refine mapping once canonical n8n response shape is confirmed
export default function mapN8nToReviewData(raw: any): N8nReviewResult {
  const arr = findRowsArray(raw);
  if (!arr || arr.length === 0) {
    return { mappedRows: [], mappingSuccessful: false };
  }
  const mapped: Record<string, any>[] = [];
  for (let i = 0; i < arr.length; i++) {
    const r = mapRow(arr[i], mapped.length);
    if (r) mapped.push(r);
  }
  return { mappedRows: mapped, mappingSuccessful: mapped.length > 0 };
}
