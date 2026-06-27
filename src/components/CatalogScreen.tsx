import { useState, useEffect, useCallback } from 'react';
import { Search, ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { escapeIlikeTerm } from '../lib/productDatabase';

const PAGE_SIZE = 100;

type Tab = 'catalogo' | 'creados';

interface Filters {
  search: string;
  marca: string;
  departamento: string;
  categoria: string;
  precioMin: string;
  precioMax: string;
}

const emptyFilters: Filters = { search: '', marca: '', departamento: '', categoria: '', precioMin: '', precioMax: '' };

export default function CatalogScreen() {
  const [tab, setTab] = useState<Tab>('catalogo');
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [goToPage, setGoToPage] = useState('');

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const fetchData = useCallback(async () => {
    setLoading(true);
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    try {
      if (tab === 'catalogo') {
        let q = supabase
          .from('products')
          .select('CodigoArt, DescCortaArt, DescLargaArt, Marca, IDMarca, DeptoArt, CategoriaArt, SubCategoriaArt, UMP, Precio, CodBarras, GarantiaArt, PesoArt, AnchoArt, AltoArt, ProfundidadArt, ValorAtrib4, ValorAtrib5, ValorAtrib6, ValorAtrib7, ValorAtrib8', { count: 'exact' });

        if (filters.search.trim()) {
          const term = `%${escapeIlikeTerm(filters.search)}%`;
          q = q.or(`CodigoArt.ilike."${term}",DescCortaArt.ilike."${term}",DescLargaArt.ilike."${term}",Marca.ilike."${term}",CodBarras.ilike."${term}"`);
        }
        if (filters.marca.trim()) {
          q = q.ilike('Marca', `%${escapeIlikeTerm(filters.marca)}%`);
        }
        if (filters.departamento.trim()) {
          q = q.ilike('DeptoArt', `%${escapeIlikeTerm(filters.departamento)}%`);
        }
        if (filters.categoria.trim()) {
          q = q.ilike('CategoriaArt', `%${escapeIlikeTerm(filters.categoria)}%`);
        }
        if (filters.precioMin.trim()) {
          const min = parseFloat(filters.precioMin);
          if (!isNaN(min)) q = q.gte('Precio', min);
        }
        if (filters.precioMax.trim()) {
          const max = parseFloat(filters.precioMax);
          if (!isNaN(max)) q = q.lte('Precio', max);
        }

        q = q.order('DescCortaArt', { ascending: true }).range(from, to);

        const { data, count, error } = await q;
        if (error) {
          console.error('[Catalog] products query error:', error);
          setRows([]);
          setTotalCount(0);
        } else {
          setRows(data || []);
          setTotalCount(count ?? 0);
        }
      } else {
        let q = supabase
          .from('productos_nuevos')
          .select('codigo, descripcion_corta, descripcion_larga, marca, departamento, categoria, subcategoria, unidad_medida, precio_unitario, codigo_barras, garantia, sincronizado_sf, created_at', { count: 'exact' });

        if (filters.search.trim()) {
          const term = `%${escapeIlikeTerm(filters.search)}%`;
          q = q.or(`codigo.ilike."${term}",descripcion_corta.ilike."${term}",descripcion_larga.ilike."${term}",marca.ilike."${term}"`);
        }
        if (filters.marca.trim()) {
          q = q.ilike('marca', `%${escapeIlikeTerm(filters.marca)}%`);
        }
        if (filters.departamento.trim()) {
          q = q.ilike('departamento', `%${escapeIlikeTerm(filters.departamento)}%`);
        }
        if (filters.categoria.trim()) {
          q = q.ilike('categoria', `%${escapeIlikeTerm(filters.categoria)}%`);
        }
        if (filters.precioMin.trim()) {
          const min = parseFloat(filters.precioMin);
          if (!isNaN(min)) q = q.gte('precio_unitario', min);
        }
        if (filters.precioMax.trim()) {
          const max = parseFloat(filters.precioMax);
          if (!isNaN(max)) q = q.lte('precio_unitario', max);
        }

        q = q.order('descripcion_corta', { ascending: true }).range(from, to);

        const { data, count, error } = await q;
        if (error) {
          console.error('[Catalog] productos_nuevos query error:', error);
          setRows([]);
          setTotalCount(0);
        } else {
          setRows(data || []);
          setTotalCount(count ?? 0);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [tab, page, filters]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleFilterChange = (key: keyof Filters, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters(emptyFilters);
    setPage(1);
  };

  const hasActiveFilters = Object.values(filters).some((v) => v.trim() !== '');

  const handleGoToPage = () => {
    const p = parseInt(goToPage, 10);
    if (!isNaN(p) && p >= 1 && p <= totalPages) {
      setPage(p);
      setGoToPage('');
    }
  };

  const formatMXN = (value: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 }).format(value);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-rule">
        <button
          onClick={() => { setTab('catalogo'); setPage(1); setFilters(emptyFilters); }}
          className={`px-4 py-2.5 text-sm font-semibold rounded-t-md transition-colors ${
            tab === 'catalogo' ? 'text-brand border-b-2 border-brand bg-brand-soft/40' : 'text-ink-faint hover:text-ink'
          }`}
        >
          Catalogo
        </button>
        <button
          onClick={() => { setTab('creados'); setPage(1); setFilters(emptyFilters); }}
          className={`px-4 py-2.5 text-sm font-semibold rounded-t-md transition-colors ${
            tab === 'creados' ? 'text-brand border-b-2 border-brand bg-brand-soft/40' : 'text-ink-faint hover:text-ink'
          }`}
        >
          Productos creados
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-rule-soft p-4 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              placeholder="Buscar por codigo, descripcion, marca..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-rule-soft rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
            />
          </div>
          <input
            type="text"
            value={filters.marca}
            onChange={(e) => handleFilterChange('marca', e.target.value)}
            placeholder="Marca"
            className="w-full px-3 py-2 text-sm border border-rule-soft rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
          />
          <input
            type="text"
            value={filters.departamento}
            onChange={(e) => handleFilterChange('departamento', e.target.value)}
            placeholder="Departamento"
            className="w-full px-3 py-2 text-sm border border-rule-soft rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
          />
          <input
            type="text"
            value={filters.categoria}
            onChange={(e) => handleFilterChange('categoria', e.target.value)}
            placeholder="Categoria"
            className="w-full px-3 py-2 text-sm border border-rule-soft rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
          />
          <div className="flex gap-2">
            <input
              type="number"
              value={filters.precioMin}
              onChange={(e) => handleFilterChange('precioMin', e.target.value)}
              placeholder="$ Min"
              className="w-full px-3 py-2 text-sm border border-rule-soft rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
            />
            <input
              type="number"
              value={filters.precioMax}
              onChange={(e) => handleFilterChange('precioMax', e.target.value)}
              placeholder="$ Max"
              className="w-full px-3 py-2 text-sm border border-rule-soft rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
            />
          </div>
        </div>
        {hasActiveFilters && (
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-ink-faint bg-rule-soft rounded-md hover:bg-rule transition-colors"
            >
              <X className="w-3 h-3" />
              Limpiar filtros
            </button>
            <span className="text-xs text-ink-faint">{totalCount.toLocaleString('es-MX')} resultados</span>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-rule-soft shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-ink-faint">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm font-medium">Cargando...</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-sm text-ink-faint">
            No se encontraron productos con esos filtros.
          </div>
        ) : (
          <div className="overflow-x-auto">
            {tab === 'catalogo' ? <CatalogTable rows={rows} formatMXN={formatMXN} /> : <CreatedTable rows={rows} formatMXN={formatMXN} formatDate={formatDate} />}
          </div>
        )}

        {/* Pagination */}
        {totalCount > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-rule-soft bg-[#FAFAFA]">
            <span className="text-xs text-ink-faint">
              Pagina {page} de {totalPages} &middot; {totalCount.toLocaleString('es-MX')} productos
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-md text-ink-faint hover:bg-rule-soft disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <PaginationNumbers page={page} totalPages={totalPages} onPageChange={setPage} />
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-md text-ink-faint hover:bg-rule-soft disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-ink-faint">Ir a:</span>
              <input
                type="number"
                value={goToPage}
                onChange={(e) => setGoToPage(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleGoToPage(); }}
                min={1}
                max={totalPages}
                className="w-16 px-2 py-1 text-xs border border-rule-soft rounded-md focus:outline-none focus:ring-1 focus:ring-brand/30"
              />
              <button
                onClick={handleGoToPage}
                className="px-2.5 py-1 text-xs font-semibold text-brand bg-brand-soft rounded-md hover:bg-brand/10 transition-colors"
              >
                Ir
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Pagination Numbers ─── */

function PaginationNumbers({ page, totalPages, onPageChange }: { page: number; totalPages: number; onPageChange: (p: number) => void }) {
  const pages: (number | '...')[] = [];

  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push('...');
    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (page < totalPages - 2) pages.push('...');
    pages.push(totalPages);
  }

  return (
    <>
      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`dots-${i}`} className="px-1 text-xs text-ink-faint">...</span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`min-w-[28px] h-7 rounded-md text-xs font-semibold transition-colors ${
              p === page ? 'bg-brand text-white' : 'text-ink-faint hover:bg-rule-soft'
            }`}
          >
            {p}
          </button>
        )
      )}
    </>
  );
}

/* ─── Catalog Table ─── */

const CATALOG_COLS = [
  { key: 'CodigoArt', label: 'Codigo', sticky: true },
  { key: 'DescCortaArt', label: 'Desc. Corta' },
  { key: 'DescLargaArt', label: 'Desc. Larga' },
  { key: 'Marca', label: 'Marca' },
  { key: 'IDMarca', label: 'ID Marca' },
  { key: 'DeptoArt', label: 'Depto' },
  { key: 'CategoriaArt', label: 'Categoria' },
  { key: 'SubCategoriaArt', label: 'Subcategoria' },
  { key: 'UMP', label: 'UMP' },
  { key: 'Precio', label: 'Precio' },
  { key: 'CodBarras', label: 'Cod. Barras' },
  { key: 'GarantiaArt', label: 'Garantia' },
  { key: 'PesoArt', label: 'Peso' },
  { key: 'AnchoArt', label: 'Ancho' },
  { key: 'AltoArt', label: 'Alto' },
  { key: 'ProfundidadArt', label: 'Profundidad' },
  { key: 'ValorAtrib4', label: 'Atrib4' },
  { key: 'ValorAtrib5', label: 'Atrib5' },
  { key: 'ValorAtrib6', label: 'Atrib6' },
  { key: 'ValorAtrib7', label: 'Atrib7' },
  { key: 'ValorAtrib8', label: 'Atrib8' },
];

function CatalogTable({ rows, formatMXN }: { rows: any[]; formatMXN: (v: number) => string }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-xs text-ink-faint uppercase tracking-wider border-b border-rule-soft bg-[#FAFAFA]">
          {CATALOG_COLS.map((col) => (
            <th
              key={col.key}
              className={`text-left py-2.5 px-3 font-medium whitespace-nowrap ${col.sticky ? 'sticky left-0 bg-[#FAFAFA] z-10' : ''}`}
            >
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="border-b border-rule-soft last:border-0 hover:bg-brand-soft/20 transition-colors">
            {CATALOG_COLS.map((col) => (
              <td
                key={col.key}
                className={`py-2 px-3 whitespace-nowrap text-ink-soft ${col.sticky ? 'sticky left-0 bg-white z-10 font-medium text-ink' : ''}`}
              >
                {col.key === 'Precio'
                  ? row[col.key] != null ? formatMXN(Number(row[col.key])) : '-'
                  : row[col.key] ?? '-'}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ─── Created Products Table ─── */

const CREATED_COLS = [
  { key: 'codigo', label: 'Codigo' },
  { key: 'descripcion_corta', label: 'Desc. Corta' },
  { key: 'descripcion_larga', label: 'Desc. Larga' },
  { key: 'marca', label: 'Marca' },
  { key: 'departamento', label: 'Depto' },
  { key: 'categoria', label: 'Categoria' },
  { key: 'subcategoria', label: 'Subcategoria' },
  { key: 'unidad_medida', label: 'Unidad' },
  { key: 'precio_unitario', label: 'Precio' },
  { key: 'codigo_barras', label: 'Cod. Barras' },
  { key: 'garantia', label: 'Garantia' },
  { key: 'sincronizado_sf', label: 'Sinc. SF' },
  { key: 'created_at', label: 'Creado' },
];

function CreatedTable({ rows, formatMXN, formatDate }: { rows: any[]; formatMXN: (v: number) => string; formatDate: (d: string) => string }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-xs text-ink-faint uppercase tracking-wider border-b border-rule-soft bg-[#FAFAFA]">
          {CREATED_COLS.map((col) => (
            <th key={col.key} className="text-left py-2.5 px-3 font-medium whitespace-nowrap">
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="border-b border-rule-soft last:border-0 hover:bg-brand-soft/20 transition-colors">
            {CREATED_COLS.map((col) => (
              <td key={col.key} className="py-2 px-3 whitespace-nowrap text-ink-soft">
                {col.key === 'precio_unitario'
                  ? row[col.key] != null ? formatMXN(Number(row[col.key])) : '-'
                  : col.key === 'sincronizado_sf'
                  ? <SyncBadge value={row[col.key]} />
                  : col.key === 'created_at'
                  ? row[col.key] ? formatDate(row[col.key]) : '-'
                  : row[col.key] ?? '-'}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SyncBadge({ value }: { value: boolean | null }) {
  if (value) {
    return <span className="inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full bg-good-soft text-good">Si</span>;
  }
  return <span className="inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full bg-rule-soft text-ink-faint">No</span>;
}
