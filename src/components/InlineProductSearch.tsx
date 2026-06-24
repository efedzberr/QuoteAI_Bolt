import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Loader2, X, ChevronDown, Filter, RotateCcw } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { escapeIlikeTerm } from '../lib/productDatabase';

const productsClient = createClient(
  'https://sfwblexfjrctgokscuqz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmd2JsZXhmanJjdGdva3NjdXF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0NzU1OTQsImV4cCI6MjA4ODA1MTU5NH0.OEIpY8e5oAW0RlzBODZ-t2ofiJ7VZxtxrmggLDZxKdA'
);

export interface SearchProduct {
  CodigoArt: string;
  DescCortaArt: string;
  DescLargaArt: string;
  Marca: string;
  Precio: number;
  UMP: string;
}

interface FacetRow {
  marca: string | null;
  depto: string | null;
  categoria: string | null;
  subcategoria: string | null;
}

interface InlineProductSearchProps {
  placeholder?: string;
  initialValue?: string;
  onSelect: (product: SearchProduct) => void;
  onCancel: () => void;
  autoFocus?: boolean;
  value?: string;
}

function CheckboxDropdown({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (vals: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [filterText, setFilterText] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
        setFilterText('');
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const visibleOptions = useMemo(() => {
    if (!filterText.trim()) return options;
    const lower = filterText.toLowerCase();
    return options.filter((o) => o.toLowerCase().includes(lower));
  }, [options, filterText]);

  const toggleOption = (val: string) => {
    if (selected.includes(val)) {
      onChange(selected.filter((v) => v !== val));
    } else {
      onChange([...selected, val]);
    }
  };

  const buttonLabel = selected.length > 0 ? `${label} (${selected.length})` : label;

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        onClick={() => { setOpen(!open); setFilterText(''); }}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-all ${
          selected.length > 0
            ? 'border-[#00A99D] bg-[#F0FDFA] text-[#00796B]'
            : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
        }`}
      >
        <span className="truncate max-w-[120px]">{buttonLabel}</span>
        <ChevronDown className={`w-3 h-3 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-60 bg-white border border-gray-200 rounded-lg shadow-xl z-[70] flex flex-col max-h-72">
          <div className="p-2 border-b border-gray-100">
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Buscar..."
              className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#00A99D] focus:border-[#00A99D]"
              autoFocus
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>
          <div className="overflow-y-auto flex-1 p-1.5">
            {visibleOptions.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-4">Sin opciones</p>
            )}
            {visibleOptions.map((opt) => (
              <label
                key={opt}
                className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md hover:bg-gray-50 cursor-pointer"
                onMouseDown={(e) => e.preventDefault()}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(opt)}
                  onChange={() => toggleOption(opt)}
                  className="w-3.5 h-3.5 rounded border-gray-300 text-[#00A99D] focus:ring-[#00A99D] cursor-pointer"
                />
                <span className="text-xs text-gray-700 truncate">{opt}</span>
              </label>
            ))}
          </div>
          {selected.length > 0 && (
            <div className="border-t border-gray-100 p-2">
              <button
                type="button"
                onClick={() => onChange([])}
                className="w-full text-xs text-[#00796B] hover:text-[#004D40] font-medium py-1"
              >
                Limpiar seleccion
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function InlineProductSearch({
  placeholder = 'Buscar por nombre, codigo o marca...',
  initialValue = '',
  onSelect,
  onCancel,
  autoFocus = true,
  value,
}: InlineProductSearchProps) {
  const [searchTerm, setSearchTerm] = useState(value !== undefined ? value : initialValue);
  const [results, setResults] = useState<SearchProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [resultCount, setResultCount] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const reqIdRef = useRef(0);

  // Facets state
  const [facets, setFacets] = useState<FacetRow[]>([]);
  const [selectedMarcas, setSelectedMarcas] = useState<string[]>([]);
  const [selectedCategorias, setSelectedCategorias] = useState<string[]>([]);
  const [selectedTipos, setSelectedTipos] = useState<string[]>([]);
  const facetsLoaded = useRef(false);

  // Load facets once
  useEffect(() => {
    if (facetsLoaded.current) return;
    facetsLoaded.current = true;
    productsClient.rpc('get_product_facets').then(({ data }) => {
      if (data) setFacets(data as FacetRow[]);
    });
  }, []);

  // Derive marca options: all unique non-null marcas from facets
  const marcaOptions = useMemo(() => {
    const set = new Set<string>();
    for (const f of facets) {
      if (f.marca) set.add(f.marca);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }, [facets]);

  // Derive categoria options: filtered by selected marcas
  const categoriaOptions = useMemo(() => {
    const set = new Set<string>();
    const source = selectedMarcas.length > 0
      ? facets.filter((f) => f.marca !== null && selectedMarcas.includes(f.marca))
      : facets;
    for (const f of source) {
      if (f.categoria) set.add(f.categoria);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }, [facets, selectedMarcas]);

  // Derive tipo options: filtered by selected marcas AND categorias
  const tipoOptions = useMemo(() => {
    const set = new Set<string>();
    let source = facets;
    if (selectedMarcas.length > 0) {
      source = source.filter((f) => f.marca !== null && selectedMarcas.includes(f.marca));
    }
    if (selectedCategorias.length > 0) {
      source = source.filter((f) => f.categoria !== null && selectedCategorias.includes(f.categoria));
    }
    for (const f of source) {
      if (f.subcategoria) set.add(f.subcategoria);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }, [facets, selectedMarcas, selectedCategorias]);

  // Prune downstream selections when upstream changes
  useEffect(() => {
    setSelectedCategorias((prev) => prev.filter((c) => categoriaOptions.includes(c)));
  }, [categoriaOptions]);

  useEffect(() => {
    setSelectedTipos((prev) => prev.filter((t) => tipoOptions.includes(t)));
  }, [tipoOptions]);

  const hasAnyFilter = selectedMarcas.length > 0 || selectedCategorias.length > 0 || selectedTipos.length > 0;

  const performSearch = useCallback(async (
    term: string,
    marcas: string[],
    categorias: string[],
    tipos: string[]
  ) => {
    const words = term.trim().split(/\s+/).filter(Boolean).map(escapeIlikeTerm).filter(Boolean);
    const hasText = words.length > 0;
    const hasFilters = marcas.length > 0 || categorias.length > 0 || tipos.length > 0;

    if (!hasText && !hasFilters) {
      setResults([]);
      setResultCount(null);
      setShowDropdown(false);
      return;
    }

    const myId = ++reqIdRef.current;
    setLoading(true);
    try {
      let query = productsClient
        .from('products')
        .select('CodigoArt, DescCortaArt, DescLargaArt, Marca, Precio, UMP')
        .limit(50);

      // Text search: each word must match at least one field (AND between words)
      for (const w of words) {
        query = query.or(
          [
            `DescCortaArt.ilike.%${w}%`,
            `DescLargaArt.ilike.%${w}%`,
            `Marca.ilike.%${w}%`,
            `CategoriaArt.ilike.%${w}%`,
            `SubCategoriaArt.ilike.%${w}%`,
            `CodigoArt.ilike.%${w}%`,
          ].join(',')
        );
      }

      // Facet filters
      if (marcas.length > 0) query = query.in('Marca', marcas);
      if (categorias.length > 0) query = query.in('CategoriaArt', categorias);
      if (tipos.length > 0) query = query.in('SubCategoriaArt', tipos);

      const { data, error } = await query;
      if (myId !== reqIdRef.current) return;
      if (error) console.error('Search error:', error);
      const items = (data as SearchProduct[]) || [];
      setResults(items);
      setResultCount(items.length);
      setShowDropdown(true);
    } catch (err) {
      if (myId !== reqIdRef.current) return;
      console.error('Search error:', err);
      setResults([]);
      setResultCount(0);
    } finally {
      if (myId === reqIdRef.current) setLoading(false);
    }
  }, []);

  // Debounced trigger on text or filter changes
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const hasText = searchTerm.trim().length >= 2;
    const hasFilters = selectedMarcas.length > 0 || selectedCategorias.length > 0 || selectedTipos.length > 0;

    if (!hasText && !hasFilters) {
      setResults([]);
      setResultCount(null);
      setShowDropdown(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      performSearch(searchTerm, selectedMarcas, selectedCategorias, selectedTipos);
    }, 300);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchTerm, selectedMarcas, selectedCategorias, selectedTipos, performSearch]);

  useEffect(() => {
    if (autoFocus && inputRef.current) inputRef.current.focus();
  }, [autoFocus]);

  useEffect(() => {
    if (value !== undefined) setSearchTerm(value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setShowDropdown(false);
        onCancel();
      }
    }
    document.addEventListener('mouseup', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mouseup', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onCancel]);

  const handleSelect = (product: SearchProduct) => {
    onSelect(product);
    setShowDropdown(false);
  };

  const clearAll = () => {
    setSelectedMarcas([]);
    setSelectedCategorias([]);
    setSelectedTipos([]);
    setSearchTerm('');
    setResults([]);
    setResultCount(null);
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  let dropdownStyle: React.CSSProperties = {};
  if (showDropdown && inputRef.current) {
    const rect = inputRef.current.getBoundingClientRect();
    dropdownStyle = {
      position: 'fixed',
      top: `${rect.bottom + 4}px`,
      left: `${rect.left}px`,
      width: `${Math.max(rect.width, 480)}px`,
      minHeight: '100px',
    };
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Filters row */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <Filter className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
        <CheckboxDropdown
          label="Marca"
          options={marcaOptions}
          selected={selectedMarcas}
          onChange={setSelectedMarcas}
        />
        <CheckboxDropdown
          label="Categoria"
          options={categoriaOptions}
          selected={selectedCategorias}
          onChange={setSelectedCategorias}
        />
        <CheckboxDropdown
          label="Tipo"
          options={tipoOptions}
          selected={selectedTipos}
          onChange={setSelectedTipos}
        />
        {(hasAnyFilter || searchTerm.trim().length > 0) && (
          <button
            type="button"
            onClick={clearAll}
            className="flex items-center gap-1 text-xs text-[#00796B] hover:text-[#004D40] font-medium px-2 py-1 rounded hover:bg-[#F0FDFA] transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Text search input */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (debounceRef.current) clearTimeout(debounceRef.current);
              performSearch(searchTerm, selectedMarcas, selectedCategorias, selectedTipos);
            }
          }}
          placeholder={placeholder}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#00A99D] focus:border-transparent"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
        )}
        {!loading && searchTerm && (
          <button
            onClick={() => {
              setSearchTerm('');
              if (!hasAnyFilter) {
                setResults([]);
                setResultCount(null);
                setShowDropdown(false);
              }
              inputRef.current?.focus();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Result count */}
      {resultCount !== null && !loading && (
        <div className="mt-1.5">
          <span className="text-xs text-gray-500">
            {resultCount} resultado{resultCount !== 1 ? 's' : ''}
            {resultCount === 50 && ' (max)'}
          </span>
        </div>
      )}

      {/* Results dropdown */}
      {showDropdown && (
        <div
          ref={dropdownRef}
          className="bg-white border border-gray-300 rounded-md shadow-lg z-[9999] max-h-72 overflow-y-auto"
          style={dropdownStyle}
        >
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
            </div>
          )}

          {!loading && results.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-gray-500">
              Sin resultados
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="py-1">
              {results.map((product) => (
                <button
                  key={product.CodigoArt}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(product);
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                >
                  <div className="font-semibold text-gray-900 text-sm">
                    {product.DescCortaArt}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 space-x-2">
                    <span>{product.CodigoArt}</span>
                    <span>&middot;</span>
                    <span>{product.Marca}</span>
                    <span>&middot;</span>
                    <span>${Number(product.Precio).toFixed(2)}</span>
                    <span>{product.UMP}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
