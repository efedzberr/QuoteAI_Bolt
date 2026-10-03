// Importe con letra en español, como se imprime en cotizaciones y facturas en México:
// 282003.19 -> "DOSCIENTOS OCHENTA Y DOS MIL TRES PESOS 19/100 M.N."

const UNIDADES = [
  '', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE',
  'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE',
  'VEINTE', 'VEINTIUNO', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE',
];
const DECENAS = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
const CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

/** 0..999 en letras. `apocopar`: "UNO" se dice "UN" (antes de MIL, MILLONES o de la moneda). */
function centenas(n: number, apocopar: boolean): string {
  if (n === 0) return '';
  if (n === 100) return 'CIEN';
  const partes: string[] = [];
  const c = Math.floor(n / 100);
  const resto = n % 100;
  if (c > 0) partes.push(CENTENAS[c]);
  if (resto > 0) {
    if (resto < 30) {
      let u = UNIDADES[resto];
      if (apocopar && resto === 1) u = 'UN';
      if (apocopar && resto === 21) u = 'VEINTIÚN';
      partes.push(u);
    } else {
      const d = Math.floor(resto / 10);
      const u = resto % 10;
      if (u === 0) partes.push(DECENAS[d]);
      else partes.push(`${DECENAS[d]} Y ${apocopar && u === 1 ? 'UN' : UNIDADES[u]}`);
    }
  }
  return partes.join(' ');
}

/** Entero no negativo (hasta 999,999,999,999) en letras. `apocopar` aplica a las unidades finales. */
export function enteroALetras(n: number, apocopar = false): string {
  const entero = Math.floor(Math.abs(n));
  if (entero === 0) return 'CERO';
  const millones = Math.floor(entero / 1000000);
  const miles = Math.floor((entero % 1000000) / 1000);
  const unidades = entero % 1000;
  const partes: string[] = [];
  if (millones > 0) {
    if (millones === 1) partes.push('UN MILLÓN');
    else partes.push(`${enteroALetras(millones, true)} MILLONES`);
  }
  if (miles > 0) {
    if (miles === 1) partes.push('MIL');
    else partes.push(`${centenas(miles, true)} MIL`);
  }
  if (unidades > 0) partes.push(centenas(unidades, apocopar));
  return partes.join(' ');
}

/** Importe con letra: "DOSCIENTOS OCHENTA Y DOS MIL TRES PESOS 19/100 M.N." */
export function importeConLetra(importe: number, moneda = 'MXN'): string {
  const valor = Number.isFinite(importe) ? Math.abs(importe) : 0;
  const centavosTotales = Math.round(valor * 100);
  const entero = Math.floor(centavosTotales / 100);
  const centavos = centavosTotales % 100;
  const esDolar = (moneda || '').toUpperCase() === 'USD';
  const millonesExactos = entero > 0 && entero % 1000000 === 0;
  const nombre = esDolar ? (entero === 1 ? 'DÓLAR' : 'DÓLARES') : entero === 1 ? 'PESO' : 'PESOS';
  const sufijo = esDolar ? 'USD' : 'M.N.';
  const letras = enteroALetras(entero, true);
  return `${letras}${millonesExactos ? ' DE' : ''} ${nombre} ${String(centavos).padStart(2, '0')}/100 ${sufijo}`;
}
