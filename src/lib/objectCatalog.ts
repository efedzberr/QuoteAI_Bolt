import type { ObjetoSeguridad } from './seguridad';

export type FieldDataType = 'text' | 'number' | 'currency' | 'date' | 'datetime' | 'picklist' | 'user' | 'boolean';

export interface ObjectFieldDef {
  key: string;
  label: string;
  dataType: FieldDataType;
  sortable?: boolean;      // default true
  editable?: boolean;      // se puede capturar en Nuevo/Editar
  required?: boolean;
  picklist?: string[];
  lookup?: 'grupos';        // el valor se elige de una lista cargada desde la BD
  lookupAllowNew?: boolean; // permite escribir un valor que no está en la lista
  notes?: string;
  align?: 'left' | 'right';
}

export interface AdminObjectDef {
  id: string;                 // id de la vista de lista (list_views.object)
  label: string;
  singular: string;
  table: string;
  pk: string;
  pkFields?: string[];        // llave compuesta; si falta, es [pk]
  pkIsGenerated: boolean;     // true = la BD genera la llave (no se captura)
  readOnly: boolean;
  permObject: ObjetoSeguridad | null;   // objeto de perfil que controla crear/editar/eliminar
  ownerField?: string;        // habilita "Mis registros"
  select: string;             // columnas para el select (incluye embeds)
  searchFields: string[];     // búsqueda rápida (ilike)
  systemViewId: string;       // vista por default
  note?: string;
  fields: ObjectFieldDef[];
}

export const JOB_STATUS_VALUES = [
  'nueva_solicitud', 'extraccion', 'extraccion_completada', 'revision_datos', 'matching', 'matching_completado',
  'validacion', 'generacion', 'completado', 'completada', 'pdf_generado', 'error', 'procesando', 'en_revision', 'enviado_validacion',
];

export const ADMIN_OBJECTS: AdminObjectDef[] = [
  {
    id: 'propuestas', label: 'Propuestas', singular: 'propuesta', table: 'jobs', pk: 'id', pkIsGenerated: true,
    readOnly: true, permObject: 'cotizaciones', ownerField: 'owner_id',
    select: '*, owner:user_profiles!jobs_owner_id_fkey(id, full_name, email)',
    searchFields: ['referencia', 'cliente', 'nombre_proyecto', 'no_cliente', 'grupo'],
    systemViewId: 'b0000000-0000-0000-0000-000000000001',
    note: 'Las propuestas se administran desde el Dashboard; aquí solo se consultan.',
    fields: [
      { key: 'referencia', label: 'Referencia', dataType: 'text', required: true },
      { key: 'cliente', label: 'Cliente', dataType: 'text' },
      { key: 'nombre_proyecto', label: 'Proyecto', dataType: 'text', notes: 'Obra / fraccionamiento / orden a la que pertenece la propuesta' },
      { key: 'no_cliente', label: 'No. cliente', dataType: 'text', notes: 'Viene de Salesforce (noCliente)' },
      { key: 'grupo', label: 'Grupo', dataType: 'text', notes: 'Grupo de precios resuelto en el matching' },
      { key: 'status', label: 'Estatus', dataType: 'picklist', picklist: JOB_STATUS_VALUES, required: true },
      { key: 'total_lineas', label: 'Líneas', dataType: 'number', align: 'right' },
      { key: 'progreso', label: 'Progreso', dataType: 'number', align: 'right' },
      { key: 'precio_seleccionado', label: 'Precio seleccionado', dataType: 'picklist', picklist: ['grupo', 'lista'] },
      { key: 'owner_id', label: 'Propietario', dataType: 'user', sortable: false },
      { key: 'sf_opportunity_id', label: 'Oportunidad SF', dataType: 'text' },
      { key: 'sf_quote_id', label: 'Cotización SF', dataType: 'text' },
      { key: 'sf_sent_at', label: 'Enviada a SF', dataType: 'datetime' },
      { key: 'created_at', label: 'Fecha de creación', dataType: 'datetime', required: true },
      { key: 'updated_at', label: 'Última actualización', dataType: 'datetime' },
    ],
  },
  {
    id: 'grupos', label: 'Grupos', singular: 'grupo', table: 'grupo', pk: 'group_name', pkFields: ['group_name', 'no_cliente'], pkIsGenerated: false,
    readOnly: false, permObject: 'grupos',
    select: '*',
    searchFields: ['group_name', 'no_cliente'],
    systemViewId: 'b0000000-0000-0000-0000-000000000003',
    note: 'Relación cliente → grupo de precios. La carga externa escribe loaded_at; los cambios manuales pueden ser sobrescritos por una recarga.',
    fields: [
      { key: 'group_name', label: 'Grupo', dataType: 'text', required: true, editable: true, lookup: 'grupos', lookupAllowNew: true, notes: 'Elige un grupo existente; solo escribe uno nuevo si realmente no existe. Referenciado por precio_grupo.group_name' },
      { key: 'no_cliente', label: 'No. cliente', dataType: 'text', required: true, editable: true, notes: 'Junto con Grupo forma la llave del registro' },
      { key: 'loaded_at', label: 'Cargado', dataType: 'datetime', notes: 'Fecha de carga externa' },
    ],
  },
  {
    id: 'productos', label: 'Productos', singular: 'producto', table: 'products', pk: 'CodigoArt', pkIsGenerated: false,
    readOnly: true, permObject: null,
    select: 'CodigoArt,DescCortaArt,DescLargaArt,Marca,UMP,DeptoArt,CategoriaArt,SubCategoriaArt,CodBarras,GarantiaArt,PesoArt,Precio',
    searchFields: ['CodigoArt', 'DescCortaArt', 'DescLargaArt', 'Marca', 'CodBarras'],
    systemViewId: 'b0000000-0000-0000-0000-000000000004',
    note: 'Catálogo maestro (solo lectura). Se carga por importación; no se edita desde la app.',
    fields: [
      { key: 'CodigoArt', label: 'Código', dataType: 'text', required: true },
      { key: 'DescCortaArt', label: 'Descripción corta', dataType: 'text' },
      { key: 'DescLargaArt', label: 'Descripción larga', dataType: 'text' },
      { key: 'Marca', label: 'Marca', dataType: 'text' },
      { key: 'UMP', label: 'UMP', dataType: 'text' },
      { key: 'DeptoArt', label: 'Departamento', dataType: 'text' },
      { key: 'CategoriaArt', label: 'Categoría', dataType: 'text' },
      { key: 'SubCategoriaArt', label: 'Subcategoría', dataType: 'text' },
      { key: 'CodBarras', label: 'Código de barras', dataType: 'text' },
      { key: 'GarantiaArt', label: 'Garantía', dataType: 'text' },
      { key: 'PesoArt', label: 'Peso', dataType: 'number', align: 'right' },
      { key: 'Precio', label: 'Precio lista', dataType: 'currency', align: 'right' },
    ],
  },
  {
    id: 'precio_grupo', label: 'Precio grupo', singular: 'precio', table: 'precio_grupo', pk: 'id', pkIsGenerated: true,
    readOnly: false, permObject: 'precio_grupo',
    select: '*',
    searchFields: ['group_name', 'codigo_art'],
    systemViewId: 'b0000000-0000-0000-0000-000000000005',
    note: 'Precio por grupo y artículo. La carga externa escribe loaded_at; los cambios manuales pueden ser sobrescritos por una recarga.',
    fields: [
      { key: 'id', label: 'ID', dataType: 'number', align: 'right' },
      { key: 'group_name', label: 'Grupo', dataType: 'text', required: true, editable: true, lookup: 'grupos', lookupAllowNew: false, notes: 'Debe existir en Grupos' },
      { key: 'codigo_art', label: 'Código', dataType: 'text', required: true, editable: true, notes: 'Código del catálogo (products.CodigoArt)' },
      { key: 'no_corto_art', label: 'No. corto', dataType: 'number', editable: true, align: 'right' },
      { key: 'art_principal', label: 'Art. principal', dataType: 'number', editable: true, align: 'right' },
      { key: 'precio_art', label: 'Precio', dataType: 'currency', editable: true, align: 'right' },
      { key: 'precio_promo_art', label: 'Precio promo', dataType: 'currency', editable: true, align: 'right', notes: 'Si es > 0 tiene prioridad en el matching' },
      { key: 'loaded_at', label: 'Cargado', dataType: 'datetime', notes: 'Fecha de carga externa' },
    ],
  },
];

