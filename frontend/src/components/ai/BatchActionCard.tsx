import { useState } from "react";
import type { PendingAction } from "../../types";
import { aiChatApi } from "../../api";

interface Props {
  actions: PendingAction[];
  conversationId: string;
  onConfirmed: (results: unknown[]) => void;
  onCancelled: () => void;
}

const ACTION_ICONS: Record<string, string> = {
  CREATE_JOB: "\u{1F4C5}",
  CREATE_QUOTE: "\u{1F4DD}",
  MARK_JOB_COMPLETE: "\u2705",
  ADD_LINE_ITEM: "\u2795",
  UPDATE_CLIENT: "\u270F\uFE0F",
  RESCHEDULE_JOB: "\u{1F504}",
  CREATE_INVOICE: "\u{1F4B0}",
  LOG_CHEMICAL: "\u{1F9EA}",
  UPDATE_JOB: "\u270F\uFE0F",
  REMOVE_LINE_ITEM: "\u2796",
  CREATE_RECURRING: "\u{1F501}",
  SEND_REMINDER: "\u{1F514}",
  SUGGEST_SERVICE: "\u{1F4A1}",
  UPDATE_QUOTE: "\u{1F4DD}",
};

export default function BatchActionCard({ actions, conversationId, onConfirmed, onCancelled }: Props) {
  const [checked, setChecked] = useState<boolean[]>(() => actions.map(() => true));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCount = checked.filter(Boolean).length;

  function toggleCheck(index: number) {
    setChecked((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  }

  async function handleConfirm() {
    const selectedIndices = checked
      .map((isChecked, i) => (isChecked ? i : -1))
      .filter((i) => i !== -1);

    if (selectedIndices.length === 0) return;

    setLoading(true);
    setError(null);
    try {
      const res = await aiChatApi.confirmBatch(conversationId, selectedIndices);
      onConfirmed(res.results);
    } catch (e: any) {
      setError(e.message ?? "Failed to execute batch actions");
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel() {
    try {
      await aiChatApi.cancel(conversationId);
    } catch {
      // cancellation failure is non-critical
    }
    onCancelled();
  }

  return (
    <div className="mx-2 mb-3 border border-turf-300 bg-turf-50 rounded-xl p-3.5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-turf-600 text-base">{"\u{1F4CB}"}</span>
        <p className="text-xs font-semibold text-turf-700 uppercase tracking-wide">
          Batch Actions
        </p>
        <span className="inline-flex items-center justify-center bg-turf-600 text-white text-xs font-bold rounded-full w-5 h-5">
          {actions.length}
        </span>
      </div>

      {/* Action list */}
      <div className="space-y-2 mb-3">
        {actions.map((action, i) => (
          <div
            key={i}
            className={`flex items-start gap-2 bg-white rounded-lg border px-3 py-2 transition-colors ${
              checked[i] ? "border-turf-200" : "border-gray-200 opacity-50"
            }`}
          >
            {/* Checkbox */}
            <label className="flex items-center shrink-0 mt-0.5 cursor-pointer">
              <input
                type="checkbox"
                checked={checked[i]}
                onChange={() => toggleCheck(i)}
                disabled={loading}
                className="w-4 h-4 rounded border-gray-300 text-turf-600 focus:ring-turf-500"
              />
            </label>

            {/* Number + Icon */}
            <span className="text-xs text-gray-400 font-mono mt-0.5 shrink-0">
              {i + 1}.
            </span>
            <span className="text-sm shrink-0 mt-px">
              {ACTION_ICONS[action.type] ?? "\u26A1"}
            </span>

            {/* Description + optional details */}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-800">{action.description}</p>

              {/* Mini line items summary */}
              {action.display_items && action.display_items.length > 0 && (
                <div className="mt-1 text-xs text-gray-500">
                  {action.display_items.map((item, j) => (
                    <span key={j}>
                      {item.description} ({item.quantity} x ${item.unitPrice.toFixed(2)})
                      {j < action.display_items!.length - 1 && ", "}
                    </span>
                  ))}
                </div>
              )}

              {/* Total */}
              {action.total !== undefined && (
                <p className="mt-0.5 text-xs font-semibold text-turf-700">
                  Total: ${action.total.toFixed(2)}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1 mb-2">{error}</p>
      )}

      {/* Footer buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleConfirm}
          disabled={loading || selectedCount === 0}
          className="flex-1 btn-primary text-xs py-1.5 justify-center"
        >
          {loading ? "Executing..." : `Confirm Selected (${selectedCount})`}
        </button>
        <button
          onClick={handleCancel}
          disabled={loading}
          className="flex-1 btn-secondary text-xs py-1.5 justify-center"
        >
          Cancel All
        </button>
      </div>
    </div>
  );
}
