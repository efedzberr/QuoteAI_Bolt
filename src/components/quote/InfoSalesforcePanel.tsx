import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Check, Copy, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  SF_OPP_DEFAULTS, ahoraMexico, formatoFecha, normalizarConfig, resolverPlantilla,
  type ClaveVariable, type ListaSf, type SfOportunidadConfig,
} from '../../lib/sfOportunidad';

interface Props {
  referencia: string;
  subtotal: number;
  refreshKey: number;
}

interface UltimoEnvio {
  fecha?: string;
  operacion?: string;
  usuario?: string;
  cuenta?: { salesforceAccountId?: string | null; noCliente?: string | null; ownerId?: string | null; accountName?: string | null };
  oportunidad?: {
    opportunityName?: string; stage?: string; forecastCategory?: string; probability?: number | string;
    closeDate?: string; amount?: number; projectType?: string; accountName?: string;
  };
  origen_variables?: Partial<Record<ClaveVariable, string>>;
  total_lineas?: number;
  ok?: boolean;
  http_status?: number;
  opportunityId?: string | null;
  quoteId?: string | null;
  nuevaOportunidad?: boolean;
  mensaje?: string;
}

interface JobSf {
  sf_ultimo_envio: UltimoEnvio | null;
  sf_opportunity_id: string | null;
  sf_quote_id: string | null;
  sf_sent_at: string | null;
  cuenta_sf: { id?: string; name?: string } | null;
  cliente: string | null;
  no_cliente: string | null;
  grupo: string | null;
  nombre_proyecto: string | null;
  transporte: string | null;
  orden_compra: string | null;
  owner: { full_name: string | null; email: string | null } | null;
}

interface ValorListaSimple { lista: ListaSf; valor: string; etiqueta: string | null; activo: boolean }

interface Datos { job: JobSf; config: SfOportunidadConfig; listas: ValorListaSimple[] }

const C = { azul: '#0176D3', marino: '#032D60', gris: '#747474', verde: '#2E844A', rojo: '#BA0517', ambar: '#B86C00' };
const pad = (n: number) => String(n).padStart(2, '0');

