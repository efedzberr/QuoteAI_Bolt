import { ArrowDown, ArrowUp, Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import type { CeldaPdf } from '../../../lib/pdf/pdfConfig';
import { CAMPOS_PDF } from '../../../lib/pdf/pdfDatos';
import { claseBotonEliminar, claseBotonIcono, claseCampo, moverElemento, nuevoIdCelda } from './pdfEditorUtil';

const GRUPOS = ['Cotización', 'Cliente', 'Usuario'] as const;

/** Opciones del selector de dato, agrupadas. `vacio` es el texto de la opción sin dato. */
export function OpcionesCampo({ vacio }: { vacio: string }) {
  return (
    <>
      <option value="">{vacio}</option>
      {GRUPOS.map((grupo) => (
        <optgroup key={grupo} label={grupo}>
          {CAMPOS_PDF.filter((c) => c.grupo === grupo).map((c) => (
            <option key={c.clave} value={c.clave}>
              {c.etiqueta}{c.disponible ? '' : ' (aún sin dato)'}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  );
}

interface Props {
  celdas: CeldaPdf[];
  onCambio: (celdas: CeldaPdf[]) => void;
  /** Cómo se llama el texto que acompaña al dato: «Título» en las celdas, «Prefijo» en los renglones del cliente. */
  nombreEtiqueta: string;
  textoAgregar: string;
}

/** Editor de una lista de celdas o renglones: orden, título, dato, texto fijo y si se imprime. */
export default function PdfListaCeldas({ celdas, onCambio, nombreEtiqueta, textoAgregar }: Props) {
  const cambiar = (i: number, parcial: Partial<CeldaPdf>) =>
    onCambio(celdas.map((c, k) => (k === i ? { ...c, ...parcial } : c)));

  return (
    <div className="space-y-2">
      {celdas.map((c, i) => (
        <div key={c.id} className={`border border-rule rounded-lg p-2 space-y-2 ${c.visible ? 'bg-white' : 'bg-rule-soft'}`}>
          <div className="flex items-center gap-1">
            <button type="button" title="Subir" aria-label="Subir" disabled={i === 0} onClick={() => onCambio(moverElemento(celdas, i, -1))} className={claseBotonIcono}>
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
            <button type="button" title="Bajar" aria-label="Bajar" disabled={i === celdas.length - 1} onClick={() => onCambio(moverElemento(celdas, i, 1))} className={claseBotonIcono}>
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
            <input
              value={c.etiqueta}
              onChange={(e) => cambiar(i, { etiqueta: e.target.value })}
              placeholder={nombreEtiqueta}
              aria-label={nombreEtiqueta}
              className={`${claseCampo} flex-1 min-w-0`}
            />
            <button
              type="button"
              title={c.visible ? 'Se imprime. Clic para ocultar' : 'No se imprime. Clic para mostrar'}
              aria-label={c.visible ? 'Ocultar' : 'Mostrar'}
              onClick={() => cambiar(i, { visible: !c.visible })}
              className={claseBotonIcono}
            >
              {c.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            </button>
            <button type="button" title="Eliminar" aria-label="Eliminar" onClick={() => onCambio(celdas.filter((_, k) => k !== i))} className={claseBotonEliminar}>
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select value={c.campo} onChange={(e) => cambiar(i, { campo: e.target.value })} aria-label="Dato" className={claseCampo}>
              <OpcionesCampo vacio="Sin dato (solo texto fijo)" />
            </select>
            <input
              value={c.texto}
              onChange={(e) => cambiar(i, { texto: e.target.value })}
              placeholder={c.campo ? 'Texto si el dato viene vacío' : 'Texto fijo'}
              aria-label="Texto fijo"
              className={claseCampo}
            />
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onCambio([...celdas, { id: nuevoIdCelda(), etiqueta: '', campo: '', texto: '', visible: true }])}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:text-brand-deep"
      >
        <Plus className="w-4 h-4" /> {textoAgregar}
      </button>
    </div>
  );
}
