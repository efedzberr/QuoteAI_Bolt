import { useState, useCallback, useRef, useEffect } from 'react';
import { X, Search, Loader2, PackagePlus } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { escapeIlikeTerm } from '../../lib/productDatabase';
import CreateProductModal, { type NewProductData, type PrefillData } from './CreateProductModal';

const productsClient = createClient(
  'https://sfwblexfjrctgokscuqz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmd2JsZXhmanJjdGdva3NjdXF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0NzU1OTQsImV4cCI6MjA4ODA1MTU5NH0.OEIpY8e5oAW0RlzBODZ-t2ofiJ7VZxtxrmggLDZxKdA'
);

export interface AddLineResult {
  matched_product_code: string;
  matched_product_name: string;
  matched_unit_price: number;
  matched_unit_of_measure: string;
  quantity: number;
  source: 'catalogo' | 'producto_nuevo';
}

interface SearchResult {
  codigo: string;
  descripcion: string;
  marca: string;
  precio: number;
  unidad: string;
  source: 'catalogo' | 'producto_nuevo';
}

export interface SourceLineData {
  originalText: string;
  quantity: number;
  unitOfMeasure: string;
}

interface AddLineModalProps {
  open: boolean;
  onClose: () => void;
  onLineAdded: (result: AddLineResult) => void;
  title?: string;
  sourceLineData?: SourceLineData | null;
}

