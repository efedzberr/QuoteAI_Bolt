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
  embed?: string;
  auditUserEmbed?: string;
  suggestions?: 'unidades_catalogo';
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
  allowCreate?: boolean;
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

const AUDIT_FIELDS: ObjectFieldDef[] = [
  { key: 'created_at', label: 'Fecha de creación', dataType: 'datetime' },
  { key: 'created_by', label: 'Creado por', dataType: 'user', sortable: false, embed: 'creador' },
  { key: 'updated_at', label: 'Última modificación', dataType: 'datetime', auditUserEmbed: 'actualizador' },
  { key: 'updated_by', label: 'Actualizado por', dataType: 'user', sortable: false, embed: 'actualizador' },
];

export const ADMIN_OBJECTS: AdminObjectDef[] = [
  {
    id: 'propuestas', label: 'Propuestas', singular: 'propuesta', table: 'jobs', pk: 'id', pkIsGenerated: true,
    readOnly: true, permObject: 'cotizaciones', ownerField: 'owner_id',
    select: '*, owner:user_profiles!jobs_owner_id_fkey(id, full_name, email), creador:user_profiles!jobs_created_by_fkey(full_name, email), actualizador:user_profiles!jobs_updated_by_fkey(full_name, email)',
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
      ...AUDIT_FIELDS,
    ],
  },
  {
    id: 'grupos', label: 'Grupos', singular: 'grupo', table: 'grupo', pk: 'group_name', pkFields: ['group_name', 'no_cliente'], pkIsGenerated: false,
    readOnly: false, permObject: 'grupos',
    select: '*, creador:user_profiles!grupo_created_by_fkey(full_name, email), actualizador:user_profiles!grupo_updated_by_fkey(full_name, email)',
    searchFields: ['group_name', 'no_cliente'],
    systemViewId: 'b0000000-0000-0000-0000-000000000003',
    note: 'Relación cliente → grupo de precios. La carga externa escribe loaded_at; los cambios manuales pueden ser sobrescritos por una recarga.',
    fields: [
      { key: 'group_name', label: 'Grupo', dataType: 'text', required: true, editable: true, lookup: 'grupos', lookupAllowNew: true, notes: 'Elige un grupo existente; solo escribe uno nuevo si realmente no existe. Referenciado por precio_grupo.group_name' },
      { key: 'no_cliente', label: 'No. cliente', dataType: 'text', required: true, editable: true, notes: 'Junto con Grupo forma la llave del registro' },
      { key: 'loaded_at', label: 'Cargado', dataType: 'datetime', notes: 'Fecha de carga externa' },
      ...AUDIT_FIELDS,
    ],
  },
  {
    id: 'productos', label: 'Productos', singular: 'producto', table: 'products', pk: 'CodigoArt', pkIsGenerated: false,
    readOnly: true, permObject: null,
    select: 'CodigoArt,DescCortaArt,DescLargaArt,Marca,UMP,DeptoArt,CategoriaArt,SubCategoriaArt,CodBarras,GarantiaArt,PesoArt,Precio,created_at,updated_at,created_by,updated_by,creador:user_profiles!products_created_by_fkey(full_name, email),actualizador:user_profiles!products_updated_by_fkey(full_name, email)',
    searchFields: ['CodigoArt', 'DescCortaArt', 'DescLargaArt', 'Marca', 'CodBarras'],
    systemViewId: 'b0000000-0000-0000-0000-000000000004',
    note: 'Catálogo maestro (solo lectura). Se carga por importación; no se edita desde la app.',
    fields: [
      { key: 'CodigoArt', label: 'Código', dataType: 'text', required: true },
      { key: 'DescCortaArt', label: 'Descripción corta', dataType: 'text' },
      { key: 'DescLargaArt', label: 'Descripción larga', dataType: 'text' },
      { key: 'Marca', label: 'Marca', dataType: 'text' },
      { key: 'UMP', label: 'UMP', dataType: 'text', suggestions: 'unidades_catalogo' },
      { key: 'DeptoArt', label: 'Departamento', dataType: 'text' },
      { key: 'CategoriaArt', label: 'Categoría', dataType: 'text' },
      { key: 'SubCategoriaArt', label: 'Subcategoría', dataType: 'text' },
      { key: 'CodBarras', label: 'Código de barras', dataType: 'text' },
      { key: 'GarantiaArt', label: 'Garantía', dataType: 'text' },
      { key: 'PesoArt', label: 'Peso', dataType: 'number', align: 'right' },
      { key: 'Precio', label: 'Precio lista', dataType: 'currency', align: 'right' },
      ...AUDIT_FIELDS,
    ],
  },
  {
    id: 'precio_grupo', label: 'Precio grupo', singular: 'precio', table: 'precio_grupo', pk: 'id', pkIsGenerated: true,
    readOnly: false, permObject: 'precio_grupo',
    select: '*, creador:user_profiles!precio_grupo_created_by_fkey(full_name, email), actualizador:user_profiles!precio_grupo_updated_by_fkey(full_name, email)',
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
      ...AUDIT_FIELDS,
    ],
  },
  {
    id: 'lineas_no_cotizadas', label: 'L\u00edneas no cotizadas', singular: 'l\u00ednea', table: 'v_lineas_no_cotizadas',
    pk: 'id', pkIsGenerated: true, readOnly: true, permObject: 'cotizaciones', ownerField: 'owner_id',
    select: '*',
    searchFields: ['referencia', 'cliente', 'descripcion_original', 'codigo_original', 'candidato_codigo', 'motivo'],
    systemViewId: 'b0000000-0000-0000-0000-000000000007',
    note: 'L\u00edneas eliminadas por el ejecutivo y l\u00edneas sin coincidencia. Incluye el producto que sugiri\u00f3 la IA y el importe estimado.',
    fields: [
      { key: 'referencia', label: 'Referencia', dataType: 'text' },
      { key: 'cliente', label: 'Cliente', dataType: 'text' },
      { key: 'no_cliente', label: 'No. cliente', dataType: 'text' },
      { key: 'nombre_proyecto', label: 'Proyecto', dataType: 'text' },
      { key: 'ejecutivo', label: 'Ejecutivo', dataType: 'text' },
      { key: 'tipo', label: 'Tipo', dataType: 'picklist', picklist: ['Eliminada por el usuario', 'Sin coincidencia'] },
      { key: 'renglon', label: 'Rengl\u00f3n', dataType: 'number', align: 'right' },
      { key: 'codigo_original', label: 'C\u00f3digo cliente', dataType: 'text' },
      { key: 'descripcion_original', label: 'Solicitud original', dataType: 'text' },
      { key: 'cantidad', label: 'Cantidad', dataType: 'number', align: 'right' },
      { key: 'unidad_original', label: 'Unidad', dataType: 'text' },
      { key: 'candidato_codigo', label: 'Candidato IA', dataType: 'text' },
      { key: 'candidato_descripcion', label: 'Descripci\u00f3n candidato', dataType: 'text' },
      { key: 'candidato_confianza', label: 'Confianza IA', dataType: 'number', align: 'right' },
      { key: 'candidato_precio', label: 'Precio candidato', dataType: 'currency', align: 'right' },
      { key: 'motivo', label: 'Motivo', dataType: 'text' },
      { key: 'comentario_eliminacion', label: 'Comentario', dataType: 'text' },
      { key: 'pendiente_clasificar', label: 'Sin clasificar', dataType: 'boolean' },
      { key: 'eliminada_por', label: 'Eliminada por', dataType: 'text' },
      { key: 'eliminada_at', label: 'Eliminada', dataType: 'datetime' },
      { key: 'importe_estimado', label: 'Importe estimado', dataType: 'currency', align: 'right' },
      { key: 'estatus_cotizacion', label: 'Estatus cotizaci\u00f3n', dataType: 'picklist', picklist: JOB_STATUS_VALUES },
      { key: 'fecha_cotizacion', label: 'Fecha', dataType: 'datetime' },
    ],
  },
  {
    id: 'aprendizaje', label: 'Aprendizaje', singular: 'correcci\u00f3n', table: 'match_correcciones',
    pk: 'id', pkIsGenerated: true, readOnly: false, permObject: 'aprendizaje', allowCreate: false,
    select: '*, usuario:user_profiles!match_correcciones_usuario_id_fkey(full_name, email), revisor:user_profiles!match_correcciones_revisado_por_fkey(full_name, email), creador:user_profiles!match_correcciones_created_by_fkey(full_name, email), actualizador:user_profiles!match_correcciones_updated_by_fkey(full_name, email)',
    searchFields: ['texto_original', 'codigo_cliente', 'ia_producto_codigo', 'producto_elegido_codigo', 'cliente', 'referencia'],
    systemViewId: 'b0000000-0000-0000-0000-000000000009',
    note: 'Lo que el ejecutivo confirm\u00f3, sustituy\u00f3 o rechaz\u00f3 frente a la IA. Se captura solo; aqu\u00ed \u00fanicamente se revoca (Activo = No) o se anota. Despu\u00e9s de revocar, el matching lo toma en m\u00e1ximo 10 minutos.',
    fields: [
      { key: 'texto_original', label: 'Texto del cliente', dataType: 'text' },
      { key: 'codigo_cliente', label: 'C\u00f3digo cliente', dataType: 'text' },
      { key: 'ia_producto_codigo', label: 'Sugerido IA', dataType: 'text' },
      { key: 'ia_producto_descripcion', label: 'Descripci\u00f3n sugerida', dataType: 'text' },
      { key: 'ia_confianza', label: 'Confianza IA', dataType: 'number', align: 'right' },
      { key: 'ia_metodo', label: 'M\u00e9todo IA', dataType: 'text' },
      { key: 'producto_elegido_codigo', label: 'Elegido', dataType: 'text' },
      { key: 'producto_elegido_descripcion', label: 'Descripci\u00f3n elegida', dataType: 'text' },
      { key: 'resultado', label: 'Resultado', dataType: 'picklist', picklist: ['confirmado', 'sustituido', 'rechazado'] },
      { key: 'cliente', label: 'Cliente', dataType: 'text' },
      { key: 'no_cliente', label: 'No. cliente', dataType: 'text' },
      { key: 'referencia', label: 'Referencia', dataType: 'text' },
      { key: 'usuario_id', label: 'Ejecutivo', dataType: 'user', sortable: false, embed: 'usuario' },
      { key: 'activo', label: 'Activo', dataType: 'boolean', editable: true, notes: 'No = el matching deja de usar esta correcci\u00f3n' },
      { key: 'nota_revision', label: 'Nota de revisi\u00f3n', dataType: 'text', editable: true },
      { key: 'revisado_por', label: 'Revisado por', dataType: 'user', sortable: false, embed: 'revisor' },
      { key: 'revisado_at', label: 'Revisado', dataType: 'datetime' },
      ...AUDIT_FIELDS,
    ],
  },
  {
    id: 'unidades_equivalentes', label: 'Unidades equivalentes', singular: 'equivalencia', table: 'unidades_equivalentes',
    pk: 'id', pkIsGenerated: true, readOnly: false, permObject: 'unidades',
    select: '*, creador:user_profiles!unidades_equivalentes_created_by_fkey(full_name, email), actualizador:user_profiles!unidades_equivalentes_updated_by_fkey(full_name, email)',
    searchFields: ['unidad_cliente', 'unidad_catalogo', 'notas'],
    systemViewId: 'b0000000-0000-0000-0000-000000000012',
    note: 'C\u00f3mo escriben los clientes una unidad y a qu\u00e9 unidad del cat\u00e1logo equivale. Solo traduce el nombre; nunca convierte cantidades. Los cambios los toma el matching en m\u00e1ximo 10 minutos.',
    fields: [
      { key: 'unidad_cliente', label: 'Unidad del cliente', dataType: 'text', required: true, editable: true, notes: 'Tal como la escribe el cliente (se guarda en may\u00fasculas)' },
      { key: 'unidad_catalogo', label: 'Unidad del cat\u00e1logo', dataType: 'text', required: true, editable: true, suggestions: 'unidades_catalogo', notes: 'Debe existir en el cat\u00e1logo de productos' },
      { key: 'activo', label: 'Activo', dataType: 'boolean', editable: true },
      { key: 'notas', label: 'Notas', dataType: 'text', editable: true },
      ...AUDIT_FIELDS,
    ],
  },
  {
    id: 'unidades_sin_traduccion', label: 'Unidades sin traducci\u00f3n', singular: 'unidad', table: 'v_unidades_sin_traduccion',
    pk: 'unidad_cliente', pkIsGenerated: false, readOnly: true, permObject: 'cotizaciones',
    select: '*',
    searchFields: ['unidad_cliente', 'unidades_catalogo', 'ejemplo'],
    systemViewId: 'b0000000-0000-0000-0000-000000000013',
    note: 'Unidades que escribieron los clientes y no se pudieron traducir a la del producto. Si una es equivalente, agr\u00e9gala en Unidades equivalentes.',
    fields: [
      { key: 'unidad_cliente', label: 'Unidad del cliente', dataType: 'text' },
      { key: 'unidades_catalogo', label: 'Unidad del cat\u00e1logo', dataType: 'text' },
      { key: 'lineas', label: 'L\u00edneas', dataType: 'number', align: 'right' },
      { key: 'cotizaciones', label: 'Cotizaciones', dataType: 'number', align: 'right' },
      { key: 'ejemplo', label: 'Ejemplo', dataType: 'text' },
      { key: 'ya_tiene_traduccion', label: 'Ya tiene traducci\u00f3n', dataType: 'boolean' },
      { key: 'ultima_vez', label: '\u00daltima vez', dataType: 'datetime' },
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
    const key = field.embed || 'owner';
    const u = row?.[key] as { full_name?: string | null; email?: string } | null | undefined;
    return u?.full_name || u?.email || (value ? String(value) : '—');
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
