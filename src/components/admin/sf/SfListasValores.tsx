import { useState } from 'react';
import { ArrowUp, ArrowDown, Pencil, Check, X, Trash2, Plus, Loader2, Info, AlertTriangle } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import type { ListaSf, ValorLista } from '../../../lib/sfOportunidad';
import { claseCampo, claseBotonIcono, claseBotonEliminar } from '../pdf/pdfEditorUtil';
import { Segmentado } from '../pdf/PdfControles';

interface Props {
  listas: ValorLista[];
  /** Valor guardado en Variables de la oportunidad para cada lista. */
  enUso: Record<ListaSf, string>;
  onRecargar: () => Promise<void>;
  onToast: (message: string, type: 'success' | 'error') => void;
}

const OPCIONES: { valor: ListaSf; texto: string }[] = [
  { valor: 'etapa', texto: 'Etapa' },
  { valor: 'pronostico', texto: 'Categoría de pronóstico' },
  { valor: 'probabilidad', texto: 'Probabilidad' },
];

const MSG_EN_USO = 'Este valor está en uso en Variables de la oportunidad. Selecciona otro valor y guarda antes de modificarlo.';

const mensajeDe = (e: unknown) => {
  const err = e as { code?: string; message?: string };
  if (err?.code === '23505') return 'Ese valor ya existe en la lista';
  return err?.message || String(e);
};

/** Devuelve el valor y la etiqueta listos para guardar, o un mensaje de error. */
function validar(lista: ListaSf, valorRaw: string, etiquetaRaw: string): { valor: string; etiqueta: string } | string {
  const valor = valorRaw.trim();
  if (!valor) return 'El valor es obligatorio.';
  if (lista === 'probabilidad') {
    if (!/^\d+$/.test(valor) || parseInt(valor, 10) > 100) return 'La probabilidad debe ser un número entero de 0 a 100.';
    const canonico = String(parseInt(valor, 10));
    return { valor: canonico, etiqueta: etiquetaRaw.trim() || `${canonico}%` };
  }
  return { valor, etiqueta: etiquetaRaw.trim() || valor };
}

