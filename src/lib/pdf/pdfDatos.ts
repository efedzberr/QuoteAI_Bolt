import type { QuoteData } from '../../types/quote';
import type { CeldaPdf } from './pdfConfig';
import { nombreFuenteTc, fechaTc } from '../monedas';

/** Copia de la cuenta de Salesforce guardada con la cotización (jobs.cuenta_sf). */
export type CuentaPdf = Record<string, unknown>;

/** Datos de un artículo del catálogo (tabla products) que se pueden imprimir en la tabla del PDF. */
export interface ProductoCatalogo {
  marca: string;
  descripcionLarga: string;
  garantia: string;
  codigoBarras: string;
  departamento: string;
  categoria: string;
  subcategoria: string;
  peso: string;
  /** Precio de lista del catálogo; respaldo cuando la partida no guardó el suyo. */
  precio: number | null;
  /** Valores de los atributos del artículo (ValorAtrib4 a ValorAtrib8) que traen dato. */
  atributos: string[];
}

/** Artículos del catálogo de la cotización, por código (CodigoArt). */
export type CatalogoPdf = Record<string, ProductoCatalogo>;

/** Datos que no vienen en la cotización: la cuenta del cliente, quién la elaboró y el catálogo de sus artículos. */
export interface DatosPdf {
  cuenta: CuentaPdf | null;
  elaboro: string;
  elaboroCorreo: string;
  /** Transporte que capturó el ejecutivo en el encabezado de la cotización (jobs.transporte). */
  transporte: string;
  /** Orden de compra del cliente que capturó el ejecutivo (jobs.orden_compra). */
  ordenCompra: string;
  /** Solo se consulta cuando alguna columna de la tabla usa datos del catálogo. */
  catalogo?: CatalogoPdf;
  moneda?: string;
  tipoCambio?: number | null;
  tcFuente?: string;
  tcFecha?: string;
  listo?: boolean;
}

export const DATOS_PDF_VACIOS: DatosPdf = { cuenta: null, elaboro: '', elaboroCorreo: '', transporte: '', ordenCompra: '' };

/** Opciones de la leyenda de moneda (son las de PdfConfig['totales']). */
export interface OpcionesLeyendaMoneda {
  leyendaMoneda?: boolean;
  leyendaMonedaCodigo?: boolean;
  leyendaMonedaTipoCambio?: boolean;
  leyendaMonedaFuente?: boolean;
  leyendaMonedaFecha?: boolean;
}

/**
 * Leyenda de moneda del PDF según lo que el administrador encendió.
 * Devuelve cadena vacía si la propuesta es en pesos, si la leyenda está apagada o si no queda ninguna pieza.
 */
export function leyendaMoneda(datos: DatosPdf, op: OpcionesLeyendaMoneda): string {
  const moneda = (datos.moneda || 'MXN').toUpperCase();
  const tc = Number(datos.tipoCambio);
  if (moneda === 'MXN' || !(tc > 0) || op.leyendaMoneda === false) return '';
  const fuente = op.leyendaMonedaFuente !== false && datos.tcFuente ? nombreFuenteTc(datos.tcFuente) : '';
  const fecha = op.leyendaMonedaFecha !== false && datos.tcFecha ? fechaTc(datos.tcFecha) : '';
  const origen = [fuente, fecha].filter(Boolean).join(', ');
  const piezas: string[] = [];
  if (op.leyendaMonedaCodigo !== false) piezas.push(`Moneda: ${moneda}`);
  if (op.leyendaMonedaTipoCambio !== false) {
    piezas.push(`Tipo de cambio: 1 ${moneda} = ${tc.toFixed(4)} MXN${origen ? ` (${origen})` : ''}`);
  } else if (origen) {
    piezas.push(`Tipo de cambio de ${origen}`);
  }
  return piezas.join(' · ');
}

