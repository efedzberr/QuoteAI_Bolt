// Utilerías del editor de la plantilla del PDF (Ajustes > PDF de cotización).

export const claseCampo =
  'w-full h-9 px-2.5 border border-rule rounded-lg text-sm text-ink bg-white placeholder:text-ink-faint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft transition';
export const claseEtiqueta = 'block text-[11px] font-semibold text-ink-soft uppercase tracking-wide mb-1';
const baseBotonIcono =
  'inline-flex items-center justify-center w-7 h-7 flex-shrink-0 rounded-md text-ink-faint hover:bg-rule-soft disabled:opacity-30 disabled:hover:bg-transparent transition-colors';
export const claseBotonIcono = `${baseBotonIcono} hover:text-ink disabled:hover:text-ink-faint`;
export const claseBotonEliminar = `${baseBotonIcono} hover:text-bad`;

/** Devuelve la lista con el elemento `i` movido un lugar hacia arriba (-1) o hacia abajo (1). */
export function moverElemento<T>(lista: T[], i: number, delta: -1 | 1): T[] {
  const j = i + delta;
  if (j < 0 || j >= lista.length) return lista;
  const copia = [...lista];
  [copia[i], copia[j]] = [copia[j], copia[i]];
  return copia;
}

/** Identificador para una celda nueva. */
export function nuevoIdCelda(): string {
  return `c${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

/** Limita un número a un rango. Si no es un número devuelve el mínimo. */
export function acotar(n: number, min: number, max: number): number {
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
}

// --- Imagen de la marca de agua ---
// La imagen se guarda dentro de la plantilla, así que antes se aligera: lado mayor y calidad de cada intento.
const INTENTOS: [number, number][] = [[1400, 0.85], [1000, 0.75], [800, 0.6]];
const LIMITE_CARACTERES = 400000;
const ERROR_LECTURA = 'No se pudo leer la imagen. Usa un archivo PNG o JPG.';

function cargarImagen(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(ERROR_LECTURA));
    img.src = url;
  });
}

/**
 * Convierte la imagen elegida en un JPG ligero con fondo blanco, como texto (data URL), que es lo que
 * se guarda en la plantilla. Así el PDF siempre recibe un formato que sabe dibujar y la plantilla no pesa de más.
 */
export async function prepararImagenMarcaAgua(archivo: File): Promise<string> {
  const url = URL.createObjectURL(archivo);
  try {
    const img = await cargarImagen(url);
    const ancho = img.naturalWidth;
    const alto = img.naturalHeight;
    if (!ancho || !alto) throw new Error(ERROR_LECTURA);

    for (const [ladoMayor, calidad] of INTENTOS) {
      const escala = Math.min(1, ladoMayor / Math.max(ancho, alto));
      const lienzo = document.createElement('canvas');
      lienzo.width = Math.max(1, Math.round(ancho * escala));
      lienzo.height = Math.max(1, Math.round(alto * escala));
      const ctx = lienzo.getContext('2d');
      if (!ctx) throw new Error('El navegador no pudo preparar la imagen.');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, lienzo.width, lienzo.height);
      ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height);
      const datos = lienzo.toDataURL('image/jpeg', calidad);
      if (datos.length <= LIMITE_CARACTERES) return datos;
    }
    throw new Error('La imagen pesa demasiado aun reducida. Usa una imagen más sencilla.');
  } finally {
    URL.revokeObjectURL(url);
  }
}
