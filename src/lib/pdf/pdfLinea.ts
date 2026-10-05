// Datos que se pueden imprimir en las columnas de la tabla de productos del PDF.
// Cada columna imprime un dato de CAMPOS_LINEA, un texto fijo o un texto que combina datos entre llaves.
import type { QuoteLine } from '../../types/quote';
import type { AlineacionPdf, ColumnaPdf, PdfConfig } from './pdfConfig';
import { combinarDatos, esTextoCombinado, type CatalogoPdf, type ProductoCatalogo } from './pdfDatos';

/** Partida tal como llega al PDF: la de la cotización más lo que guarda job_lines. */
export type LineaPdf = QuoteLine & {
  precio_lista?: number | null;
  inventario_total?: number | null;
};

export type GrupoLinea = 'Partida' | 'Solicitud del cliente' | 'Precios y descuentos' | 'Catálogo' | 'Disponibilidad';

export const GRUPOS_LINEA: GrupoLinea[] = ['Partida', 'Solicitud del cliente', 'Precios y descuentos', 'Catálogo', 'Disponibilidad'];

export interface CampoLinea {
  clave: string;
  /** Nombre en el selector del editor. */
  etiqueta: string;
  grupo: GrupoLinea;
  /** Título, ancho (0 = el espacio que sobra) y alineación que se sugieren al elegir el dato. */
  titulo: string;
  ancho: number;
  alineacion: AlineacionPdf;
  /** true = lo lee del catálogo (o lo usa de respaldo): al generar el PDF se consultan los artículos. */
  catalogo?: boolean;
}

/** Datos de una partida que se pueden imprimir en una columna. */
export const CAMPOS_LINEA: CampoLinea[] = [
  { clave: 'partida', etiqueta: 'Número de partida', grupo: 'Partida', titulo: '#', ancho: 24, alineacion: 'center' },
  { clave: 'clave', etiqueta: 'Clave del producto', grupo: 'Partida', titulo: 'CLAVE', ancho: 70, alineacion: 'left' },
  { clave: 'descripcion', etiqueta: 'Descripción', grupo: 'Partida', titulo: 'DESCRIPCION', ancho: 0, alineacion: 'left' },
  { clave: 'um', etiqueta: 'Unidad de medida', grupo: 'Partida', titulo: 'U.M.', ancho: 35, alineacion: 'center' },
  { clave: 'cantidad', etiqueta: 'Cantidad', grupo: 'Partida', titulo: 'CANTIDAD', ancho: 55, alineacion: 'center' },
  { clave: 'precio', etiqueta: 'Precio unitario', grupo: 'Partida', titulo: 'PRECIO UNITARIO', ancho: 70, alineacion: 'right' },
  { clave: 'importe', etiqueta: 'Importe', grupo: 'Partida', titulo: 'IMPORTE', ancho: 70, alineacion: 'right' },
  { clave: 'comentario', etiqueta: 'Comentario de la partida', grupo: 'Partida', titulo: 'COMENTARIO', ancho: 110, alineacion: 'left' },
  { clave: 'codigo_cliente', etiqueta: 'Código del cliente', grupo: 'Solicitud del cliente', titulo: 'SU CODIGO', ancho: 70, alineacion: 'left' },
  { clave: 'descripcion_cliente', etiqueta: 'Descripción del cliente', grupo: 'Solicitud del cliente', titulo: 'SU DESCRIPCION', ancho: 0, alineacion: 'left' },
  { clave: 'precio_lista', etiqueta: 'Precio de lista', grupo: 'Precios y descuentos', titulo: 'PRECIO LISTA', ancho: 65, alineacion: 'right', catalogo: true },
  { clave: 'descuento_pct', etiqueta: 'Descuento % (contra precio de lista)', grupo: 'Precios y descuentos', titulo: 'DESC.', ancho: 40, alineacion: 'center', catalogo: true },
  { clave: 'precio_iva', etiqueta: 'Precio unitario con IVA', grupo: 'Precios y descuentos', titulo: 'PRECIO C/IVA', ancho: 70, alineacion: 'right' },
  { clave: 'importe_iva', etiqueta: 'Importe con IVA', grupo: 'Precios y descuentos', titulo: 'IMPORTE C/IVA', ancho: 75, alineacion: 'right' },
  { clave: 'marca', etiqueta: 'Marca', grupo: 'Catálogo', titulo: 'MARCA', ancho: 70, alineacion: 'left', catalogo: true },
  { clave: 'descripcion_larga', etiqueta: 'Descripción larga', grupo: 'Catálogo', titulo: 'DESCRIPCION', ancho: 0, alineacion: 'left', catalogo: true },
  { clave: 'garantia', etiqueta: 'Garantía', grupo: 'Catálogo', titulo: 'GARANTIA', ancho: 70, alineacion: 'left', catalogo: true },
  { clave: 'codigo_barras', etiqueta: 'Código de barras del artículo', grupo: 'Catálogo', titulo: 'COD. BARRAS', ancho: 70, alineacion: 'left', catalogo: true },
  { clave: 'departamento', etiqueta: 'Departamento', grupo: 'Catálogo', titulo: 'DEPARTAMENTO', ancho: 70, alineacion: 'left', catalogo: true },
  { clave: 'categoria', etiqueta: 'Categoría', grupo: 'Catálogo', titulo: 'CATEGORIA', ancho: 80, alineacion: 'left', catalogo: true },
  { clave: 'subcategoria', etiqueta: 'Subcategoría', grupo: 'Catálogo', titulo: 'SUBCATEGORIA', ancho: 80, alineacion: 'left', catalogo: true },
  { clave: 'peso', etiqueta: 'Peso', grupo: 'Catálogo', titulo: 'PESO', ancho: 40, alineacion: 'right', catalogo: true },
  { clave: 'caracteristicas', etiqueta: 'Características (atributos)', grupo: 'Catálogo', titulo: 'CARACTERISTICAS', ancho: 90, alineacion: 'left', catalogo: true },
  { clave: 'existencia', etiqueta: 'Existencia en almacén', grupo: 'Disponibilidad', titulo: 'EXISTENCIA', ancho: 50, alineacion: 'center' },
  { clave: 'disponibilidad', etiqueta: 'Disponibilidad (Inmediata / Sobre pedido)', grupo: 'Disponibilidad', titulo: 'DISPONIBILIDAD', ancho: 65, alineacion: 'center' },
];

