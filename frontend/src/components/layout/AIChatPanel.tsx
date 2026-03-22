import { useReducer, useRef, useEffect, useCallback, useState } from "react";
import type { ChatMessage, PendingAction } from "../../types";
import { aiChatApi, clientsApi, jobsApi, quotesApi, invoicesApi, servicesApi } from "../../api";
import ChatMessage_ from "../ai/ChatMessage";
import PendingActionCard from "../ai/PendingActionCard";

// ── Slash Commands ────────────────────────────────────────────────────────

interface SlashCommand {
  command: string;
  label: string;
  template: string;
  section: "favorites" | "lookup" | "create" | "manage" | "info";
  icon: string;
}

const SLASH_COMMANDS: SlashCommand[] = [
  // Favorites
  { command: "/new-client", label: "New Client", template: "Create a new client: ", section: "favorites", icon: "👤" },
  { command: "/new-quote", label: "New Quote", template: "Draft a quote for ", section: "favorites", icon: "📝" },
  { command: "/schedule", label: "Schedule", template: "What's on the schedule this week?", section: "favorites", icon: "📅" },
  { command: "/complete", label: "Complete Job", template: "Mark job complete at ", section: "favorites", icon: "✅" },
  { command: "/weather", label: "Weather", template: "What's the weather forecast for ", section: "favorites", icon: "🌤️" },
  { command: "/lawn-check", label: "Analyze lawn photo/issue", template: "Analyze this lawn: ", section: "favorites", icon: "🌿" },
  // Look Up
  { command: "/find-client", label: "Find Client", template: "Look up client ", section: "lookup", icon: "🔍" },
  { command: "/find-property", label: "Find Property", template: "Show me property at ", section: "lookup", icon: "🏠" },
  { command: "/find-job", label: "Find Job", template: "Find job ", section: "lookup", icon: "🔎" },
  { command: "/find-quote", label: "Find Quote", template: "Look up quote ", section: "lookup", icon: "📋" },
  { command: "/clients", label: "List Clients", template: "List all clients", section: "lookup", icon: "📇" },
  // Create
  { command: "/new-job", label: "New Job", template: "Schedule a new job for ", section: "create", icon: "🗓️" },
  { command: "/new-invoice", label: "New Invoice", template: "Create an invoice for ", section: "create", icon: "💰" },
  // Manage
  { command: "/add-item", label: "Add Line Item", template: "Add line item to ", section: "manage", icon: "➕" },
  { command: "/log-chemical", label: "Log Chemical", template: "Log chemical application at ", section: "manage", icon: "🧪" },
  { command: "/update-client", label: "Update Client", template: "Update client ", section: "manage", icon: "✏️" },
  { command: "/log-service", label: "Log equipment service", template: "Just serviced ", section: "manage", icon: "🔧" },
  // Info
  { command: "/dashboard", label: "Dashboard", template: "How are we doing this month?", section: "info", icon: "📊" },
  { command: "/services", label: "Services", template: "What services do we offer?", section: "info", icon: "🛠️" },
  { command: "/maintenance", label: "Check maintenance alerts", template: "What equipment needs maintenance?", section: "info", icon: "⚠️" },
  { command: "/treatment", label: "Get treatment recommendations", template: "How do I treat ", section: "info", icon: "💊" },
  { command: "/seasonal", label: "Seasonal care guide", template: "What should I be doing this season for ", section: "info", icon: "📅" },
  { command: "/reminder", label: "Reminder", template: "Remind me to ", section: "info", icon: "🔔" },
];

const SECTION_HEADERS: Record<SlashCommand["section"], string> = {
  favorites: "⭐ Favorites",
  lookup: "🔍 Look Up",
  create: "➕ Create",
  manage: "⚙️ Manage",
  info: "ℹ️ Info",
};

const SECTION_ORDER: SlashCommand["section"][] = ["favorites", "lookup", "create", "manage", "info"];

// ── State ─────────────────────────────────────────────────────────────────

