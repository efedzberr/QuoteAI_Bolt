// Código de barras Code 128 (juego B): letras, números y signos comunes.
// Devuelve los anchos de barras y espacios para dibujarlo; no requiere librerías.

// Patrón de cada símbolo: anchos alternados barra, espacio, barra, espacio, barra, espacio.
const PATRONES = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232',
];
const INICIO_B = 104;
const ALTO = '2331112';

export interface BarraCodigo {
  /** Posición de la barra, en módulos desde la izquierda. */
  x: number;
  /** Ancho de la barra, en módulos. */
  ancho: number;
}

export interface CodigoBarras {
  barras: BarraCodigo[];
  /** Ancho total del código, en módulos. */
  modulos: number;
}

/**
 * Codifica un texto en Code 128 B. Los caracteres que no existen en el juego B
 * (acentos, por ejemplo) se omiten. Devuelve null si no queda nada que codificar.
 */
export function codigo128(texto: string): CodigoBarras | null {
  const valores: number[] = [];
  for (const ch of texto || '') {
    const code = ch.charCodeAt(0);
    if (code >= 32 && code <= 126) valores.push(code - 32);
  }
  if (valores.length === 0) return null;

  let suma = INICIO_B;
  valores.forEach((v, i) => { suma += v * (i + 1); });
  const simbolos = [INICIO_B, ...valores, suma % 103];
  const anchos = simbolos.map((s) => PATRONES[s]).join('') + ALTO;

  const barras: BarraCodigo[] = [];
  let x = 0;
  for (let i = 0; i < anchos.length; i++) {
    const ancho = Number(anchos[i]);
    if (i % 2 === 0) barras.push({ x, ancho });
    x += ancho;
  }
  return { barras, modulos: x };
}
