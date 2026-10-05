import { Document, Page, Text, View, Image, Svg, Rect, StyleSheet, Font } from '@react-pdf/renderer';
import { styles, BORDER_COLOR } from './styles';
import { normalizeLines } from '../../lib/normalizeLines';
import type { QuoteData } from '../../types/quote';
import { resolverPdfConfig, type AlineacionPdf, type PdfConfig, type CeldaPdf, type ColumnaPdf } from '../../lib/pdf/pdfConfig';
import { DATOS_PDF_VACIOS, valorCampo, valorCelda, type DatosPdf } from '../../lib/pdf/pdfDatos';
import { importeConLetra } from '../../lib/pdf/numeroALetras';
import { codigo128 } from '../../lib/pdf/codigoBarras';
import { columnaDelComentario, valorColumna, type ContextoLinea } from '../../lib/pdf/pdfLinea';

interface QuoteDocumentProps {
  quoteData: QuoteData;
  pdfLogoUrl?: string | null;
  pdfLogoWidthPx?: number;
  pdfLogoHeightPx?: number;
  /** Plantilla del PDF (app_settings.pdf_config ya resuelta). Sin ella se usa la plantilla inicial. */
  config?: PdfConfig;
  /** Cuenta del cliente y quién elaboró la cotización. */
  datos?: DatosPdf;
}

type Linea = QuoteData['lines'][0];

// Las palabras no se parten con guion al final del renglón (por ejemplo «PRECIO UNI-TARIO»)
Font.registerHyphenationCallback((palabra) => [palabra]);

// Ancho de cada módulo del código de barras, en puntos (1 pt = 0.35 mm)
const MODULO_BARRAS = 1;

// Alineación del bloque de la empresa: dónde queda el logo dentro de su renglón
const ALINEACIONES: AlineacionPdf[] = ['left', 'center', 'right'];
const LOGO_EN_RENGLON = { left: 'flex-start', center: 'center', right: 'flex-end' } as const;

