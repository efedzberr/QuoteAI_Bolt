import { createClient } from '@supabase/supabase-js';

const productsClient = createClient(
  'https://sfwblexfjrctgokscuqz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmd2JsZXhmanJjdGdva3NjdXF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0NzU1OTQsImV4cCI6MjA4ODA1MTU5NH0.OEIpY8e5oAW0RlzBODZ-t2ofiJ7VZxtxrmggLDZxKdA'
);

export interface Product {
  ProductCode: string;
  ProductName: string;
  Description: string;
  UnitPrice: number;
  UnitOfMeasure: string;
  Category: string;
  Department: string;
  Manufacturer: string;
  CodBarras: string;
}

export function escapeIlikeTerm(term: string): string {
  return term
    .replace(/[\\"]/g, '')
    .replace(/[%_]/g, '')
    .trim();
}

export async function searchProducts(
  query: string,
  category: string,
  department: string
): Promise<Product[]> {
  let dbQuery = productsClient
    .from('products')
    .select(
      'CodigoArt, DescCortaArt, DescLargaArt, Precio, UMP, CategoriaArt, DeptoArt, Marca, CodBarras, ValorAtrib4, ValorAtrib5, ValorAtrib6, ValorAtrib7, ValorAtrib8'
    )
    .order('DescCortaArt')
    .limit(50);

  if (query.trim()) {
    const q = escapeIlikeTerm(query);
    if (q) {
      dbQuery = dbQuery.or(
        [
          `CodigoArt.ilike."%${q}%"`,
          `DescCortaArt.ilike."%${q}%"`,
          `DescLargaArt.ilike."%${q}%"`,
          `Marca.ilike."%${q}%"`,
          `CodBarras.ilike."%${q}%"`,
          `ValorAtrib4.ilike."%${q}%"`,
          `ValorAtrib5.ilike."%${q}%"`,
          `ValorAtrib6.ilike."%${q}%"`,
          `ValorAtrib7.ilike."%${q}%"`,
          `ValorAtrib8.ilike."%${q}%"`,
        ].join(',')
      );
    }
  }

  if (category && category !== 'ALL') {
    dbQuery = dbQuery.eq('CategoriaArt', category);
  }

  if (department && department !== 'ALL') {
    dbQuery = dbQuery.eq('DeptoArt', department);
  }

  const { data, error } = await dbQuery;

  if (error) console.error('searchProducts error:', error);
  if (error || !data) return [];

  return data.map((row) => ({
    ProductCode: row.CodigoArt,
    ProductName: row.DescCortaArt,
    Description: row.DescLargaArt || '',
    UnitPrice: Number(row.Precio) || 0,
    UnitOfMeasure: row.UMP || 'PZ',
    Category: row.CategoriaArt || '',
    Department: row.DeptoArt || '',
    Manufacturer: row.Marca || '',
    CodBarras: row.CodBarras || '',
  }));
}

export async function getCategories(): Promise<string[]> {
  const { data, error } = await productsClient
    .from('products')
    .select('CategoriaArt');

  if (error || !data) return ['ALL'];

  const unique = [
    ...new Set(
      data
        .map((r) => r.CategoriaArt)
        .filter((v): v is string => !!v && v.trim() !== '')
    ),
  ].sort();

  return ['ALL', ...unique];
}

export async function getDepartments(): Promise<string[]> {
  const { data, error } = await productsClient
    .from('products')
    .select('DeptoArt');

  if (error || !data) return ['ALL'];

  const unique = [
    ...new Set(
      data
        .map((r) => r.DeptoArt)
        .filter((v): v is string => !!v && v.trim() !== '')
    ),
  ].sort();

  return ['ALL', ...unique];
}