export default function SfListasValores({ listas, enUso, onRecargar, onToast }: Props) {
  const [lista, setLista] = useState<ListaSf>('etapa');
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [edicion, setEdicion] = useState<{ id: string; valor: string; etiqueta: string } | null>(null);
  const [nuevoValor, setNuevoValor] = useState('');
  const [nuevaEtiqueta, setNuevaEtiqueta] = useState('');

  const filas = listas.filter((v) => v.lista === lista).sort((a, b) => a.orden - b.orden);
  const valorEnUso = enUso[lista];

  const ejecutar = async (clave: string, accion: () => Promise<void>) => {
    setOcupado(clave);
    setAviso(null);
    try {
      await accion();
      await onRecargar();
    } catch (e) {
      onToast(mensajeDe(e), 'error');
    } finally {
      setOcupado(null);
    }
  };

  const cambiarLista = (l: ListaSf) => {
    setLista(l);
    setAviso(null);
    setEdicion(null);
    setNuevoValor('');
    setNuevaEtiqueta('');
  };

  const mover = (i: number, delta: -1 | 1) => {
    const a = filas[i];
    const b = filas[i + delta];
    if (!a || !b) return;
    const ordenA = a.orden === b.orden ? b.orden + delta : b.orden;
    const ordenB = a.orden;
    ejecutar(`mover-${a.id}`, async () => {
      const r1 = await supabase.from('sf_listas_valores').update({ orden: ordenA }).eq('id', a.id);
      if (r1.error) throw r1.error;
      const r2 = await supabase.from('sf_listas_valores').update({ orden: ordenB }).eq('id', b.id);
      if (r2.error) throw r2.error;
    });
  };

  const guardarEdicion = (fila: ValorLista) => {
    if (!edicion) return;
    const r = validar(lista, edicion.valor, edicion.etiqueta);
    if (typeof r === 'string') {
      setAviso(r);
      return;
    }
    if (fila.valor === valorEnUso && r.valor !== fila.valor) {
      setAviso(MSG_EN_USO);
      return;
    }
    ejecutar(`editar-${fila.id}`, async () => {
      const { error } = await supabase.from('sf_listas_valores').update({ valor: r.valor, etiqueta: r.etiqueta }).eq('id', fila.id);
      if (error) throw error;
      setEdicion(null);
    });
  };

  const alternarActivo = (fila: ValorLista) => {
    if (fila.activo && fila.valor === valorEnUso) {
      setAviso(MSG_EN_USO);
      return;
    }
    ejecutar(`activo-${fila.id}`, async () => {
      const { error } = await supabase.from('sf_listas_valores').update({ activo: !fila.activo }).eq('id', fila.id);
      if (error) throw error;
    });
  };

  const eliminar = (fila: ValorLista) => {
    if (fila.valor === valorEnUso) {
      setAviso(MSG_EN_USO);
      return;
    }
    if (!window.confirm(`¿Eliminar el valor «${fila.valor}» de la lista?`)) return;
    ejecutar(`eliminar-${fila.id}`, async () => {
      const { error } = await supabase.from('sf_listas_valores').delete().eq('id', fila.id);
      if (error) throw error;
      onToast('Valor eliminado', 'success');
    });
  };

  const agregar = () => {
    const r = validar(lista, nuevoValor, nuevaEtiqueta);
    if (typeof r === 'string') {
      setAviso(r);
      return;
    }
    const orden = filas.reduce((m, f) => Math.max(m, f.orden), 0) + 1;
    ejecutar('agregar', async () => {
      const { error } = await supabase
        .from('sf_listas_valores')
        .insert({ lista, valor: r.valor, etiqueta: r.etiqueta, orden, activo: true });
      if (error) throw error;
      setNuevoValor('');
      setNuevaEtiqueta('');
      onToast('Valor agregado', 'success');
    });
  };

  return (
    <section className="bg-white rounded-card border border-rule shadow-sm">
      <div className="px-5 py-4 border-b border-rule space-y-3">
        <div>
          <h3 className="text-base font-bold text-ink">Listas de valores aceptados</h3>
          <p className="text-xs text-ink-faint mt-0.5">Los valores activos aparecen en Variables de la oportunidad.</p>
        </div>
        <div className="max-w-xl">
          <Segmentado etiqueta="Lista" valor={lista} opciones={OPCIONES} onCambio={cambiarLista} />
        </div>
        <p className="flex items-start gap-2 text-xs text-ink-soft bg-brand-soft rounded-lg px-3 py-2">
          <Info className="w-4 h-4 text-brand flex-shrink-0" />
          <span>
            El <strong>Valor</strong> debe coincidir exactamente con el valor de la lista de selección (picklist) en Salesforce; si no
            coincide, Salesforce rechazará la oportunidad.
          </span>
        </p>
        {aviso && (
          <p className="flex items-start gap-2 text-xs font-semibold text-warn bg-warn-soft rounded-lg px-3 py-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">{aviso}</span>
            <button type="button" onClick={() => setAviso(null)} aria-label="Cerrar aviso" className="text-warn/70 hover:text-warn">
              <X className="w-3.5 h-3.5" />
            </button>
          </p>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="text-left text-[11px] font-semibold text-ink-soft uppercase tracking-wide bg-rule-soft">
              <th className="px-5 py-2.5 w-[90px]">Orden</th>
              <th className="px-3 py-2.5">Valor (se envía a Salesforce)</th>
              <th className="px-3 py-2.5">Etiqueta (se muestra)</th>
              <th className="px-3 py-2.5 w-[80px]">Activo</th>
              <th className="px-5 py-2.5 w-[110px] text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule-soft">
            {filas.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-6 text-center text-sm text-ink-faint">Esta lista todavía no tiene valores.</td>
              </tr>
            )}
            {filas.map((fila, i) => {
              const editando = edicion?.id === fila.id;
              const enUsoFila = fila.valor === valorEnUso;
              const cargandoFila = ocupado !== null && ocupado.endsWith(fila.id);
              return (
                <tr key={fila.id} className={`transition-colors ${fila.activo ? '' : 'bg-rule-soft/40'} hover:bg-rule-soft/60`}>
                  <td className="px-5 py-2">
                    <div className="flex items-center gap-0.5">
                      <button type="button" aria-label="Subir" disabled={i === 0 || ocupado !== null} onClick={() => mover(i, -1)} className={claseBotonIcono}>
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label="Bajar"
                        disabled={i === filas.length - 1 || ocupado !== null}
                        onClick={() => mover(i, 1)}
                        className={claseBotonIcono}
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                  {editando ? (
                    <>
                      <td className="px-3 py-2">
                        <input
                          autoFocus
                          value={edicion.valor}
                          onChange={(e) => setEdicion({ ...edicion, valor: e.target.value })}
                          onKeyDown={(e) => { if (e.key === 'Enter') guardarEdicion(fila); if (e.key === 'Escape') setEdicion(null); }}
                          className={`${claseCampo} font-mono`}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          value={edicion.etiqueta}
                          onChange={(e) => setEdicion({ ...edicion, etiqueta: e.target.value })}
                          onKeyDown={(e) => { if (e.key === 'Enter') guardarEdicion(fila); if (e.key === 'Escape') setEdicion(null); }}
                          className={claseCampo}
                        />
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-2">
                        <span className="font-mono text-[13px] text-ink">{fila.valor}</span>
                        {enUsoFila && (
                          <span className="ml-2 inline-flex items-center h-5 px-1.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-brand-soft text-brand">
                            En uso
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-ink-soft">{fila.etiqueta || fila.valor}</td>
                    </>
                  )}
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={fila.activo}
                      aria-label={fila.activo ? 'Desactivar' : 'Activar'}
                      disabled={ocupado !== null}
                      onClick={() => alternarActivo(fila)}
                      className={`relative w-9 h-5 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-soft disabled:opacity-60 ${fila.activo ? 'bg-brand' : 'bg-[#C9C9C9]'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${fila.activo ? 'translate-x-4' : ''}`} />
                    </button>
                  </td>
                  <td className="px-5 py-2">
                    <div className="flex items-center justify-end gap-0.5">
                      {cargandoFila ? (
                        <Loader2 className="w-4 h-4 animate-spin text-ink-faint mr-1.5" />
                      ) : editando ? (
                        <>
                          <button type="button" aria-label="Guardar" onClick={() => guardarEdicion(fila)} className={`${claseBotonIcono} !text-good`}>
                            <Check className="w-4 h-4" />
                          </button>
                          <button type="button" aria-label="Cancelar" onClick={() => setEdicion(null)} className={claseBotonIcono}>
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            aria-label="Editar"
                            disabled={ocupado !== null}
                            onClick={() => { setAviso(null); setEdicion({ id: fila.id, valor: fila.valor, etiqueta: fila.etiqueta || '' }); }}
                            className={claseBotonIcono}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" aria-label="Eliminar" disabled={ocupado !== null} onClick={() => eliminar(fila)} className={claseBotonEliminar}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            <tr className="bg-rule-soft/30">
              <td className="px-5 py-3 text-xs font-semibold text-ink-faint">Nuevo</td>
              <td className="px-3 py-3">
                <input
                  value={nuevoValor}
                  onChange={(e) => setNuevoValor(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') agregar(); }}
                  placeholder={lista === 'probabilidad' ? 'ej. 50' : 'Valor exacto en Salesforce'}
                  className={`${claseCampo} font-mono`}
                />
              </td>
              <td className="px-3 py-3">
                <input
                  value={nuevaEtiqueta}
                  onChange={(e) => setNuevaEtiqueta(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') agregar(); }}
                  placeholder={lista === 'probabilidad' ? 'ej. 50%' : 'Opcional'}
                  className={claseCampo}
                />
              </td>
              <td className="px-3 py-3" />
              <td className="px-5 py-3 text-right">
                <button
                  type="button"
                  onClick={agregar}
                  disabled={ocupado !== null || !nuevoValor.trim()}
                  className="inline-flex items-center justify-center gap-1.5 h-9 px-3 bg-brand text-white font-semibold text-sm rounded-lg hover:bg-brand-deep disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {ocupado === 'agregar' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Agregar
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
