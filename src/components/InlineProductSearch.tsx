import { useState, useCallback, useEffect, useRef } from 'react';
import { Loader2, X } from 'lucide-react';
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

interface InlineProductSearchProps {
  placeholder?: string;
  initialValue?: string;
  onSelect: (product: SearchProduct) => void;
  onCancel: () => void;
  autoFocus?: boolean;
  value?: string;
}

export default function InlineProductSearch({
  placeholder = 'Buscar por nombre, código o marca...',
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
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const reqIdRef = useRef(0);

  const performSearch = useCallback(async (term: string) => {
    if (term.trim().length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    const myId = ++reqIdRef.current;
    setLoading(true);
    try {
      const q = escapeIlikeTerm(term);
      const { data, error } = await productsClient
        .from('products')
        .select('CodigoArt, DescCortaArt, DescLargaArt, Marca, Precio, UMP')
        .or(
          [
            `DescCortaArt.ilike."%${q}%"`,
            `DescLargaArt.ilike."%${q}%"`,
            `CodigoArt.ilike."%${q}%"`,
            `Marca.ilike."%${q}%"`,
          ].join(',')
        )
        .limit(10);

      if (myId !== reqIdRef.current) return;
      if (error) console.error('Search error:', error);
      setResults((data as SearchProduct[]) || []);
      setShowDropdown(true);
    } catch (error) {
      if (myId !== reqIdRef.current) return;
      console.error('Search error:', error);
      setResults([]);
    } finally {
      if (myId === reqIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (searchTerm.length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      performSearch(searchTerm);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchTerm, performSearch]);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    if (value !== undefined) {
      setSearchTerm(value);
    }
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
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

  const highlightMatch = (text: string, term: string) => {
    if (!term || !text) return text;
    const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const safe = escapeRegExp(term);
    if (!safe) return text;
    const regex = new RegExp(`(${safe})`, 'gi');
    const parts = text.split(regex);
    const lower = term.toLowerCase();
    return parts.map((part, i) =>
      part.toLowerCase() === lower
        ? <span key={i} className="bg-yellow-200 font-medium">{part}</span>
        : part
    );
  };

  const handleSelect = (product: SearchProduct) => {
    console.log('handleSelect called with:', product.CodigoArt);
    onSelect(product);
    console.log('onSelect called');
    setShowDropdown(false);
  };

  let dropdownStyle: React.CSSProperties = {};
  if (showDropdown && inputRef.current) {
    const inputRect = inputRef.current.getBoundingClientRect();
    dropdownStyle = {
      position: 'fixed',
      top: `${inputRect.bottom + 4}px`,
      left: `${inputRect.left}px`,
      width: `${inputRect.width}px`,
      minHeight: '200px',
    };
  }

  return (
    <div className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
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
              setShowDropdown(false);
              inputRef.current?.focus();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {showDropdown && searchTerm.length >= 2 && (
        <div
          ref={dropdownRef}
          className="bg-white border border-gray-300 rounded-md shadow-lg z-9999 max-h-72 overflow-y-auto"
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
                    console.log('onMouseDown fired for:', product.CodigoArt);
                    e.preventDefault();
                    handleSelect(product);
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                >
                  <div className="font-semibold text-gray-900 text-sm">
                    {highlightMatch(product.DescCortaArt, searchTerm)}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 space-x-2">
                    <span>{product.CodigoArt}</span>
                    <span>·</span>
                    <span>{product.Marca}</span>
                    <span>·</span>
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