export default function AddLineModal({ open, onClose, onLineAdded, title = 'Agregar linea', sourceLineData }: AddLineModalProps) {
  const [tab, setTab] = useState<'search' | 'create'>('search');
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [quantity, setQuantity] = useState('1');
  const [selectedProduct, setSelectedProduct] = useState<SearchResult | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const reqIdRef = useRef(0);

  useEffect(() => {
    if (open && tab === 'search') {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, tab]);

  const handleClose = useCallback(() => {
    setSearchTerm('');
    setResults([]);
    setSelectedProduct(null);
    setQuantity('1');
    setTab('search');
    onClose();
  }, [onClose]);

  const performSearch = useCallback(async (term: string) => {
    if (term.trim().length < 2) {
      setResults([]);
      return;
    }

    const myId = ++reqIdRef.current;
    setLoading(true);
    try {
      const q = escapeIlikeTerm(term);
      const allResults: SearchResult[] = [];

      const { data: catData } = await productsClient
        .from('products')
        .select('CodigoArt, DescCortaArt, Marca, Precio, UMP')
        .or(
          [
            `DescCortaArt.ilike."%${q}%"`,
            `CodigoArt.ilike."%${q}%"`,
            `Marca.ilike."%${q}%"`,
          ].join(',')
        )
        .limit(8);

      if (myId !== reqIdRef.current) return;

      if (catData) {
        catData.forEach((r) => {
          allResults.push({
            codigo: r.CodigoArt,
            descripcion: r.DescCortaArt,
            marca: r.Marca || '',
            precio: Number(r.Precio) || 0,
            unidad: r.UMP || 'PZ',
            source: 'catalogo',
          });
        });
      }

      const { data: newData } = await supabase
        .from('productos_nuevos')
        .select('id, codigo, descripcion_corta, marca, precio_unitario, unidad_medida')
        .or(
          [
            `descripcion_corta.ilike.%${q}%`,
            `codigo.ilike.%${q}%`,
            `marca.ilike.%${q}%`,
          ].join(',')
        )
        .limit(5);

      if (myId !== reqIdRef.current) return;

      if (newData) {
        newData.forEach((r) => {
          allResults.push({
            codigo: r.codigo || r.id.substring(0, 8),
            descripcion: r.descripcion_corta,
            marca: r.marca,
            precio: Number(r.precio_unitario) || 0,
            unidad: r.unidad_medida || 'PZ',
            source: 'producto_nuevo',
          });
        });
      }

      setResults(allResults);
    } catch (err) {
      console.error('[AddLineModal] Search error:', err);
      setResults([]);
    } finally {
      if (myId === reqIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (searchTerm.length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => performSearch(searchTerm), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchTerm, performSearch]);

  const handleSelectProduct = (product: SearchResult) => {
    setSelectedProduct(product);
  };

  const handleConfirmAdd = () => {
    if (!selectedProduct) return;
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) return;

    onLineAdded({
      matched_product_code: selectedProduct.codigo,
      matched_product_name: selectedProduct.descripcion,
      matched_unit_price: selectedProduct.precio,
      matched_unit_of_measure: selectedProduct.unidad,
      quantity: qty,
      source: selectedProduct.source === 'producto_nuevo' ? 'producto_nuevo' : 'catalogo',
    });
    handleClose();
  };

  const handleProductCreated = (product: NewProductData, qty: number) => {
    setShowCreate(false);
    onLineAdded({
      matched_product_code: product.codigo || '',
      matched_product_name: product.descripcion_corta,
      matched_unit_price: product.precio_unitario,
      matched_unit_of_measure: product.unidad_medida,
      quantity: qty,
      source: 'producto_nuevo',
    });
    handleClose();
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-50 overflow-y-auto py-8">
        <div
          className="bg-white rounded-xl w-full max-w-xl mx-4 border border-[#E5E5E5]"
          style={{ boxShadow: '0 12px 24px rgba(0,0,0,.15)' }}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E5E5]">
            <h2 className="text-[#181818]" style={{ fontSize: 17, fontWeight: 700, fontFamily: "'Manrope', sans-serif" }}>
              {title}
            </h2>
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-full hover:bg-[#F0F0F0] flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4 text-[#747474]" />
            </button>
          </div>

          <div className="flex border-b border-[#E5E5E5]">
            <button
              onClick={() => setTab('search')}
              className={`flex-1 px-4 py-3 transition-colors border-b-2 ${
                tab === 'search'
                  ? 'border-[#0176D3] text-[#0176D3]'
                  : 'border-transparent text-[#747474] hover:text-[#181818]'
              }`}
              style={{ fontSize: 13, fontWeight: 600 }}
            >
              <Search className="w-4 h-4 inline mr-2" />
              Buscar en catalogo
            </button>
            <button
              onClick={() => setTab('create')}
              className={`flex-1 px-4 py-3 transition-colors border-b-2 ${
                tab === 'create'
                  ? 'border-[#0176D3] text-[#0176D3]'
                  : 'border-transparent text-[#747474] hover:text-[#181818]'
              }`}
              style={{ fontSize: 13, fontWeight: 600 }}
            >
              <PackagePlus className="w-4 h-4 inline mr-2" />
              Crear producto nuevo
            </button>
          </div>

          {tab === 'search' && (
            <div className="p-6">
              <div className="relative mb-4">
                <input
                  ref={inputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setSelectedProduct(null); }}
                  placeholder="Buscar por nombre, codigo o marca..."
                  className="w-full px-3.5 py-2.5 border border-[#E5E5E5] rounded-lg text-[#181818] placeholder:text-[#A3A3A3] focus:outline-none focus:border-[#0176D3] focus:ring-[3px] focus:ring-[#EAF5FE] transition-all pr-10"
                  style={{ fontSize: 13 }}
                />
                {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0176D3] animate-spin" />}
              </div>

              {results.length > 0 && !selectedProduct && (
                <div className="border border-[#E5E5E5] rounded-lg max-h-64 overflow-y-auto">
                  {results.map((product, i) => (
                    <button
                      key={`${product.source}-${product.codigo}-${i}`}
                      onClick={() => handleSelectProduct(product)}
                      className="w-full text-left px-4 py-3 hover:bg-[#FAFAFA] transition-colors border-b border-[#F0F0F0] last:border-b-0"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[#181818] font-semibold" style={{ fontSize: 13 }}>
                          {product.descripcion}
                        </span>
                        <span
                          className="inline-flex items-center rounded-full px-2 py-0.5"
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            backgroundColor: product.source === 'catalogo' ? '#EAF5FE' : '#FEF1DC',
                            color: product.source === 'catalogo' ? '#0176D3' : '#B86C00',
                          }}
                        >
                          {product.source === 'catalogo' ? 'Catalogo' : 'Producto nuevo'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[#747474]" style={{ fontSize: 11 }}>
                        <span>{product.codigo}</span>
                        <span>-</span>
                        <span>{product.marca}</span>
                        <span>-</span>
                        <span>${product.precio.toFixed(2)}</span>
                        <span>{product.unidad}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {!loading && searchTerm.length >= 2 && results.length === 0 && (
                <p className="text-center text-[#747474] py-8" style={{ fontSize: 13 }}>
                  Sin resultados para "{searchTerm}"
                </p>
              )}

              {selectedProduct && (
                <div className="mt-4 p-4 border border-[#0176D3]/30 bg-[#EAF5FE] rounded-lg">
                  <p className="text-[#181818] font-semibold" style={{ fontSize: 13 }}>
                    {selectedProduct.descripcion}
                  </p>
                  <p className="text-[#747474] mt-0.5" style={{ fontSize: 11 }}>
                    {selectedProduct.codigo} - {selectedProduct.marca} - ${selectedProduct.precio.toFixed(2)} {selectedProduct.unidad}
                  </p>
                  <div className="mt-3 flex items-end gap-3">
                    <div>
                      <label className="block text-[#444444] mb-1" style={{ fontSize: 11, fontWeight: 600 }}>Cantidad</label>
                      <input
                        type="number"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        min="1"
                        step="1"
                        className="w-20 px-3 py-2 border border-[#E5E5E5] rounded-md text-center focus:outline-none focus:border-[#0176D3] focus:ring-[3px] focus:ring-[#EAF5FE] transition-all"
                        style={{ fontSize: 13 }}
                      />
                    </div>
                    <button
                      onClick={handleConfirmAdd}
                      className="px-5 py-2 bg-[#0176D3] text-white rounded-lg hover:bg-[#014486] transition-colors"
                      style={{ fontSize: 13, fontWeight: 700 }}
                    >
                      Agregar
                    </button>
                    <button
                      onClick={() => setSelectedProduct(null)}
                      className="px-4 py-2 text-[#747474] hover:text-[#181818] transition-colors"
                      style={{ fontSize: 13, fontWeight: 600 }}
                    >
                      Cambiar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'create' && (
            <div className="p-6 text-center">
              <div className="w-14 h-14 rounded-full bg-[#EAF5FE] flex items-center justify-center mx-auto mb-4">
                <PackagePlus className="w-7 h-7 text-[#0176D3]" />
              </div>
              <p className="text-[#181818] mb-1" style={{ fontSize: 14, fontWeight: 600 }}>
                Crear un producto que no existe en el catalogo
              </p>
              <p className="text-[#747474] mb-5" style={{ fontSize: 12 }}>
                Se guardara en la base de datos para futuras cotizaciones.
              </p>
              <button
                onClick={() => setShowCreate(true)}
                className="px-5 py-2.5 bg-[#0176D3] text-white rounded-lg hover:bg-[#014486] transition-colors"
                style={{ fontSize: 13, fontWeight: 700 }}
              >
                Abrir formulario
              </button>
            </div>
          )}
        </div>
      </div>

      <CreateProductModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onProductCreated={handleProductCreated}
        prefillData={sourceLineData ? {
          originalText: sourceLineData.originalText,
          quantity: sourceLineData.quantity,
          unitOfMeasure: sourceLineData.unitOfMeasure,
        } : null}
      />
    </>
  );
}

