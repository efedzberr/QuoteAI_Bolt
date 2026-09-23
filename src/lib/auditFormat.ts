const TZ = 'America/Mexico_City';
const LOCALE = 'es-MX';

const dtf = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TZ,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const rtf = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto', style: 'long' });

const THRESHOLDS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['second', 60],
  ['minute', 60],
  ['hour', 24],
  ['day', 30],
  ['month', 12],
  ['year', Infinity],
];

export function formatAuditDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return dtf.format(new Date(iso));
  } catch {
    return '—';
  }
}

export function formatRelative(iso: string | null): string {
  if (!iso) return '';
  try {
    let diff = (new Date(iso).getTime() - Date.now()) / 1000;
    for (const [unit, max] of THRESHOLDS) {
      if (Math.abs(diff) < max) return rtf.format(Math.round(diff), unit);
      diff /= max;
    }
    return '';
  } catch {
    return '';
  }
}

type AuditProfile = { full_name?: string | null; email?: string } | null | undefined;

export function resolveAuditUser(
  userId: string | null | undefined,
  profile: AuditProfile,
): string {
  if (!userId) return 'Importación';
  if (!profile) return 'Usuario del sistema';
  const name = profile.full_name || profile.email || '';
  return name || 'Usuario del sistema';
}
