import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { DATOS_PDF_VACIOS, type CuentaPdf, type DatosPdf } from './pdfDatos';

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
