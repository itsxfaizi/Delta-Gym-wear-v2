"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** Thin shadcn Select wrapper so forms and controls share one look. */
export function StatusSelect({
  id,
  value,
  options,
  disabled,
  placeholder = "Select…",
  onValueChange,
}: {
  id?: string;
  value: string;
  options: readonly (string | { value: string; label: string })[];
  disabled?: boolean;
  placeholder?: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <Select value={value || undefined} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger id={id} className="admin-select-trigger">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => {
          // Callers may pass raw values or {value,label}; a raw value must never
          // reach the user as a machine enum like "returned_to_sender".
          const item = typeof option === "string" ? { value: option, label: option } : option;
          return (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