function fechaHoraLocal(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fechaIsoADmy(s?: string | null): string {
  if (!s) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
}

function mxn(n?: number | null): string {
  if (n === undefined || n === null || !Number.isFinite(Number(n))) return '—';
  return `MX$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function vacio(v: unknown): boolean {
  return v === undefined || v === null || String(v).trim() === '';
}

export default function InfoSalesforcePanel({ referencia, subtotal, refreshKey }: Props) {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [copiado, setCopiado] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(false);
    try {
      const [jobRes, cfgRes, listasRes] = await Promise.all([
        supabase
          .from('jobs')
          .select('sf_ultimo_envio, sf_opportunity_id, sf_quote_id, sf_sent_at, cuenta_sf, cliente, no_cliente, grupo, nombre_proyecto, transporte, orden_compra, owner:user_profiles!jobs_owner_id_fkey(full_name, email)')
          .eq('referencia', referencia)
          .maybeSingle(),
        supabase.from('app_settings').select('sf_oportunidad_config').eq('id', 1).maybeSingle(),
        supabase.from('sf_listas_valores').select('lista, valor, etiqueta, activo'),
      ]);
      if (jobRes.error || cfgRes.error || listasRes.error || !jobRes.data) {
        console.error('[InfoSalesforcePanel]', jobRes.error || cfgRes.error || listasRes.error || 'job no encontrado');
        setError(true);
        return;
      }
      setDatos({
        job: jobRes.data as unknown as JobSf,
        config: normalizarConfig(cfgRes.data?.sf_oportunidad_config),
        listas: (listasRes.data || []) as ValorListaSimple[],
      });
    } catch (e) {
      console.error('[InfoSalesforcePanel]', e);
      setError(true);
    } finally {
      setCargando(false);
    }
  }, [referencia]);

  useEffect(() => { cargar(); }, [cargar, refreshKey]);

  const copiar = async (texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(texto);
      setTimeout(() => setCopiado((c) => (c === texto ? null : c)), 1500);
    } catch {
      setCopiado(null);
    }
  };

  if (cargando && !datos) {
    return (
      <div className="bg-white border border-[#E5E5E5] rounded-lg p-4 flex items-center justify-center" style={{ minHeight: 96 }}>
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: C.azul }} aria-label="Cargando información de Salesforce" />
      </div>
    );
  }

  if (error || !datos) {
    return (
      <div className="bg-white border border-[#E5E5E5] rounded-lg p-4 flex items-center gap-3" style={{ fontSize: 13 }}>
        <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: C.rojo }} />
        <span style={{ color: C.rojo }}>No se pudo cargar la información de Salesforce.</span>
        <button
          type="button"
          onClick={cargar}
          className="ml-auto px-3 py-1 rounded-lg border border-[#E5E5E5] hover:border-[#0176D3] hover:text-[#0176D3] transition-colors"
          style={{ fontSize: 12, fontWeight: 600 }}
        >
          Reintentar
        </button>
      </div>
    );
  }

  const { job, config, listas } = datos;
  const envio = job.sf_ultimo_envio && typeof job.sf_ultimo_envio === 'object' ? job.sf_ultimo_envio : null;
  const opp = envio?.oportunidad;
  const hayEnvio = !!envio;
  const ahora = ahoraMexico();

  const valorVigente = (lista: ListaSf, clave: ClaveVariable): { valor: string; respaldo: boolean } => {
    const v = String(config[clave].valor);
    const activo = listas.some((l) => l.lista === lista && l.activo && String(l.valor) === v);
    return activo ? { valor: v, respaldo: false } : { valor: String(SF_OPP_DEFAULTS[clave].valor), respaldo: true };
  };
  const etapa = valorVigente('etapa', 'etapa');
  const pronostico = valorVigente('pronostico', 'pronostico');
  const probabilidad = valorVigente('probabilidad', 'probabilidad');

  const dias = Number(config.cierre.valor);
  const cierre = new Date(ahora.getTime());
  cierre.setDate(cierre.getDate() + (Number.isFinite(dias) ? dias : Number(SF_OPP_DEFAULTS.cierre.valor)));

  const campos: Record<string, string | number> = {
    referencia,
    cliente: job.cliente || '',
    no_cliente: job.no_cliente || '',
    grupo: job.grupo || '',
    proyecto: job.nombre_proyecto || '',
    transporte: job.transporte || '',
    orden_compra: job.orden_compra || '',
    usuario: job.owner?.email || '',
    total: subtotal,
    lineas: 0,
  };
  const nombre = resolverPlantilla(String(config.nombre.valor), campos, ahora)
    || resolverPlantilla(String(SF_OPP_DEFAULTS.nombre.valor), campos, ahora);

  const filas: {
    clave: ClaveVariable; campo: string; sf: string; enviado: string; actual: string; respaldo?: boolean; comparar?: boolean; distinto?: boolean;
  }[] = [
    { clave: 'etapa', campo: 'Etapa', sf: 'StageName', enviado: vacio(opp?.stage) ? '—' : String(opp?.stage), actual: etapa.valor, respaldo: etapa.respaldo, comparar: true },
    { clave: 'pronostico', campo: 'Categoría de pronóstico', sf: 'ForecastCategoryName', enviado: vacio(opp?.forecastCategory) ? '—' : String(opp?.forecastCategory), actual: pronostico.valor, respaldo: pronostico.respaldo, comparar: true },
    { clave: 'probabilidad', campo: 'Probabilidad', sf: 'Probability', enviado: vacio(opp?.probability) ? '—' : `${opp?.probability}%`, actual: `${probabilidad.valor}%`, respaldo: probabilidad.respaldo, comparar: true },
    { clave: 'cierre', campo: 'Fecha de cierre', sf: 'CloseDate', enviado: fechaIsoADmy(opp?.closeDate), actual: formatoFecha(cierre, 'DD/MM/YYYY') },
    { clave: 'monto', campo: 'Monto', sf: 'Amount', enviado: mxn(opp?.amount), actual: mxn(subtotal) },
    { clave: 'nombre', campo: 'Nombre', sf: 'Name', enviado: vacio(opp?.opportunityName) ? '—' : String(opp?.opportunityName), actual: nombre, comparar: true },
  ];
  if (hayEnvio && opp) {
    filas.forEach((f) => {
      if (!f.comparar || f.enviado === '—') return;
      const a = f.clave === 'probabilidad' ? String(Number(String(opp.probability))) : f.enviado.trim();
      const b = f.clave === 'probabilidad' ? String(Number(probabilidad.valor)) : f.actual.trim();
      f.distinto = a !== b;
    });
  }

  const oppId = envio?.opportunityId || job.sf_opportunity_id || '';
  const quoteId = envio?.quoteId || job.sf_quote_id || '';

  const Chip = ({ color, bg, texto }: { color: string; bg: string; texto: string }) => (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full" style={{ fontSize: 11, fontWeight: 700, color, background: bg }}>
      {texto}
    </span>
  );

  const BadgeOrigen = ({ origen }: { origen?: string }) => {
    if (!origen) return null;
    const esConfig = origen === 'config';
    return (
      <span
        className="inline-block mt-1 px-1.5 rounded"
        style={{ fontSize: 10, fontWeight: 600, color: esConfig ? C.azul : C.gris, background: esConfig ? '#EAF5FE' : '#F3F3F3' }}
      >
        {esConfig ? 'Configuración' : 'Respaldo'}
      </span>
    );
  };

  const IdCopiable = ({ etiqueta, valor }: { etiqueta: string; valor: string }) => (
    <div className="flex items-center gap-2 mt-2">
      <span style={{ color: C.gris, fontSize: 12, minWidth: 110 }}>{etiqueta}</span>
      {valor ? (
        <>
          <span className="font-mono truncate" style={{ fontSize: 12, color: C.marino }}>{valor}</span>
          <button
            type="button"
            onClick={() => copiar(valor)}
            className="p-1 rounded hover:bg-[#EAF5FE] transition-colors flex-shrink-0"
            title="Copiar"
            aria-label={`Copiar ${etiqueta}`}
          >
            {copiado === valor
              ? <Check className="w-3.5 h-3.5" style={{ color: C.verde }} />
              : <Copy className="w-3.5 h-3.5" style={{ color: C.gris }} />}
          </button>
        </>
      ) : (
        <span style={{ fontSize: 12, color: '#A3A3A3' }}>—</span>
      )}
    </div>
  );

  const Titulo = ({ children }: { children: string }) => (
    <h4 className="uppercase mb-3" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: C.gris }}>{children}</h4>
  );

  const Dato = ({ etiqueta, valor, extra }: { etiqueta: string; valor: string; extra?: string }) => (
    <div className="mb-2">
      <div style={{ fontSize: 11, color: C.gris }}>{etiqueta}</div>
      <div className="break-words" style={{ fontSize: 13, fontWeight: 600, color: C.marino }}>
        {valor || '—'}
        {extra && <span className="ml-1" style={{ fontSize: 11, fontWeight: 500, color: C.gris }}>{extra}</span>}
      </div>
    </div>
  );

  const cuenta = envio?.cuenta;

  return (
    <div className="bg-white border border-[#E5E5E5] rounded-lg p-4 relative" style={{ fontSize: 13 }}>
      {cargando && (
        <Loader2 className="w-4 h-4 animate-spin absolute top-3 right-3" style={{ color: C.azul }} aria-label="Actualizando" />
      )}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)] gap-6">
        <section>
          <Titulo>Estado del envío</Titulo>
          {envio && envio.ok === true && (
            <div className="space-y-1">
              <Chip color={C.verde} bg="#E6F4EA" texto="Enviada a Salesforce" />
              <div style={{ fontSize: 12, color: C.marino }}>
                {fechaHoraLocal(envio.fecha)} · {envio.operacion === 'actualizar' ? 'Actualizada' : 'Creada'}
              </div>
              {envio.nuevaOportunidad === true && (
                <div style={{ fontSize: 12, color: C.ambar, fontWeight: 600 }}>Se creó una oportunidad nueva en lugar de actualizar</div>
              )}
            </div>
          )}
          {envio && envio.ok !== true && (
            <div className="space-y-1">
              <Chip color={C.rojo} bg="#FDE8E8" texto="Último intento con error" />
              <div style={{ fontSize: 12, color: C.marino }}>{fechaHoraLocal(envio.fecha)}</div>
              {envio.mensaje && (
                <div className="break-words whitespace-pre-wrap" style={{ fontSize: 12, color: C.rojo }}>{envio.mensaje}</div>
              )}
            </div>
          )}
          {!envio && job.sf_opportunity_id && (
            <div className="space-y-1">
              <Chip color={C.gris} bg="#F3F3F3" texto="Enviada antes de este registro" />
              <div style={{ fontSize: 12, color: C.marino }}>{fechaHoraLocal(job.sf_sent_at)}</div>
              <div style={{ fontSize: 12, color: C.gris }}>El detalle de lo enviado está disponible a partir de los envíos nuevos.</div>
            </div>
          )}
          {!envio && !job.sf_opportunity_id && <Chip color={C.gris} bg="#F3F3F3" texto="Aún no se ha enviado" />}
          <div className="mt-2">
            <IdCopiable etiqueta="Id de Oportunidad" valor={oppId} />
            <IdCopiable etiqueta="Id de Quote" valor={quoteId} />
          </div>
        </section>

        <section className="min-w-0">
          <Titulo>Oportunidad</Titulo>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ fontSize: 12 }}>
              <thead>
                <tr className="border-b border-[#E5E5E5]" style={{ color: C.gris }}>
                  <th className="text-left font-semibold py-1.5 pr-3">Campo Salesforce</th>
                  {hayEnvio && <th className="text-left font-semibold py-1.5 pr-3">Enviado</th>}
                  <th className="text-left font-semibold py-1.5">{hayEnvio ? 'Configuración actual' : 'Se enviará'}</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr
                    key={f.clave}
                    className="border-b border-[#F3F3F3] align-top"
                    style={f.distinto ? { background: '#FEF1DC' } : undefined}
                  >
                    <td className="py-1.5 pr-3">
                      <div className="flex items-center gap-1.5" style={{ color: C.marino, fontWeight: 600 }}>
                        {f.distinto && (
                          <span title="La configuración cambió después del envío" className="inline-flex">
                            <AlertTriangle className="w-3.5 h-3.5" style={{ color: C.ambar }} />
                          </span>
                        )}
                        {f.campo}
                      </div>
                      <div className="font-mono" style={{ fontSize: 10, color: C.gris }}>{f.sf}</div>
                    </td>
                    {hayEnvio && (
                      <td className="py-1.5 pr-3 break-words" style={{ color: C.marino }}>
                        <div>{f.enviado}</div>
                        <BadgeOrigen origen={envio?.origen_variables?.[f.clave]} />
                      </td>
                    )}
                    <td className="py-1.5 break-words" style={{ color: C.marino }}>
                      <span>{f.actual || '—'}</span>
                      {f.respaldo && (
                        <span className="ml-1.5 px-1.5 rounded" style={{ fontSize: 10, fontWeight: 600, color: C.gris, background: '#F3F3F3' }}>
                          respaldo
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <Titulo>Cuenta y propietario</Titulo>
          <Dato etiqueta="Cuenta" valor={(hayEnvio ? cuenta?.accountName : null) || job.cuenta_sf?.name || job.cliente || ''} />
          <Dato etiqueta="Id de cuenta SF" valor={(hayEnvio ? cuenta?.salesforceAccountId : null) || job.cuenta_sf?.id || ''} />
          <Dato etiqueta="No. de cliente" valor={(hayEnvio ? cuenta?.noCliente : null) || job.no_cliente || ''} />
          {hayEnvio
            ? <Dato etiqueta="Propietario (correo enviado)" valor={envio?.usuario || ''} />
            : <Dato etiqueta="Propietario (correo enviado)" valor={job.owner?.email || ''} extra="(se enviará)" />}
          <p style={{ fontSize: 11, color: C.gris, lineHeight: 1.5 }}>
            Salesforce asigna como propietario al usuario con este correo; si no existe o está inactivo, queda el propietario de la cuenta.
          </p>
        </section>
      </div>
      <p className="mt-4 pt-3 border-t border-[#F3F3F3]" style={{ fontSize: 11, color: C.gris, lineHeight: 1.5 }}>
        Esto es lo que QuoteAI envió o enviará. Salesforce puede modificar los valores después de recibirlos (flujos o reglas automáticas). Próximamente: consultar la oportunidad directamente en Salesforce.
      </p>
    </div>
  );
}
