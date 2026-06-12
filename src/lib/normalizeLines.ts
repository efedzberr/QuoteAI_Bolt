// Normalizar lines — puede llegar como array de objetos, array de strings, o string concatenado
export function normalizeLines(raw: any): any[] {
  if (!raw) return [];

  // Si es string, puede ser un JSON array o múltiples objetos separados por coma
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      // Intentar separar objetos concatenados con "}, {"
      const fixed = '[' + raw.replace(/\}\s*,\s*\{/g, '},{') + ']';
      try {
        return JSON.parse(fixed);
      } catch {
        return [];
      }
    }
  }

  // Si es array, normalizar cada elemento
  if (Array.isArray(raw)) {
    return raw.map(item => {
      if (typeof item === 'string') {
        try {
          return JSON.parse(item);
        } catch {
          return item;
        }
      }
      if (item && typeof item.value === 'string') {
        try {
          return JSON.parse(item.value);
        } catch {
          return item;
        }
      }
      return item;
    });
  }

  return [raw];
}
