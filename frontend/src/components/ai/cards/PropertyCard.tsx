import type { EntityCard } from "../../../types";

interface Props {
  card: EntityCard;
  onAction: (action: string, params?: Record<string, any>) => void;
}

export default function PropertyCard({ card, onAction }: Props) {
  const d = card.data;
  const address = d.streetAddress ?? d.address ?? "";
  const cityStateZip = [d.city, d.state, d.zip].filter(Boolean).join(", ");
  const measurements = d.measurements;
  const clientName = d.client
    ? `${d.client.firstName ?? ""} ${d.client.lastName ?? ""}`.trim()
    : d.clientName ?? "";

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm max-w-[440px]">
      {/* Address */}
      <p className="text-sm font-bold text-gray-900">{address || "No Address"}</p>
      {cityStateZip && <p className="text-xs text-gray-500 mb-2">{cityStateZip}</p>}

      {/* Measurements summary */}
      {measurements && measurements.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {measurements[0].lotSizeSqft && (
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
              Lot: {measurements[0].lotSizeSqft.toLocaleString()} sqft
            </span>
          )}
          {measurements[0].lawnSqft && (
            <span className="text-xs bg-turf-50 text-turf-700 px-2 py-0.5 rounded-full">
              Lawn: {measurements[0].lawnSqft.toLocaleString()} sqft
            </span>
          )}
          {measurements[0].bedSqft && (
            <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
              Beds: {measurements[0].bedSqft.toLocaleString()} sqft
            </span>
          )}
          {measurements[0].edgingLinearFt && (
            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
              Edging: {measurements[0].edgingLinearFt.toLocaleString()} ft
            </span>
          )}
        </div>
      )}

      {/* Client name */}
      {clientName && (
        <p className="text-xs text-gray-500 mb-2">
          <span className="font-medium text-gray-600">Client:</span> {clientName}
        </p>
      )}

      {/* Action buttons */}
      {card.actions && card.actions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-gray-100">
          {card.actions.map((a) => (
            <button
              key={a.action}
              onClick={() => onAction(a.action, { ...a.params, propertyId: card.id })}
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
