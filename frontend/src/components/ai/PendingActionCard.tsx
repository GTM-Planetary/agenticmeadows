import { useState } from "react";
import type { PendingAction } from "../../types";
import { aiChatApi } from "../../api";

interface Props {
  action: PendingAction;
  conversationId: string;
  onConfirmed: (result: unknown) => void;
  onCancelled: () => void;
}

export default function PendingActionCard({ action, conversationId, onConfirmed, onCancelled }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    try {
      const res = await aiChatApi.confirm(conversationId);
      onConfirmed(res.result);
    } catch (e: any) {
      setError(e.message ?? "Failed to execute action");
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

  const actionLabels: Record<string, string> = {
    CREATE_QUOTE: "Create Quote",
    CREATE_JOB: "Schedule Job",
    RESCHEDULE_JOB: "Reschedule Job",
    CREATE_INVOICE: "Create Invoice",
    LOG_CHEMICAL: "Log Chemical Application",
    CREATE_RECURRING: "Create Recurring Schedule",
    SEND_REMINDER: "Send Reminder",
    SUGGEST_SERVICE: "Service Suggestion",
  };
  const actionLabel = actionLabels[action.type] ?? action.type;

  return (
    <div className="mx-2 mb-3 border border-turf-300 bg-turf-50 rounded-xl p-3.5">
      <div className="flex items-start gap-2 mb-2">
        <span className="text-turf-600 text-base">✅</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-turf-700 uppercase tracking-wide mb-0.5">
            Proposed Action: {actionLabel}
          </p>
          <p className="text-sm text-gray-800 font-medium">{action.description}</p>
        </div>
      </div>

      {/* Line items preview */}
      {action.display_items && action.display_items.length > 0 && (
        <div className="bg-white rounded-lg border border-turf-200 mb-3 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-turf-50 border-b border-turf-100">
                <th className="text-left px-3 py-1.5 text-gray-600 font-medium">Service</th>
                <th className="text-right px-3 py-1.5 text-gray-600 font-medium">Qty</th>
                <th className="text-right px-3 py-1.5 text-gray-600 font-medium">Unit</th>
                <th className="text-right px-3 py-1.5 text-gray-600 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {action.display_items.map((item, i) => (
                <tr key={i} className="border-b border-gray-50 last:border-0">
                  <td className="px-3 py-1.5 text-gray-700">{item.description}</td>
                  <td className="px-3 py-1.5 text-right text-gray-500">{item.quantity}</td>
                  <td className="px-3 py-1.5 text-right text-gray-500">${item.unitPrice.toFixed(2)}</td>
                  <td className="px-3 py-1.5 text-right font-medium">${(item.quantity * item.unitPrice).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            {action.total !== undefined && (
              <tfoot>
                <tr className="bg-turf-50">
                  <td colSpan={3} className="px-3 py-1.5 text-right font-semibold text-turf-800 text-xs">Total</td>
                  <td className="px-3 py-1.5 text-right font-bold text-turf-800">${action.total.toFixed(2)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1 mb-2">{error}</p>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleConfirm}
          disabled={loading}
          className="flex-1 btn-primary text-xs py-1.5 justify-center"
        >
          {loading ? "Creating..." : "Confirm"}
        </button>
        <button
          onClick={handleCancel}
          disabled={loading}
          className="flex-1 btn-secondary text-xs py-1.5 justify-center"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
