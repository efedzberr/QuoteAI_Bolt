import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, Loader2, RefreshCw, Ruler, Sparkles } from 'lucide-react';
import {
  normUnidad, resolverUnidades,
  type EstadoUnidades, type OpcionUnidad, type UnidadReconocida, type UnidadesResueltas,
} from '../lib/unidadesMedida';

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rows: Record<string, any>[];
  onChange: (estado: EstadoUnidades) => void;
}

export default function UnidadesPorResolverPanel({ rows, onChange }: Props) {
  const [info, setInfo] = useState<Record<string, UnidadReconocida>>({});
  const [opciones, setOpciones] = useState<OpcionUnidad[]>([]);
  // Elección del ejecutivo por texto: siempre un código de la lista
  const [elecciones, setElecciones] = useState<Record<string, string>>({});
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(false);
  const [disponible, setDisponible] = useState(true);
  const [reintento, setReintento] = useState(0);
  const pedidoRef = useRef(0);

  // Unidades distintas del archivo y cuántas líneas usan cada una
  const conteo = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) {
      const t = normUnidad(r?.Unid);
      if (t) m.set(t, (m.get(t) ?? 0) + 1);
    }
    return m;
  }, [rows]);
  const distintas = useMemo(() => Array.from(conteo.keys()).sort(), [conteo]);
  const claveDistintas = distintas.join('|');

  // Consulta a Railway solo lo que todavía no se conoce (con una pausa mientras el usuario edita)
  useEffect(() => {
    if (!disponible) return;
    const faltantes = distintas.filter((t) => !info[t]);
    if (faltantes.length === 0) { setCargando(false); return; }
    const pedido = ++pedidoRef.current;
    setCargando(true);
    setError(false);
    const timer = setTimeout(async () => {
      try {
        const r = await resolverUnidades(faltantes);
        if (pedido !== pedidoRef.current) return;
        if (!r.disponible) { setDisponible(false); setCargando(false); return; }
        setOpciones(r.opciones);
        setInfo((prev) => {
          const next = { ...prev };
          for (const u of r.unidades) next[normUnidad(u.texto)] = u;
          // Lo que Railway no regresó se trata como sin resolver para no bloquear en silencio
          for (const t of faltantes) if (!next[t]) next[t] = { texto: t, codigo: null, descripcion: null, origen: 'sin_resolver' };
          return next;
        });
        setCargando(false);
      } catch (e) {
        if (pedido !== pedidoRef.current) return;
        console.error('[UnidadesPorResolverPanel] resolverUnidades:', e);
        setError(true);
        setCargando(false);
      }
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveDistintas, disponible, reintento]);

  // Estado que se entrega a la pantalla
  const estado = useMemo<EstadoUnidades>(() => {
    const resueltas: UnidadesResueltas = {};
    let pendientes = 0;
    if (disponible && !error) {
      for (const t of distintas) {
        if (t in elecciones) { resueltas[t] = { codigo: elecciones[t], origen: 'ejecutivo' }; continue; }
        const u = info[t];
        if (!u) continue;
        if (u.origen === 'sin_resolver') { pendientes += 1; continue; }
        resueltas[t] = { codigo: u.codigo, origen: u.origen };
      }
    }
    return { resueltas, pendientes, cargando: disponible && !error && cargando };
  }, [distintas, elecciones, info, cargando, disponible, error]);

  const claveEstado = JSON.stringify(estado);
  useEffect(() => {
    onChange(estado);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveEstado]);

  if (!disponible || distintas.length === 0) return null;

  if (error) {
    return (
      <div className="flex items-start gap-3 mb-6 px-4 py-3 rounded-lg border border-[#FCD34D] bg-[#FFFBEB]" role="status">
        <AlertTriangle className="w-5 h-5 text-[#B86C00] flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-[#7C4A03]" style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.5 }}>
            No se pudieron verificar las unidades de medida. Puedes continuar: las unidades que no coincidan con el producto quedarán marcadas en "Validar productos".
          </p>
        </div>
        <button
          onClick={() => setReintento((n) => n + 1)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#B86C00] text-[#7C4A03] hover:bg-[#FEF3C7] transition-colors"
          style={{ fontSize: 12, fontWeight: 600 }}
        >
          <RefreshCw className="w-3.5 h-3.5" />Reintentar
        </button>
      </div>
    );
  }

  // Solo se listan las que necesitan la atención del ejecutivo
  const visibles = distintas.filter((t) => t in elecciones || info[t]?.origen === 'ia' || info[t]?.origen === 'sin_resolver');

  if (visibles.length === 0) {
    if (!cargando) return null;
    return (
      <div className="flex items-center gap-2 mb-6 px-4 py-3 rounded-lg border border-[#E5E5E5] bg-white text-[#747474]" style={{ fontSize: 13 }}>
        <Loader2 className="w-4 h-4 animate-spin" />Reconociendo unidades de medida…
      </div>
    );
  }

  const unidades = opciones.filter((o) => o.clase === 'unidad');
  const familias = opciones.filter((o) => o.clase === 'familia');

  const elegir = (texto: string, valor: string) => {
    setElecciones((prev) => {
      const next = { ...prev };
      if (valor === '') delete next[texto];
      else next[texto] = valor;
      return next;
    });
  };

  return (
    <div className="bg-white border border-[#E5E5E5] rounded-xl mb-6 overflow-hidden" style={{ boxShadow: '0 1px 2px rgba(0,0,0,.05)' }}>
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#F0F0F0]">
        <div className="flex items-center gap-2">
          <Ruler className="w-4 h-4 text-[#0176D3]" />
          <span className="text-[#181818]" style={{ fontSize: 14, fontWeight: 700 }}>Unidades de medida</span>
          {cargando && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#747474]" />}
        </div>
        {estado.pendientes > 0 ? (
          <span className="rounded-full px-2.5 py-1" style={{ fontSize: 11, fontWeight: 700, backgroundColor: '#FEDED7', color: '#BA0517' }}>
            {estado.pendientes === 1 ? 'Falta elegir 1 unidad' : `Falta elegir ${estado.pendientes} unidades`}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1" style={{ fontSize: 11, fontWeight: 700, backgroundColor: '#DEF5E5', color: '#2E844A' }}>
            <Check className="w-3 h-3" />Unidades resueltas
          </span>
        )}
      </div>
      <p className="px-5 pt-3 text-[#747474]" style={{ fontSize: 12, lineHeight: 1.5 }}>
        Estas unidades no estaban en el diccionario. Revisa las que interpretó la IA y elige las que faltan: debes elegir una unidad de la lista para poder continuar. Cada elección aplica a todas las líneas que usan esa unidad.
      </p>
      <div className="px-5 py-3">
        <table className="w-full" style={{ fontSize: 13 }}>
          <thead>
            <tr className="text-left uppercase text-[#747474]" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em' }}>
              <th className="py-2 pr-4">El cliente escribió</th>
              <th className="py-2 pr-4" style={{ width: 80 }}>Líneas</th>
              <th className="py-2 pr-4">Se interpreta como</th>
              <th className="py-2" style={{ width: 170 }}></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0F0F0]">
            {visibles.map((t) => {
              const u = info[t];
              const elegida = t in elecciones;
              const valor = elegida ? elecciones[t] : (u?.origen === 'ia' ? (u.codigo ?? '') : '');
              const falta = !elegida && u?.origen === 'sin_resolver';
              return (
                <tr key={t}>
                  <td className="py-2.5 pr-4 text-[#181818]" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 600 }}>{t}</td>
                  <td className="py-2.5 pr-4 text-[#747474]" style={{ fontVariantNumeric: 'tabular-nums' }}>{conteo.get(t) ?? 0}</td>
                  <td className="py-2.5 pr-4">
                    <select
                      value={valor}
                      onChange={(e) => elegir(t, e.target.value)}
                      className={`w-full max-w-[360px] px-2.5 py-1.5 rounded-md border bg-white text-[#181818] focus:outline-none focus:ring-[3px] focus:ring-[#EAF5FE] ${falta ? 'border-[#BA0517]' : 'border-[#E5E5E5] focus:border-[#0176D3]'}`}
                      style={{ fontSize: 13 }}
                      aria-label={`Unidad para ${t}`}
                    >
                      {(falta || (!elegida && u?.origen !== 'ia')) && <option value="">Selecciona una unidad…</option>}
                      {elegida && u?.origen === 'ia' && <option value="">Volver a la sugerencia de la IA</option>}
                      <optgroup label="Unidades">
                        {unidades.map((o) => <option key={o.codigo} value={o.codigo}>{o.codigo} — {o.descripcion}</option>)}
                      </optgroup>
                      {familias.length > 0 && (
                        <optgroup label="Empaques (la medida depende del producto)">
                          {familias.map((o) => <option key={o.codigo} value={o.codigo}>{o.descripcion}</option>)}
                        </optgroup>
                      )}
                    </select>
                  </td>
                  <td className="py-2.5">
                    {falta ? (
                      <span className="rounded-full px-2 py-0.5" style={{ fontSize: 10, fontWeight: 700, backgroundColor: '#FEDED7', color: '#BA0517' }}>Falta elegir</span>
                    ) : elegida ? (
                      <span className="rounded-full px-2 py-0.5" style={{ fontSize: 10, fontWeight: 700, backgroundColor: '#DEF5E5', color: '#2E844A' }}>
                        Elegida por ti
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5" style={{ fontSize: 10, fontWeight: 700, backgroundColor: '#EDE9FE', color: '#5B21B6' }}>
                        <Sparkles className="w-3 h-3" />Interpretada por IA
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
