import { Document, Page, Text, View, Image } from '@react-pdf/renderer';
import { styles } from './styles';
import { normalizeLines } from '../../lib/normalizeLines';
import type { QuoteData } from '../../types/quote';

interface QuoteDocumentProps {
  quoteData: QuoteData;
  pdfLogoUrl?: string | null;
  pdfLogoWidthPx?: number;
  pdfLogoHeightPx?: number;
}

function formatNumber(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function Header({
  quoteData,
  pdfLogoUrl,
  pdfLogoWidthPx,
  pdfLogoHeightPx,
}: {
  quoteData: QuoteData;
  pdfLogoUrl?: string | null;
  pdfLogoWidthPx?: number;
  pdfLogoHeightPx?: number;
}) {
  const refNumber = quoteData.quoteReference.replace(/[^0-9]/g, '') || quoteData.quoteReference;

  return (
    <View style={styles.headerRow}>
      <View style={styles.headerLeft}>
        {pdfLogoUrl && (
          <View style={styles.logoRow}>
            <Image
              src={pdfLogoUrl}
              style={{
                width: pdfLogoWidthPx ?? 200,
                height: pdfLogoHeightPx ?? 80,
                objectFit: 'contain',
              }}
            />
          </View>
        )}
        <Text style={styles.companyName}>IMPULSORA INDUSTRIAL MONTERREY, SA DE CV</Text>
        <Text style={styles.companyDetail}>Carretera Miguel Aleman 1500</Text>
        <Text style={styles.companyDetail}>Valle de Huinala. Apodaca, Nuevo Leon, Mexico C.P. 66634</Text>
        <Text style={styles.companyDetail}>R.F.C. IIM651101EVA</Text>
        <Text style={styles.companyWebsite}>impulsora.com</Text>
      </View>

      <View style={styles.headerRight}>
        <View style={styles.headerInfoRow}>
          <Text style={styles.headerInfoLabel}>FECHA</Text>
          <Text style={styles.headerInfoValue}>{quoteData.generatedDate}</Text>
        </View>
        <View style={styles.headerInfoRow}>
          <Text style={styles.headerInfoLabel}>REFERENCIA</Text>
          <Text style={styles.headerInfoValue}>SQ {refNumber}</Text>
        </View>
        <View style={styles.headerInfoRowLast}>
          <Text style={styles.headerInfoLabel}>COTIZACION</Text>
          <Text style={styles.headerInfoValue}>{refNumber}</Text>
        </View>
      </View>
    </View>
  );
}

function SoldToSection({ quoteData }: { quoteData: QuoteData }) {
  return (
    <View style={styles.sectionSoldTo}>
      <View style={styles.soldToCol}>
        <Text style={styles.soldToLabel}>VENDIDO A</Text>
        <Text style={styles.soldToText}>{quoteData.customerName}</Text>
        <Text style={styles.soldToText}>---</Text>
      </View>
      <View style={styles.soldToDivider} />
      <View style={styles.soldToCol}>
        <Text style={styles.soldToLabel}>CONSIGNADO A</Text>
        <Text style={styles.soldToText}>{quoteData.customerName}</Text>
        <Text style={styles.soldToText}>---</Text>
      </View>
    </View>
  );
}

function OrderDataSection({ quoteData }: { quoteData: QuoteData }) {
  const refNumber = quoteData.quoteReference.replace(/[^0-9]/g, '') || quoteData.quoteReference;

  return (
    <View style={styles.orderSection}>
      <View style={styles.orderHeaderRow}>
        <Text style={styles.orderCellBold}>PEDIDO #</Text>
        <Text style={styles.orderCellBold}>ORDEN DE COMPRA</Text>
        <Text style={styles.orderCellBold}>CONDICIONES DE PAGO</Text>
        <Text style={styles.orderCellBold}>TRANSPORTE</Text>
        <Text style={styles.orderCellBold}>AGENTE</Text>
        <Text style={styles.orderCellBold}>ELABORO</Text>
        <Text style={styles.orderCellBoldLast}>ZONA</Text>
      </View>
      <View style={styles.orderDataRow}>
        <Text style={styles.orderCell}>{refNumber} SQ</Text>
        <Text style={styles.orderCell}></Text>
        <Text style={styles.orderCell}>Neto a 45 dias</Text>
        <Text style={styles.orderCell}></Text>
        <Text style={styles.orderCell}>36214</Text>
        <Text style={styles.orderCell}>RARIZPE</Text>
        <Text style={styles.orderCellLast}>999</Text>
      </View>
    </View>
  );
}

function TableHeaderRow() {
  return (
    <View style={styles.tableHeader}>
      <View style={styles.colClave}>
        <Text style={styles.colHeaderText}>CLAVE</Text>
      </View>
      <View style={styles.colDescripcion}>
        <Text style={styles.colHeaderText}>DESCRIPCION</Text>
      </View>
      <View style={styles.colAlmacen}>
        <Text style={styles.colHeaderText}>ALMACEN</Text>
      </View>
      <View style={styles.colUM}>
        <Text style={styles.colHeaderText}>U.M.</Text>
      </View>
      <View style={styles.colCantidad}>
        <Text style={styles.colHeaderText}>CANTIDAD</Text>
      </View>
      <View style={styles.colPrecio}>
        <Text style={styles.colHeaderText}>PRECIO{'\n'}UNITARIO</Text>
      </View>
      <View style={styles.colImporte}>
        <Text style={styles.colHeaderText}>IMPORTE</Text>
      </View>
    </View>
  );
}

function TableRow({ line, index }: { line: QuoteData['lines'][0]; index: number }) {
  const importe = (line.quantity || 0) * (line.matched_unit_price || 0);
  const rowStyle = index % 2 === 1 ? styles.tableRowAlt : styles.tableRow;
  const comentario = (line as any).comentario;

  return (
    <View style={rowStyle} wrap={false}>
      <View style={styles.colClave}>
        <Text>{line.matched_product_code || 'Especial'}</Text>
      </View>
      <View style={styles.colDescripcion}>
        <Text>{line.matched_product_name || ''}</Text>
        {comentario ? (
          <Text style={{ fontSize: 6, color: '#6B7280', marginTop: 2 }}>{comentario}</Text>
        ) : null}
      </View>
      <View style={styles.colAlmacen}>
        <Text>1080</Text>
      </View>
      <View style={styles.colUM}>
        <Text>{line.matched_unit_of_measure || 'PZ'}</Text>
      </View>
      <View style={styles.colCantidad}>
        <Text>{line.quantity}</Text>
      </View>
      <View style={styles.colPrecio}>
        <Text>{line.matched_unit_price !== null ? formatNumber(line.matched_unit_price) : '0.00'}</Text>
      </View>
      <View style={styles.colImporte}>
        <Text>{formatNumber(importe)}</Text>
      </View>
    </View>
  );
}

function TotalsSection({ subtotal }: { subtotal: number }) {
  const iva = subtotal * 0.16;
  const total = subtotal + iva;

  return (
    <View style={styles.totalsContainer}>
      <View style={styles.totalsBox}>
        <View style={styles.totalsRow}>
          <Text style={styles.totalsLabel}>Subtotal</Text>
          <Text style={styles.totalsValue}>${formatNumber(subtotal)}</Text>
        </View>
        <View style={styles.totalsRow}>
          <Text style={styles.totalsLabel}>IVA (16%)</Text>
          <Text style={styles.totalsValue}>${formatNumber(iva)}</Text>
        </View>
        <View style={styles.totalsRowLast}>
          <Text style={styles.totalsLabelBold}>TOTAL</Text>
          <Text style={styles.totalsValueBold}>${formatNumber(total)}</Text>
        </View>
      </View>
    </View>
  );
}

export default function QuoteDocument({ quoteData, pdfLogoUrl, pdfLogoWidthPx, pdfLogoHeightPx }: QuoteDocumentProps) {
  const normalizedLinesList = normalizeLines(quoteData.lines);
  const activeLines = normalizedLinesList.filter((l) => !l.ignored);
  const subtotal = activeLines.reduce((sum, line) => {
    return sum + (line.quantity || 0) * (line.matched_unit_price || 0);
  }, 0);

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Header quoteData={quoteData} pdfLogoUrl={pdfLogoUrl} pdfLogoWidthPx={pdfLogoWidthPx} pdfLogoHeightPx={pdfLogoHeightPx} />
        <SoldToSection quoteData={quoteData} />
        <OrderDataSection quoteData={quoteData} />

        <View style={styles.tableContainer}>
          <TableHeaderRow />
          {activeLines.map((line, index) => (
            <TableRow key={index} line={line} index={index} />
          ))}
        </View>

        <TotalsSection subtotal={subtotal} />

        <Text style={styles.footer}>
          Documento generado por QuoteAI - Impulsora Industrial Monterrey, SA de CV
        </Text>
      </Page>
    </Document>
  );
}
