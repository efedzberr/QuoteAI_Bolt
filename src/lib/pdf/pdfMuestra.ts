import type { QuoteData, QuoteLine } from '../../types/quote';
import type { DatosPdf } from './pdfDatos';

// Datos de ejemplo para la vista previa de la plantilla (Ajustes > PDF de cotización).
// La cuenta trae solo lo que hoy entrega Salesforce: lo demás sale vacío, igual que en una cotización real.

const linea = (codigo: string, nombre: string, cantidad: number, precio: number, um = 'PZ'): QuoteLine => ({
  original_text: nombre,
  original_code: codigo,
  matched_product_name: nombre,
  matched_product_code: codigo,
  confidence: 1,
  quantity: cantidad,
  matched_unit_of_measure: um,
  matched_unit_price: precio,
  needs_review: false,
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
    linea('NQ424AB225F-D150', 'TABLERO ENSAMBLADO 42P 225A', 1, 32050),
    linea('QO320S-O', 'CENTRO DE CARGA 20 POLOS 3F ZAPATAS PRINCIPALES CON TAPA', 3, 5541.4),
    linea('75T132H', 'TRANSFORMADOR 75 KVA TIPO SECO TRIFASICO 480V', 2, 62733.8),
    linea('QO240', 'INTERRUPTOR TERMOMAGNETICO 2P 40A 240V', 12, 572.6),
    linea('THW-12-NEG', 'CABLE THW CALIBRE 12 NEGRO', 300, 9.85, 'MT'),
    { ...linea('TC-34-PG', 'TUBO CONDUIT PARED GRUESA 3/4"', 40, 118.5, 'TR'), comentario: 'Entrega en dos parcialidades' },
  ],
};

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
};