interface State {
  messages: ChatMessage[];
  pendingAction: PendingAction | null;
  conversationId: string;
  isLoading: boolean;
  error: string | null;
  // Context injected from the current page (job detail, client detail, etc.)
  context: { clientId?: string; jobId?: string } | null;
}

type Action =
  | { type: "SET_CONTEXT"; context: State["context"] }
  | { type: "SEND_MESSAGE"; message: ChatMessage }
  | { type: "RECEIVE_REPLY"; message: ChatMessage; pendingAction: PendingAction | null }
  | { type: "SET_LOADING"; loading: boolean }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "CLEAR_PENDING" }
  | { type: "ACTION_CONFIRMED"; successMessage: ChatMessage }
  | { type: "BATCH_CONFIRMED"; successMessage: ChatMessage }
  | { type: "NEW_SESSION"; dividerMessage: ChatMessage; conversationId: string };

function getOrCreateConversationId(): string {
  const key = "am_conv_id";
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
  }
  return id;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_CONTEXT":
      return { ...state, context: action.context };
    case "SEND_MESSAGE":
      return { ...state, messages: [...state.messages, action.message], isLoading: true, error: null };
    case "RECEIVE_REPLY":
      return {
        ...state,
        messages: [...state.messages, action.message],
        pendingAction: action.pendingAction ?? null,
        isLoading: false,
      };
    case "SET_LOADING":
      return { ...state, isLoading: action.loading };
    case "SET_ERROR":
      return { ...state, error: action.error, isLoading: false };
    case "CLEAR_PENDING":
      return { ...state, pendingAction: null };
    case "ACTION_CONFIRMED":
      return {
        ...state,
        pendingAction: null,
        messages: [...state.messages, action.successMessage],
      };
    case "BATCH_CONFIRMED":
      return {
        ...state,
        messages: [...state.messages, action.successMessage],
      };
    case "NEW_SESSION":
      return {
        ...state,
        messages: [...state.messages, action.dividerMessage],
        conversationId: action.conversationId,
        pendingAction: null,
      };
    default:
      return state;
  }
}

// ── Action-to-message mapping for entity card actions ────────────────────

function actionToMessage(action: string, params?: Record<string, any>): string {
  const map: Record<string, (p?: Record<string, any>) => string> = {
    draft_quote: (p) => `draft a quote for client ${p?.clientId ?? ""}`.trim(),
    draft_job: (p) => `schedule a job for client ${p?.clientId ?? ""}`.trim(),
    view_client: (p) => `show me client ${p?.clientId ?? ""}`.trim(),
    mark_job_complete: (p) => `mark job ${p?.jobId ?? ""} as complete`.trim(),
    reschedule_job: (p) => `reschedule job ${p?.jobId ?? ""}`.trim(),
    draft_invoice: (p) => `draft an invoice for job ${p?.jobId ?? ""}`.trim(),
    add_line_item: (p) => `add a line item to quote ${p?.quoteId ?? ""}`.trim(),
    send_quote: (p) => `send quote ${p?.quoteId ?? ""}`.trim(),
    convert_to_invoice: (p) => `convert quote ${p?.quoteId ?? ""} to an invoice`.trim(),
    mark_invoice_paid: (p) => `mark invoice ${p?.invoiceId ?? ""} as paid`.trim(),
    send_invoice: (p) => `send invoice ${p?.invoiceId ?? ""}`.trim(),
    void_invoice: (p) => `void invoice ${p?.invoiceId ?? ""}`.trim(),
  };

  const builder = map[action];
  if (builder) return builder(params);
  // Fallback: convert action to readable sentence
  return `${action.replace(/_/g, " ")} ${params ? JSON.stringify(params) : ""}`.trim();
}

// ── Component ─────────────────────────────────────────────────────────────

interface Props {
  isOpen: boolean;
  onClose: () => void;
  // Optional context to pre-load (set by JobDetail, ClientDetail, etc.)
  clientId?: string;
  jobId?: string;
  prefillMessage?: string;
}

