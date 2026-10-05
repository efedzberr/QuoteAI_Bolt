import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import type { PdfConfig } from './pdfConfig';
import { DATOS_PDF_VACIOS, type CatalogoPdf, type CuentaPdf, type DatosPdf, type ProductoCatalogo } from './pdfDatos';
import { codigosCatalogo, usaCatalogo } from './pdfLinea';

/**
 * Guarda con la cotización una copia de la cuenta de Salesforce elegida al capturarla.
 * El PDF toma de ahí los datos del cliente. Si falla, la cotización sigue igual.
 */
export async function guardarCuentaCotizacion(referencia: string, cuenta: unknown): Promise<void> {
  if (!referencia || !cuenta || typeof cuenta !== 'object') return;
  const { error } = await supabase.from('jobs').update({ cuenta_sf: cuenta }).eq('referencia', referencia);
  if (error) console.error('[pdf] guardarCuentaCotizacion error:', error);
}

async function usuarioActual(): Promise<{ nombre: string; correo: string }> {
  const { data } = await supabase.auth.getUser();
  const user = data?.user;
  if (!user) return { nombre: '', correo: '' };
  const { data: perfil } = await supabase.from('user_profiles').select('full_name, email').eq('id', user.id).maybeSingle();
  const correo = (perfil?.email as string | null) || user.email || '';
  return { nombre: (perfil?.full_name as string | null) || correo.split('@')[0] || '', correo };
}

/**
 * Datos del PDF que no vienen en la cotización: la cuenta guardada y quién la elaboró
 * (el dueño de la cotización; si no hay cotización guardada, el usuario actual).
 * Nunca lanza un error: si algo falla devuelve lo que tenga.
 */
export async function fetchDatosPdf(referencia?: string | null): Promise<DatosPdf> {
  let cuenta: CuentaPdf | null = null;
  let elaboro = '';
  let elaboroCorreo = '';
  try {
    if (referencia) {
      const { data, error } = await supabase
        .from('jobs')
        .select('cuenta_sf, owner:user_profiles!jobs_owner_id_fkey(full_name, email)')
        .eq('referencia', referencia)
        .maybeSingle();
      if (error) console.error('[pdf] fetchDatosPdf error:', error);
      const fila = data as { cuenta_sf?: unknown; owner?: unknown } | null;
      if (fila?.cuenta_sf && typeof fila.cuenta_sf === 'object') cuenta = fila.cuenta_sf as CuentaPdf;
      const dueno = (Array.isArray(fila?.owner) ? fila?.owner[0] : fila?.owner) as { full_name?: string | null; email?: string | null } | null | undefined;
      if (dueno) {
        elaboroCorreo = dueno.email || '';
        elaboro = dueno.full_name || elaboroCorreo.split('@')[0] || '';
      }
    }
    if (!elaboro) {
      const actual = await usuarioActual();
      elaboro = actual.nombre;
      elaboroCorreo = actual.correo;
    }
  } catch (e) {
    console.error('[pdf] fetchDatosPdf error:', e);
  }
  return { cuenta, elaboro, elaboroCorreo };
}

// Columnas del catálogo que lee la tabla del PDF. Si la consulta falla (por ejemplo, porque alguna columna
// no existe en esta base), se repite con las básicas.
const COLUMNAS_CATALOGO =
  'CodigoArt, Marca, DescLargaArt, GarantiaArt, CodBarras, DeptoArt, CategoriaArt, SubCategoriaArt, PesoArt, Precio, ValorAtrib4, ValorAtrib5, ValorAtrib6, ValorAtrib7, ValorAtrib8';
const COLUMNAS_CATALOGO_BASICAS =
  'CodigoArt, Marca, DescLargaArt, CodBarras, DeptoArt, CategoriaArt, Precio, ValorAtrib4, ValorAtrib5, ValorAtrib6, ValorAtrib7, ValorAtrib8';
// Códigos por consulta, para no rebasar el largo de la dirección
const LOTE_CATALOGO = 150;

