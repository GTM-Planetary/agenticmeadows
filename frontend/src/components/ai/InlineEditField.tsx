import { useState, useRef, useEffect, useCallback } from "react";

interface Props {
  value: string | number;
  fieldKey: string;
  fieldType?: "text" | "number" | "date" | "select" | "textarea";
  options?: { label: string; value: string }[];
  onSave: (fieldKey: string, value: string | number) => Promise<void>;
  editable: boolean;
  label?: string;
}

export default function InlineEditField({
  value,
  fieldKey,
  fieldType = "text",
  options,
  onSave,
  editable,
  label,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(String(value ?? ""));
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<"success" | "error" | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null);

  // Sync draft when external value changes
  useEffect(() => {
    if (!editing) setDraft(String(value ?? ""));
  }, [value, editing]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (editing) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [editing]);

  const startEdit = useCallback(() => {
    if (!editable) return;
    setEditing(true);
    setFlash(null);
  }, [editable]);

  const cancel = useCallback(() => {
    setDraft(String(value ?? ""));
    setEditing(false);
  }, [value]);

  const save = useCallback(async () => {
    const finalValue = fieldType === "number" ? Number(draft) : draft;
    if (String(finalValue) === String(value)) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(fieldKey, finalValue);
      setFlash("success");
      setEditing(false);
      setTimeout(() => setFlash(null), 1200);
    } catch {
      setFlash("error");
      setTimeout(() => setFlash(null), 2000);
    } finally {
      setSaving(false);
    }
  }, [draft, fieldKey, fieldType, onSave, value]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && fieldType !== "textarea") {
      e.preventDefault();
      save();
    }
    if (e.key === "Escape") {
      cancel();
    }
  }

  const flashBorder =
    flash === "success"
      ? "ring-2 ring-green-400"
      : flash === "error"
      ? "ring-2 ring-red-400"
      : "";

  // ── Display mode ──
  if (!editing) {
    const displayValue = String(value ?? "");
    return (
      <div className={`group ${flashBorder} rounded transition-all duration-300`}>
        {label && <p className="text-xs text-gray-500 mb-0.5">{label}</p>}
        <div
          className={`text-sm text-gray-800 ${
            editable ? "cursor-pointer hover:bg-gray-50 rounded px-1 -mx-1 py-0.5 -my-0.5" : ""
          } flex items-center gap-1`}
          onClick={startEdit}
        >
          <span className={displayValue ? "" : "text-gray-400 italic"}>
            {displayValue || "Empty"}
          </span>
          {editable && (
            <svg
              className="w-3 h-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          )}
        </div>
      </div>
    );
  }

  // ── Edit mode ──
  const baseInputClass =
    "w-full text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-turf-500 focus:border-turf-500";

  return (
    <div>
      {label && <p className="text-xs text-gray-500 mb-0.5">{label}</p>}
      <div className="relative">
        {fieldType === "textarea" ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={save}
            disabled={saving}
            rows={3}
            className={`${baseInputClass} resize-none ${flash === "error" ? "border-red-400" : ""}`}
          />
        ) : fieldType === "select" ? (
          <select
            ref={inputRef as React.RefObject<HTMLSelectElement>}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              // Auto-save on select change
              setTimeout(() => save(), 0);
            }}
            onBlur={save}
            onKeyDown={handleKeyDown}
            disabled={saving}
            className={`${baseInputClass} ${flash === "error" ? "border-red-400" : ""}`}
          >
            {options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type={fieldType}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={save}
            disabled={saving}
            className={`${baseInputClass} ${flash === "error" ? "border-red-400" : ""}`}
          />
        )}
        {saving && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <div className="w-3.5 h-3.5 border-2 border-turf-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}