export default function AIChatPanel({ isOpen, onClose, clientId, jobId, prefillMessage }: Props) {
  const [state, dispatch] = useReducer(reducer, {
    messages: [
      {
        id: "welcome",
        role: "assistant",
        content: "Hi! I'm Glen AI. I can help with scheduling, quotes, and job site analysis.\n\nUpload a photo on a job page, or just ask me anything!",
        timestamp: new Date().toISOString(),
      },
    ],
    pendingAction: null,
    conversationId: getOrCreateConversationId(),
    isLoading: false,
    error: null,
    context: null,
  });

  const [inputValue, setInputValue] = useState("");
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashFilter, setSlashFilter] = useState("");
  const [slashIndex, setSlashIndex] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const slashMenuRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.messages, state.isLoading]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 100);
  }, [isOpen]);

  // Update context when props change
  useEffect(() => {
    if (clientId || jobId) {
      dispatch({ type: "SET_CONTEXT", context: { clientId, jobId } });
    }
  }, [clientId, jobId]);

  // Handle prefill message
  useEffect(() => {
    if (prefillMessage && isOpen) {
      setInputValue(prefillMessage);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [prefillMessage, isOpen]);

  // ── Slash command helpers ──────────────────────────────────────────────
  const filteredCommands = SLASH_COMMANDS.filter((cmd) =>
    cmd.command.toLowerCase().includes(("/" + slashFilter).toLowerCase())
  );

  // Group filtered commands by section (preserving order)
  const groupedCommands: { section: SlashCommand["section"]; commands: SlashCommand[] }[] = [];
  for (const section of SECTION_ORDER) {
    const cmds = filteredCommands.filter((c) => c.section === section);
    if (cmds.length > 0) groupedCommands.push({ section, commands: cmds });
  }

  // Build flat list for keyboard navigation indexing
  const flatFiltered = groupedCommands.flatMap((g) => g.commands);

  function selectSlashCommand(cmd: SlashCommand) {
    setInputValue(cmd.template);
    setShowSlashMenu(false);
    setSlashFilter("");
    setSlashIndex(0);
    // Move cursor to end of template after React re-render
    setTimeout(() => {
      const el = inputRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(cmd.template.length, cmd.template.length);
        // Reset textarea height
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
      }
    }, 0);
  }

  // Keep slashIndex in bounds when filter changes
  useEffect(() => {
    if (slashIndex >= flatFiltered.length) {
      setSlashIndex(Math.max(0, flatFiltered.length - 1));
    }
  }, [slashFilter, flatFiltered.length, slashIndex]);

  // Scroll active slash menu item into view
  useEffect(() => {
    if (showSlashMenu && slashMenuRef.current) {
      const active = slashMenuRef.current.querySelector("[data-slash-active='true']");
      active?.scrollIntoView({ block: "nearest" });
    }
  }, [slashIndex, showSlashMenu]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || state.isLoading) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      timestamp: new Date().toISOString(),
    };

    dispatch({ type: "SEND_MESSAGE", message: userMsg });
    setInputValue("");

    try {
      const res = await aiChatApi.chat({
        message: trimmed,
        conversation_id: state.conversationId,
        client_id: state.context?.clientId ?? clientId,
        job_id: state.context?.jobId ?? jobId,
      });

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: res.reply,
        timestamp: new Date().toISOString(),
        pendingAction: res.pending_action ?? undefined,
        entities: res.entities ?? undefined,
        batchActions: res.batch_actions ?? undefined,
      };

      dispatch({
        type: "RECEIVE_REPLY",
        message: assistantMsg,
        pendingAction: res.pending_action ?? null,
      });
    } catch (e: any) {
      dispatch({ type: "SET_ERROR", error: e.message ?? "Failed to connect to AI service" });
    }
  }, [state.isLoading, state.conversationId, state.context, clientId, jobId]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (showSlashMenu) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashIndex((prev) => (prev + 1) % (flatFiltered.length || 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashIndex((prev) => (prev - 1 + (flatFiltered.length || 1)) % (flatFiltered.length || 1));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (flatFiltered[slashIndex]) {
          selectSlashCommand(flatFiltered[slashIndex]);
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowSlashMenu(false);
        setSlashFilter("");
        setSlashIndex(0);
        return;
      }
      // Tab also selects
      if (e.key === "Tab") {
        e.preventDefault();
        if (flatFiltered[slashIndex]) {
          selectSlashCommand(flatFiltered[slashIndex]);
        }
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputValue);
    }
  }

  function handleActionConfirmed(result: unknown) {
    const successMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "Done! The action was completed successfully. You can view it in the relevant section.",
      timestamp: new Date().toISOString(),
    };
    dispatch({ type: "ACTION_CONFIRMED", successMessage: successMsg });
  }

  function handleActionCancelled() {
    dispatch({ type: "CLEAR_PENDING" });
  }

  function handleBatchConfirmed(results: unknown[]) {
    const count = Array.isArray(results) ? results.length : 0;
    const successMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: `Done! ${count} action${count !== 1 ? "s" : ""} completed successfully.`,
      timestamp: new Date().toISOString(),
    };
    dispatch({ type: "BATCH_CONFIRMED", successMessage: successMsg });
  }

  function handleBatchCancelled() {
    const cancelMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "Batch actions cancelled. Let me know if you need anything else.",
      timestamp: new Date().toISOString(),
    };
    dispatch({ type: "BATCH_CONFIRMED", successMessage: cancelMsg });
  }

  // ── Entity card action handler ──────────────────────────────────────────
  const handleEntityAction = useCallback((action: string, params?: Record<string, any>) => {
    const message = actionToMessage(action, params);
    sendMessage(message);
  }, [sendMessage]);

  // ── Entity card field save handler ──────────────────────────────────────
  const handleEntityFieldSave = useCallback(async (
    fieldKey: string,
    value: string | number,
    entityType: string,
    entityId: string
  ) => {
    const updateData = { [fieldKey]: value };

    try {
      switch (entityType) {
        case "client":
          await clientsApi.update(entityId, updateData);
          break;
        case "job":
          await jobsApi.update(entityId, updateData);
          break;
        case "quote":
          await quotesApi.update(entityId, updateData);
          break;
        case "invoice":
          await invoicesApi.update(entityId, updateData);
          break;
        case "service":
          await servicesApi.update(entityId, updateData);
          break;
        default:
          throw new Error(`Unknown entity type: ${entityType}`);
      }

      // Add a quiet success toast in chat
      const toastMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Updated ${entityType} ${fieldKey} successfully.`,
        timestamp: new Date().toISOString(),
      };
      dispatch({ type: "RECEIVE_REPLY", message: toastMsg, pendingAction: null });
    } catch (e: any) {
      throw new Error(e.message ?? `Failed to update ${entityType}`);
    }
  }, []);

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/10 z-30 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <aside
        className={`fixed right-0 top-0 h-full w-[480px] bg-gray-50 border-l border-gray-200 flex flex-col z-40 shadow-xl transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 bg-white border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-turf-100 rounded-full flex items-center justify-center">🤖</div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Glen AI</p>
              <p className="text-xs text-turf-600">by AgenticMeadows · Qwen 3.5 · Local</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const newId = crypto.randomUUID();
                sessionStorage.setItem("am_conv_id", newId);
                const divider: ChatMessage = {
                  id: "divider-" + Date.now(),
                  role: "assistant",
                  content: "--- New Session ---",
                  timestamp: new Date().toISOString(),
                };
                dispatch({ type: "NEW_SESSION", dividerMessage: divider, conversationId: newId });
              }}
              className="btn-secondary text-xs py-1 px-2"
              title="Start a new conversation session"
            >
              + New Session
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">
              ✕
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto py-4 px-2">
          {state.messages.map((msg) => (
            <ChatMessage_
              key={msg.id}
              message={msg}
              conversationId={state.conversationId}
              onEntityAction={handleEntityAction}
              onEntityFieldSave={handleEntityFieldSave}
              onBatchConfirmed={handleBatchConfirmed}
              onBatchCancelled={handleBatchCancelled}
            />
          ))}

          {/* Loading indicator */}
          {state.isLoading && (
            <div className="flex justify-start mb-3">
              <div className="w-7 h-7 bg-turf-100 rounded-full flex items-center justify-center text-sm shrink-0 mr-2">🤖</div>
              <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-3.5 py-2.5 shadow-sm">
                <div className="flex gap-1 items-center h-4">
                  <span className="w-1.5 h-1.5 bg-turf-400 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 bg-turf-400 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 bg-turf-400 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {state.error && (
            <div className="mx-2 mb-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <p className="text-xs text-red-700">{state.error}</p>
            </div>
          )}

          {/* Pending action card */}
          {state.pendingAction && (
            <PendingActionCard
              action={state.pendingAction}
              conversationId={state.conversationId}
              onConfirmed={handleActionConfirmed}
              onCancelled={handleActionCancelled}
            />
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="shrink-0 bg-white border-t border-gray-200 p-3 relative">
          {/* Slash command popup */}
          {showSlashMenu && (
            <div
              ref={slashMenuRef}
              className="absolute bottom-full left-0 right-0 mb-1 mx-3 bg-white rounded-lg shadow-xl border border-gray-200 max-h-72 overflow-y-auto z-50"
            >
              {flatFiltered.length === 0 ? (
                <div className="px-3 py-4 text-sm text-gray-400 text-center">No matching commands</div>
              ) : (
                groupedCommands.map((group) => {
                  return (
                    <div key={group.section}>
                      <div className="px-3 pt-2 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide select-none">
                        {SECTION_HEADERS[group.section]}
                      </div>
                      {group.commands.map((cmd) => {
                        const idx = flatFiltered.indexOf(cmd);
                        const isActive = idx === slashIndex;
                        return (
                          <button
                            key={cmd.command}
                            type="button"
                            data-slash-active={isActive ? "true" : undefined}
                            className={`w-full text-left px-3 py-1.5 flex items-center gap-2 cursor-pointer transition-colors ${
                              isActive ? "bg-turf-50" : "hover:bg-gray-50"
                            }`}
                            onMouseEnter={() => setSlashIndex(idx)}
                            onMouseDown={(e) => {
                              e.preventDefault(); // prevent textarea blur
                              selectSlashCommand(cmd);
                            }}
                          >
                            <span className="text-base w-5 text-center shrink-0">{cmd.icon}</span>
                            <span className="text-sm font-medium text-gray-900">{cmd.command}</span>
                            <span className="text-sm text-gray-400 truncate">{cmd.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>
          )}
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => {
                const val = e.target.value;
                setInputValue(val);
                if (val.startsWith("/")) {
                  setShowSlashMenu(true);
                  setSlashFilter(val.slice(1));
                  setSlashIndex(0);
                } else {
                  setShowSlashMenu(false);
                  setSlashFilter("");
                }
              }}
              onKeyDown={handleKeyDown}
              placeholder="Ask Glen AI..."
              rows={1}
              disabled={state.isLoading}
              className="flex-1 input resize-none min-h-[38px] max-h-24 leading-snug py-2 text-sm"
              style={{ height: "auto" }}
              onInput={(e) => {
                const t = e.currentTarget;
                t.style.height = "auto";
                t.style.height = `${Math.min(t.scrollHeight, 96)}px`;
              }}
            />
            <button
              onClick={() => sendMessage(inputValue)}
              disabled={state.isLoading || !inputValue.trim()}
              className="btn-primary py-2 px-3 shrink-0"
            >
              ➤
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1.5 text-center">Enter to send · Shift+Enter for newline · Type <span className="font-mono">/</span> for commands</p>
        </div>
      </aside>
    </>
  );
}
