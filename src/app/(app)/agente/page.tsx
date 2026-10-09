"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowSquareOutIcon, ArrowUpIcon, BankIcon, FileTextIcon } from "@phosphor-icons/react";
import { LumeIcon } from "@/components/lume-icon";
import { api, ApiError, errorMessage, isDemoSession, type AgentBlock, type AgentContext, type AgentMessage } from "@/lib/api";
import { RulesExplanation, type RulesReason } from "@/components/rules-explanation";
import { config } from "@/lib/config";
import { DemoNotice } from "@/components/demo-notice";
import { useSession } from "@/lib/session";
import { formatBRL, formatDate, formatInt, formatTime, monthLabel, monthLong } from "@/lib/format";
import { Badge, Card, cn, InlineError, KeyValue, Kicker } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/use-api";
import { MonthPicker } from "@/components/month-picker";

export default function AgentePage() {
  const { user, setUser } = useSession();
  const { t } = useI18n();
  const copy = t.agent;
  const reports = useApi(() => api.reports(), []);
  const months = useMemo(() => {
    const available = (reports.data ?? []).map((report) => report.month).sort((a, b) => b.localeCompare(a));
    // O agente simulado só tem respostas consistentes para março de 2026.
    return config.useMocks || isDemoSession() ? available.filter((month) => month === "2026-03") : available;
  }, [reports.data]);
  // Explicação por regras: aparece quando a IA está indisponível (503) ou a cota acabou (429).
  const [rules, setRules] = useState<RulesReason | null>(null);
  const exhausted = user !== null && user.agentQuestionsLeft <= 0;
  const inFlight = useRef(false);
  const [failedMessage, setFailedMessage] = useState<string | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [context, setContext] = useState<AgentContext | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const month = picked ?? context?.month ?? months[0] ?? null;
  // null = ainda sem resposta do agente: mostra as perguntas iniciais no idioma atual.
  const [suggestions, setSuggestions] = useState<string[] | null>(null);
  const chips = suggestions ?? (month ? t.agent.starters(monthLong(month)) : []);
  const [conversationId, setConversationId] = useState<string>();
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({
      top: scroller.current.scrollHeight,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }, [messages, pending]);

  const send = async (text: string, retry = false) => {
    const message = text.trim();
    if (!message || !month || inFlight.current || exhausted) return;
    inFlight.current = true;
    setFailedMessage(null);
    setError(null);
    setInput("");
    if (!retry) setMessages((m) => [
      ...m,
      {
        id: `u_${Date.now()}`,
        role: "user",
        text: message,
        createdAt: new Date().toISOString(),
      },
    ]);
    setPending(true);
    try {
      const reply = await api.agent({
        message,
        conversationId,
        month,
      });
      setConversationId(reply.conversationId);
      setMessages((m) => [...m, reply.message]);
      setContext(reply.context);
      setSuggestions(reply.suggestions);
      if (user) setUser({ ...user, agentQuestionsLeft: reply.questionsLeft });
    } catch (err) {
      setFailedMessage(message);
      setError(errorMessage(err));
      setInput(message);
      if (err instanceof ApiError && err.status === 503) setRules("unavailable");
      else if (err instanceof ApiError && err.status === 429) {
        setRules("quota");
        if (user) setUser({ ...user, agentQuestionsLeft: 0 });
      }
    } finally {
      inFlight.current = false;
      setPending(false);
      inputRef.current?.focus();
    }
  };

  const reset = () => {
    setMessages([]);
    setContext(null);
    setConversationId(undefined);
    setSuggestions(null);
    setRules(null);
    setError(null);
    setFailedMessage(null);
    setInput("");
    inputRef.current?.focus();
  };

  const changeFocusMonth = (nextMonth: string) => {
    if (nextMonth === month) return;
    setPicked(nextMonth);
    reset();
  };

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="flex min-h-0 min-w-0 flex-col">
        <header className="flex min-h-[72px] flex-wrap shrink-0 items-center justify-between gap-3 py-3 border-b border-line px-5 sm:px-10 lg:h-[84px]">
          <div className="flex min-w-0 items-center gap-3">
            <LumeIcon size={36} accent className="shrink-0 text-accent-text" aria-hidden />
            <div className="min-w-0">
              <h1 className="type-h1 m-0">{copy.title}</h1>
              <p className="m-0 text-xs leading-relaxed text-muted">{copy.subtitle}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Kicker as="span">{copy.focusMonth}</Kicker>
            {month && months.length > 0 ? (
              <MonthPicker value={month} months={months} onChange={changeFocusMonth} disabled={pending} />
            ) : (
              <span className="text-sm text-muted">{reports.loading ? t.common.loading : copy.noReports}</span>
            )}
          </div>
        </header>

        {reports.error && (
          <div className="flex flex-wrap items-center gap-3 px-5 pt-3 sm:px-10">
            <InlineError>{reports.error}</InlineError>
            <button type="button" className="min-h-11 text-sm text-accent-text" onClick={reports.reload}>
              {t.common.retry}
            </button>
          </div>
        )}
        <div className="px-5 pt-4 sm:px-10"><DemoNotice text={copy.demo} /></div>
        <div className="px-5 pt-3 sm:px-10">
          <button type="button" disabled={pending} className="min-h-11 cursor-pointer text-sm text-accent-text disabled:opacity-50" onClick={reset}>
            {copy.fresh}
          </button>
        </div>
        <div ref={scroller} className="flex flex-1 flex-col gap-6 overflow-y-auto px-5 py-8 sm:px-10" role="log" aria-label={t.agent.title} aria-live="polite" aria-relevant="additions text">
          {!reports.loading && !reports.error && months.length === 0 && (
            <p role="status" className="m-0 text-sm text-muted">{copy.noReports}</p>
          )}
          {messages.length === 0 && (
            <div className="flex max-w-[620px] gap-3.5">
              <AgentAvatar />
              <div className="flex flex-col gap-2 text-[15px] leading-[1.65]">
                <p className="m-0 text-pretty">{t.agent.intro}</p>
              </div>
            </div>
          )}

          {messages.map((m) =>
            m.role === "user" ? (
              <div
                key={m.id}
                className="max-w-[min(420px,85%)] self-end break-words rounded-[12px_12px_4px_12px] bg-accent px-[18px] py-3.5 text-[15px] text-on-accent"
              >
                {m.text}
              </div>
            ) : (
              <div key={m.id} className="flex max-w-[700px] gap-3.5">
                <AgentAvatar />
                <div className="flex min-w-0 flex-col gap-3.5 text-[15px] leading-[1.65]">
                  {m.source === "rules" && (
                    <span className="self-start">
                      <Badge tone="draft">{t.rules.badge}</Badge>
                    </span>
                  )}
                  {m.blocks?.map((b, i) => (
                    <Block key={i} block={b} />
                  ))}
                </div>
              </div>
            ),
          )}

          {pending && (
            <div className="flex gap-3.5" role="status">
              <AgentAvatar />
              <span className="flex items-center gap-1.5 text-sm text-muted">
                {t.agent.thinking}
                <span className="inline-flex gap-1" aria-hidden>
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="size-1.5 animate-pulse rounded-full bg-soft" style={{ animationDelay: `${i * 160}ms` }} />
                  ))}
                </span>
              </span>
            </div>
          )}

          {rules && <RulesExplanation month={context?.month} reason={rules} onClose={() => setRules(null)} />}

        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
          className="flex flex-col gap-2 px-5 pt-5 pb-7 sm:px-10"
        >
          <InlineError>{error}</InlineError>
          {failedMessage && !pending && !exhausted && <button type="button" className="min-h-11 self-start text-sm text-accent-text" onClick={() => void send(failedMessage, true)}>{copy.retry}</button>}
          {exhausted && <p role="status" className="m-0 text-sm text-muted">{copy.exhausted}</p>}
          {exhausted && !rules && (
            <button type="button" className="min-h-11 self-start text-sm text-accent-text" onClick={() => setRules("quota")}>
              {t.rules.show}
            </button>
          )}
          {!pending && month && !exhausted && chips.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2">
              {chips.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="cursor-pointer rounded-xl bg-card px-3 py-2 text-left text-[13px] text-chip-text transition-[filter] hover:brightness-95"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <div className="flex h-[54px] items-center gap-2.5 rounded-xl border border-line2 bg-panel pr-2 pl-[18px] transition-colors focus-within:border-accent">
            <label htmlFor="agent-input" className="sr-only">
              {t.agent.inputLabel}
            </label>
            <input
              id="agent-input"
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t.agent.placeholder}
              autoComplete="off"
              maxLength={600}
              disabled={pending || !month}
              className="min-w-0 flex-1 border-none bg-transparent text-[15px] text-ink outline-none focus-visible:outline-none"
            />
            <button
              type="submit"
              aria-label={t.agent.send}
              disabled={pending || exhausted || !month || !input.trim()}
              className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-accent text-on-accent transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ArrowUpIcon size={18} aria-hidden />
            </button>
          </div>
          <span className="text-xs text-faint">
            {t.agent.disclaimer}
            {user && ` · ${t.agent.questionsLeft(user.agentQuestionsLeft)}`}
          </span>
        </form>
      </section>

      <aside aria-label={t.agent.cited} className="flex min-w-0 flex-col gap-5 overflow-y-auto border-t border-line bg-panel px-5 py-6 lg:border-t-0 lg:border-l lg:px-7 lg:py-8">
        <Kicker>{t.agent.cited}</Kicker>
        {context ? (
          <>
            <div className="flex items-center justify-between">
              <span className="font-display text-xl font-medium">{monthLabel(context.month)}</span>
              {context.status === "final" ? <Badge tone="ok">{t.common.final}</Badge> : <Badge tone="draft">{t.common.draft}</Badge>}
            </div>
            <div className="flex flex-col">
              <KeyValue label={t.agent.volume} value={formatBRL(context.volumeBrl)} />
              <KeyValue label={t.agent.gain} value={formatBRL(context.gainBrl)} />
              <KeyValue label={t.agent.tax(context.taxRatePct)} value={formatBRL(context.taxBrl)} last />
            </div>
            {context.sourceTx && (
              <>
                <Kicker className="mt-2">{t.agent.sourceTx}</Kicker>
                <Card className="flex flex-col gap-2.5 p-[18px]">
                  <span className="font-medium">{context.sourceTx.title}</span>
                  <span className="font-mono text-xs break-all text-muted">{context.sourceTx.signature}</span>
                  <div className="flex justify-between gap-3 font-mono text-xs">
                    <span className="text-muted">
                      {formatDate(context.sourceTx.date)} · {formatTime(context.sourceTx.date)}
                    </span>
                    <span>slot {formatInt(context.sourceTx.slot)}</span>
                  </div>
                </Card>
              </>
            )}
          </>
        ) : (
          <p className="m-0 text-sm leading-relaxed text-muted">{t.agent.citedEmpty}</p>
        )}
      </aside>
    </div>
  );
}

