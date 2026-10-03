// Configuración del PDF de cotización: una sola plantilla para toda la empresa.
// Se guarda en app_settings.pdf_config. Lo que no esté guardado toma los valores iniciales
// de configInicialPdf(), que reproducen el diseño actual más los elementos nuevos.

export type TamanoPagina = 'LETTER' | 'A4' | 'LEGAL';
export type OrientacionPagina = 'portrait' | 'landscape';
export type AlineacionPdf = 'left' | 'center' | 'right';

/** Celda o renglón con un dato: un campo de la cotización, un texto fijo o ambos. */
export interface CeldaPdf {
  id: string;
  /** Título de la celda. En los bloques de cliente es el prefijo del renglón (por ejemplo "Tel."). */
  etiqueta: string;
  /** Clave del campo (ver CAMPOS_PDF en pdfDatos.ts). Vacío = solo texto fijo. */
  campo: string;
  /**
   * Texto fijo: se usa cuando no hay campo o cuando el campo viene vacío.
   * Si trae datos entre llaves (`{cliente_ciudad}, {cliente_estado}`) combina varios datos en el renglón y el campo no se usa.
   */
  texto: string;
  visible: boolean;
}

export type ClaveColumnaPdf = 'partida' | 'clave' | 'descripcion' | 'almacen' | 'um' | 'cantidad' | 'precio' | 'importe';

export interface ColumnaPdf {
  id: string;
  clave: ClaveColumnaPdf;
  etiqueta: string;
  /** Ancho en puntos. 0 = toma el espacio que sobra. */
  ancho: number;
  alineacion: AlineacionPdf;
  visible: boolean;
  /** Valor fijo para todas las líneas (solo lo usa la columna Almacén). */
  texto: string;
}

export interface PdfConfig {
  pagina: { tamano: TamanoPagina; orientacion: OrientacionPagina };
  /** Encabezado, lado izquierdo: logo y datos de la empresa. */
  empresa: { mostrarLogo: boolean; nombre: string; lineas: string[]; sitioWeb: string };
  /** Encabezado, lado derecho: cuadro con fecha, referencia, etc. */
  cuadro: CeldaPdf[];
  vendidoA: { titulo: string; lineas: CeldaPdf[] };
  consignadoA: { visible: boolean; titulo: string; lineas: CeldaPdf[] };
  /** Segundo renglón de los bloques de cliente cuando solo hay nombre. */
  textoSinDatos: string;
  /** Renglón de datos del pedido (pedido, orden de compra, condiciones de pago…). */
  pedido: { visible: boolean; celdas: CeldaPdf[] };
  /** Columnas de la tabla de productos, en el orden en que se imprimen. */
  columnas: ColumnaPdf[];
  totales: {
    tasaIva: number;
    /** Muestra los renglones Descuentos y Total (antes de IVA), como en JDE. */
    mostrarDescuentos: boolean;
    etiquetaSubtotal: string;
    etiquetaDescuentos: string;
    etiquetaTotal: string;
    etiquetaIva: string;
    etiquetaTotalFinal: string;
    importeConLetra: boolean;
    totalArticulos: boolean;
    etiquetaTotalArticulos: string;
  };
  codigoBarras: { visible: boolean; campo: string; mostrarTexto: boolean; alto: number };
  /** Imagen de fondo en todas las páginas, detrás del contenido. Sin imagen no se dibuja. */
  marcaAgua: { visible: boolean; url: string; opacidad: number; anchoPct: number };
  pie: { leyenda: string; textoCentro: string; mostrarPagina: boolean };
}

const celda = (id: string, etiqueta: string, campo: string, texto = ''): CeldaPdf => ({ id, etiqueta, campo, texto, visible: true });

const columna = (
  clave: ClaveColumnaPdf,
  etiqueta: string,
  ancho: number,
  alineacion: AlineacionPdf,
  visible = true,
  texto = ''
): ColumnaPdf => ({ id: clave, clave, etiqueta, ancho, alineacion, visible, texto });

