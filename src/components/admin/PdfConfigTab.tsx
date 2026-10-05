import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  FileText,
  Loader2,
  Maximize2,
  Minimize2,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Undo2,
  Upload,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAppSettings } from '../../hooks/useAppSettings';
import { configInicialPdf, type OrientacionPagina, type PdfConfig, type TamanoPagina } from '../../lib/pdf/pdfConfig';
import { Campo, Interruptor, Seccion, Segmentado, Subtitulo } from './pdf/PdfControles';
import PdfColumnas from './pdf/PdfColumnas';
import PdfListaCeldas, { OpcionesCampo } from './pdf/PdfListaCeldas';
import PdfVistaPrevia from './pdf/PdfVistaPrevia';
import {
  acotar,
  claseBotonEliminar,
  claseCampo,
  claseEtiqueta,
  prepararImagenLogo,
  prepararImagenMarcaAgua,
} from './pdf/pdfEditorUtil';

interface PdfConfigTabProps {
  onToast: (message: string, type: 'success' | 'error') => void;
}

type IdSeccion = 'pagina' | 'encabezado' | 'cliente' | 'pedido' | 'tabla' | 'totales' | 'barras' | 'marca' | 'pie';

/** Logo del PDF: la imagen y su tamaño máximo en puntos. Se guarda en sus propias columnas de app_settings. */
interface LogoPdf {
  url: string | null;
  ancho: number;
  alto: number;
}

const NOMBRE_TAMANO: Record<TamanoPagina, string> = { LETTER: 'Carta', A4: 'A4', LEGAL: 'Legal' };

const botonPrimario =
  'inline-flex items-center justify-center gap-2 h-9 px-3 bg-brand text-white font-semibold text-sm rounded-lg hover:bg-brand-deep disabled:opacity-60 disabled:cursor-not-allowed transition-colors';
const botonSecundario =
  'inline-flex items-center justify-center gap-2 h-9 px-3 bg-white text-ink-soft font-semibold text-sm rounded-lg border border-rule hover:bg-rule-soft disabled:opacity-60 disabled:cursor-not-allowed transition-colors';
const enlaceAgregar = 'inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:text-brand-deep';
const claseRango = 'w-full accent-[#0176D3]';

const etiquetaIvaDe = (tasa: number) => `IVA (${Math.round(tasa * 10000) / 100}%)`;
const mensajeDe = (e: unknown) => (e as { message?: string })?.message || String(e);