function AgentAvatar() {
  return (
    <div className="flex size-[34px] shrink-0 items-center justify-center rounded-xl bg-brand-deep text-brand-mist" aria-hidden>
      <LumeIcon size={22} />
    </div>
  );
}

function Block({ block }: { block: AgentBlock }) {
  if (block.type === "text") return <p className="m-0 text-pretty">{block.text}</p>;
  if (block.type === "breakdown")
    return (
      <div className="rounded-xl border border-line bg-panel px-[18px] py-1.5 font-mono text-[13px]">
        {block.rows.map((r, i) => (
          <div
            key={i}
            className={cn(
              "flex justify-between gap-4 py-[9px]",
              i < block.rows.length - 1 && "border-b border-line",
              r.emphasis && "font-medium",
            )}
          >
            <span className={r.emphasis ? undefined : "text-muted"}>{r.label}</span>
            <span className={cn("text-right", r.emphasis === "gain" && "text-ok")}>{r.value}</span>
          </div>
        ))}
      </div>
    );
  return (
    <div className="flex flex-wrap gap-2">
      {block.items.map((c, i) => {
        const Icon = c.kind === "ptax" ? BankIcon : c.kind === "tx" ? ArrowSquareOutIcon : FileTextIcon;
        const cls = cn(
          "inline-flex items-center gap-1.5 rounded-lg border border-line2 px-2.5 py-1.5 font-mono text-xs no-underline",
          c.kind === "tx" ? "text-accent-text" : "text-ink",
        );
        return c.url && /^https?:\/\//i.test(c.url) && !((config.useMocks || isDemoSession()) && c.kind === "tx") ? (
          <a key={i} href={c.url} target="_blank" rel="noopener noreferrer" className={cn(cls, "hover:border-soft/60")}>
            <Icon size={14} aria-hidden />
            {c.label}
          </a>
        ) : (
          <span key={i} className={cls}>
            <Icon size={14} aria-hidden />
            {c.label}
          </span>
        );
      })}
    </div>
  );
}
