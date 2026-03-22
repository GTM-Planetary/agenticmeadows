import type { EntityCard, ServiceCategory, PricingUnit } from "../../../types";

const categoryColors: Record<string, string> = {
  MOWING: "bg-turf-50 text-turf-700",
  TRIMMING: "bg-turf-50 text-turf-700",
  FERTILIZATION: "bg-amber-50 text-amber-700",
  WEED_CONTROL: "bg-red-50 text-red-600",
  AERATION: "bg-blue-50 text-blue-700",
  SEEDING: "bg-green-50 text-green-700",
  MULCHING: "bg-amber-50 text-amber-700",
  PRUNING: "bg-purple-50 text-purple-700",
  IRRIGATION: "bg-blue-50 text-blue-700",
  CLEANUP: "bg-gray-100 text-gray-600",
  HARDSCAPE: "bg-gray-100 text-gray-600",
  PLANTING: "bg-green-50 text-green-700",
  SNOW_REMOVAL: "bg-blue-50 text-blue-700",
  OTHER: "bg-gray-100 text-gray-600",
};

const unitLabels: Record<PricingUnit, string> = {
  FLAT: "flat",
  PER_SQFT: "/sqft",
  PER_LINEAR_FT: "/lin ft",
  PER_HOUR: "/hr",
  PER_APPLICATION: "/app",
  PER_YARD: "/yard",
};

interface Props {
  card: EntityCard;
  onAction: (action: string, params?: Record<string, any>) => void;
}

export default function ServiceCard({ card, onAction }: Props) {
  const d = card.data;
  const category = d.category as ServiceCategory;
  const pricingUnit = d.pricingUnit as PricingUnit;

  return (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 shadow-sm max-w-[440px] flex items-center gap-3">
      {/* Name */}
      <p className="text-sm font-medium text-gray-900 flex-1 min-w-0 truncate">{d.name ?? "Service"}</p>

      {/* Category badge */}
      {category && (
        <span className={`badge text-xs shrink-0 ${categoryColors[category] ?? "bg-gray-100 text-gray-600"}`}>
          {category.replace(/_/g, " ")}
        </span>
      )}

      {/* Price */}
      <p className="text-sm font-semibold text-gray-800 shrink-0">
        ${Number(d.basePrice ?? 0).toFixed(2)}
        {pricingUnit && (
          <span className="text-xs text-gray-500 font-normal ml-0.5">
            {unitLabels[pricingUnit] ?? ""}
          </span>
        )}
      </p>

      {/* Action buttons (inline for compact layout) */}
      {card.actions && card.actions.length > 0 && (
        <div className="flex gap-1 shrink-0">
          {card.actions.map((a) => (
            <button
              key={a.action}
              onClick={() => onAction(a.action, { ...a.params, serviceId: card.id })}
              className="text-xs px-2 py-0.5 rounded-full bg-turf-50 text-turf-700 hover:bg-turf-100 font-medium transition-colors"
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
