import type { EntityCard, QuoteStatus, LineItem } from "../../../types";

const statusColors: Record<QuoteStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  SENT: "bg-blue-100 text-blue-700",
  APPROVED: "bg-turf-100 text-turf-700",
  REJECTED: "bg-red-100 text-red-600",
  INVOICED: "bg-purple-100 text-purple-700",
};

interface Props {
  card: EntityCard;
  onAction: (action: string, params?: Record<string, any>) => void;
  onFieldSave: (fieldKey: string, value: string | number) => Promise<void>;
}

export default function QuoteCard({ card, onAction, onFieldSave: _onFieldSave }: Props) {
  const d = card.data;
  const status = (d.status as QuoteStatus) ?? "DRAFT";
  const lineItems: LineItem[] = d.lineItems ?? [];
  const total = lineItems.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0);

  const clientName = d.client
    ? `${d.client.firstName ?? ""} ${d.client.lastName ?? ""}`.trim()
    : d.clientName ?? "";

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm max-w-[440px]">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="text-sm font-bold text-gray-900">{d.title ?? "Untitled Quote"}</p>
        <span className={`badge text-xs shrink-0 ${statusColors[status] ?? "bg-gray-100 text-gray-600"}`}>
          {status}
        </span>
      </div>
      {clientName && <p className="text-xs text-gray-500 mb-3">{clientName}</p>}

      {/* Line items table */}
      {lineItems.length > 0 && (
        <div className="bg-gray-50 rounded-lg border border-gray-100 mb-3 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left px-3 py-1.5 text-gray-600 font-medium">Service</th>
                <th className="text-right px-2 py-1.5 text-gray-600 font-medium">Qty</th>
                <th className="text-right px-2 py-1.5 text-gray-600 font-medium">Price</th>
                <th className="text-right px-3 py-1.5 text-gray-600 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item, i) => (
                <tr key={item.id ?? i} className="border-b border-gray-50 last:border-0">
                  <td className="px-3 py-1.5 text-gray-700">{item.description}</td>
                  <td className="px-2 py-1.5 text-right text-gray-500">{item.quantity}</td>
                  <td className="px-2 py-1.5 text-right text-gray-500">${item.unitPrice.toFixed(2)}</td>
                  <td className="px-3 py-1.5 text-right font-medium">${(item.quantity * item.unitPrice).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-turf-50">
                <td colSpan={3} className="px-3 py-1.5 text-right font-semibold text-turf-800 text-xs">Total</td>
                <td className="px-3 py-1.5 text-right font-bold text-turf-800">${total.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Action buttons */}
      {card.actions && card.actions.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-gray-100">
          {card.actions.map((a) => (
            <button
              key={a.action}
              onClick={() => onAction(a.action, { ...a.params, quoteId: card.id })}
              className="text-xs px-2.5 py-1 rounded-full bg-turf-50 text-turf-700 hover:bg-turf-100 font-medium transition-colors"
            >
              {a.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-gray-100">
          {status === "DRAFT" && (
            <>
              <button
                onClick={() => onAction("add_line_item", { quoteId: card.id })}
                className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium transition-colors"
              >
                Add Line Item
              </button>
              <button
                onClick={() => onAction("send_quote", { quoteId: card.id })}
                className="text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium transition-colors"
              >
                Send
              </button>
            </>
          )}
          {(status === "SENT" || status === "APPROVED") && (
            <button
              onClick={() => onAction("convert_to_invoice", { quoteId: card.id })}
              className="text-xs px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 hover:bg-purple-100 font-medium transition-colors"
            >
              Convert to Invoice
            </button>
          )}
        </div>
      )}
    </div>
  );
}
