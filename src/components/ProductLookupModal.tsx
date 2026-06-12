import { useState, useCallback, useEffect, useRef } from 'react';
import { Search, X, Package, Loader2 } from 'lucide-react';
import { searchProducts, getCategories, getDepartments, type Product } from '../lib/productDatabase';

export type ProductResult = Product;

interface ProductLookupModalProps {
  open: boolean;
  initialSearch?: string;
  onSelect: (product: ProductResult) => void;
  onClose: () => void;
}

export default function ProductLookupModal({ open, initialSearch = '', onSelect, onClose }: ProductLookupModalProps) {
  const [query, setQuery] = useState(initialSearch);
  const [category, setCategory] = useState('ALL');
  const [department, setDepartment] = useState('ALL');
  const [categories, setCategories] = useState<string[]>(['ALL']);
  const [departments, setDepartments] = useState<string[]>(['ALL']);
  const [results, setResults] = useState<ProductResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const reqIdRef = useRef(0);

  const runSearch = useCallback(async (q: string, cat: string, dept: string) => {
    const myId = ++reqIdRef.current;
    setLoading(true);
    setSearched(true);
    const data = await searchProducts(q, cat, dept);
    if (myId !== reqIdRef.current) return;
    setResults(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery(initialSearch);
      setCategory('ALL');
      setDepartment('ALL');
      setResults([]);
      setSearched(false);
      runSearch(initialSearch, 'ALL', 'ALL');
      getCategories().then(setCategories);
      getDepartments().then(setDepartments);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, initialSearch, runSearch]);

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      runSearch(query, category, department);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, category, department, open, runSearch]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 pt-[10vh]">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col" style={{ maxHeight: '70vh' }}>
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h3 className="text-lg font-bold text-gray-900">Buscar Producto</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="px-6 pb-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre, codigo, marca o atributos..."
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00A99D] focus:border-transparent text-sm"
            />
            {loading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 animate-spin" />
            )}
          </div>

          <div className="flex gap-3">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#00A99D] focus:border-transparent"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c === 'ALL' ? 'Todas las categorias' : c}
                </option>
              ))}
            </select>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#00A99D] focus:border-transparent"
            >
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d === 'ALL' ? 'Todos los departamentos' : d}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-5">
          {!loading && searched && results.length === 0 && (
            <div className="text-center py-10 text-gray-400">
              <Package className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No se encontraron productos</p>
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-1">
              {results.map((product) => (
                <button
                  key={product.ProductCode}
                  onClick={() => onSelect(product)}
                  className="w-full text-left px-4 py-3 rounded-lg hover:bg-[#F0FAFA] border border-transparent hover:border-[#00A99D]/30 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 text-sm group-hover:text-[#00A99D] transition-colors">
                        {product.ProductName}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-gray-500">{product.ProductCode}</span>
                        {product.Category && <span className="text-xs text-gray-400">{product.Category}</span>}
                        {product.Manufacturer && <span className="text-xs text-gray-400">{product.Manufacturer}</span>}
                        <span className="text-xs text-gray-400">{product.UnitOfMeasure}</span>
                      </div>
                    </div>
                    <div className="text-sm font-bold text-gray-900 ml-4">
                      ${product.UnitPrice.toFixed(2)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