export interface CampoPdf {
  clave: string;
  etiqueta: string;
  grupo: 'Cotización' | 'Cliente' | 'Usuario';
  /** Propiedad de la cuenta de Salesforce de donde sale (solo campos del cliente). */
  propiedadCuenta?: string;
  /** Propiedad que se usa cuando la principal viene vacía. */
  propiedadAlterna?: string;
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
  { clave: 'orden_compra', etiqueta: 'Orden de compra del cliente', grupo: 'Cotización', disponible: true },
  { clave: 'transporte', etiqueta: 'Transporte', grupo: 'Cotización', disponible: true },
  { clave: 'moneda', etiqueta: 'Moneda de la propuesta (MXN, USD…)', grupo: 'Cotización', disponible: true },
  { clave: 'tipo_cambio', etiqueta: 'Tipo de cambio (vacío si es en pesos)', grupo: 'Cotización', disponible: true },
  { clave: 'tc_fuente', etiqueta: 'Fuente del tipo de cambio', grupo: 'Cotización', disponible: true },
  { clave: 'tc_fecha', etiqueta: 'Fecha del tipo de cambio', grupo: 'Cotización', disponible: true },
  { clave: 'cliente', etiqueta: 'Cliente (como se capturó)', grupo: 'Cliente', disponible: true },
  { clave: 'cliente_nombre', etiqueta: 'Nombre de la cuenta', grupo: 'Cliente', propiedadCuenta: 'name', disponible: true },
  { clave: 'cliente_numero', etiqueta: 'Número de cliente', grupo: 'Cliente', propiedadCuenta: 'noCliente', disponible: true },
  { clave: 'cliente_rfc', etiqueta: 'RFC', grupo: 'Cliente', propiedadCuenta: 'rfc', disponible: true },
  { clave: 'cliente_calle', etiqueta: 'Calle', grupo: 'Cliente', propiedadCuenta: 'billingStreet', propiedadAlterna: 'calle', disponible: true },
  { clave: 'cliente_ciudad', etiqueta: 'Ciudad', grupo: 'Cliente', propiedadCuenta: 'billingCity', disponible: true },
  { clave: 'cliente_estado', etiqueta: 'Estado', grupo: 'Cliente', propiedadCuenta: 'billingState', propiedadAlterna: 'estado', disponible: true },
  { clave: 'cliente_cp', etiqueta: 'Código postal', grupo: 'Cliente', propiedadCuenta: 'billingPostalCode', disponible: true },
  { clave: 'cliente_pais', etiqueta: 'País', grupo: 'Cliente', propiedadCuenta: 'billingCountry', disponible: true },
  { clave: 'cliente_telefono', etiqueta: 'Teléfono', grupo: 'Cliente', propiedadCuenta: 'phone', disponible: true },
  { clave: 'contacto_nombre', etiqueta: 'Contacto principal', grupo: 'Cliente', propiedadCuenta: 'primaryContactName', disponible: true },
  { clave: 'contacto_correo', etiqueta: 'Correo del contacto', grupo: 'Cliente', propiedadCuenta: 'primaryContactEmail', disponible: true },
  { clave: 'cliente_colonia', etiqueta: 'Colonia', grupo: 'Cliente', propiedadCuenta: 'colonia', disponible: false },
  { clave: 'dias_entrega', etiqueta: 'Días de entrega', grupo: 'Cliente', propiedadCuenta: 'diasEntrega', disponible: false },
  { clave: 'condiciones_pago', etiqueta: 'Condiciones de pago', grupo: 'Cliente', propiedadCuenta: 'condicionesPago', disponible: false },
  { clave: 'agente', etiqueta: 'Agente', grupo: 'Cliente', propiedadCuenta: 'agente', disponible: false },
  { clave: 'zona', etiqueta: 'Zona', grupo: 'Cliente', propiedadCuenta: 'zona', disponible: false },
  { clave: 'ruta', etiqueta: 'Ruta', grupo: 'Cliente', propiedadCuenta: 'ruta', disponible: false },
  { clave: 'elaboro', etiqueta: 'Elaboró (nombre del usuario)', grupo: 'Usuario', disponible: true },
  { clave: 'elaboro_correo', etiqueta: 'Elaboró (correo)', grupo: 'Usuario', disponible: true },
];

