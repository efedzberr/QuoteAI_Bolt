import { X, Clock } from 'lucide-react';
import { type AdminObjectDef, type ObjectFieldDef, formatCell } from '../../lib/objectCatalog';
import { formatAuditDate, formatRelative, resolveAuditUser } from '../../lib/auditFormat';

type Row = Record<string, unknown>;
type Profile = { full_name?: string | null; email?: string } | null | undefined;

const AUDIT_KEYS = new Set(['created_at', 'created_by', 'updated_at', 'updated_by']);

interface Props {
  def: AdminObjectDef;
  row: Row;
  onClose: () => void;
}

function AuditLine({ label, iso, userId, profile }: { label: string; iso: string | null; userId: string | null | undefined; profile: Profile }) {
  const date = formatAuditDate(iso);
  const rel = formatRelative(iso);
  const user = resolveAuditUser(userId as string | null, profile);
  return (
    <div>
      <p className="text-xs font-semibold text-ink-soft uppercase tracking-wide mb-1">{label}</p>
      <p className="text-sm text-ink">
        <span className="font-medium">{user}</span>
        <span className="mx-1.5 text-ink-faint">&middot;</span>
        <span title={rel} className="cursor-default">{date}</span>
      </p>
    </div>
  );
}

export default function RecordDetailDrawer({ def, row, onClose }: Props) {
  const visibleFields = def.fields.filter(f => !AUDIT_KEYS.has(f.key));

  const createdIso = row.created_at as string | null;
  const updatedIso = row.updated_at as string | null;
  const createdById = row.created_by as string | null | undefined;
  const updatedById = row.updated_by as string | null | undefined;
  const creadorProfile = row.creador as Profile;
  const actualizadorProfile = row.actualizador as Profile;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white border-l border-rule shadow-xl flex flex-col animate-in slide-in-from-right duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-rule bg-rule-soft/50">
          <div>
            <p className="text-xs font-semibold text-ink-soft uppercase tracking-wide">{def.singular}</p>
            <h2 className="text-lg font-bold text-ink mt-0.5 truncate">{primaryLabel(def, row)}</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-ink-faint hover:bg-rule-soft hover:text-ink transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {visibleFields.map(f => (
            <FieldRow key={f.key} field={f} value={row[f.key]} row={row} />
          ))}

          <div className="border-t border-rule pt-5 mt-6">
            <div className="flex items-center gap-1.5 mb-4">
              <Clock className="w-3.5 h-3.5 text-ink-faint" />
              <h3 className="text-xs font-bold text-ink-soft uppercase tracking-wide">Informaci&oacute;n del sistema</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <AuditLine label="Creado por" iso={createdIso} userId={createdById} profile={creadorProfile} />
              <AuditLine label="&Uacute;ltima modificaci&oacute;n por" iso={updatedIso} userId={updatedById} profile={actualizadorProfile} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function FieldRow({ field, value, row }: { field: ObjectFieldDef; value: unknown; row: Row }) {
  return (
    <div>
      <p className="text-xs font-semibold text-ink-soft uppercase tracking-wide mb-0.5">{field.label}</p>
      <p className={`text-sm text-ink ${field.dataType === 'currency' || field.dataType === 'number' ? 'font-mono' : ''}`}>
        {formatCell(field, value, row)}
      </p>
    </div>
  );
}

function primaryLabel(def: AdminObjectDef, row: Row): string {
  const first = def.fields[0];
  if (!first) return String(row[def.pk] ?? '');
  const v = row[first.key];
  return v != null && v !== '' ? String(v) : String(row[def.pk] ?? '');
}
