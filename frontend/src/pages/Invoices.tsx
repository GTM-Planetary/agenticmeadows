import { useState, useEffect } from "react";
import { invoicesApi } from "../api";
import type { Invoice, InvoiceStatus } from "../types";

const statusColors: Record<InvoiceStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  SENT: "bg-blue-100 text-blue-700",
  PAID: "bg-turf-100 text-turf-700",
  OVERDUE: "bg-red-100 text-red-600",
  VOID: "bg-gray-100 text-gray-400",
};

export default function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  function load() { invoicesApi.list().then(setInvoices).catch(console.error); }
  useEffect(() => { load(); }, []);

  async function markPaid(id: string) {
    try {
      await invoicesApi.markPaid(id);
      load();
    } catch (e: any) {
      alert(e.message);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>

      <div className="card overflow-hidden">
        {invoices.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            No invoices yet. Convert an approved quote to create one.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Client</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Total</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Due Date</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {invoices.map((inv) => {
                const total = inv.lineItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
                return (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium">
                      {inv.client ? `${inv.client.firstName} ${inv.client.lastName}` : "—"}
                    </td>
                    <td className="px-5 py-3">${total.toFixed(2)}</td>
                    <td className="px-5 py-3 text-gray-500">
                      {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`badge ${statusColors[inv.status]}`}>{inv.status}</span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {inv.status !== "PAID" && inv.status !== "VOID" && (
                        <button onClick={() => markPaid(inv.id)} className="btn-secondary text-xs py-1 px-2">
                          Mark Paid
                        </button>
                      )}
                      {inv.paidAt && (
                        <span className="text-xs text-gray-400">
                          Paid {new Date(inv.paidAt).toLocaleDateString()}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