export function adminObjectFor(id: string): AdminObjectDef | undefined {
  return ADMIN_OBJECTS.find(o => o.id === id);
}

export function fieldMap(def: AdminObjectDef): Map<string, ObjectFieldDef> {
  return new Map(def.fields.map(f => [f.key, f]));
}

export function pkFieldsOf(def: AdminObjectDef): string[] {
  return def.pkFields && def.pkFields.length > 0 ? def.pkFields : [def.pk];
}

export function rowKey(def: AdminObjectDef, row: Record<string, unknown>): string {
  return pkFieldsOf(def).map(k => String(row[k] ?? '')).join('||');
}

export function pkMatch(def: AdminObjectDef, row: Record<string, unknown>): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const k of pkFieldsOf(def)) out[k] = row[k] as string | number;
  return out;
}

export function isPkField(def: AdminObjectDef, key: string): boolean {
  return pkFieldsOf(def).includes(key);
}

export function formatCell(field: ObjectFieldDef, value: unknown, row?: Record<string, unknown>): string {
  if (field.dataType === 'user') {
    const owner = row?.owner as { full_name?: string | null; email?: string } | null | undefined;
    return owner?.full_name || owner?.email || (value ? String(value) : '—');
  }
  if (value === null || value === undefined || value === '') return '—';
  switch (field.dataType) {
    case 'currency': {
      const n = typeof value === 'number' ? value : parseFloat(String(value));
      return isNaN(n) ? String(value) : n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
    }
    case 'number': {
      const n = typeof value === 'number' ? value : parseFloat(String(value));
      return isNaN(n) ? String(value) : n.toLocaleString('es-MX');
    }
    case 'date':
      return new Date(String(value)).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
    case 'datetime':
      return new Date(String(value)).toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    case 'boolean':
      return value ? 'Sí' : 'No';
    default:
      return String(value);
  }
}
