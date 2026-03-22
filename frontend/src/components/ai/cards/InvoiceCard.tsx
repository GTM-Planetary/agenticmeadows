import type { EntityCard, InvoiceStatus, LineItem } from "../../../types";

const statusColors: Record<InvoiceStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  SENT: "bg-blue-100 text-blue-700",
  PAID: "bg-turf-100 text-turf-700",
  OVERDUE: "bg-red-100 text-red-600",
  VOID: "bg-gray-100 text-gray-400",
};

interface Props {
  card: EntityCard;
  onAction: (action: string, params?: Record<string, any>) => void;
  onFieldSave: (fieldKey: string, value: string | number) => Promise<void>;
}

export default function InvoiceCard({ card, onAction, onFieldSave: _onFieldSave }: Props) {
  const d = card.data;
  const status = (d.status as InvoiceStatus) ?? "DRAFT";
  const lineItems: LineItem[] = d.lineItems ?? [];
  const total = lineItems.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0);

  const clientName = d.client
    ? `${d.client.firstName ?? ""} ${d.client.lastName ?? ""}`.trim()
    : d.clientName ?? "";

  const dueDate = d.dueDate ? new Date(d.dueDate).toLocaleDateString() : null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm max-w-[440px]">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-1">
        <div>
          <p className="text-sm font-bold text-gray-900">Invoice</p>
          {clientName && <p className="text-xs text-gray-500">{clientName}</p>}
        </div>
        <span className={`badge text-xs shrink-0 ${statusColors[status] ?? "bg-gray-100 text-gray-600"}`}>
          {status}
        </span>
      </div>

      {dueDate && (
        <p className="text-xs text-gray-500 mb-3">
          <span className="font-medium text-gray-600">Due:</span> {dueDate}
        </p>
      )}

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

      {/* Paid info */}
      {d.paidAt && (
        <p className="text-xs text-turf-600 mb-2">
          Paid {new Date(d.paidAt).toLocaleDateString()}
        </p>
      )}

      {/* Action buttons */}
      {card.actions && card.actions.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-gray-100">
          {card.actions.map((a) => (
            <button
              key={a.action}
              onClick={() => onAction(a.action, { ...a.params, invoiceId: card.id })}
              className="text-xs px-2.5 py-1 rounded-full bg-turf-50 text-turf-700 hover:bg-turf-100 font-medium transition-colors"
            >
              {a.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-gray-100">
          {status !== "PAID" && status !== "VOID" && (
            <button
              onClick={() => onAction("mark_invoice_paid", { invoiceId: card.id })}
              className="text-xs px-2.5 py-1 rounded-full bg-turf-50 text-turf-700 hover:bg-turf-100 font-medium transition-colors"
            >
              Mark Paid
            </button>
          )}
          {status === "DRAFT" && (
            <button
              onClick={() => onAction("send_invoice", { invoiceId: card.id })}
              className="text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium transition-colors"
            >
              Send
            </button>
          )}
          {status !== "VOID" && status !== "PAID" && (
            <button
              onClick={() => onAction("void_invoice", { invoiceId: card.id })}
              className="text-xs px-2.5 py-1 rounded-full bg-red-50 text-red-600 hover:bg-red-100 font-medium transition-colors"
            >
              Void
            </button>
          )}
        </div>
      )}
    </div>
  );
}
