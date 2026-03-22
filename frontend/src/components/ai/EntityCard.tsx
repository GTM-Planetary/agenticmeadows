import type { EntityCard as EntityCardType } from "../../types";
import ClientCard from "./cards/ClientCard";
import JobCard from "./cards/JobCard";
import QuoteCard from "./cards/QuoteCard";
import PropertyCard from "./cards/PropertyCard";
import InvoiceCard from "./cards/InvoiceCard";
import ServiceCard from "./cards/ServiceCard";

interface Props {
  card: EntityCardType;
  onAction: (action: string, params?: Record<string, any>) => void;
  onFieldSave: (fieldKey: string, value: string | number, entityType: string, entityId: string) => Promise<void>;
}

export default function EntityCard({ card, onAction, onFieldSave }: Props) {
  const handleFieldSave = async (fieldKey: string, value: string | number) => {
    await onFieldSave(fieldKey, value, card.type, card.id);
  };

  switch (card.type) {
    case "client":
      return <ClientCard card={card} onAction={onAction} onFieldSave={handleFieldSave} />;
    case "job":
      return <JobCard card={card} onAction={onAction} onFieldSave={handleFieldSave} />;
    case "quote":
      return <QuoteCard card={card} onAction={onAction} onFieldSave={handleFieldSave} />;
    case "property":
      return <PropertyCard card={card} onAction={onAction} />;
    case "invoice":
      return <InvoiceCard card={card} onAction={onAction} onFieldSave={handleFieldSave} />;
    case "service":
      return <ServiceCard card={card} onAction={onAction} />;
    default:
      return null;
  }
}
