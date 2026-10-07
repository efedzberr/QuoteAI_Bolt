import type { QuoteData } from '../../types/quote';
import type { DatosPdf, ProductoCatalogo } from './pdfDatos';
import type { LineaPdf } from './pdfLinea';

// Datos de ejemplo para la vista previa de la plantilla (Ajustes > PDF de cotización).
// La cuenta trae solo lo que hoy entrega Salesforce: lo demás sale vacío, igual que en una cotización real.
// Cada partida trae lo que pidió el cliente, su precio de lista y su existencia, para que cualquier columna
// muestre un valor.

const linea = (
  codigo: string,
  nombre: string,
  cantidad: number,
  precio: number,
  um: string,
  pedido: [codigo: string, texto: string],
  precioLista: number,
  existencia: number
): LineaPdf => ({
  original_text: pedido[1],
  original_code: pedido[0],
  matched_product_name: nombre,
  matched_product_code: codigo,
  confidence: 1,
  quantity: cantidad,
  matched_unit_of_measure: um,
  matched_unit_price: precio,
  needs_review: false,
  precio_lista: precioLista,
  inventario_total: existencia,
});

export const COTIZACION_MUESTRA: QuoteData = {
  quoteReference: 'QAI-1790864620688',
  customerName: 'CLIENTE DE EJEMPLO SA DE CV',
  projectName: 'Proyecto de ejemplo',
  generatedDate: '01/10/2026',
  totalLines: 6,
  currency: 'MXN',
  subtotal: 0,
  lines: [
    linea('NQ424AB225F-D150', 'TABLERO ENSAMBLADO 42P 225A', 1, 32050, 'PZ', ['TAB-42', 'Tablero 42 polos 225 A'], 35611.11, 2),
    linea('QO320S-O', 'CENTRO DE CARGA 20 POLOS 3F ZAPATAS PRINCIPALES CON TAPA', 3, 5541.4, 'PZ', ['CC-20', 'Centro de carga 20 polos trifásico'], 6157.11, 1),
    linea('75T132H', 'TRANSFORMADOR 75 KVA TIPO SECO TRIFASICO 480V', 2, 62733.8, 'PZ', ['TR-75', 'Transformador seco 75 kVA 480 V'], 69704.22, 0),
    linea('QO240', 'INTERRUPTOR TERMOMAGNETICO 2P 40A 240V', 12, 572.6, 'PZ', ['INT-240', 'Pastilla 2 x 40'], 636.22, 85),
    linea('THW-12-NEG', 'CABLE THW CALIBRE 12 NEGRO', 300, 9.85, 'MT', ['CAB-12N', 'Cable calibre 12 negro'], 10.94, 1200),
    {
      ...linea('TC-34-PG', 'TUBO CONDUIT PARED GRUESA 3/4"', 40, 118.5, 'TR', ['TUB-34', 'Tubo conduit 3/4 pared gruesa'], 131.67, 25),
      comentario: 'Entrega en dos parcialidades',
    },
  ],
};

const articulo = (
  marca: string,
  descripcionLarga: string,
  garantia: string,
  codigoBarras: string,
  departamento: string,
  categoria: string,
  atributos: string[]
): ProductoCatalogo => ({
  marca,
  descripcionLarga,
  garantia,
  codigoBarras,
  departamento,
  categoria,
  subcategoria: '',
  peso: '',
  precio: null,
  atributos,
});

export const DATOS_MUESTRA: DatosPdf = {
  cuenta: {
    name: 'CLIENTE DE EJEMPLO SA DE CV',
    noCliente: '123456',
    calle: 'Av. Ejemplo 100 Pte.',
    estado: 'Nuevo León',
    rfc: 'XAXX010101000',
    billingStreet: 'Av. Ejemplo 100 Pte.\nCol. Centro',
    billingCity: 'Monterrey',
    billingState: 'Nuevo León',
    billingPostalCode: '64000',
    billingCountry: 'México',
    phone: '8112345678',
    primaryContactName: 'NOMBRE DEL CONTACTO',
    primaryContactEmail: 'contacto@ejemplo.com',
  },
  elaboro: 'Nombre del usuario',
  elaboroCorreo: 'usuario@impulsora.com',
  transporte: 'ENTREGA A DOMICILIO',
  ordenCompra: 'OC-000123',
  catalogo: {
    'NQ424AB225F-D150': articulo('MARCA DE EJEMPLO', 'Tablero de alumbrado ensamblado de 42 polos, 225 A, con interruptor principal', '1 año', '7501000000011', 'Distribución', 'Tableros', ['42P', '225 A']),
    'QO320S-O': articulo('MARCA DE EJEMPLO', 'Centro de carga de 20 polos, 3 fases, zapatas principales, con tapa', '1 año', '7501000000028', 'Distribución', 'Centros de carga', ['20P', '3F']),
    '75T132H': articulo('MARCA DE EJEMPLO', 'Transformador tipo seco de 75 kVA, trifásico, 480 V', '2 años', '7501000000035', 'Transformación', 'Transformadores', ['75 kVA', '480 V']),
    QO240: articulo('MARCA DE EJEMPLO', 'Interruptor termomagnético de 2 polos, 40 A, 240 V', '1 año', '7501000000042', 'Protección', 'Interruptores', ['2P', '40 A']),
    'THW-12-NEG': articulo('OTRA MARCA', 'Cable THW calibre 12 AWG, color negro', '', '7501000000059', 'Conductores', 'Cable de cobre', ['Cal. 12', 'Negro']),
    'TC-34-PG': articulo('OTRA MARCA', 'Tubo conduit galvanizado pared gruesa de 3/4"', '', '7501000000066', 'Canalización', 'Tubería', ['3/4"']),
  },
};
