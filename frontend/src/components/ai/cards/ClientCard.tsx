import type { EntityCard } from "../../../types";
import InlineEditField from "../InlineEditField";

interface Props {
  card: EntityCard;
  onAction: (action: string, params?: Record<string, any>) => void;
  onFieldSave: (fieldKey: string, value: string | number) => Promise<void>;
}

export default function ClientCard({ card, onAction, onFieldSave }: Props) {
  const d = card.data;
  const fullName = `${d.firstName ?? ""} ${d.lastName ?? ""}`.trim();
  const isEditable = (field: string) => card.editable && (card.editableFields?.includes(field) ?? card.editable);
  const propertyCount = d.properties?.length ?? d.propertyCount ?? 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm max-w-[440px]">
      {/* Header */}
      <div className="mb-3">
        <p className="text-sm font-bold text-gray-900">{fullName || "Unnamed Client"}</p>
        {d.company && <p className="text-xs text-gray-500">{d.company}</p>}
      </div>

      {/* 2-column grid: Email, Phone */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 mb-3">
        <InlineEditField
          label="Email"
          value={d.email ?? ""}
          fieldKey="email"
          fieldType="text"
          editable={isEditable("email")}
          onSave={onFieldSave}
        />
        <InlineEditField
          label="Phone"
          value={d.phone ?? ""}
          fieldKey="phone"
          fieldType="text"
          editable={isEditable("phone")}
          onSave={onFieldSave}
        />
      </div>

      {/* Notes */}
      <div className="mb-3">
        <InlineEditField
          label="Notes"
          value={d.notes ?? ""}
          fieldKey="notes"
          fieldType="textarea"
          editable={isEditable("notes")}
          onSave={onFieldSave}
        />
      </div>

      {/* Properties badge */}
      {propertyCount > 0 && (
        <div className="mb-3">
          <span className="inline-flex items-center gap-1 text-xs bg-turf-50 text-turf-700 px-2 py-0.5 rounded-full font-medium">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4" />
            </svg>
            {propertyCount} {propertyCount === 1 ? "Property" : "Properties"}
          </span>
        </div>
      )}

      {/* Action buttons */}
      {card.actions && card.actions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-gray-100">
          {card.actions.map((a) => (
            <button
              key={a.action}
              onClick={() => onAction(a.action, { ...a.params, clientId: card.id })}
              className="text-xs px-2.5 py-1 rounded-full bg-turf-50 text-turf-700 hover:bg-turf-100 font-medium transition-colors"
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