const limpio = (v: unknown): string => (v === null || v === undefined ? '' : String(v).replace(/\r\n?/g, '\n').trim());

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
    case 'orden_compra': return limpio(datos.ordenCompra);
    case 'transporte': return limpio(datos.transporte);
    case 'moneda': return (datos.moneda || 'MXN').toUpperCase();
    case 'tipo_cambio': {
      const tc = Number(datos.tipoCambio);
      return (datos.moneda || 'MXN').toUpperCase() !== 'MXN' && tc > 0 ? tc.toFixed(4) : '';
    }
    case 'tc_fuente': return (datos.moneda || 'MXN').toUpperCase() !== 'MXN' && datos.tcFuente ? nombreFuenteTc(datos.tcFuente) : '';
    case 'tc_fecha': return (datos.moneda || 'MXN').toUpperCase() !== 'MXN' && datos.tcFecha ? fechaTc(datos.tcFecha) : '';
    case 'cliente': return limpio(quoteData.customerName);
    case 'elaboro': return limpio(datos.elaboro);
    case 'elaboro_correo': return limpio(datos.elaboroCorreo);
    default: {
      const def = CAMPOS_PDF.find((c) => c.clave === campo);
      if (!def?.propiedadCuenta || !datos.cuenta) return '';
      const valor = limpio(datos.cuenta[def.propiedadCuenta]) || (def.propiedadAlterna ? limpio(datos.cuenta[def.propiedadAlterna]) : '');
      // Un dato que viene en varios renglones (por ejemplo calle y colonia) se imprime en uno, separado por comas
      return valor.split('\n').map((parte) => parte.trim()).filter(Boolean).join(', ');
    }
  }
}

/** true si el texto combina datos, es decir, trae al menos un dato entre llaves: `{cliente_ciudad}`. */
export function esTextoCombinado(texto: string): boolean {
  return /\{[a-z_]+\}/.test(texto || '');
}

/**
 * Arma un texto que combina varios datos: `{cliente_ciudad}, {cliente_estado}, C.P. {cliente_cp}`.
 * `valorDe` da el valor de cada dato (los del encabezado o los de una partida de la tabla).
 * Un dato vacío se quita junto con el texto que lo antecede, para no dejar comas ni etiquetas sueltas.
 * Si todos los datos vienen vacíos el resultado es una cadena vacía.
 */
export function combinarDatos(texto: string, valorDe: (clave: string) => string): string {
  const partes = (texto || '').split(/\{([a-z_]+)\}/);
  // partes: [texto, clave, texto, clave, ..., texto]
  let salida = '';
  let impresos = 0;
  for (let i = 1; i < partes.length; i += 2) {
    const valor = valorDe(partes[i]);
    if (!valor) continue;
    const antes = partes[i - 1];
    // El primer dato que sí se imprime no lleva el separador de un dato anterior que quedó vacío
    salida += impresos === 0 && i > 1 ? antes.replace(/^[\s,;:|/·-]+/, '') : antes;
    salida += valor;
    impresos++;
  }
  if (impresos === 0) return '';
  return (salida + partes[partes.length - 1]).trim();
}

/** Texto que combina datos del encabezado, los bloques de cliente y los datos del pedido. */
export function textoCombinado(texto: string, quoteData: QuoteData, datos: DatosPdf): string {
  return combinarDatos(texto, (clave) => valorCampo(clave, quoteData, datos));
}

/**
 * Valor de una celda. Si el texto combina datos (trae llaves) se arma con ellos;
 * si no, es el campo y, cuando no hay campo o viene vacío, el texto fijo.
 */
export function valorCelda(celda: CeldaPdf, quoteData: QuoteData, datos: DatosPdf): string {
  if (esTextoCombinado(celda.texto)) return textoCombinado(celda.texto, quoteData, datos);
  const delCampo = celda.campo ? valorCampo(celda.campo, quoteData, datos) : '';
  return delCampo || limpio(celda.texto);
}
