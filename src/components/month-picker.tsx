"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarBlankIcon, CaretDownIcon, CheckIcon } from "@phosphor-icons/react";
import { monthLabel } from "@/lib/format";
import { cn } from "@/components/ui";

/** Botão "Setembro 2026 ▾" do painel, com lista de meses disponíveis. */
export function MonthPicker({ value, months, onChange }: { value: string; months: string[]; onChange: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-line2 bg-transparent px-4 text-[15px] text-ink transition-colors hover:border-soft/60"
      >
        <CalendarBlankIcon size={18} aria-hidden />
        {monthLabel(value)}
        <CaretDownIcon size={14} aria-hidden className={cn("transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label="Escolher mês"
          className="absolute right-0 z-20 mt-2 max-h-80 w-56 overflow-auto rounded-xl border border-line bg-panel p-1.5 shadow-frame md:left-0"
        >
          {months.map((m) => (
            <li key={m}>
              <button
                type="button"
                role="option"
                aria-selected={m === value}
                onClick={() => {
                  onChange(m);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-card",
                  m === value && "bg-chip font-medium text-chip-text",
                )}
              >
                {monthLabel(m)}
                {m === value && <CheckIcon size={14} aria-hidden />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