const SIN_DATO = { titulo: '', ancho: 60, alineacion: 'left' as AlineacionPdf };

/** Título, ancho y alineación sugeridos para una columna con ese dato (vacío = texto fijo). */
export function sugerenciaColumna(campo: string): { titulo: string; ancho: number; alineacion: AlineacionPdf } {
  const def = CAMPOS_LINEA.find((c) => c.clave === campo);
  return def ? { titulo: def.titulo, ancho: def.ancho, alineacion: def.alineacion } : SIN_DATO;
}

/** Nombre de un dato para mostrarlo en el editor. */
export function nombreCampoLinea(campo: string): string {
  return CAMPOS_LINEA.find((c) => c.clave === campo)?.etiqueta ?? campo;
}

/** Datos que usa una columna: los que trae entre llaves o, si no combina datos, su dato. */
export function camposDeColumna(col: ColumnaPdf): string[] {
  if (esTextoCombinado(col.texto)) return Array.from(col.texto.matchAll(/\{([a-z_]+)\}/g), (m) => m[1]);
  return col.campo ? [col.campo] : [];
}

const CAMPOS_DEL_CATALOGO = new Set(CAMPOS_LINEA.filter((c) => c.catalogo).map((c) => c.clave));

/** true si alguna columna visible usa datos del catálogo: al generar el PDF hay que consultar los artículos. */
export function usaCatalogo(config: PdfConfig): boolean {
  return config.columnas.some((col) => col.visible && camposDeColumna(col).some((c) => CAMPOS_DEL_CATALOGO.has(c)));
}

const limpio = (v: unknown): string => (v === null || v === undefined ? '' : String(v).replace(/\r\n?/g, '\n').trim());

/** Códigos de producto de las partidas, sin repetir, para consultar el catálogo. */
export function codigosCatalogo(lineas: unknown[]): string[] {
  return Array.from(new Set(lineas.map((l) => limpio((l as LineaPdf | null)?.matched_product_code)).filter(Boolean)));
}

/**
 * Columna (de las visibles) que lleva el comentario de la partida debajo de su texto: la de la descripción.
 * Si alguna columna ya imprime el comentario, no se repite (-1).
 */
export function columnaDelComentario(columnas: ColumnaPdf[]): number {
  if (columnas.some((c) => camposDeColumna(c).includes('comentario'))) return -1;
  return columnas.findIndex((c) => camposDeColumna(c).includes('descripcion'));
}

