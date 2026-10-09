export type ClaveVariable = 'etapa' | 'pronostico' | 'probabilidad' | 'cierre' | 'monto' | 'nombre';
export type ListaSf = 'etapa' | 'pronostico' | 'probabilidad';

export interface VariableConfig { origen: 'lista' | 'dias' | 'campo' | 'plantilla'; valor: string | number }
export type SfOportunidadConfig = Record<ClaveVariable, VariableConfig>;

export interface ValorLista {
  id: string; lista: ListaSf; valor: string; etiqueta: string | null; orden: number; activo: boolean;
}

export const SF_OPP_DEFAULTS: SfOportunidadConfig = {
  etapa:        { origen: 'lista',     valor: 'En Seguimiento' },
  pronostico:   { origen: 'lista',     valor: 'Pipeline' },
  probabilidad: { origen: 'lista',     valor: '30' },
  cierre:       { origen: 'dias',      valor: 1 },
  monto:        { origen: 'campo',     valor: 'total' },
  nombre:       { origen: 'plantilla', valor: '{referencia} - {cliente:40} - {fecha:DDMESYY}' },
};

export const SF_OPP_NAME_MAX = 120;
export const SF_OPP_CIERRE_MAX_DIAS = 365;

/** Campos que se pueden insertar en la plantilla del nombre. */
export const CAMPOS_PLANTILLA: { token: string; etiqueta: string }[] = [
  { token: '{referencia}',        etiqueta: 'Referencia (folio)' },
  { token: '{cliente:40}',        etiqueta: 'Cliente (40 caracteres)' },
  { token: '{no_cliente}',        etiqueta: 'No. de cliente' },
  { token: '{grupo}',             etiqueta: 'Grupo' },
  { token: '{proyecto}',          etiqueta: 'Proyecto' },
  { token: '{transporte}',        etiqueta: 'Transporte' },
  { token: '{orden_compra}',      etiqueta: 'Orden de compra' },
  { token: '{usuario}',           etiqueta: 'Usuario (correo)' },
  { token: '{total}',             etiqueta: 'Total' },
  { token: '{lineas}',            etiqueta: 'No. de líneas' },
  { token: '{fecha:DDMESYY}',     etiqueta: 'Fecha 09OCT26' },
  { token: '{fecha:DD/MM/YYYY}',  etiqueta: 'Fecha 09/10/2026' },
  { token: '{fecha:YYYY-MM-DD}',  etiqueta: 'Fecha 2026-10-09' },
];

/** Datos de ejemplo para la vista previa. */
export const EJEMPLO_CAMPOS: Record<string, string | number> = {
  referencia: 'QAI-1782341425583',
  cliente: 'CONSTRUCCION DE HOGARES JAVER SA DE CV',
  no_cliente: '100245',
  grupo: 'CONSTRUCTORAS',
  proyecto: 'Torre Norte',
  transporte: 'Paquetería',
  orden_compra: 'OC-55821',
  usuario: 'ejecutivo@impulsora.com',
  total: 125430.5,
  lineas: 18,
};

const MESES = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
const pad = (n: number) => String(n).padStart(2, '0');

/** "Ahora" en horario de México (UTC-6), igual que Railway. */
export function ahoraMexico(): Date {
  const utc = Date.now() + new Date().getTimezoneOffset() * 60000;
  return new Date(utc - 6 * 3600000);
}

export function formatoFecha(d: Date, formato?: string): string {
  const f = (formato || 'DDMESYY').trim().toUpperCase();
  if (f === 'DD/MM/YYYY') return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  if (f === 'YYYY-MM-DD') return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  if (f === 'DDMMYY') return `${pad(d.getDate())}${pad(d.getMonth() + 1)}${pad(d.getFullYear() % 100)}`;
  return `${pad(d.getDate())}${MESES[d.getMonth()]}${pad(d.getFullYear() % 100)}`;
}

/** {campo}, {campo:N} (recorta a N), {fecha:FORMATO}. Campos desconocidos = vacío. */
export function resolverPlantilla(plantilla: string, campos: Record<string, string | number>, fecha: Date): string {
  let txt = (plantilla || '').replace(/\{\s*([a-z_]+)\s*(?::\s*([^}]*))?\}/gi, (_m, claveRaw: string, argRaw?: string) => {
    const clave = claveRaw.toLowerCase();
    const arg = (argRaw || '').trim();
    if (clave === 'fecha') return formatoFecha(fecha, arg);
    const val = campos[clave];
    if (val === undefined || val === null) return '';
    let s = clave === 'total' && Number.isFinite(Number(val))
      ? Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : String(val).replace(/\s+/g, ' ').trim();
    if (/^\d+$/.test(arg)) s = s.slice(0, parseInt(arg, 10)).trim();
    return s;
  });
  txt = txt.replace(/\s+/g, ' ').trim();
  txt = txt.replace(/(\s*-\s*){2,}/g, ' - ');
  txt = txt.replace(/^[\s-]+|[\s-]+$/g, '');
  return txt.slice(0, SF_OPP_NAME_MAX).trim();
}

/** Combina lo guardado con los valores de respaldo. */
export function normalizarConfig(raw: unknown): SfOportunidadConfig {
  const r = (raw && typeof raw === 'object') ? raw as Partial<SfOportunidadConfig> : {};
  const out = { ...SF_OPP_DEFAULTS };
  (Object.keys(SF_OPP_DEFAULTS) as ClaveVariable[]).forEach(k => {
    const v = r[k];
    if (v && typeof v === 'object' && 'valor' in v) out[k] = { origen: SF_OPP_DEFAULTS[k].origen, valor: v.valor };
  });
  return out;
}