function productoDeFila(f: Record<string, unknown>): ProductoCatalogo {
  const t = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim());
  const precio = Number(f.Precio);
  return {
    marca: t(f.Marca),
    descripcionLarga: t(f.DescLargaArt),
    garantia: t(f.GarantiaArt),
    codigoBarras: t(f.CodBarras),
    departamento: t(f.DeptoArt),
    categoria: t(f.CategoriaArt),
    subcategoria: t(f.SubCategoriaArt),
    peso: t(f.PesoArt),
    precio: Number.isFinite(precio) && precio > 0 ? precio : null,
    atributos: [f.ValorAtrib4, f.ValorAtrib5, f.ValorAtrib6, f.ValorAtrib7, f.ValorAtrib8].map(t).filter(Boolean),
  };
}

async function consultarCatalogo(codigos: string[], columnas: string) {
  const filas: Record<string, unknown>[] = [];
  for (let i = 0; i < codigos.length; i += LOTE_CATALOGO) {
    const { data, error } = await supabase.from('products').select(columnas).in('CodigoArt', codigos.slice(i, i + LOTE_CATALOGO));
    if (error) return { filas, error };
    filas.push(...((data ?? []) as unknown as Record<string, unknown>[]));
  }
  return { filas, error: null };
}

/** Artículos del catálogo por código. Nunca lanza un error: si la consulta falla devuelve lo que tenga. */
export async function fetchCatalogoPdf(codigos: string[]): Promise<CatalogoPdf> {
  const catalogo: CatalogoPdf = {};
  if (codigos.length === 0) return catalogo;
  try {
    let { filas, error } = await consultarCatalogo(codigos, COLUMNAS_CATALOGO);
    if (error) {
      console.error('[pdf] fetchCatalogoPdf error, se repite con las columnas básicas:', error);
      ({ filas, error } = await consultarCatalogo(codigos, COLUMNAS_CATALOGO_BASICAS));
      if (error) console.error('[pdf] fetchCatalogoPdf error:', error);
    }
    for (const f of filas) {
      const codigo = String(f.CodigoArt ?? '').trim();
      if (codigo && !catalogo[codigo]) catalogo[codigo] = productoDeFila(f);
    }
  } catch (e) {
    console.error('[pdf] fetchCatalogoPdf error:', e);
  }
  return catalogo;
}

const CATALOGO_VACIO: CatalogoPdf = {};

/**
 * Artículos del catálogo de las partidas, solo si alguna columna de la plantilla usa sus datos.
 * `cargando` es true mientras se consultan: el PDF debe esperar para no salir sin esos datos.
 */
export function useCatalogoPdf(lineas: unknown[], config: PdfConfig): { catalogo: CatalogoPdf; cargando: boolean } {
  const clave = usaCatalogo(config) ? codigosCatalogo(lineas).join('\n') : '';
  const [cargado, setCargado] = useState<{ clave: string; catalogo: CatalogoPdf } | null>(null);

  useEffect(() => {
    if (!clave) return;
    let vigente = true;
    fetchCatalogoPdf(clave.split('\n')).then((catalogo) => {
      if (vigente) setCargado({ clave, catalogo });
    });
    return () => {
      vigente = false;
    };
  }, [clave]);

  if (!clave) return { catalogo: CATALOGO_VACIO, cargando: false };
  return cargado?.clave === clave ? { catalogo: cargado.catalogo, cargando: false } : { catalogo: CATALOGO_VACIO, cargando: true };
}

/** Datos del PDF de una cotización; mientras cargan (o si fallan) devuelve datos vacíos. */
export function useDatosPdf(referencia?: string | null): DatosPdf {
  const [datos, setDatos] = useState<DatosPdf>(DATOS_PDF_VACIOS);
  useEffect(() => {
    let vigente = true;
    fetchDatosPdf(referencia).then((d) => {
      if (vigente) setDatos(d);
    });
    return () => {
      vigente = false;
    };
  }, [referencia]);
  return datos;
}