/** Ajustes > PDF de cotización: editor de la plantilla de la empresa con vista previa. */
export default function PdfConfigTab({ onToast }: PdfConfigTabProps) {
  const settings = useAppSettings();
  const [borrador, setBorrador] = useState<PdfConfig>(settings.pdfConfig);
  const [abierta, setAbierta] = useState<IdSeccion | null>('encabezado');
  const [guardando, setGuardando] = useState(false);
  const [preparando, setPreparando] = useState(false);
  // Vista previa en grande: ocupa todo el ancho y el editor se oculta mientras tanto
  const [amplia, setAmplia] = useState(false);
  const archivoRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const [preparandoLogo, setPreparandoLogo] = useState(false);
  // El logo (imagen y tamaño) está en sus propias columnas de app_settings, fuera de la plantilla,
  // pero se edita, se descarta y se guarda junto con ella
  const logoGuardado = useMemo<LogoPdf>(
    () => ({ url: settings.pdfLogoUrl, ancho: settings.pdfLogoWidthPx, alto: settings.pdfLogoHeightPx }),
    [settings.pdfLogoUrl, settings.pdfLogoWidthPx, settings.pdfLogoHeightPx]
  );
  const [logo, setLogo] = useState<LogoPdf>(logoGuardado);
  // La vista previa sigue al borrador con un pequeño retraso, para no volver a generar el PDF en cada tecla
  const [configVista, setConfigVista] = useState<PdfConfig>(settings.pdfConfig);
  const [logoVista, setLogoVista] = useState<LogoPdf>(logoGuardado);

  useEffect(() => {
    const t = setTimeout(() => {
      setConfigVista(borrador);
      setLogoVista(logo);
    }, 500);
    return () => clearTimeout(t);
  }, [borrador, logo]);

  // Al terminar de cargar, y después de guardar, el borrador y la vista previa toman lo guardado
  useEffect(() => {
    if (settings.loading) return;
    setBorrador(settings.pdfConfig);
    setConfigVista(settings.pdfConfig);
    setLogo(logoGuardado);
    setLogoVista(logoGuardado);
  }, [settings.loading, settings.pdfConfig, logoGuardado]);

  const guardado = useMemo(() => JSON.stringify(settings.pdfConfig), [settings.pdfConfig]);
  const plantillaCambiada = JSON.stringify(borrador) !== guardado;
  const logoCambiado = logo.url !== logoGuardado.url || logo.ancho !== logoGuardado.ancho || logo.alto !== logoGuardado.alto;
  const hayCambios = plantillaCambiada || logoCambiado;

  const set = (parcial: Partial<PdfConfig>) => setBorrador((b) => ({ ...b, ...parcial }));
  const alternar = (id: IdSeccion) => setAbierta((a) => (a === id ? null : id));

  const { pagina, empresa, vendidoA, consignadoA, pedido, columnas, totales, codigoBarras, marcaAgua, pie } = borrador;
  const setEmpresa = (p: Partial<PdfConfig['empresa']>) => set({ empresa: { ...empresa, ...p } });
  const setTotales = (p: Partial<PdfConfig['totales']>) => set({ totales: { ...totales, ...p } });
  const setBarras = (p: Partial<PdfConfig['codigoBarras']>) => set({ codigoBarras: { ...codigoBarras, ...p } });
  const setMarca = (p: Partial<PdfConfig['marcaAgua']>) => set({ marcaAgua: { ...marcaAgua, ...p } });
  const setPie = (p: Partial<PdfConfig['pie']>) => set({ pie: { ...pie, ...p } });

  const guardar = async () => {
    setGuardando(true);
    try {
      // Solo se manda lo que cambió: la plantilla y el logo pueden traer imágenes incrustadas
      const cambios: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (plantillaCambiada) cambios.pdf_config = borrador;
      if (logoCambiado) {
        cambios.pdf_logo_url = logo.url;
        cambios.pdf_logo_width_px = logo.ancho;
        cambios.pdf_logo_height_px = logo.alto;
      }
      const { data, error } = await supabase.from('app_settings').update(cambios).eq('id', 1).select('id');
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('no tienes permiso para cambiar la configuración.');
      await settings.refresh();
      onToast('Plantilla del PDF guardada', 'success');
    } catch (e) {
      onToast(`No se pudo guardar la plantilla: ${mensajeDe(e)}`, 'error');
    } finally {
      setGuardando(false);
    }
  };

  const descartar = () => {
    setBorrador(settings.pdfConfig);
    setLogo(logoGuardado);
  };

  const elegirLogo = async (archivo: File) => {
    setPreparandoLogo(true);
    try {
      const url = await prepararImagenLogo(archivo);
      setLogo((l) => ({ ...l, url }));
    } catch (e) {
      onToast(mensajeDe(e), 'error');
    } finally {
      setPreparandoLogo(false);
    }
  };

  const elegirImagen = async (archivo: File) => {
    setPreparando(true);
    try {
      const url = await prepararImagenMarcaAgua(archivo);
      setBorrador((b) => ({ ...b, marcaAgua: { ...b.marcaAgua, url, visible: true } }));
    } catch (e) {
      onToast(mensajeDe(e), 'error');
    } finally {
      setPreparando(false);
    }
  };

  if (settings.loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-ink-faint">
        <Loader2 className="w-4 h-4 animate-spin" /> Cargando la plantilla…
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5">
        <h2 className="flex items-center gap-2 text-xl font-bold text-ink">
          <FileText className="w-5 h-5 text-brand" /> PDF de cotización
        </h2>
        <p className="text-sm text-ink-faint mt-1">
          Una sola plantilla para toda la empresa. Los cambios aplican a los PDF que se generen después de guardar.
        </p>
      </div>

      <div className={`grid grid-cols-1 gap-6 items-start ${amplia ? '' : 'xl:grid-cols-[380px_minmax(0,1fr)]'}`}>
        {/* Editor */}
        <div className={`space-y-3 min-w-0 ${amplia ? 'hidden' : ''}`}>
          <Seccion
            titulo="Página"
            resumen={`${NOMBRE_TAMANO[pagina.tamano]} · ${pagina.orientacion === 'portrait' ? 'Vertical' : 'Horizontal'}`}
            abierta={abierta === 'pagina'}
            onAlternar={() => alternar('pagina')}
          >
            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta="Tamaño">
                <select
                  value={pagina.tamano}
                  onChange={(e) => set({ pagina: { ...pagina, tamano: e.target.value as TamanoPagina } })}
                  className={claseCampo}
                >
                  <option value="LETTER">Carta (21.6 × 27.9 cm)</option>
                  <option value="A4">A4 (21 × 29.7 cm)</option>
                  <option value="LEGAL">Legal (21.6 × 35.6 cm)</option>
                </select>
              </Campo>
              <Campo etiqueta="Orientación">
                <select
                  value={pagina.orientacion}
                  onChange={(e) => set({ pagina: { ...pagina, orientacion: e.target.value as OrientacionPagina } })}
                  className={claseCampo}
                >
                  <option value="portrait">Vertical</option>
                  <option value="landscape">Horizontal</option>
                </select>
              </Campo>
            </div>
          </Seccion>

          <Seccion
            titulo="Encabezado"
            resumen="Logo, datos de la empresa y cuadro de fecha y folio"
            abierta={abierta === 'encabezado'}
            onAlternar={() => alternar('encabezado')}
          >
            <Interruptor activo={empresa.mostrarLogo} onCambio={(v) => setEmpresa({ mostrarLogo: v })} etiqueta="Mostrar el logo" />
            {empresa.mostrarLogo && (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-28 h-16 flex-shrink-0 flex items-center justify-center overflow-hidden border border-dashed border-rule rounded-lg bg-white p-1.5">
                    {logo.url ? (
                      <img src={logo.url} alt="Logo del PDF" className="max-w-full max-h-full object-contain" />
                    ) : (
                      <span className="text-[11px] text-ink-faint">Sin logo</span>
                    )}
                  </div>
                  <div className="space-y-2 min-w-0">
                    <input
                      ref={logoRef}
                      type="file"
                      accept="image/png, image/jpeg, image/svg+xml, image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const archivo = e.target.files?.[0];
                        if (archivo) elegirLogo(archivo);
                        e.target.value = '';
                      }}
                    />
                    <div className="flex flex-wrap items-center gap-3">
                      <button type="button" onClick={() => logoRef.current?.click()} disabled={preparandoLogo} className={botonSecundario}>
                        {preparandoLogo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        {logo.url ? 'Cambiar logo' : 'Subir logo'}
                      </button>
                      {logo.url && (
                        <button
                          type="button"
                          onClick={() => setLogo((l) => ({ ...l, url: null }))}
                          className="inline-flex items-center gap-1.5 text-sm font-semibold text-bad hover:opacity-80"
                        >
                          <Trash2 className="w-4 h-4" /> Quitar
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-ink-faint">PNG, JPG o SVG. Al subirlo se recortan sus márgenes en blanco.</p>
                  </div>
                </div>
                {!logo.url && (
                  <p className="text-xs text-warn bg-warn-soft rounded-lg px-3 py-2">Falta subir el logo: sin logo no se dibuja nada.</p>
                )}
                {logo.url && (
                  <div>
                    <div className="grid grid-cols-2 gap-3">
                      <Campo etiqueta={`Ancho máximo: ${logo.ancho} pt`}>
                        <input
                          type="range"
                          min={40}
                          max={400}
                          step={5}
                          value={logo.ancho}
                          onChange={(e) => setLogo((l) => ({ ...l, ancho: Number(e.target.value) }))}
                          className={claseRango}
                        />
                      </Campo>
                      <Campo etiqueta={`Alto máximo: ${logo.alto} pt`}>
                        <input
                          type="range"
                          min={20}
                          max={200}
                          step={2}
                          value={logo.alto}
                          onChange={(e) => setLogo((l) => ({ ...l, alto: Number(e.target.value) }))}
                          className={claseRango}
                        />
                      </Campo>
                    </div>
                    <p className="text-xs text-ink-faint mt-1">
                      En puntos (la hoja carta mide 612 de ancho). El logo se ajusta dentro de este tamaño sin deformarse.
                    </p>
                  </div>
                )}
              </>
            )}
            <div>
              <span className={claseEtiqueta}>Alineación</span>
              <Segmentado
                etiqueta="Alineación del logo y los datos de la empresa"
                valor={empresa.alineacion}
                onCambio={(alineacion) => setEmpresa({ alineacion })}
                opciones={[
                  { valor: 'left', texto: 'Izquierda', icono: <AlignLeft className="w-4 h-4" /> },
                  { valor: 'center', texto: 'Centro', icono: <AlignCenter className="w-4 h-4" /> },
                  { valor: 'right', texto: 'Derecha', icono: <AlignRight className="w-4 h-4" /> },
                ]}
              />
              <span className="block text-xs text-ink-faint mt-1">Acomoda juntos el logo, el nombre, los renglones y el sitio web.</span>
            </div>
            <Campo etiqueta="Nombre de la empresa">
              <input value={empresa.nombre} onChange={(e) => setEmpresa({ nombre: e.target.value })} className={claseCampo} />
            </Campo>
            <div>
              <span className={claseEtiqueta}>Renglones debajo del nombre</span>
              <div className="space-y-2">
                {empresa.lineas.map((linea, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <input
                      value={linea}
                      onChange={(e) => setEmpresa({ lineas: empresa.lineas.map((x, k) => (k === i ? e.target.value : x)) })}
                      aria-label={`Renglón ${i + 1} de la empresa`}
                      className={`${claseCampo} flex-1 min-w-0`}
                    />
                    <button
                      type="button"
                      title="Eliminar"
                      aria-label="Eliminar renglón"
                      onClick={() => setEmpresa({ lineas: empresa.lineas.filter((_, k) => k !== i) })}
                      className={claseBotonEliminar}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={() => setEmpresa({ lineas: [...empresa.lineas, ''] })} className={enlaceAgregar}>
                  <Plus className="w-4 h-4" /> Agregar renglón
                </button>
              </div>
            </div>
            <Campo etiqueta="Sitio web">
              <input value={empresa.sitioWeb} onChange={(e) => setEmpresa({ sitioWeb: e.target.value })} className={claseCampo} />
            </Campo>
            <Subtitulo>Cuadro de datos (lado derecho)</Subtitulo>
            <PdfListaCeldas
              celdas={borrador.cuadro}
              onCambio={(cuadro) => set({ cuadro })}
              nombreEtiqueta="Título"
              textoAgregar="Agregar renglón al cuadro"
            />
          </Seccion>

          <Seccion
            titulo="Datos del cliente"
            resumen={consignadoA.visible ? `${vendidoA.titulo} y ${consignadoA.titulo}` : vendidoA.titulo}
            abierta={abierta === 'cliente'}
            onAlternar={() => alternar('cliente')}
          >
            <p className="text-xs text-ink-faint">
              Cada renglón imprime un dato de la cuenta de Salesforce. Los renglones sin dato no se imprimen; los marcados «aún sin dato»
              todavía no los entrega Salesforce.
            </p>
            <Campo etiqueta="Título del primer bloque">
              <input value={vendidoA.titulo} onChange={(e) => set({ vendidoA: { ...vendidoA, titulo: e.target.value } })} className={claseCampo} />
            </Campo>
            <PdfListaCeldas
              celdas={vendidoA.lineas}
              onCambio={(lineas) => set({ vendidoA: { ...vendidoA, lineas } })}
              nombreEtiqueta="Prefijo (opcional)"
              textoAgregar="Agregar renglón"
            />
            <Subtitulo>Segundo bloque</Subtitulo>
            <Interruptor
              activo={consignadoA.visible}
              onCambio={(v) => set({ consignadoA: { ...consignadoA, visible: v } })}
              etiqueta="Mostrar el segundo bloque"
            />
            {consignadoA.visible && (
              <>
                <Campo etiqueta="Título del segundo bloque">
                  <input
                    value={consignadoA.titulo}
                    onChange={(e) => set({ consignadoA: { ...consignadoA, titulo: e.target.value } })}
                    className={claseCampo}
                  />
                </Campo>
                <PdfListaCeldas
                  celdas={consignadoA.lineas}
                  onCambio={(lineas) => set({ consignadoA: { ...consignadoA, lineas } })}
                  nombreEtiqueta="Prefijo (opcional)"
                  textoAgregar="Agregar renglón"
                />
              </>
            )}
            <Subtitulo>Cotizaciones sin datos de la cuenta</Subtitulo>
            <Campo etiqueta="Texto debajo del nombre" ayuda="Se imprime cuando el bloque solo tiene el nombre del cliente.">
              <input value={borrador.textoSinDatos} onChange={(e) => set({ textoSinDatos: e.target.value })} className={claseCampo} />
            </Campo>
          </Seccion>

          <Seccion
            titulo="Datos del pedido"
            resumen={pedido.visible ? `${pedido.celdas.filter((c) => c.visible).length} celdas` : 'Oculto'}
            abierta={abierta === 'pedido'}
            onAlternar={() => alternar('pedido')}
          >
            <Interruptor
              activo={pedido.visible}
              onCambio={(v) => set({ pedido: { ...pedido, visible: v } })}
              etiqueta="Mostrar el renglón de datos del pedido"
            />
            {pedido.visible && (
              <PdfListaCeldas
                celdas={pedido.celdas}
                onCambio={(celdas) => set({ pedido: { ...pedido, celdas } })}
                nombreEtiqueta="Título"
                textoAgregar="Agregar celda"
              />
            )}
          </Seccion>

          <Seccion
            titulo="Tabla de productos"
            resumen={`${columnas.filter((c) => c.visible).length} columnas`}
            abierta={abierta === 'tabla'}
            onAlternar={() => alternar('tabla')}
          >
            <PdfColumnas columnas={columnas} pagina={pagina} onCambio={(columnas) => set({ columnas })} />
          </Seccion>

          <Seccion
            titulo="Totales"
            resumen="IVA, descuentos, importe con letra y total de artículos"
            abierta={abierta === 'totales'}
            onAlternar={() => alternar('totales')}
          >
            <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-3">
              <Campo etiqueta="IVA (%)">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={Math.round(totales.tasaIva * 10000) / 100}
                  onChange={(e) => {
                    const tasaIva = acotar(parseFloat(e.target.value), 0, 100) / 100;
                    // La etiqueta acompaña a la tasa mientras conserve el formato «IVA (16%)»
                    const etiquetaIva = totales.etiquetaIva === etiquetaIvaDe(totales.tasaIva) ? etiquetaIvaDe(tasaIva) : totales.etiquetaIva;
                    setTotales({ tasaIva, etiquetaIva });
                  }}
                  className={claseCampo}
                />
              </Campo>
              <Campo etiqueta="Etiqueta del IVA">
                <input value={totales.etiquetaIva} onChange={(e) => setTotales({ etiquetaIva: e.target.value })} className={claseCampo} />
              </Campo>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta="Etiqueta del subtotal">
                <input value={totales.etiquetaSubtotal} onChange={(e) => setTotales({ etiquetaSubtotal: e.target.value })} className={claseCampo} />
              </Campo>
              <Campo etiqueta="Etiqueta del total final">
                <input value={totales.etiquetaTotalFinal} onChange={(e) => setTotales({ etiquetaTotalFinal: e.target.value })} className={claseCampo} />
              </Campo>
            </div>
            <Interruptor
              activo={totales.mostrarDescuentos}
              onCambio={(v) => setTotales({ mostrarDescuentos: v })}
              etiqueta="Mostrar Descuentos y Total antes del IVA"
              ayuda="Como en el PDF de JDE."
            />
            {totales.mostrarDescuentos && (
              <div className="grid grid-cols-2 gap-3">
                <Campo etiqueta="Etiqueta de descuentos">
                  <input value={totales.etiquetaDescuentos} onChange={(e) => setTotales({ etiquetaDescuentos: e.target.value })} className={claseCampo} />
                </Campo>
                <Campo etiqueta="Etiqueta del total">
                  <input value={totales.etiquetaTotal} onChange={(e) => setTotales({ etiquetaTotal: e.target.value })} className={claseCampo} />
                </Campo>
              </div>
            )}
            <Interruptor activo={totales.importeConLetra} onCambio={(v) => setTotales({ importeConLetra: v })} etiqueta="Mostrar el importe con letra" />
            <Interruptor activo={totales.totalArticulos} onCambio={(v) => setTotales({ totalArticulos: v })} etiqueta="Mostrar el total de artículos" />
            {totales.totalArticulos && (
              <Campo etiqueta="Etiqueta del total de artículos">
                <input
                  value={totales.etiquetaTotalArticulos}
                  onChange={(e) => setTotales({ etiquetaTotalArticulos: e.target.value })}
                  className={claseCampo}
                />
              </Campo>
            )}
          </Seccion>

          <Seccion
            titulo="Código de barras"
            resumen={codigoBarras.visible ? 'Visible' : 'Oculto'}
            abierta={abierta === 'barras'}
            onAlternar={() => alternar('barras')}
          >
            <Interruptor activo={codigoBarras.visible} onCambio={(v) => setBarras({ visible: v })} etiqueta="Mostrar el código de barras" />
            {codigoBarras.visible && (
              <>
                <Campo etiqueta="Dato que lleva">
                  <select value={codigoBarras.campo} onChange={(e) => setBarras({ campo: e.target.value })} className={claseCampo}>
                    <OpcionesCampo vacio="Sin dato" />
                  </select>
                </Campo>
                <Interruptor
                  activo={codigoBarras.mostrarTexto}
                  onCambio={(v) => setBarras({ mostrarTexto: v })}
                  etiqueta="Mostrar el texto debajo de las barras"
                />
                <Campo etiqueta={`Alto: ${codigoBarras.alto} puntos`}>
                  <input
                    type="range"
                    min={14}
                    max={60}
                    step={2}
                    value={codigoBarras.alto}
                    onChange={(e) => setBarras({ alto: Number(e.target.value) })}
                    className={claseRango}
                  />
                </Campo>
              </>
            )}
          </Seccion>

          <Seccion
            titulo="Marca de agua"
            resumen={marcaAgua.visible && marcaAgua.url ? 'Visible' : 'Apagada'}
            abierta={abierta === 'marca'}
            onAlternar={() => alternar('marca')}
          >
            <Interruptor
              activo={marcaAgua.visible}
              onCambio={(v) => setMarca({ visible: v })}
              etiqueta="Mostrar la marca de agua"
              ayuda="Imagen de fondo en todas las páginas, detrás del contenido. Con ella la tabla va sin renglones sombreados."
            />
            <div className="flex items-center gap-3">
              <div className="w-20 h-24 flex-shrink-0 flex items-center justify-center overflow-hidden border border-dashed border-rule rounded-lg bg-rule-soft">
                {marcaAgua.url ? (
                  <img src={marcaAgua.url} alt="Marca de agua" className="max-w-full max-h-full object-contain" />
                ) : (
                  <span className="text-[11px] text-ink-faint">Sin imagen</span>
                )}
              </div>
              <div className="space-y-2 min-w-0">
                <input
                  ref={archivoRef}
                  type="file"
                  accept="image/png, image/jpeg"
                  className="hidden"
                  onChange={(e) => {
                    const archivo = e.target.files?.[0];
                    if (archivo) elegirImagen(archivo);
                    e.target.value = '';
                  }}
                />
                <div className="flex flex-wrap items-center gap-3">
                  <button type="button" onClick={() => archivoRef.current?.click()} disabled={preparando} className={botonSecundario}>
                    {preparando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {marcaAgua.url ? 'Cambiar imagen' : 'Subir imagen'}
                  </button>
                  {marcaAgua.url && (
                    <button type="button" onClick={() => setMarca({ url: '' })} className="inline-flex items-center gap-1.5 text-sm font-semibold text-bad hover:opacity-80">
                      <Trash2 className="w-4 h-4" /> Quitar
                    </button>
                  )}
                </div>
                <p className="text-xs text-ink-faint">PNG o JPG, de preferencia ya atenuada (en tonos claros).</p>
              </div>
            </div>
            {marcaAgua.visible && !marcaAgua.url && (
              <p className="text-xs text-warn bg-warn-soft rounded-lg px-3 py-2">Falta subir la imagen: sin imagen no se dibuja nada.</p>
            )}
            {marcaAgua.url && (
              <div className="grid grid-cols-2 gap-3">
                <Campo etiqueta={`Intensidad: ${Math.round(marcaAgua.opacidad * 100)}%`}>
                  <input
                    type="range"
                    min={10}
                    max={100}
                    step={5}
                    value={Math.round(marcaAgua.opacidad * 100)}
                    onChange={(e) => setMarca({ opacidad: Number(e.target.value) / 100 })}
                    className={claseRango}
                  />
                </Campo>
                <Campo etiqueta={`Ancho: ${marcaAgua.anchoPct}% de la hoja`}>
                  <input
                    type="range"
                    min={20}
                    max={100}
                    step={5}
                    value={marcaAgua.anchoPct}
                    onChange={(e) => setMarca({ anchoPct: Number(e.target.value) })}
                    className={claseRango}
                  />
                </Campo>
              </div>
            )}
          </Seccion>

          <Seccion
            titulo="Pie de página"
            resumen="Leyenda, texto del centro y número de página"
            abierta={abierta === 'pie'}
            onAlternar={() => alternar('pie')}
          >
            <Campo etiqueta="Leyenda (izquierda)">
              <input value={pie.leyenda} onChange={(e) => setPie({ leyenda: e.target.value })} className={claseCampo} />
            </Campo>
            <Campo etiqueta="Texto del centro">
              <input value={pie.textoCentro} onChange={(e) => setPie({ textoCentro: e.target.value })} className={claseCampo} />
            </Campo>
            <Interruptor activo={pie.mostrarPagina} onCambio={(v) => setPie({ mostrarPagina: v })} etiqueta="Mostrar el número de página (1 de 3)" />
          </Seccion>

          <button
            type="button"
            onClick={() => setBorrador(configInicialPdf())}
            className="inline-flex items-center gap-1.5 pt-1 text-sm font-semibold text-ink-soft hover:text-ink"
          >
            <RotateCcw className="w-4 h-4" /> Restablecer la plantilla inicial
          </button>
        </div>

        {/* Acciones y vista previa */}
        <div className="min-w-0 xl:sticky xl:top-[76px]">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <span className={`text-xs font-semibold ${hayCambios ? 'text-warn' : 'text-ink-faint'}`}>
              {hayCambios ? 'Hay cambios sin guardar' : 'Sin cambios pendientes'}
            </span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setAmplia((a) => !a)} className={botonSecundario}>
                {amplia ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />} {amplia ? 'Volver a editar' : 'Ampliar'}
              </button>
              <button type="button" onClick={descartar} disabled={!hayCambios || guardando} className={botonSecundario}>
                <Undo2 className="w-4 h-4" /> Descartar
              </button>
              <button type="button" onClick={guardar} disabled={!hayCambios || guardando} className={botonPrimario}>
                {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar
              </button>
            </div>
          </div>
          <div className="h-[calc(100vh-190px)] min-h-[420px] border border-rule rounded-card overflow-hidden">
            <PdfVistaPrevia
              config={configVista}
              pdfLogoUrl={logoVista.url}
              pdfLogoWidthPx={logoVista.ancho}
              pdfLogoHeightPx={logoVista.alto}
              ajuste={amplia ? 'ancho' : 'pagina'}
            />
          </div>
          <p className="mt-2 text-xs text-ink-faint">Vista previa con datos de ejemplo.</p>
        </div>
      </div>
    </div>
  );
}
