"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarBlankIcon, CaretDownIcon, CheckIcon } from "@phosphor-icons/react";
import { monthLabel } from "@/lib/format";
import { cn } from "@/components/ui";
import { useI18n } from "@/lib/i18n";

/** Botão "Setembro 2026 ▾" do painel, com lista de meses disponíveis. */
export function MonthPicker({ value, months, onChange }: { value: string; months: string[]; onChange: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  };

  // Ao abrir pelo teclado ou mouse, o foco vai para o mês selecionado.
  useEffect(() => {
    if (open) list.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
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
        ref={trigger}
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
          ref={list}
          role="listbox"
          aria-label={t.monthPicker.choose}
          onKeyDown={(e) => {
            const items = Array.from(list.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
            const i = items.indexOf(document.activeElement as HTMLButtonElement);
            const next =
              e.key === "ArrowDown"
                ? i + 1
                : e.key === "ArrowUp"
                  ? i - 1
                  : e.key === "Home"
                    ? 0
                    : e.key === "End"
                      ? items.length - 1
                      : null;
            if (next === null) return;
            e.preventDefault();
            items[Math.max(0, Math.min(items.length - 1, next))]?.focus();
          }}
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
                  close(true);
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
