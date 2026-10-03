import type { QuoteData } from '../../types/quote';
import type { CeldaPdf } from './pdfConfig';

/** Copia de la cuenta de Salesforce guardada con la cotización (jobs.cuenta_sf). */
export type CuentaPdf = Record<string, unknown>;

/** Datos que no vienen en la cotización: la cuenta del cliente y quién la elaboró. */
export interface DatosPdf {
  cuenta: CuentaPdf | null;
  elaboro: string;
  elaboroCorreo: string;
}

export const DATOS_PDF_VACIOS: DatosPdf = { cuenta: null, elaboro: '', elaboroCorreo: '' };

export interface CampoPdf {
  clave: string;
  etiqueta: string;
  grupo: 'Cotización' | 'Cliente' | 'Usuario';
  /** Propiedad de la cuenta de Salesforce de donde sale (solo campos del cliente). */
  propiedadCuenta?: string;
  /** false = el servicio de cuentas todavía no lo devuelve: sale vacío. */
  disponible: boolean;
}

/** Campos que se pueden imprimir en el encabezado, los bloques de cliente y los datos del pedido. */
export const CAMPOS_PDF: CampoPdf[] = [
  { clave: 'fecha', etiqueta: 'Fecha', grupo: 'Cotización', disponible: true },
  { clave: 'folio', etiqueta: 'Folio (SQ 123)', grupo: 'Cotización', disponible: true },
  { clave: 'folio_sin_espacio', etiqueta: 'Folio sin espacio (SQ123)', grupo: 'Cotización', disponible: true },
  { clave: 'numero', etiqueta: 'Número de cotización', grupo: 'Cotización', disponible: true },
  { clave: 'pedido', etiqueta: 'Pedido (123 SQ)', grupo: 'Cotización', disponible: true },
  { clave: 'proyecto', etiqueta: 'Proyecto', grupo: 'Cotización', disponible: true },
  { clave: 'cliente', etiqueta: 'Cliente (como se capturó)', grupo: 'Cliente', disponible: true },
  { clave: 'cliente_nombre', etiqueta: 'Nombre de la cuenta', grupo: 'Cliente', propiedadCuenta: 'name', disponible: true },
  { clave: 'cliente_numero', etiqueta: 'Número de cliente', grupo: 'Cliente', propiedadCuenta: 'noCliente', disponible: true },
  { clave: 'cliente_calle', etiqueta: 'Calle', grupo: 'Cliente', propiedadCuenta: 'calle', disponible: true },
  { clave: 'cliente_estado', etiqueta: 'Estado', grupo: 'Cliente', propiedadCuenta: 'estado', disponible: true },
  { clave: 'cliente_telefono', etiqueta: 'Teléfono', grupo: 'Cliente', propiedadCuenta: 'phone', disponible: true },
  { clave: 'contacto_nombre', etiqueta: 'Contacto principal', grupo: 'Cliente', propiedadCuenta: 'primaryContactName', disponible: true },
  { clave: 'contacto_correo', etiqueta: 'Correo del contacto', grupo: 'Cliente', propiedadCuenta: 'primaryContactEmail', disponible: true },
  { clave: 'cliente_rfc', etiqueta: 'RFC', grupo: 'Cliente', propiedadCuenta: 'rfc', disponible: false },
  { clave: 'cliente_colonia', etiqueta: 'Colonia', grupo: 'Cliente', propiedadCuenta: 'colonia', disponible: false },
  { clave: 'cliente_ciudad', etiqueta: 'Ciudad', grupo: 'Cliente', propiedadCuenta: 'ciudad', disponible: false },
  { clave: 'cliente_cp', etiqueta: 'Código postal', grupo: 'Cliente', propiedadCuenta: 'codigoPostal', disponible: false },
  { clave: 'dias_entrega', etiqueta: 'Días de entrega', grupo: 'Cliente', propiedadCuenta: 'diasEntrega', disponible: false },
  { clave: 'condiciones_pago', etiqueta: 'Condiciones de pago', grupo: 'Cliente', propiedadCuenta: 'condicionesPago', disponible: false },
  { clave: 'agente', etiqueta: 'Agente', grupo: 'Cliente', propiedadCuenta: 'agente', disponible: false },
  { clave: 'zona', etiqueta: 'Zona', grupo: 'Cliente', propiedadCuenta: 'zona', disponible: false },
  { clave: 'ruta', etiqueta: 'Ruta', grupo: 'Cliente', propiedadCuenta: 'ruta', disponible: false },
  { clave: 'elaboro', etiqueta: 'Elaboró (nombre del usuario)', grupo: 'Usuario', disponible: true },
  { clave: 'elaboro_correo', etiqueta: 'Elaboró (correo)', grupo: 'Usuario', disponible: true },
];

const limpio = (v: unknown): string => (v === null || v === undefined ? '' : String(v).trim());

/** Número de la cotización: los dígitos de la referencia (QAI-1790864620688 -> 1790864620688). */
export function numeroCotizacion(quoteData: QuoteData): string {
  const ref = limpio(quoteData.quoteReference);
  return ref.replace(/[^0-9]/g, '') || ref;
}

/** Fecha con día y mes a dos dígitos: 1/10/2026 -> 01/10/2026. Otros formatos se dejan igual. */
export function fechaPdf(texto: string): string {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(limpio(texto));
  return m ? `${m[1].padStart(2, '0')}/${m[2].padStart(2, '0')}/${m[3]}` : limpio(texto);
}

/** Valor de un campo de CAMPOS_PDF. Un campo desconocido o sin dato devuelve cadena vacía. */
export function valorCampo(campo: string, quoteData: QuoteData, datos: DatosPdf): string {
  const numero = numeroCotizacion(quoteData);
  switch (campo) {
    case 'fecha': return fechaPdf(quoteData.generatedDate);
    case 'folio': return numero ? `SQ ${numero}` : '';
    case 'folio_sin_espacio': return numero ? `SQ${numero}` : '';
    case 'numero': return numero;
    case 'pedido': return numero ? `${numero} SQ` : '';
    case 'proyecto': return limpio(quoteData.projectName);
    case 'cliente': return limpio(quoteData.customerName);
    case 'elaboro': return limpio(datos.elaboro);
    case 'elaboro_correo': return limpio(datos.elaboroCorreo);
    default: {
      const def = CAMPOS_PDF.find((c) => c.clave === campo);
      if (!def?.propiedadCuenta || !datos.cuenta) return '';
      return limpio(datos.cuenta[def.propiedadCuenta]);
    }
  }
}

/** Valor de una celda: el campo y, si no hay campo o viene vacío, el texto fijo. */
export function valorCelda(celda: CeldaPdf, quoteData: QuoteData, datos: DatosPdf): string {
  const delCampo = celda.campo ? valorCampo(celda.campo, quoteData, datos) : '';
  return delCampo || limpio(celda.texto);
}