// Estilos de los elementos nuevos; el resto del diseño sigue en styles.ts
const extra = StyleSheet.create({
  marcaAgua: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bloqueFinal: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  finalIzquierda: {
    flex: 1,
    paddingRight: 12,
  },
  textoBarras: {
    fontSize: 7,
    letterSpacing: 2,
    textAlign: 'center',
    marginTop: 2,
  },
  totalArticulos: {
    fontSize: 8,
    marginTop: 8,
  },
  importeLetra: {
    fontSize: 7,
    marginTop: 4,
  },
  pie: {
    position: 'absolute',
    bottom: 15,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  pieIzquierda: { flex: 1, fontSize: 6, color: '#666666', textAlign: 'left' },
  pieCentro: { flex: 2, fontSize: 6, color: '#999999', textAlign: 'center' },
  pieDerecha: { flex: 1, fontSize: 6, color: '#666666', textAlign: 'right' },
});

function formatNumber(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function Header({
  quoteData,
  datos,
  config,
  pdfLogoUrl,
  pdfLogoWidthPx,
  pdfLogoHeightPx,
}: {
  quoteData: QuoteData;
  datos: DatosPdf;
  config: PdfConfig;
  pdfLogoUrl?: string | null;
  pdfLogoWidthPx?: number;
  pdfLogoHeightPx?: number;
}) {
  const filas = config.cuadro.filter((c) => c.visible);
  // Un valor guardado que no se reconoce se toma como izquierda
  const alineacion = ALINEACIONES.includes(config.empresa.alineacion) ? config.empresa.alineacion : 'left';
  const texto = { textAlign: alineacion };
  // Al centro o a la derecha, el bloque deja un espacio antes del cuadro de fecha y folio
  const separacion = alineacion !== 'left' && filas.length > 0 ? { paddingRight: 12 } : {};

  return (
    <View style={styles.headerRow}>
      <View style={[styles.headerLeft, separacion]}>
        {config.empresa.mostrarLogo && pdfLogoUrl && (
          <View style={[styles.logoRow, { justifyContent: LOGO_EN_RENGLON[alineacion] }]}>
            <Image
              src={pdfLogoUrl}
              style={{
                width: pdfLogoWidthPx ?? 200,
                height: pdfLogoHeightPx ?? 80,
                maxWidth: '100%',
                objectFit: 'contain',
                // La imagen se pega al lado elegido dentro de su recuadro. Sin esto queda centrada en él
                // y, alineada a la izquierda, no arranca en el mismo margen que el texto.
                objectPosition: `${alineacion} center`,
              }}
            />
          </View>
        )}
        {config.empresa.nombre ? <Text style={[styles.companyName, texto]}>{config.empresa.nombre}</Text> : null}
        {config.empresa.lineas.filter(Boolean).map((linea, i) => (
          <Text key={i} style={[styles.companyDetail, texto]}>{linea}</Text>
        ))}
        {config.empresa.sitioWeb ? <Text style={[styles.companyWebsite, texto]}>{config.empresa.sitioWeb}</Text> : null}
      </View>

      {filas.length > 0 && (
        <View style={styles.headerRight}>
          {filas.map((c, i) => (
            <View key={i} style={i === filas.length - 1 ? styles.headerInfoRowLast : styles.headerInfoRow}>
              <Text style={styles.headerInfoLabel}>{c.etiqueta}</Text>
              <Text style={styles.headerInfoValue}>{valorCelda(c, quoteData, datos)}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function BloqueCliente({
  titulo,
  lineas,
  textoSinDatos,
  quoteData,
  datos,
}: {
  titulo: string;
  lineas: CeldaPdf[];
  textoSinDatos: string;
  quoteData: QuoteData;
  datos: DatosPdf;
}) {
  // Los renglones sin dato no se imprimen
  const textos = lineas
    .filter((l) => l.visible)
    .map((l) => {
      const valor = valorCelda(l, quoteData, datos);
      if (!valor) return '';
      return l.etiqueta ? `${l.etiqueta} ${valor}` : valor;
    })
    .filter(Boolean);

  return (
    <View style={styles.soldToCol}>
      <Text style={styles.soldToLabel}>{titulo}</Text>
      {textos.map((t, i) => (
        <Text key={i} style={styles.soldToText}>{t}</Text>
      ))}
      {textos.length <= 1 && textoSinDatos ? <Text style={styles.soldToText}>{textoSinDatos}</Text> : null}
    </View>
  );
}

function SoldToSection({ quoteData, datos, config }: { quoteData: QuoteData; datos: DatosPdf; config: PdfConfig }) {
  return (
    <View style={styles.sectionSoldTo}>
      <BloqueCliente
        titulo={config.vendidoA.titulo}
        lineas={config.vendidoA.lineas}
        textoSinDatos={config.textoSinDatos}
        quoteData={quoteData}
        datos={datos}
      />
      {config.consignadoA.visible && <View style={styles.soldToDivider} />}
      {config.consignadoA.visible && (
        <BloqueCliente
          titulo={config.consignadoA.titulo}
          lineas={config.consignadoA.lineas}
          textoSinDatos={config.textoSinDatos}
          quoteData={quoteData}
          datos={datos}
        />
      )}
    </View>
  );
}

function OrderDataSection({ quoteData, datos, config }: { quoteData: QuoteData; datos: DatosPdf; config: PdfConfig }) {
  const celdas = config.pedido.celdas.filter((c) => c.visible);
  if (!config.pedido.visible || celdas.length === 0) return null;
  const ultima = celdas.length - 1;

  return (
    <View style={styles.orderSection}>
      <View style={styles.orderHeaderRow}>
        {celdas.map((c, i) => (
          <Text key={i} style={i === ultima ? styles.orderCellBoldLast : styles.orderCellBold}>{c.etiqueta}</Text>
        ))}
      </View>
      <View style={styles.orderDataRow}>
        {celdas.map((c, i) => (
          <Text key={i} style={i === ultima ? styles.orderCellLast : styles.orderCell}>{valorCelda(c, quoteData, datos)}</Text>
        ))}
      </View>
    </View>
  );
}

function estiloColumna(col: ColumnaPdf, ultima: boolean) {
  return {
    ...(col.ancho > 0 ? { width: col.ancho } : { flex: 1 }),
    padding: 4,
    fontSize: 7,
    textAlign: col.alineacion,
    ...(ultima ? {} : { borderRightWidth: 1, borderRightColor: BORDER_COLOR }),
  };
}

function TableHeaderRow({ columnas }: { columnas: ColumnaPdf[] }) {
  return (
    <View style={styles.tableHeader} fixed>
      {columnas.map((col, i) => (
        <View key={i} style={estiloColumna(col, i === columnas.length - 1)}>
          <Text style={styles.colHeaderText}>{col.etiqueta}</Text>
        </View>
      ))}
    </View>
  );
}

function TableRow({
  line,
  index,
  columnas,
  sinFondo,
  tasaIva,
  datos,
  columnaComentario,
}: {
  line: Linea;
  index: number;
  columnas: ColumnaPdf[];
  sinFondo: boolean;
  tasaIva: number;
  datos: DatosPdf;
  /** Columna que lleva el comentario de la partida debajo de su texto (-1 = ninguna). */
  columnaComentario: number;
}) {
  // Con marca de agua los renglones van sin fondo alterno, para no taparla
  const rowStyle = index % 2 === 1 && !sinFondo ? styles.tableRowAlt : styles.tableRow;
  const comentario = line.comentario;
  const contexto: ContextoLinea = { linea: line, indice: index, tasaIva, catalogo: datos.catalogo };

  return (
    <View style={rowStyle} wrap={false}>
      {columnas.map((col, i) => (
        <View key={i} style={estiloColumna(col, i === columnas.length - 1)}>
          <Text>{valorColumna(col, contexto)}</Text>
          {i === columnaComentario && comentario ? (
            <Text style={{ fontSize: 6, color: '#6B7280', marginTop: 2 }}>{comentario}</Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function CodigoDeBarras({ valor, alto, mostrarTexto }: { valor: string; alto: number; mostrarTexto: boolean }) {
  const codigo = codigo128(valor);
  if (!codigo) return null;
  const ancho = codigo.modulos * MODULO_BARRAS;

  return (
    <View style={{ width: ancho }}>
      <Svg width={ancho} height={alto}>
        {codigo.barras.map((b, i) => (
          <Rect key={i} x={b.x * MODULO_BARRAS} y={0} width={b.ancho * MODULO_BARRAS} height={alto} fill="#000000" />
        ))}
      </Svg>
      {mostrarTexto ? <Text style={extra.textoBarras}>{valor}</Text> : null}
    </View>
  );
}

function TotalsSection({
  subtotal,
  articulos,
  quoteData,
  datos,
  config,
}: {
  subtotal: number;
  articulos: number;
  quoteData: QuoteData;
  datos: DatosPdf;
  config: PdfConfig;
}) {
  const t = config.totales;
  const descuentos = 0;
  const total = subtotal - descuentos;
  const iva = total * t.tasaIva;
  const totalFinal = total + iva;
  const valorBarras = config.codigoBarras.visible ? valorCampo(config.codigoBarras.campo, quoteData, datos) : '';

  const filas: { etiqueta: string; valor: number }[] = [{ etiqueta: t.etiquetaSubtotal, valor: subtotal }];
  if (t.mostrarDescuentos) {
    filas.push({ etiqueta: t.etiquetaDescuentos, valor: descuentos });
    filas.push({ etiqueta: t.etiquetaTotal, valor: total });
  }
  filas.push({ etiqueta: t.etiquetaIva, valor: iva });

  return (
    <View style={extra.bloqueFinal} wrap={false}>
      <View style={extra.finalIzquierda}>
        {valorBarras ? (
          <CodigoDeBarras valor={valorBarras} alto={config.codigoBarras.alto} mostrarTexto={config.codigoBarras.mostrarTexto} />
        ) : null}
        {t.totalArticulos ? (
          <Text style={extra.totalArticulos}>{t.etiquetaTotalArticulos}: {articulos.toLocaleString('en-US')}</Text>
        ) : null}
        {t.importeConLetra ? (
          <Text style={extra.importeLetra}>({importeConLetra(totalFinal, quoteData.currency)})</Text>
        ) : null}
      </View>
      <View style={styles.totalsBox}>
        {filas.map((f, i) => (
          <View key={i} style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>{f.etiqueta}</Text>
            <Text style={styles.totalsValue}>${formatNumber(f.valor)}</Text>
          </View>
        ))}
        <View style={styles.totalsRowLast}>
          <Text style={styles.totalsLabelBold}>{t.etiquetaTotalFinal}</Text>
          <Text style={styles.totalsValueBold}>${formatNumber(totalFinal)}</Text>
        </View>
      </View>
    </View>
  );
}

function Pie({ config }: { config: PdfConfig }) {
  return (
    <View style={extra.pie} fixed>
      <Text style={extra.pieIzquierda}>{config.pie.leyenda}</Text>
      <Text style={extra.pieCentro}>{config.pie.textoCentro}</Text>
      <Text
        style={extra.pieDerecha}
        render={({ pageNumber, totalPages }) => (config.pie.mostrarPagina ? `${pageNumber} de ${totalPages}` : '')}
      />
    </View>
  );
}

export default function QuoteDocument({ quoteData, pdfLogoUrl, pdfLogoWidthPx, pdfLogoHeightPx, config, datos }: QuoteDocumentProps) {
  const cfg = config ?? resolverPdfConfig(null);
  const dat = datos ?? DATOS_PDF_VACIOS;
  const normalizedLinesList = normalizeLines(quoteData.lines);
  const activeLines = normalizedLinesList.filter((l) => !l.ignored);
  const subtotal = activeLines.reduce((sum, line) => {
    return sum + (line.quantity || 0) * (line.matched_unit_price || 0);
  }, 0);
  const articulos = activeLines.reduce((sum, line) => sum + (Number(line.quantity) || 0), 0);
  const columnas = cfg.columnas.filter((c) => c.visible);
  const columnaComentario = columnaDelComentario(columnas);
  const conMarcaAgua = cfg.marcaAgua.visible && !!cfg.marcaAgua.url;

  return (
    <Document>
      <Page size={cfg.pagina.tamano} orientation={cfg.pagina.orientacion} style={styles.page}>
        {/* La marca de agua va primero para quedar detrás del contenido, en todas las páginas */}
        {conMarcaAgua ? (
          <View style={extra.marcaAgua} fixed>
            <Image src={cfg.marcaAgua.url} style={{ width: `${cfg.marcaAgua.anchoPct}%`, opacity: cfg.marcaAgua.opacidad }} />
          </View>
        ) : null}

        <Header
          quoteData={quoteData}
          datos={dat}
          config={cfg}
          pdfLogoUrl={pdfLogoUrl}
          pdfLogoWidthPx={pdfLogoWidthPx}
          pdfLogoHeightPx={pdfLogoHeightPx}
        />
        <SoldToSection quoteData={quoteData} datos={dat} config={cfg} />
        <OrderDataSection quoteData={quoteData} datos={dat} config={cfg} />

        {columnas.length > 0 && (
          <View style={styles.tableContainer}>
            <TableHeaderRow columnas={columnas} />
            {activeLines.map((line, index) => (
              <TableRow
                key={index}
                line={line}
                index={index}
                columnas={columnas}
                sinFondo={conMarcaAgua}
                tasaIva={cfg.totales.tasaIva}
                datos={dat}
                columnaComentario={columnaComentario}
              />
            ))}
          </View>
        )}

        <TotalsSection subtotal={subtotal} articulos={articulos} quoteData={quoteData} datos={dat} config={cfg} />

        <Pie config={cfg} />
      </Page>
    </Document>
  );
}
