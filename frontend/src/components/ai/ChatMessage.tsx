import type { ChatMessage as ChatMessageType } from "../../types";
import EntityCard from "./EntityCard";
import BatchActionCard from "./BatchActionCard";

interface Props {
  message: ChatMessageType;
  conversationId?: string;
  onEntityAction?: (action: string, params?: Record<string, any>) => void;
  onEntityFieldSave?: (fieldKey: string, value: string | number, entityType: string, entityId: string) => Promise<void>;
  onBatchConfirmed?: (results: unknown[]) => void;
  onBatchCancelled?: () => void;
}

export default function ChatMessage({ message, conversationId, onEntityAction, onEntityFieldSave, onBatchConfirmed, onBatchCancelled }: Props) {
  const isUser = message.role === "user";
  const isDivider = message.content.startsWith("---") && message.content.includes("New Session");

  // Render divider messages as a styled horizontal line with centered text
  if (isDivider) {
    return (
      <div className="flex items-center gap-3 my-4 px-2">
        <div className="flex-1 border-t border-gray-300" />
        <span className="text-xs text-gray-400 font-medium whitespace-nowrap">New Session</span>
        <div className="flex-1 border-t border-gray-300" />
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      {!isUser && (
        <div className="w-7 h-7 bg-turf-100 rounded-full flex items-center justify-center text-sm shrink-0 mr-2 mt-0.5">
          🤖
        </div>
      )}
      <div className={`max-w-[85%] ${isUser ? "" : ""}`}>
        <div
          className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
            isUser
              ? "bg-turf-600 text-white rounded-tr-sm"
              : "bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm"
          }`}
        >
          {/* Render content with basic markdown-like formatting */}
          {message.content.split("\n").map((line, i) => {
            if (line.startsWith("**") && line.endsWith("**")) {
              return <p key={i} className="font-semibold">{line.slice(2, -2)}</p>;
            }
            if (line.startsWith("• ")) {
              return <p key={i} className="pl-2">{line}</p>;
            }
            if (line === "") return <br key={i} />;
            return <p key={i}>{line}</p>;
          })}
          <p className={`text-xs mt-1 ${isUser ? "text-turf-200" : "text-gray-400"}`}>
            {new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>

        {/* Entity cards */}
        {!isUser && message.entities && message.entities.length > 0 && (
          <div className="mt-2 space-y-2">
            {message.entities.map((card) => (
              <EntityCard
                key={`${card.type}-${card.id}`}
                card={card}
                onAction={onEntityAction ?? (() => {})}
                onFieldSave={onEntityFieldSave ?? (async () => {})}
              />
            ))}
          </div>
        )}

        {/* Batch action cards */}
        {!isUser && message.batchActions && message.batchActions.length > 0 && conversationId && (
          <div className="mt-2">
            <BatchActionCard
              actions={message.batchActions}
              conversationId={conversationId}
              onConfirmed={onBatchConfirmed ?? (() => {})}
              onCancelled={onBatchCancelled ?? (() => {})}
            />
          </div>
        )}
      </div>
    </div>
  );
}