/** Plantilla inicial: el diseño actual de QuoteAI más los elementos del PDF de JDE. */
export function configInicialPdf(): PdfConfig {
  return {
    pagina: { tamano: 'LETTER', orientacion: 'portrait' },
    empresa: {
      mostrarLogo: true,
      nombre: 'IMPULSORA INDUSTRIAL MONTERREY, SA DE CV',
      lineas: [
        'Carretera Miguel Aleman 1500',
        'Valle de Huinala. Apodaca, Nuevo Leon, Mexico C.P. 66634',
        'R.F.C. IIM651101EVA',
      ],
      sitioWeb: 'impulsora.com',
    },
    cuadro: [
      celda('fecha', 'FECHA', 'fecha'),
      celda('referencia', 'REFERENCIA', 'folio'),
      celda('cotizacion', 'COTIZACION', 'numero'),
      celda('proyecto', 'PROYECTO', 'proyecto', '—'),
    ],
    vendidoA: {
      titulo: 'VENDIDO A',
      lineas: [
        celda('cliente', '', 'cliente'),
        celda('rfc', 'R.F.C.', 'cliente_rfc'),
        celda('direccion1', '', '', '{cliente_calle}, {cliente_ciudad}'),
        celda('direccion2', '', '', '{cliente_estado}, {cliente_pais}, C.P. {cliente_cp}'),
        celda('telefono', 'Tel.', 'cliente_telefono'),
        celda('contacto', 'Contacto:', 'contacto_nombre'),
        celda('correo', '', 'contacto_correo'),
      ],
    },
    consignadoA: {
      visible: true,
      titulo: 'CONSIGNADO A',
      lineas: [
        celda('cliente', '', 'cliente'),
        celda('direccion1', '', '', '{cliente_calle}, {cliente_ciudad}'),
        celda('direccion2', '', '', '{cliente_estado}, {cliente_pais}, C.P. {cliente_cp}'),
        celda('telefono', 'Tel.', 'cliente_telefono'),
      ],
    },
    textoSinDatos: '---',
    pedido: {
      visible: true,
      celdas: [
        celda('pedido', 'PEDIDO #', 'pedido'),
        celda('orden_compra', 'ORDEN DE COMPRA', ''),
        celda('condiciones_pago', 'CONDICIONES DE PAGO', 'condiciones_pago'),
        celda('transporte', 'TRANSPORTE', ''),
        celda('agente', 'AGENTE', 'agente'),
        celda('elaboro', 'ELABORO', 'elaboro'),
        celda('zona', 'ZONA', 'zona'),
      ],
    },
    columnas: [
      columna('partida', '#', 24, 'center', false),
      columna('clave', 'CLAVE', 70, 'left'),
      columna('descripcion', 'DESCRIPCION', 0, 'left'),
      columna('almacen', 'ALMACEN', 55, 'center', true, '1080'),
      columna('um', 'U.M.', 35, 'center'),
      columna('cantidad', 'CANTIDAD', 55, 'center'),
      columna('precio', 'PRECIO UNITARIO', 70, 'right'),
      columna('importe', 'IMPORTE', 70, 'right'),
    ],
    totales: {
      tasaIva: 0.16,
      mostrarDescuentos: true,
      etiquetaSubtotal: 'Subtotal',
      etiquetaDescuentos: 'Descuentos',
      etiquetaTotal: 'Total',
      etiquetaIva: 'IVA (16%)',
      etiquetaTotalFinal: 'TOTAL COTIZACIÓN',
      importeConLetra: true,
      totalArticulos: true,
      etiquetaTotalArticulos: 'Total de artículos',
    },
    codigoBarras: { visible: true, campo: 'folio_sin_espacio', mostrarTexto: true, alto: 26 },
    marcaAgua: { visible: false, url: '', opacidad: 1, anchoPct: 100 },
    pie: {
      leyenda: 'Este documento NO tiene una Validez Fiscal',
      textoCentro: 'Documento generado por QuoteAI - Impulsora Industrial Monterrey, SA de CV',
      mostrarPagina: true,
    },
  };
}

// Combina lo guardado con los valores iniciales: los objetos se combinan clave por clave,
// las listas guardadas sustituyen a la inicial completa y un tipo distinto al esperado se descarta.
function combinar<T>(base: T, guardado: unknown): T {
  if (Array.isArray(base)) return (Array.isArray(guardado) ? guardado : base) as T;
  if (base !== null && typeof base === 'object') {
    if (guardado === null || typeof guardado !== 'object' || Array.isArray(guardado)) return base;
    const salida: Record<string, unknown> = {};
    for (const clave of Object.keys(base as Record<string, unknown>)) {
      salida[clave] = combinar((base as Record<string, unknown>)[clave], (guardado as Record<string, unknown>)[clave]);
    }
    return salida as T;
  }
  return (typeof guardado === typeof base ? guardado : base) as T;
}

/** Configuración completa a partir de lo guardado en app_settings.pdf_config (puede venir vacío o nulo). */
export function resolverPdfConfig(guardado: unknown): PdfConfig {
  return combinar(configInicialPdf(), guardado);
}
