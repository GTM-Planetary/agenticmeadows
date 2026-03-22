import type { EntityCard, JobStatus } from "../../../types";
import InlineEditField from "../InlineEditField";

const statusColors: Record<JobStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  SCHEDULED: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-turf-100 text-turf-700",
  COMPLETED: "bg-gray-100 text-gray-600",
  CANCELLED: "bg-red-100 text-red-600",
};

interface Props {
  card: EntityCard;
  onAction: (action: string, params?: Record<string, any>) => void;
  onFieldSave: (fieldKey: string, value: string | number) => Promise<void>;
}

export default function JobCard({ card, onAction, onFieldSave }: Props) {
  const d = card.data;
  const status = (d.status as JobStatus) ?? "PENDING";
  const canEditDates = card.editable && (status === "PENDING" || status === "SCHEDULED");
  const isEditable = (field: string) => card.editable && (card.editableFields?.includes(field) ?? card.editable);

  const clientName = d.client
    ? `${d.client.firstName ?? ""} ${d.client.lastName ?? ""}`.trim()
    : d.clientName ?? "";
  const propertyAddress = d.property?.streetAddress ?? d.propertyAddress ?? "";

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm max-w-[440px]">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <p className="text-sm font-bold text-gray-900">{d.title ?? "Untitled Job"}</p>
        <span className={`badge text-xs shrink-0 ${statusColors[status] ?? "bg-gray-100 text-gray-600"}`}>
          {status.replace(/_/g, " ")}
        </span>
      </div>

      {/* Read-only info */}
      {clientName && (
        <p className="text-xs text-gray-500 mb-1">
          <span className="font-medium text-gray-600">Client:</span> {clientName}
        </p>
      )}
      {propertyAddress && (
        <p className="text-xs text-gray-500 mb-3">
          <span className="font-medium text-gray-600">Property:</span> {propertyAddress}
        </p>
      )}

      {/* Editable fields */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 mb-3">
        <InlineEditField
          label="Start"
          value={d.scheduledStart ? new Date(d.scheduledStart).toISOString().split("T")[0] : ""}
          fieldKey="scheduledStart"
          fieldType="date"
          editable={canEditDates}
          onSave={onFieldSave}
        />
        <InlineEditField
          label="End"
          value={d.scheduledEnd ? new Date(d.scheduledEnd).toISOString().split("T")[0] : ""}
          fieldKey="scheduledEnd"
          fieldType="date"
          editable={canEditDates}
          onSave={onFieldSave}
        />
      </div>

      <div className="mb-3">
        <InlineEditField
          label="Description"
          value={d.description ?? ""}
          fieldKey="description"
          fieldType="textarea"
          editable={isEditable("description")}
          onSave={onFieldSave}
        />
      </div>

      {/* Action buttons */}
      {card.actions && card.actions.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-gray-100">
          {card.actions.map((a) => (
            <button
              key={a.action}
              onClick={() => onAction(a.action, { ...a.params, jobId: card.id })}
              className="text-xs px-2.5 py-1 rounded-full bg-turf-50 text-turf-700 hover:bg-turf-100 font-medium transition-colors"
            >
              {a.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-gray-100">
          {status !== "COMPLETED" && status !== "CANCELLED" && (
            <button
              onClick={() => onAction("mark_job_complete", { jobId: card.id })}
              className="text-xs px-2.5 py-1 rounded-full bg-turf-50 text-turf-700 hover:bg-turf-100 font-medium transition-colors"
            >
              Mark Complete
            </button>
          )}
          {(status === "SCHEDULED" || status === "PENDING") && (
            <button
              onClick={() => onAction("reschedule_job", { jobId: card.id })}
              className="text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium transition-colors"
            >
              Reschedule
            </button>
          )}
          {status === "COMPLETED" && (
            <button
              onClick={() => onAction("draft_invoice", { jobId: card.id })}
              className="text-xs px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 hover:bg-purple-100 font-medium transition-colors"
            >
              Draft Invoice
            </button>
          )}
        </div>
      )}
    </div>
  );
}
