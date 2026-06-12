const RAILWAY_OCR_URL = 'https://cotizaciones-docling-production.up.railway.app/ocr';

export interface DoclingResult {
  rawResponse: any;
  rawText: string;
  mappedRows: Record<string, any>[];
  mappingSuccessful: boolean;
}

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

function mapDoclingRow(row: any, idx: number): Record<string, any> | null {
  if (!row || typeof row !== 'object') return null;
  const codigo = String(
    pickFirst(row, [
      'Codigo', 'codigo', 'code', 'sku', 'clave', 'item_code',
      'product_code', 'itemCode', 'productCode', 'codigo_articulo', 'articulo',
      'no_parte', 'noParte', 'ref', 'referencia',
    ]) ?? ''
  ).trim();

  const descripcion = String(
    pickFirst(row, [
      'Descripcion', 'descripcion', 'description', 'desc', 'nombre',
      'name', 'producto', 'item', 'product', 'product_name', 'itemName',
      'descripcion_producto',
    ]) ?? ''
  ).trim();

  if (!descripcion) return null;

  const unidRaw = pickFirst(row, [
    'Unid', 'unid', 'unidad', 'unit', 'uom', 'unit_of_measure', 'unidad_medida', 'ump',
  ]);
  const unid = String(unidRaw ?? 'PZ').trim().substring(0, 10) || 'PZ';

  const cantRaw = pickFirst(row, [
    'Cant', 'cant', 'cantidad', 'qty', 'quantity', 'count', 'pieces',
  ]);
  let cantNum = 1;
  if (cantRaw !== undefined) {
    const n = typeof cantRaw === 'number'
      ? cantRaw
      : parseFloat(String(cantRaw).replace(',', '.'));
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

export function mapDoclingToReviewData(
  raw: any
): { mappedRows: Record<string, any>[]; mappingSuccessful: boolean } {
  const arr = findRowsArray(raw);
  if (!arr || arr.length === 0) {
    return { mappedRows: [], mappingSuccessful: false };
  }
  const mapped: Record<string, any>[] = [];
  for (let i = 0; i < arr.length; i++) {
    const r = mapDoclingRow(arr[i], mapped.length);
    if (r) mapped.push(r);
  }
  return { mappedRows: mapped, mappingSuccessful: mapped.length > 0 };
}

async function processWithRailway(file: File): Promise<DoclingResult> {
  const form = new FormData();
  form.append('file', file);

  console.log('[Docling] Sending file to Railway:', file.name, file.size, file.type);

  let response: Response;
  try {
    response = await fetch(RAILWAY_OCR_URL, {
      method: 'POST',
      body: form,
    });
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (err?.name === 'TypeError' || /Failed to fetch/i.test(msg)) {
      throw new Error(
        'No se pudo conectar al endpoint de Railway. Posible causa: CORS no habilitado en el servidor (puede funcionar en Postman pero el navegador lo bloquea). Verifica también que el servicio esté arriba. Detalle: ' + msg
      );
    }
    throw new Error('Error de red al llamar a Railway: ' + msg);
  }

  const contentType = response.headers.get('content-type') || '';
  const rawText = await response.text();

  console.log('[Docling] HTTP status:', response.status, response.statusText);
  console.log('[Docling] Content-Type:', contentType);
  console.log('[Docling] Raw response length:', rawText.length);
  console.log('[Docling] Raw response (full):', rawText);

  if (!response.ok) {
    throw new Error(
      `Railway respondió HTTP ${response.status}: ${rawText.substring(0, 500)}`
    );
  }

  let parsed: any = rawText;
  const trimmed = rawText.trim();
  if (
    contentType.includes('application/json') ||
    trimmed.startsWith('{') ||
    trimmed.startsWith('[')
  ) {
    try {
      parsed = JSON.parse(rawText);
    } catch (e) {
      console.warn('[Docling] Could not parse as JSON, keeping raw text', e);
    }
  }

  const { mappedRows, mappingSuccessful } = mapDoclingToReviewData(parsed);

  console.log(
    '[Docling] Mapping result:',
    mappingSuccessful ? `${mappedRows.length} rows mapped` : 'mapping failed'
  );

  return {
    rawResponse: parsed,
    rawText,
    mappedRows,
    mappingSuccessful,
  };
}

export default processWithRailway;
