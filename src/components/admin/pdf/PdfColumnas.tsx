import { ArrowDown, ArrowUp, Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import { anchoTabla, type AlineacionPdf, type ColumnaPdf, type PdfConfig } from '../../../lib/pdf/pdfConfig';
import { esTextoCombinado } from '../../../lib/pdf/pdfDatos';
import { CAMPOS_LINEA, GRUPOS_LINEA, camposDeColumna, nombreCampoLinea, sugerenciaColumna } from '../../../lib/pdf/pdfLinea';
import { Campo } from './PdfControles';
import { acotar, claseBotonEliminar, claseBotonIcono, claseCampo, moverElemento, nuevoIdCelda } from './pdfEditorUtil';

// Por debajo de este ancho, una columna que toma el espacio que sobra (como la descripción) parte mucho su texto
const ANCHO_MINIMO_FLEXIBLE = 120;

const claseTextoCombinado =
  'w-full px-2.5 py-1.5 border border-rule rounded-lg font-mono text-[12px] leading-5 text-ink bg-white focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft transition resize-y';

/** Opciones del selector de dato de una columna, agrupadas. `vacio` es el texto de la opción sin dato. */
function OpcionesDato({ vacio }: { vacio: string }) {
  return (
    <>
      <option value="">{vacio}</option>
      {GRUPOS_LINEA.map((grupo) => (
        <optgroup key={grupo} label={grupo}>
          {CAMPOS_LINEA.filter((c) => c.grupo === grupo).map((c) => (
            <option key={c.clave} value={c.clave}>
              {c.etiqueta}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  );
}

/** Nombre de la columna en el editor: su dato, los datos que combina o su texto fijo. */
function nombreColumna(col: ColumnaPdf): string {
  if (esTextoCombinado(col.texto)) return camposDeColumna(col).map(nombreCampoLinea).join(' + ');
  if (col.campo) return nombreCampoLinea(col.campo);
  return col.texto ? `Texto fijo: ${col.texto}` : 'Texto fijo';
}

interface Props {
  columnas: ColumnaPdf[];
  pagina: PdfConfig['pagina'];
  onCambio: (columnas: ColumnaPdf[]) => void;
}

/**
 * Editor de las columnas de la tabla de productos: orden, dato, texto fijo o varios datos juntos,
 * título, ancho, alineación y si se imprime. Avisa cuando las columnas ya no caben en la hoja.
 */
export default function PdfColumnas({ columnas, pagina, onCambio }: Props) {
  const cambiar = (i: number, parcial: Partial<ColumnaPdf>) =>
    onCambio(columnas.map((c, k) => (k === i ? { ...c, ...parcial } : c)));

  // Al elegir otro dato, el título, el ancho y la alineación toman lo sugerido para él, salvo los que ya se
  // habían cambiado a mano. El texto fijo de una columna sin dato no se queda como texto de respaldo.
  const elegirDato = (i: number, campo: string) => {
    const col = columnas[i];
    const antes = sugerenciaColumna(col.campo);
    const despues = sugerenciaColumna(campo);
    cambiar(i, {
      campo,
      etiqueta: !col.etiqueta || col.etiqueta === antes.titulo ? despues.titulo : col.etiqueta,
      ancho: col.ancho === antes.ancho ? despues.ancho : col.ancho,
      alineacion: col.alineacion === antes.alineacion ? despues.alineacion : col.alineacion,
      texto: col.campo ? col.texto : '',
    });
  };

  // El primer dato que se agrega convierte la columna: su dato pasa al texto, entre llaves
  const agregarDato = (i: number, campo: string) => {
    if (!campo) return;
    const col = columnas[i];
    const base = esTextoCombinado(col.texto) ? col.texto : col.campo ? `{${col.campo}}` : col.texto;
    const separador = base && !/[\s/,(]$/.test(base) ? ' / ' : '';
    cambiar(i, { campo: '', texto: `${base}${separador}{${campo}}` });
  };

  const agregarColumna = () =>
    onCambio([...columnas, { id: nuevoIdCelda(), campo: '', etiqueta: '', ancho: 60, alineacion: 'left', visible: true, texto: '' }]);

  // Espacio de la tabla: las columnas con ancho fijo se restan y lo que sobra se reparte entre las de ancho 0
  const total = anchoTabla(pagina);
  const visibles = columnas.filter((c) => c.visible);
  const fijas = visibles.reduce((suma, c) => suma + (c.ancho > 0 ? c.ancho : 0), 0);
  const flexibles = visibles.filter((c) => c.ancho <= 0);
  const sobrante = total - fijas;
  const porFlexible = flexibles.length > 0 ? Math.floor(sobrante / flexibles.length) : 0;
  const nombresFlexibles = flexibles.map((c) => c.etiqueta || nombreColumna(c)).join(', ');

  let aviso: { tono: 'info' | 'warn' | 'bad'; texto: string };
  if (flexibles.length === 0) {
    aviso =
      fijas > total
        ? { tono: 'bad', texto: `Las columnas suman ${fijas} pt y la tabla mide ${total}: la tabla se sale de la hoja. Reduce el ancho de alguna u ocúltala.` }
        : { tono: 'info', texto: `Las columnas suman ${fijas} de los ${total} pt de la tabla.` };
  } else if (porFlexible < ANCHO_MINIMO_FLEXIBLE) {
    aviso = {
      tono: porFlexible < 40 ? 'bad' : 'warn',
      texto: `A ${nombresFlexibles} le quedan ${Math.max(0, porFlexible)} pt: el texto se partirá en muchos renglones. Reduce el ancho de otra columna, ocúltala o usa la hoja horizontal (sección Página).`,
    };
  } else {
    aviso = {
      tono: 'info',
      texto: `A ${nombresFlexibles} le ${flexibles.length > 1 ? 'tocan' : 'quedan'} ${porFlexible} pt${flexibles.length > 1 ? ' a cada una' : ''}, de los ${total} pt de la tabla.`,
    };
  }
  const claseAviso = { info: 'text-ink-soft bg-rule-soft', warn: 'text-warn bg-warn-soft', bad: 'text-bad bg-bad-soft' }[aviso.tono];

  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-faint">
        Las columnas se imprimen de izquierda a derecha en el orden de esta lista. Cada una imprime un dato de la partida, un texto
        fijo o varios datos juntos (con «Agregar otro dato a la columna»). El ancho va en puntos; con 0 la columna ocupa el espacio
        que sobra. El comentario de la partida sale debajo de la descripción, salvo que una columna ya lo imprima.
      </p>
      <p className={`text-xs rounded-lg px-3 py-2 ${claseAviso}`}>{aviso.texto}</p>

      <div className="space-y-2">
        {columnas.map((col, i) => (
          <div key={col.id} className={`border border-rule rounded-lg p-2 space-y-2 ${col.visible ? 'bg-white' : 'bg-rule-soft'}`}>
            <div className="flex items-center gap-1">
              <button
                type="button"
                title="Subir"
                aria-label="Subir columna"
                disabled={i === 0}
                onClick={() => onCambio(moverElemento(columnas, i, -1))}
                className={claseBotonIcono}
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                title="Bajar"
                aria-label="Bajar columna"
                disabled={i === columnas.length - 1}
                onClick={() => onCambio(moverElemento(columnas, i, 1))}
                className={claseBotonIcono}
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
              <span className="flex-1 min-w-0 px-1 text-sm font-semibold text-ink truncate" title={nombreColumna(col)}>
                {nombreColumna(col)}
              </span>
              <button
                type="button"
                title={col.visible ? 'Se imprime. Clic para ocultar' : 'No se imprime. Clic para mostrar'}
                aria-label={col.visible ? 'Ocultar columna' : 'Mostrar columna'}
                onClick={() => cambiar(i, { visible: !col.visible })}
                className={claseBotonIcono}
              >
                {col.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                title="Eliminar columna"
                aria-label="Eliminar columna"
                onClick={() => onCambio(columnas.filter((_, k) => k !== i))}
                className={claseBotonEliminar}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {esTextoCombinado(col.texto) ? (
              <textarea
                value={col.texto}
                rows={2}
                onChange={(e) => cambiar(i, { texto: e.target.value })}
                aria-label="Datos de la columna"
                title="Los datos van entre llaves. Lo demás se imprime tal cual; con Enter el siguiente dato baja de renglón."
                className={claseTextoCombinado}
              />
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <select value={col.campo} onChange={(e) => elegirDato(i, e.target.value)} aria-label="Dato de la columna" className={claseCampo}>
                  <OpcionesDato vacio="Texto fijo (igual en todas)" />
                </select>
                <input
                  value={col.texto}
                  onChange={(e) => cambiar(i, { texto: e.target.value })}
                  placeholder={col.campo ? 'Texto si el dato viene vacío' : 'Texto fijo'}
                  aria-label="Texto fijo"
                  className={claseCampo}
                />
              </div>
            )}
            <select
              value=""
              onChange={(e) => agregarDato(i, e.target.value)}
              aria-label="Agregar otro dato a la columna"
              className="w-full h-7 px-2 border border-dashed border-rule rounded-md text-xs text-ink-soft bg-white focus:outline-none focus:border-brand"
            >
              <OpcionesDato vacio="+ Agregar otro dato a la columna…" />
            </select>

            <div className="grid grid-cols-[minmax(0,1fr)_68px_104px] gap-2">
              <Campo etiqueta="Título">
                <input value={col.etiqueta} onChange={(e) => cambiar(i, { etiqueta: e.target.value })} className={claseCampo} />
              </Campo>
              <Campo etiqueta="Ancho">
                <input
                  type="number"
                  min={0}
                  max={400}
                  value={col.ancho}
                  onChange={(e) => cambiar(i, { ancho: acotar(parseInt(e.target.value, 10), 0, 400) })}
                  className={claseCampo}
                />
              </Campo>
              <Campo etiqueta="Alineación">
                <select
                  value={col.alineacion}
                  onChange={(e) => cambiar(i, { alineacion: e.target.value as AlineacionPdf })}
                  className={claseCampo}
                >
                  <option value="left">Izquierda</option>
                  <option value="center">Centro</option>
                  <option value="right">Derecha</option>
                </select>
              </Campo>
            </div>
          </div>
        ))}
      </div>

      <button type="button" onClick={agregarColumna} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:text-brand-deep">
        <Plus className="w-4 h-4" /> Agregar columna
      </button>
      <p className="text-xs text-ink-faint">
        Los datos del catálogo (marca, garantía, características…) se leen del catálogo vigente al generar el PDF. La existencia y la
        disponibilidad salen de lo guardado en cada partida.
      </p>
    </div>
  );
}
