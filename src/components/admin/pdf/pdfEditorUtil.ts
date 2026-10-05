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

// --- Imagen del logo ---
// El logo se guarda como PNG (conserva la transparencia) en app_settings.pdf_logo_url, igual que la marca de agua
// en la plantilla: no depende de los permisos del bucket. Lado mayor de cada intento hasta que quepa en el límite.
const INTENTOS_LOGO = [1200, 900, 600];
const LIMITE_LOGO = 350000;
const ERROR_LECTURA_LOGO = 'No se pudo leer la imagen. Usa un archivo PNG, JPG o SVG.';

/** Recuadro con contenido del lienzo: sin los márgenes en blanco o transparentes. */
function recuadroConContenido(ctx: CanvasRenderingContext2D, ancho: number, alto: number) {
  const { data } = ctx.getImageData(0, 0, ancho, alto);
  let x0 = ancho;
  let y0 = alto;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const i = (y * ancho + x) * 4;
      const fondo = data[i + 3] < 16 || (data[i] > 244 && data[i + 1] > 244 && data[i + 2] > 244);
      if (fondo) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  // Imagen completamente en blanco: se deja como está
  if (x1 < 0) return { x: 0, y: 0, ancho, alto };
  return { x: x0, y: y0, ancho: x1 - x0 + 1, alto: y1 - y0 + 1 };
}

/**
 * Convierte el logo elegido en un PNG ligero, como texto (data URL), sin los márgenes en blanco o transparentes:
 * así el logo queda al ras del texto del encabezado. Un SVG se convierte a PNG porque el PDF no dibuja SVG.
 */
export async function prepararImagenLogo(archivo: File): Promise<string> {
  const url = URL.createObjectURL(archivo);
  try {
    const img = await cargarImagen(url).catch(() => {
      throw new Error(ERROR_LECTURA_LOGO);
    });
    const ancho = img.naturalWidth;
    const alto = img.naturalHeight;
    if (!ancho || !alto) throw new Error(ERROR_LECTURA_LOGO);

    // Lienzo de trabajo: un SVG es vectorial y se dibuja a 1600 en su lado mayor; una imagen solo se reduce
    const vectorial = archivo.type === 'image/svg+xml' || /\.svg$/i.test(archivo.name);
    const escala = vectorial ? 1600 / Math.max(ancho, alto) : Math.min(1, 1600 / Math.max(ancho, alto));
    const base = document.createElement('canvas');
    base.width = Math.max(1, Math.round(ancho * escala));
    base.height = Math.max(1, Math.round(alto * escala));
    const ctxBase = base.getContext('2d');
    if (!ctxBase) throw new Error('El navegador no pudo preparar la imagen.');
    ctxBase.drawImage(img, 0, 0, base.width, base.height);

    let recorte = { x: 0, y: 0, ancho: base.width, alto: base.height };
    try {
      recorte = recuadroConContenido(ctxBase, base.width, base.height);
    } catch {
      // El navegador no dejó leer la imagen: se usa completa, sin recortar
    }

    for (const ladoMayor of INTENTOS_LOGO) {
      const k = Math.min(1, ladoMayor / Math.max(recorte.ancho, recorte.alto));
      const lienzo = document.createElement('canvas');
      lienzo.width = Math.max(1, Math.round(recorte.ancho * k));
      lienzo.height = Math.max(1, Math.round(recorte.alto * k));
      const ctx = lienzo.getContext('2d');
      if (!ctx) throw new Error('El navegador no pudo preparar la imagen.');
      ctx.drawImage(base, recorte.x, recorte.y, recorte.ancho, recorte.alto, 0, 0, lienzo.width, lienzo.height);
      const datos = lienzo.toDataURL('image/png');
      if (datos.length <= LIMITE_LOGO) return datos;
    }
    throw new Error('El logo pesa demasiado aun reducido. Usa una imagen más sencilla.');
  } finally {
    URL.revokeObjectURL(url);
  }
}