/** Lo que necesita una celda: la partida, su posición en la tabla, la tasa de IVA y los artículos del catálogo. */
export interface ContextoLinea {
  linea: LineaPdf;
  indice: number;
  tasaIva: number;
  catalogo?: CatalogoPdf;
}

const numero = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

const moneda = (n: number): string => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function productoDe(ctx: ContextoLinea): ProductoCatalogo | undefined {
  const codigo = limpio(ctx.linea.matched_product_code);
  return codigo ? ctx.catalogo?.[codigo] : undefined;
}

/** Precio de lista: el que guardó la partida y, si no trae, el del catálogo. */
function precioLista(ctx: ContextoLinea): number | null {
  const guardado = numero(ctx.linea.precio_lista);
  if (guardado !== null && guardado > 0) return guardado;
  const delCatalogo = productoDe(ctx)?.precio ?? null;
  return delCatalogo !== null && delCatalogo > 0 ? delCatalogo : null;
}

/** Valor de un dato de CAMPOS_LINEA en una partida. Un dato desconocido o sin valor devuelve cadena vacía. */
export function valorLinea(campo: string, ctx: ContextoLinea): string {
  const { linea } = ctx;
  const cantidad = numero(linea.quantity) ?? 0;
  const precio = numero(linea.matched_unit_price);
  switch (campo) {
    case 'partida': return String(ctx.indice + 1);
    case 'clave': return limpio(linea.matched_product_code) || 'Especial';
    case 'descripcion': return limpio(linea.matched_product_name);
    case 'um': return limpio(linea.matched_unit_of_measure) || 'PZ';
    case 'cantidad': return limpio(linea.quantity);
    case 'precio': return moneda(precio ?? 0);
    case 'importe': return moneda(cantidad * (precio ?? 0));
    case 'comentario': return limpio(linea.comentario);
    case 'codigo_cliente': return limpio(linea.original_code);
    case 'descripcion_cliente': return limpio(linea.original_text);
    case 'precio_lista': {
      const lista = precioLista(ctx);
      return lista === null ? '' : moneda(lista);
    }
    case 'descuento_pct': {
      // Se calcula con el precio que se cotiza: sigue siendo correcto si el ejecutivo cambió el precio
      const lista = precioLista(ctx);
      if (lista === null || precio === null) return '';
      const pct = Math.max(0, (1 - precio / lista) * 100);
      return `${Math.round(pct * 100) / 100}%`;
    }
    case 'precio_iva': return moneda((precio ?? 0) * (1 + ctx.tasaIva));
    case 'importe_iva': return moneda(cantidad * (precio ?? 0) * (1 + ctx.tasaIva));
    case 'marca': return limpio(productoDe(ctx)?.marca);
    case 'descripcion_larga': return limpio(productoDe(ctx)?.descripcionLarga);
    case 'garantia': return limpio(productoDe(ctx)?.garantia);
    case 'codigo_barras': return limpio(productoDe(ctx)?.codigoBarras);
    case 'departamento': return limpio(productoDe(ctx)?.departamento);
    case 'categoria': return limpio(productoDe(ctx)?.categoria);
    case 'subcategoria': return limpio(productoDe(ctx)?.subcategoria);
    case 'peso': return limpio(productoDe(ctx)?.peso);
    case 'caracteristicas': return (productoDe(ctx)?.atributos ?? []).map(limpio).filter(Boolean).join(' · ');
    case 'existencia': {
      const existencia = numero(linea.inventario_total);
      return existencia === null ? '' : existencia.toLocaleString('en-US');
    }
    case 'disponibilidad': {
      // Sin dato de existencia (por ejemplo, una partida agregada a mano) no se afirma nada
      const existencia = numero(linea.inventario_total);
      if (existencia === null) return '';
      return existencia > 0 && existencia >= cantidad ? 'Inmediata' : 'Sobre pedido';
    }
    default: return '';
  }
}

/** Lo que imprime una columna en una partida: los datos combinados, o el dato y, si viene vacío, el texto fijo. */
export function valorColumna(col: ColumnaPdf, ctx: ContextoLinea): string {
  if (esTextoCombinado(col.texto)) return combinarDatos(col.texto, (clave) => valorLinea(clave, ctx));
  const delCampo = col.campo ? valorLinea(col.campo, ctx) : '';
  return delCampo || limpio(col.texto);
}
