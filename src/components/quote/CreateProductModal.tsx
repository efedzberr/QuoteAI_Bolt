import { useState, useCallback, useEffect } from 'react';
import { X, ChevronDown, ChevronRight, AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { escapeIlikeTerm } from '../../lib/productDatabase';

const productsClient = createClient(
  'https://sfwblexfjrctgokscuqz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmd2JsZXhmanJjdGdva3NjdXF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0NzU1OTQsImV4cCI6MjA4ODA1MTU5NH0.OEIpY8e5oAW0RlzBODZ-t2ofiJ7VZxtxrmggLDZxKdA'
);

export interface NewProductData {
  id: string;
  codigo: string;
  descripcion_corta: string;
  descripcion_larga: string;
  marca: string;
  unidad_medida: string;
  precio_unitario: number;
}

export interface PrefillData {
  originalText: string;
  quantity: number;
  unitOfMeasure: string;
}

interface DuplicateMatch {
  source: 'catalogo' | 'productos_nuevos';
  codigo: string;
  descripcion: string;
  marca: string;
  precio: number;
}

interface CreateProductModalProps {
  open: boolean;
  onClose: () => void;
  onProductCreated: (product: NewProductData, quantity: number) => void;
  prefillData?: PrefillData | null;
}

function removeAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function truncateAtWord(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const truncated = text.substring(0, maxLen);
  const lastSpace = truncated.lastIndexOf(' ');
  return lastSpace > 0 ? truncated.substring(0, lastSpace) : truncated;
}

function extractCode(text: string): string {
  const match = text.match(/\b([A-Z0-9]+-[A-Z0-9]+(?:-[A-Z0-9]+)*)\.?\s*$/);
  return match ? match[1] : '';
}

export default function CreateProductModal({ open, onClose, onProductCreated, prefillData }: CreateProductModalProps) {
  const [codigo, setCodigo] = useState('');
  const [descripcionCorta, setDescripcionCorta] = useState('');
  const [descripcionLarga, setDescripcionLarga] = useState('');
  const [marca, setMarca] = useState('');
  const [unidadMedida, setUnidadMedida] = useState('PZ');
  const [precioUnitario, setPrecioUnitario] = useState('');
  const [cantidad, setCantidad] = useState('1');

  const [departamento, setDepartamento] = useState('');
  const [categoria, setCategoria] = useState('');
  const [subcategoria, setSubcategoria] = useState('');
  const [peso, setPeso] = useState('');
  const [ancho, setAncho] = useState('');
  const [alto, setAlto] = useState('');
  const [profundidad, setProfundidad] = useState('');
  const [garantia, setGarantia] = useState('');
  const [codigoBarras, setCodigoBarras] = useState('');

  const [showExtras, setShowExtras] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [duplicate, setDuplicate] = useState<DuplicateMatch | null>(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);

  const resetForm = useCallback(() => {
    setCodigo('');
    setDescripcionCorta('');
    setDescripcionLarga('');
    setMarca('');
    setUnidadMedida('PZ');
    setPrecioUnitario('');
    setCantidad('1');
    setDepartamento('');
    setCategoria('');
    setSubcategoria('');
    setPeso('');
    setAncho('');
    setAlto('');
    setProfundidad('');
    setGarantia('');
    setCodigoBarras('');
    setShowExtras(false);
    setErrors({});
    setDuplicate(null);
  }, []);

  useEffect(() => {
    if (open && prefillData) {
      const text = prefillData.originalText || '';
      setDescripcionLarga(text);
      setDescripcionCorta(truncateAtWord(text, 80));
      setCantidad(String(Math.max(1, Math.round(prefillData.quantity || 1))));
      const um = (prefillData.unitOfMeasure || 'PZ').trim().toUpperCase();
      const validUnits = ['PZ', 'MT', 'KG', 'LT', 'JG', 'RL', 'CJ', 'PAR', 'TB', 'BT'];
      setUnidadMedida(validUnits.includes(um) ? um : 'PZ');
      setCodigo(extractCode(text));
      setMarca('');
      setPrecioUnitario('');
      setErrors({});
      setDuplicate(null);
    }
  }, [open, prefillData]);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [onClose, resetForm]);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!descripcionCorta.trim()) e.descripcionCorta = 'La descripcion corta es obligatoria.';
    if (!marca.trim()) e.marca = 'La marca es obligatoria.';
    if (!unidadMedida.trim()) e.unidadMedida = 'La unidad de medida es obligatoria.';
    const precio = parseFloat(precioUnitario);
    if (!precioUnitario.trim() || isNaN(precio) || precio <= 0) {
      e.precioUnitario = 'El precio unitario debe ser mayor a 0.';
    }
    const qty = parseInt(cantidad, 10);
    if (!cantidad.trim() || isNaN(qty) || qty <= 0) {
      e.cantidad = 'La cantidad debe ser un entero mayor a 0.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const checkDuplicates = async (): Promise<DuplicateMatch | null> => {
    setCheckingDuplicate(true);
    try {
      const descNorm = removeAccents(descripcionCorta.trim().toLowerCase());

      if (codigo.trim()) {
        const codTerm = escapeIlikeTerm(codigo.trim());
        const { data: catMatch } = await productsClient
          .from('products')
          .select('CodigoArt, DescCortaArt, Marca, Precio')
          .ilike('CodigoArt', codTerm)
          .limit(1);

        if (catMatch && catMatch.length > 0) {
          return {
            source: 'catalogo',
            codigo: catMatch[0].CodigoArt,
            descripcion: catMatch[0].DescCortaArt,
            marca: catMatch[0].Marca || '',
            precio: Number(catMatch[0].Precio) || 0,
          };
        }

        const { data: newMatch } = await supabase
          .from('productos_nuevos')
          .select('id, codigo, descripcion_corta, marca, precio_unitario')
          .ilike('codigo', codTerm)
          .limit(1);

        if (newMatch && newMatch.length > 0) {
          return {
            source: 'productos_nuevos',
            codigo: newMatch[0].codigo || '',
            descripcion: newMatch[0].descripcion_corta,
            marca: newMatch[0].marca,
            precio: Number(newMatch[0].precio_unitario) || 0,
          };
        }
      }

      const descTerm = escapeIlikeTerm(descripcionCorta.trim());
      if (descTerm.length >= 3) {
        const { data: catDescMatch } = await productsClient
          .from('products')
          .select('CodigoArt, DescCortaArt, Marca, Precio')
          .ilike('DescCortaArt', descTerm)
          .limit(1);

        if (catDescMatch && catDescMatch.length > 0) {
          const matchNorm = removeAccents(catDescMatch[0].DescCortaArt.toLowerCase());
          if (matchNorm === descNorm) {
            return {
              source: 'catalogo',
              codigo: catDescMatch[0].CodigoArt,
              descripcion: catDescMatch[0].DescCortaArt,
              marca: catDescMatch[0].Marca || '',
              precio: Number(catDescMatch[0].Precio) || 0,
            };
          }
        }

        const { data: newDescMatch } = await supabase
          .from('productos_nuevos')
          .select('id, codigo, descripcion_corta, marca, precio_unitario')
          .ilike('descripcion_corta', descTerm)
          .limit(1);

        if (newDescMatch && newDescMatch.length > 0) {
          const matchNorm = removeAccents(newDescMatch[0].descripcion_corta.toLowerCase());
          if (matchNorm === descNorm) {
            return {
              source: 'productos_nuevos',
              codigo: newDescMatch[0].codigo || '',
              descripcion: newDescMatch[0].descripcion_corta,
              marca: newDescMatch[0].marca,
              precio: Number(newDescMatch[0].precio_unitario) || 0,
            };
          }
        }
      }

      return null;
    } catch (err) {
      console.error('[CreateProduct] Duplicate check error:', err);
      return null;
    } finally {
      setCheckingDuplicate(false);
    }
  };

  const handleSave = async (forceSave = false) => {
    if (!validate()) return;

    if (!forceSave) {
      const dup = await checkDuplicates();
      if (dup) {
        setDuplicate(dup);
        return;
      }
    }

    setSaving(true);
    try {
      const precio = parseFloat(precioUnitario);
      const qty = parseInt(cantidad, 10);

      const insertData: Record<string, any> = {
        descripcion_corta: descripcionCorta.trim(),
        marca: marca.trim(),
        unidad_medida: unidadMedida.trim(),
        precio_unitario: precio,
      };
      if (codigo.trim()) insertData.codigo = codigo.trim();
      if (descripcionLarga.trim()) insertData.descripcion_larga = descripcionLarga.trim();
      if (departamento.trim()) insertData.departamento = departamento.trim();
      if (categoria.trim()) insertData.categoria = categoria.trim();
      if (subcategoria.trim()) insertData.subcategoria = subcategoria.trim();
      if (peso.trim()) insertData.peso = parseFloat(peso);
      if (ancho.trim()) insertData.ancho = parseFloat(ancho);
      if (alto.trim()) insertData.alto = parseFloat(alto);
      if (profundidad.trim()) insertData.profundidad = parseFloat(profundidad);
      if (garantia.trim()) insertData.garantia = garantia.trim();
      if (codigoBarras.trim()) insertData.codigo_barras = codigoBarras.trim();

      const { data, error } = await supabase
        .from('productos_nuevos')
        .insert(insertData)
        .select('id')
        .single();

      if (error) {
        setErrors({ general: `Error al guardar: ${error.message}` });
        return;
      }

      onProductCreated(
        {
          id: data.id,
          codigo: codigo.trim(),
          descripcion_corta: descripcionCorta.trim(),
          descripcion_larga: descripcionLarga.trim(),
          marca: marca.trim(),
          unidad_medida: unidadMedida.trim(),
          precio_unitario: precio,
        },
        qty
      );
      resetForm();
    } catch (err: any) {
      setErrors({ general: `Error inesperado: ${err?.message || String(err)}` });
    } finally {
      setSaving(false);
    }
  };

  const handleUseDuplicate = () => {
    if (!duplicate) return;
    const qty = parseInt(cantidad, 10) || 1;
    onProductCreated(
      {
        id: '',
        codigo: duplicate.codigo,
        descripcion_corta: duplicate.descripcion,
        descripcion_larga: '',
        marca: duplicate.marca,
        unidad_medida: unidadMedida.trim() || 'PZ',
        precio_unitario: duplicate.precio,
      },
      qty
    );
    resetForm();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-50 overflow-y-auto py-8">
      <div
        className="bg-white rounded-xl w-full max-w-lg mx-4 border border-[#E5E5E5]"
        style={{ boxShadow: '0 12px 24px rgba(0,0,0,.15)' }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E5E5]">
          <h2 className="text-[#181818]" style={{ fontSize: 17, fontWeight: 700, fontFamily: "'Manrope', sans-serif" }}>
            Crear producto nuevo
          </h2>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full hover:bg-[#F0F0F0] flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-[#747474]" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {errors.general && (
            <div className="p-3 rounded-lg bg-[#FEDED7] text-[#BA0517] text-sm font-medium">
              {errors.general}
            </div>
          )}

          {duplicate && (
            <div className="p-4 rounded-lg bg-[#FEF1DC] border border-[#F5C242]">
              <div className="flex items-start gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-[#B86C00] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[#92400E] font-semibold text-sm">Ya existe un producto similar</p>
                  <p className="text-[#92400E] text-xs mt-1">
                    <strong>{duplicate.descripcion}</strong> ({duplicate.codigo}) - {duplicate.marca} - ${duplicate.precio.toFixed(2)}
                    <br />
                    <span className="text-[#B86C00]">Origen: {duplicate.source === 'catalogo' ? 'Catalogo principal' : 'Productos nuevos'}</span>
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleUseDuplicate}
                  className="flex-1 px-3 py-2 bg-white border border-[#E5E5E5] rounded-lg text-[#181818] hover:bg-[#FAFAFA] transition-colors"
                  style={{ fontSize: 12, fontWeight: 600 }}
                >
                  Usar producto existente
                </button>
                <button
                  onClick={() => { setDuplicate(null); handleSave(true); }}
                  className="flex-1 px-3 py-2 bg-[#0176D3] text-white rounded-lg hover:bg-[#014486] transition-colors"
                  style={{ fontSize: 12, fontWeight: 600 }}
                >
                  Crear de todos modos
                </button>
              </div>
            </div>
          )}

          <FormField label="Descripcion corta *" error={errors.descripcionCorta}>
            <input
              type="text"
              value={descripcionCorta}
              onChange={(e) => setDescripcionCorta(e.target.value)}
              placeholder="Nombre del producto"
              className="form-input-style"
            />
          </FormField>

          <FormField label="Marca *" error={errors.marca}>
            <input
              type="text"
              value={marca}
              onChange={(e) => setMarca(e.target.value)}
              placeholder="ej. DeWalt, Truper, Stanley"
              className="form-input-style"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Unidad de medida *" error={errors.unidadMedida}>
              <select
                value={unidadMedida}
                onChange={(e) => setUnidadMedida(e.target.value)}
                className="form-input-style"
              >
                <option value="PZ">PZ - Pieza</option>
                <option value="MT">MT - Metro</option>
                <option value="KG">KG - Kilogramo</option>
                <option value="LT">LT - Litro</option>
                <option value="JG">JG - Juego</option>
                <option value="RL">RL - Rollo</option>
                <option value="CJ">CJ - Caja</option>
                <option value="PAR">PAR - Par</option>
                <option value="TB">TB - Tubo</option>
                <option value="BT">BT - Bote</option>
              </select>
            </FormField>

            <FormField label="Precio unitario (MXN, sin IVA) *" error={errors.precioUnitario}>
              <input
                type="number"
                value={precioUnitario}
                onChange={(e) => setPrecioUnitario(e.target.value)}
                placeholder="0.00"
                min="0.01"
                step="0.01"
                className="form-input-style"
              />
            </FormField>
          </div>

          <FormField label="Cantidad *" error={errors.cantidad}>
            <input
              type="number"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              placeholder="1"
              min="1"
              step="1"
              className="form-input-style w-28"
            />
          </FormField>

          <FormField label="Codigo (opcional)">
            <input
              type="text"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="Codigo del producto"
              className="form-input-style"
            />
          </FormField>

          <FormField label="Descripcion larga (opcional)">
            <textarea
              value={descripcionLarga}
              onChange={(e) => setDescripcionLarga(e.target.value)}
              placeholder="Descripcion detallada del producto"
              rows={2}
              className="form-input-style resize-none"
            />
          </FormField>

          <button
            type="button"
            onClick={() => setShowExtras(!showExtras)}
            className="flex items-center gap-2 text-[#0176D3] hover:text-[#014486] transition-colors py-1"
            style={{ fontSize: 13, fontWeight: 600 }}
          >
            {showExtras ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            Campos adicionales (opcional)
          </button>

          {showExtras && (
            <div className="space-y-3 pl-2 border-l-2 border-[#EAF5FE]">
              <div className="grid grid-cols-3 gap-3">
                <FormField label="Departamento">
                  <input type="text" value={departamento} onChange={(e) => setDepartamento(e.target.value)} className="form-input-style" />
                </FormField>
                <FormField label="Categoria">
                  <input type="text" value={categoria} onChange={(e) => setCategoria(e.target.value)} className="form-input-style" />
                </FormField>
                <FormField label="Subcategoria">
                  <input type="text" value={subcategoria} onChange={(e) => setSubcategoria(e.target.value)} className="form-input-style" />
                </FormField>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <FormField label="Peso">
                  <input type="number" value={peso} onChange={(e) => setPeso(e.target.value)} className="form-input-style" placeholder="kg" />
                </FormField>
                <FormField label="Ancho">
                  <input type="number" value={ancho} onChange={(e) => setAncho(e.target.value)} className="form-input-style" placeholder="cm" />
                </FormField>
                <FormField label="Alto">
                  <input type="number" value={alto} onChange={(e) => setAlto(e.target.value)} className="form-input-style" placeholder="cm" />
                </FormField>
                <FormField label="Profundidad">
                  <input type="number" value={profundidad} onChange={(e) => setProfundidad(e.target.value)} className="form-input-style" placeholder="cm" />
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Garantia">
                  <input type="text" value={garantia} onChange={(e) => setGarantia(e.target.value)} className="form-input-style" placeholder="ej. 1 ano" />
                </FormField>
                <FormField label="Codigo de barras">
                  <input type="text" value={codigoBarras} onChange={(e) => setCodigoBarras(e.target.value)} className="form-input-style" />
                </FormField>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-[#E5E5E5]">
          <button
            onClick={handleClose}
            className="px-4 py-2.5 text-[#444444] bg-[#F0F0F0] rounded-lg hover:bg-[#E5E5E5] transition-colors"
            style={{ fontSize: 13, fontWeight: 600 }}
          >
            Cancelar
          </button>
          <button
            onClick={() => handleSave(false)}
            disabled={saving || checkingDuplicate}
            className="px-5 py-2.5 bg-[#0176D3] text-white rounded-lg hover:bg-[#014486] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            style={{ fontSize: 13, fontWeight: 700 }}
          >
            {(saving || checkingDuplicate) && <Loader2 className="w-4 h-4 animate-spin" />}
            Guardar producto
          </button>
        </div>
      </div>
    </div>
  );
}

function FormField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label
        className="block text-[#444444] mb-1.5"
        style={{ fontSize: 12, fontWeight: 600, fontFamily: "'Manrope', sans-serif" }}
      >
        {label}
      </label>
      {children}
      {error && <p className="mt-1 text-[#BA0517]" style={{ fontSize: 11, fontWeight: 500 }}>{error}</p>}
    </div>
  );
}
