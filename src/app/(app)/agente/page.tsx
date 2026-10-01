"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowSquareOutIcon, ArrowUpIcon, BankIcon, FileTextIcon, SparkleIcon } from "@phosphor-icons/react";
import { api, errorMessage, type AgentBlock, type AgentContext, type AgentMessage } from "@/lib/api";
import { useSession } from "@/lib/session";
import { formatBRL, formatDate, formatInt, formatTime, monthLabel, monthSlash } from "@/lib/format";
import { Badge, Card, cn, InlineError, KeyValue, Kicker } from "@/components/ui";

const STARTERS = ["Por que tive esse ganho em março?", "Como foi calculado o custo médio?", "Esse ganho gerou imposto?"];

export default function AgentePage() {
  const { user, setUser } = useSession();
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [context, setContext] = useState<AgentContext | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>(STARTERS);
  const [conversationId, setConversationId] = useState<string>();
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || pending) return;
    setError(null);
    setInput("");
    setMessages((m) => [...m, { id: `u_${Date.now()}`, role: "user", text: message, createdAt: new Date().toISOString() }]);
    setPending(true);
    try {
      const reply = await api.agent({ message, conversationId, month: context?.month });
      setConversationId(reply.conversationId);
      setMessages((m) => [...m, reply.message]);
      setContext(reply.context);
      setSuggestions(reply.suggestions);
      if (user) setUser({ ...user, agentQuestionsLeft: reply.questionsLeft });
    } catch (err) {
      setError(errorMessage(err));
      setInput(message);
    } finally {
      setPending(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="flex min-h-0 flex-col">
        <header className="flex h-[72px] shrink-0 items-center justify-between gap-3 border-b border-line px-5 sm:px-10 lg:h-[84px]">
          <h1 className="m-0 font-display text-[26px] font-semibold tracking-[-0.02em]">Agente IA</h1>
          {context && (
            <Badge tone="accent" icon={FileTextIcon}>
              Contexto: {monthSlash(context.month)}
            </Badge>
          )}
        </header>

        <div ref={scroller} className="flex flex-1 flex-col gap-6 overflow-y-auto px-5 py-8 sm:px-10" aria-live="polite">
          {messages.length === 0 && (
            <div className="flex max-w-[620px] gap-3.5">
              <AgentAvatar />
              <div className="flex flex-col gap-2 text-[15px] leading-[1.65]">
                <p className="m-0 text-pretty">
                  Pergunte sobre qualquer relatório. Eu explico de onde vem cada número: a cotação PTAX usada, o custo médio e a transação de
                  origem na blockchain.
                </p>
              </div>
            </div>
          )}

          {messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="max-w-[min(420px,85%)] self-end rounded-[12px_12px_4px_12px] bg-accent px-[18px] py-3.5 text-[15px] text-on-accent">
                {m.text}
              </div>
            ) : (
              <div key={m.id} className="flex max-w-[700px] gap-3.5">
                <AgentAvatar />
                <div className="flex min-w-0 flex-col gap-3.5 text-[15px] leading-[1.65]">
                  {m.blocks?.map((b, i) => <Block key={i} block={b} />)}
                </div>
              </div>
            ),
          )}

          {pending && (
            <div className="flex gap-3.5" role="status">
              <AgentAvatar />
              <span className="flex items-center gap-1.5 text-sm text-muted">
                Calculando
                <span className="inline-flex gap-1" aria-hidden>
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="size-1.5 animate-pulse rounded-full bg-soft" style={{ animationDelay: `${i * 160}ms` }} />
                  ))}
                </span>
              </span>
            </div>
          )}

          {!pending && suggestions.length > 0 && (
            <div className="flex flex-wrap gap-2 sm:pl-12">
              {suggestions.map((s) => (
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
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
          className="flex flex-col gap-2 px-5 pt-5 pb-7 sm:px-10"
        >
          <InlineError>{error}</InlineError>
          <div className="flex h-[54px] items-center gap-2.5 rounded-xl border border-line2 bg-panel pr-2 pl-[18px] transition-colors focus-within:border-accent">
            <label htmlFor="agent-input" className="sr-only">
              Pergunta para o agente
            </label>
            <input
              id="agent-input"
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunte sobre seus relatórios…"
              autoComplete="off"
              maxLength={600}
              className="min-w-0 flex-1 border-none bg-transparent text-[15px] text-ink outline-none focus-visible:outline-none"
            />
            <button
              type="submit"
              aria-label="Enviar pergunta"
              disabled={pending || !input.trim()}
              className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-accent text-on-accent transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ArrowUpIcon size={18} aria-hidden />
            </button>
          </div>
          <span className="text-xs text-faint">
            O agente explica os cálculos; não substitui a orientação de um contador.
            {user && ` · ${user.agentQuestionsLeft} perguntas restantes neste mês`}
          </span>
        </form>
      </section>

      <aside className="hidden flex-col gap-5 overflow-y-auto border-l border-line bg-panel px-7 py-8 lg:flex">
        <Kicker>Relatório citado</Kicker>
        {context ? (
          <>
            <div className="flex items-center justify-between">
              <span className="font-display text-xl font-medium">{monthLabel(context.month)}</span>
              {context.status === "final" ? <Badge tone="ok">Final</Badge> : <Badge tone="draft">Rascunho</Badge>}
            </div>
            <div className="flex flex-col">
              <KeyValue label="Volume" value={formatBRL(context.volumeBrl)} />
              <KeyValue label="Ganho" value={formatBRL(context.gainBrl)} />
              <KeyValue label={`Imposto (${context.taxRatePct}%)`} value={formatBRL(context.taxBrl)} last />
            </div>
            {context.sourceTx && (
              <>
                <Kicker className="mt-2">Transação de origem</Kicker>
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
          <p className="m-0 text-sm leading-relaxed text-muted">Quando o agente citar um relatório ou uma transação, os detalhes aparecem aqui para você conferir.</p>
        )}
      </aside>
    </div>
  );
}

function AgentAvatar() {
  return (
    <div className="flex size-[34px] shrink-0 items-center justify-center rounded-xl bg-brand-deep text-brand-mist" aria-hidden>
      <SparkleIcon size={18} />
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
            className={cn("flex justify-between gap-4 py-[9px]", i < block.rows.length - 1 && "border-b border-line", r.emphasis && "font-medium")}
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
        return c.url ? (
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
