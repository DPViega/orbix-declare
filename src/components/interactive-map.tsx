"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, animate, motion, useMotionValue, useTransform } from "motion/react";
import {
  ArrowClockwiseIcon,
  ArrowLeftIcon,
  ArrowSquareOutIcon,
  CrosshairIcon,
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
  PaperPlaneRightIcon,
  XIcon,
  type Icon,
} from "@phosphor-icons/react";
import { api, ApiError, errorMessage, type AgentMessage, type EventType, type TaxEvent } from "@/lib/api";
import { eventCost } from "@/lib/event-cost";
import { formatBRL, formatBRLShort, formatDate, formatDateTime, formatPtax, formatQty } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { TokenIcon, tokenHue } from "@/components/token-icon";
import { cn } from "@/components/ui";
import { VoxelPlanet } from "@/components/voxel-planet";
import { LumeIcon } from "@/components/lume-icon";
import { TypewriterText } from "@/components/typewriter-text";
import { EVENT_TYPES, TYPE_COLOR, TYPE_ICON } from "@/components/event-type";

/*
 * Modo interativo do painel: o mês como um grafo animado (Motion). Visão geral = mês no centro,
 * ativos saindo dele em mola (aresta mais grossa = mais volume em R$) e os eventos como folhas.
 * Clicar num ativo: ele voa para a esquerda, os cards por tipo de evento deslizam, e do card
 * escolhido sai o leque de eventos. Clicar num evento abre o painel lateral; "ver detalhes
 * completos" abre o mesmo diálogo do modo simples. Coordenadas lógicas fixas (W×H) encaixadas por
 * escala; arrastar move, os botões dão zoom. Palco sempre escuro: o brilho é a linguagem do modo.
 * MotionConfig reducedMotion="user": com "reduzir movimento" no sistema, nada voa nem pulsa.
 */

const W = 1000;
const H = 620;
const CX = 500;
const CY = 310;
const MAX_ASSETS = 8;
const MAX_LEAVES = 10;
const MAX_FAN = 16;

const EASE = [0.16, 1, 0.3, 1] as const;
const SPRING = { type: "spring", stiffness: 120, damping: 17, mass: 0.9 } as const;

const TYPES = EVENT_TYPES;

type Totals = { volumeBrl: number; capitalGainBrl: number; estimatedTaxBrl: number };

interface AssetNode {
  symbol: string;
  events: TaxEvent[];
  value: number;
  share: number;
  angle: number;
  x: number;
  y: number;
}

const valueOf = (events: TaxEvent[]) => events.reduce((sum, e) => sum + (e.valueBrl ?? 0), 0);

function buildAssets(events: TaxEvent[], othersLabel: string): AssetNode[] {
  const groups = new Map<string, TaxEvent[]>();
  for (const e of events) {
    const key = e.quantityAsset || e.asset;
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }
  let list = [...groups.entries()]
    .map(([symbol, evs]) => ({ symbol, events: evs, value: valueOf(evs) }))
    .sort((a, b) => b.value - a.value || b.events.length - a.events.length);
  if (list.length > MAX_ASSETS) {
    const rest = list.slice(MAX_ASSETS - 1).flatMap((r) => r.events);
    list = [...list.slice(0, MAX_ASSETS - 1), { symbol: othersLabel, events: rest, value: valueOf(rest) }];
  }
  const total = list.reduce((sum, a) => sum + a.value, 0);
  const base = list.length <= 2 ? 0 : -Math.PI / 2;
  return list.map((a, i) => {
    const angle = base + (i * 2 * Math.PI) / list.length;
    return {
      ...a,
      share: total > 0 ? a.value / total : 0,
      angle,
      x: CX + Math.cos(angle) * 270,
      y: CY + Math.sin(angle) * 172,
    };
  });
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function leafPositions(a: AssetNode, count: number) {
  // Ativo em cima/embaixo: as folhas abrem para os lados, senão caem atrás do rótulo ou da barra.
  const vertical = Math.abs(Math.sin(a.angle)) > 0.7;
  const spread = count === 1 ? 0 : clamp((count - 1) * 0.28, vertical ? 1.2 : 0.5, 1.6);
  const tilt = count === 1 && vertical ? 0.7 : 0;
  return Array.from({ length: count }, (_, i) => {
    const phi = a.angle + tilt + (count === 1 ? 0 : -spread / 2 + (spread * i) / (count - 1));
    const r = i % 2 === 0 ? 92 : 116;
    return { x: clamp(a.x + Math.cos(phi) * r, 24, W - 24), y: clamp(a.y + Math.sin(phi) * r * 0.8, 24, H - 24) };
  });
}

/** Curva suave entre dois pontos, com a barriga para o lado de fora do centro. */
function curve(x1: number, y1: number, x2: number, y2: number, bend = 0.18) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  return `M ${x1} ${y1} Q ${mx - (y2 - y1) * bend} ${my + (x2 - x1) * bend} ${x2} ${y2}`;
}

const bezier = (x1: number, y1: number, x2: number, y2: number) => {
  const c = (x2 - x1) * 0.5;
  return `M ${x1} ${y1} C ${x1 + c} ${y1}, ${x2 - c} ${y2}, ${x2} ${y2}`;
};

/** Feixe: as linhas saem juntas do card e só se abrem perto do destino (como fibra). */
const bundle = (x1: number, y1: number, x2: number, y2: number) =>
  `M ${x1} ${y1} C ${x1 + 110} ${y1}, ${x2 - 150} ${y2}, ${x2} ${y2}`;

function AnimatedNumber({ value, format }: { value: number; format: (v: number) => string }) {
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => format(v));
  useEffect(() => {
    const controls = animate(mv, value, { duration: 1.1, ease: EASE });
    return () => controls.stop();
  }, [mv, value]);
  return <motion.span>{text}</motion.span>;
}

/** Halo "ondulado" em volta do orbe: traços radiais de tamanho variável, girando devagar. */
function WaveRing({ size, seed, color }: { size: number; seed: number; color: string }) {
  const ticks = 96;
  const c = size / 2;
  const r = size / 2 - 16;
  const lines = Array.from({ length: ticks }, (_, i) => {
    const a = (i / ticks) * Math.PI * 2;
    const len = 3 + 12 * Math.abs(Math.sin(i * 0.9 + seed) * Math.cos(i * 0.37 + seed * 1.7));
    return {
      x1: c + Math.cos(a) * r,
      y1: c + Math.sin(a) * r,
      x2: c + Math.cos(a) * (r + len),
      y2: c + Math.sin(a) * (r + len),
      opacity: 0.3 + 0.6 * ((i * 7) % 10) / 10,
    };
  });
  return (
    <motion.svg
      aria-hidden
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="absolute inset-0"
      animate={{ rotate: 360 }}
      transition={{ duration: 70, ease: "linear", repeat: Infinity }}
    >
      {lines.map((l, i) => (
        <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={color} strokeWidth={1.3} strokeLinecap="round" opacity={l.opacity} />
      ))}
    </motion.svg>
  );
}

/** Disco escuro + halo + esfera: o "planeta" do centro e do ativo em foco. */
function Planet({ size, hue, seed, children }: { size: number; hue: number | null; seed: number; children: React.ReactNode }) {
  const ring = hue === null ? "#a78cf0" : `hsl(${hue} 80% 72%)`;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div
        aria-hidden
        className="absolute -inset-[34%] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(8,5,16,.96) 0%, rgba(8,5,16,.8) 42%, rgba(8,5,16,0) 70%)" }}
      />
      <div aria-hidden className="absolute -inset-[34%] rounded-full border border-white/[0.06]" />
      <WaveRing size={size} seed={seed} color={ring} />
      <motion.div
        aria-hidden
        className="absolute inset-[22%] rounded-full blur-xl"
        style={{ background: hue === null ? "rgba(91,53,200,.55)" : `hsl(${hue} 80% 55% / .5)` }}
        animate={{ scale: [1, 1.18, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute inset-[24%] flex items-center justify-center rounded-full"
        animate={{ y: [0, -3, 0] }}
        transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
      >
        {children}
      </motion.div>
    </div>
  );
}

export function InteractiveMap({
  events,
  loading,
  monthText,
  monthKey,
  totals,
  onOpenEvent,
}: {
  events: TaxEvent[] | null;
  loading: boolean;
  monthText: string;
  /** "AAAA-MM" do mês em foco — necessário para perguntar à Lume sem sair do mapa. */
  monthKey: string | null;
  totals: Totals | null;
  onOpenEvent: (event: TaxEvent) => void;
}) {
  const { t } = useI18n();
  const m = t.dashboard.map;
  const router = useRouter();
  const { user, setUser } = useSession();

  const assets = useMemo(() => buildAssets(events ?? [], m.others), [events, m.others]);
  const monthTotal = useMemo(() => valueOf(events ?? []), [events]);
  const typeCounts = useMemo(() => {
    const counts: Record<EventType, number> = { swap: 0, perp: 0, funding: 0, transfer: 0 };
    for (const e of events ?? []) counts[e.type] += 1;
    return counts;
  }, [events]);

  const [focus, setFocus] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<EventType | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<TaxEvent | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  // Resposta da Lume direto no mapa (sem navegar pra /agente): conversa isolada do mapa, reiniciada
  // a cada novo ativo/evento em foco para não misturar contexto.
  const [asking, setAsking] = useState(false);
  const [reply, setReply] = useState<AgentMessage | null>(null);
  const [askError, setAskError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string>();
  const exhausted = user !== null && user.agentQuestionsLeft <= 0;

  // Encaixe do palco lógico no container + pan/zoom.
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setSize({ w: entry.contentRect.width, h: entry.contentRect.height }));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  // Com o painel lateral aberto (desktop), o palco se reencaixa no espaço que sobra à esquerda.
  const freeW = selectedEvent && size.w >= 768 ? size.w - 344 : size.w;
  const fit = freeW && size.h ? Math.min(freeW / W, size.h / H) : 0;
  const scale = fit * zoom;
  const tx = (freeW - W * scale) / 2 + pan.x;
  const ty = (size.h - H * scale) / 2 + pan.y;

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const focused = focus ? assets.find((a) => a.symbol === focus) ?? null : null;

  const openAsset = (a: AssetNode) => {
    const largest = TYPES.map((type) => ({ type, n: a.events.filter((e) => e.type === type).length }))
      .filter((c) => c.n > 0)
      .sort((x, y) => y.n - x.n)[0];
    setFocus(a.symbol);
    setSelectedType(largest?.type ?? null);
    setSelectedEvent(null);
    setHovered(null);
    setQuestion(m.askAsset(a.symbol, monthText));
    clearAnswer();
    resetView();
  };

  const clearAnswer = () => {
    setReply(null);
    setAskError(null);
    setConversationId(undefined);
  };

  const backToOverview = () => {
    setFocus(null);
    setSelectedType(null);
    setSelectedEvent(null);
    setQuestion("");
    clearAnswer();
    resetView();
  };

  const selectEvent = (e: TaxEvent) => {
    setSelectedEvent(e);
    setQuestion(m.askEvent(e.asset, formatDate(e.date)));
    clearAnswer();
  };

  const submitAsk = async (text: string) => {
    if (!text || asking) return;
    // Sem o mês (painel ainda carregando), não há como perguntar com contexto: cai no agente completo.
    if (!monthKey) {
      router.push(`/agente?q=${encodeURIComponent(text)}`);
      return;
    }
    if (exhausted) return;
    setAsking(true);
    setAskError(null);
    setReply(null);
    try {
      const res = await api.agent({ message: text, month: monthKey, conversationId });
      setConversationId(res.conversationId);
      setReply(res.message);
      if (user) setUser({ ...user, agentQuestionsLeft: res.questionsLeft });
    } catch (err) {
      setAskError(errorMessage(err));
      if (err instanceof ApiError && err.status === 429 && user) setUser({ ...user, agentQuestionsLeft: 0 });
    } finally {
      setAsking(false);
    }
  };

  const ask = (event: React.FormEvent) => {
    event.preventDefault();
    void submitAsk(question.trim());
  };

  const eventLabel = (e: TaxEvent) =>
    `${t.eventType[e.type]} · ${e.asset} · ${formatDate(e.date)} · ${e.valueBrl === null ? m.noPrice : formatBRL(e.valueBrl)}`;

  const empty = !loading && events !== null && events.length === 0;

  return (
    <MotionConfig reducedMotion="user">
      <div
        ref={wrapRef}
        role="region"
        aria-label={m.label(monthText)}
        className="map-stage relative h-[clamp(540px,74vh,780px)] w-full cursor-grab touch-none overflow-hidden rounded-xl border border-line select-none active:cursor-grabbing"
        onPointerDown={(ev) => {
          if ((ev.target as HTMLElement).closest("button, input, a, form, aside")) return;
          drag.current = { x: ev.clientX, y: ev.clientY, px: pan.x, py: pan.y };
          ev.currentTarget.setPointerCapture(ev.pointerId);
        }}
        onPointerMove={(ev) => {
          const d = drag.current;
          if (d) setPan({ x: d.px + ev.clientX - d.x, y: d.py + ev.clientY - d.y });
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        {/* Palco lógico */}
        {fit > 0 && !empty && events && (
          <motion.div
            className="absolute top-0 left-0 origin-top-left"
            style={{ width: W, height: H }}
            animate={{ x: tx, y: ty, scale }}
            transition={{ type: "spring", stiffness: 260, damping: 32 }}
            initial={false}
          >
            <AnimatePresence mode="wait">
              {focused ? (
                <motion.div key={`focus-${focused.symbol}`} exit={{ opacity: 0, transition: { duration: 0.2 } }}>
                  <FocusView
                    asset={focused}
                    selectedType={selectedType}
                    selectedEvent={selectedEvent}
                    onSelectType={(type) => {
                      setSelectedType(type);
                      setSelectedEvent(null);
                    }}
                    onSelectEvent={selectEvent}
                    eventLabel={eventLabel}
                  />
                </motion.div>
              ) : (
                <motion.div key="overview" exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.2 } }}>
                  <OverviewView
                    assets={assets}
                    hovered={hovered}
                    onHover={setHovered}
                    onOpenAsset={openAsset}
                    onSelectEvent={selectEvent}
                    eventLabel={eventLabel}
                    monthText={monthText}
                    monthTotal={monthTotal}
                    eventCount={events.length}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {(loading || events === null) && !empty && (
          <p className="absolute inset-0 m-0 flex items-center justify-center text-sm text-[#a89fc5]">{t.common.loading}</p>
        )}
        {empty && <p className="absolute inset-0 m-0 flex items-center justify-center text-sm text-[#a89fc5]">{m.empty}</p>}

        {/* Barra de ferramentas */}
        <motion.div
          initial={{ y: -16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ ...SPRING, delay: 0.2 }}
          className="absolute top-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-white/10 bg-[#140f22]/80 p-1 backdrop-blur"
        >
          <AnimatePresence initial={false}>
            {focused && (
              <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: "auto", opacity: 1 }} exit={{ width: 0, opacity: 0 }} className="overflow-hidden">
                <MapButton icon={ArrowLeftIcon} label={m.back} onClick={backToOverview} showLabel />
              </motion.div>
            )}
          </AnimatePresence>
          <MapButton icon={MagnifyingGlassMinusIcon} label={m.zoomOut} onClick={() => setZoom((z) => Math.max(0.6, z / 1.25))} />
          <MapButton icon={MagnifyingGlassPlusIcon} label={m.zoomIn} onClick={() => setZoom((z) => Math.min(2.5, z * 1.25))} />
          <MapButton icon={CrosshairIcon} label={m.reset} onClick={resetView} />
        </motion.div>
        {!focused && !empty && <p className="absolute top-4 left-4 m-0 hidden text-xs text-[#a89fc5] md:block">{m.hint}</p>}

        {/* Legenda */}
        <motion.div
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ ...SPRING, delay: 0.35 }}
          className="absolute bottom-3 left-3 flex flex-col gap-1.5 rounded-xl border border-white/10 bg-[#140f22]/80 px-3.5 py-3 backdrop-blur max-md:hidden"
        >
          <span className="font-mono text-[10px] tracking-[0.08em] text-[#a89fc5] uppercase">{m.legend}</span>
          {TYPES.map((type) => (
            <span key={type} className="flex items-center gap-2 text-xs text-[#e3ddf7]">
              <span aria-hidden className="size-2.5 rounded-full" style={{ background: TYPE_COLOR[type], boxShadow: `0 0 8px ${TYPE_COLOR[type]}` }} />
              {t.eventType[type]}
              <span className="ml-auto pl-3 font-mono text-[#a89fc5]">{typeCounts[type]}</span>
            </span>
          ))}
        </motion.div>

        {/* Painel lateral do evento */}
        <AnimatePresence>
          {selectedEvent && (
            <EventPanel
              key={selectedEvent.id}
              event={selectedEvent}
              onClose={() => setSelectedEvent(null)}
              onDetails={() => onOpenEvent(selectedEvent)}
            />
          )}
        </AnimatePresence>

        {/* KPIs + pergunta para a Lume */}
        <motion.form
          onSubmit={ask}
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ ...SPRING, delay: 0.3 }}
          className="absolute right-3 bottom-3 flex w-[min(420px,calc(100%-24px))] flex-col gap-2.5 rounded-2xl border border-white/10 bg-[#140f22]/85 p-3 shadow-[0_0_40px_rgba(91,53,200,.25)] backdrop-blur max-md:left-3 max-md:w-auto"
        >
          {totals && (
            <div className="grid grid-cols-3 gap-2 px-1">
              <MapKpi label={t.dashboard.monthVolume} value={totals.volumeBrl} />
              <MapKpi label={t.dashboard.capitalGain} value={totals.capitalGainBrl} />
              <MapKpi label={t.dashboard.estimatedTax} value={totals.estimatedTaxBrl} />
            </div>
          )}
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#07040d]/70 py-1 pr-1 pl-3.5 transition-colors focus-within:border-[#a78cf0]/60">
            <label htmlFor="map-ask" className="sr-only">
              {m.askLabel}
            </label>
            <input
              id="map-ask"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={m.askPlaceholder(monthText)}
              disabled={asking}
              className="h-9 min-w-0 flex-1 bg-transparent text-[13px] text-[#f2effb] outline-none placeholder:text-[#7d7499] disabled:opacity-60"
            />
            <motion.button
              type="submit"
              aria-label={m.ask}
              title={m.ask}
              disabled={asking || exhausted}
              whileHover={asking ? undefined : { scale: 1.08 }}
              whileTap={asking ? undefined : { scale: 0.92 }}
              className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-accent text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {asking ? (
                <motion.span animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}>
                  <ArrowClockwiseIcon size={16} aria-hidden />
                </motion.span>
              ) : (
                <PaperPlaneRightIcon size={16} weight="fill" aria-hidden />
              )}
            </motion.button>
          </div>

          {/* Resposta inline: o mapa não solta a pergunta pra outra aba, a Lume responde aqui mesmo. */}
          <AnimatePresence mode="wait">
            {asking ? (
              <motion.div
                key="thinking"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 px-1 py-1 text-[13px] text-[#c9bcf7]"
              >
                <motion.span animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.3, repeat: Infinity }}>
                  <LumeIcon size={16} accent />
                </motion.span>
                {m.thinking}
              </motion.div>
            ) : askError ? (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex flex-col gap-2 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2.5 text-[12.5px] text-[#f2effb]"
              >
                {askError}
                <button
                  type="button"
                  onClick={() => void submitAsk(question.trim())}
                  className="w-fit cursor-pointer text-[12px] font-medium text-[#c9bcf7] underline underline-offset-2"
                >
                  {m.retry}
                </button>
              </motion.div>
            ) : reply ? (
              <motion.div
                key={reply.id}
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6 }}
                transition={SPRING}
                className="flex max-h-[220px] flex-col gap-2 overflow-y-auto rounded-xl border border-[#a78cf0]/25 bg-gradient-to-b from-[#241a42]/80 to-[#140f22]/80 px-3.5 py-3"
              >
                <div className="flex items-center gap-2 text-[11px] font-medium text-[#c9bcf7]">
                  <LumeIcon size={14} accent />
                  Lume
                </div>
                {(reply.blocks ?? []).map((block, i) =>
                  block.type === "text" ? (
                    <p key={i} className="m-0 text-[13px] leading-relaxed text-[#f2effb]">
                      <TypewriterText text={block.text} />
                    </p>
                  ) : block.type === "breakdown" ? (
                    <div key={i} className="rounded-lg border border-white/10 bg-[#07040d]/50 px-3 py-1 font-mono text-[12px]">
                      {block.rows.map((r, j) => (
                        <div
                          key={j}
                          className={cn(
                            "flex justify-between gap-3 py-[7px]",
                            j < block.rows.length - 1 && "border-b border-white/10",
                            r.emphasis && "font-medium",
                          )}
                        >
                          <span className={r.emphasis ? "text-[#f2effb]" : "text-[#a89fc5]"}>{r.label}</span>
                          <span className={cn("text-right text-[#f2effb]", r.emphasis === "gain" && "text-[#4ade80]")}>{r.value}</span>
                        </div>
                      ))}
                    </div>
                  ) : null,
                )}
                <div className="flex items-center gap-3 pt-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setQuestion("");
                      clearAnswer();
                    }}
                    className="cursor-pointer text-[12px] font-medium text-[#c9bcf7] underline underline-offset-2"
                  >
                    {m.newQuestion}
                  </button>
                  <Link
                    href="/agente"
                    className="ml-auto flex items-center gap-1 text-[12px] font-medium text-[#c9bcf7] no-underline hover:text-[#f2effb]"
                  >
                    {m.openFull}
                    <ArrowSquareOutIcon size={12} aria-hidden />
                  </Link>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </motion.form>
      </div>
    </MotionConfig>
  );
}

function MapButton({ icon: I, label, onClick, showLabel }: { icon: Icon; label: string; onClick: () => void; showLabel?: boolean }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={showLabel ? undefined : label}
      title={label}
      whileTap={{ scale: 0.9 }}
      className="flex h-9 min-w-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2 text-[13px] whitespace-nowrap text-[#e3ddf7] transition-colors hover:bg-white/10"
    >
      <I size={17} aria-hidden />
      {showLabel && <span className="pr-1">{label}</span>}
    </motion.button>
  );
}

function MapKpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="truncate font-mono text-[9.5px] tracking-[0.06em] text-[#a89fc5] uppercase">{label}</span>
      <span className="font-mono text-[14px] font-medium text-[#f2effb]">
        <AnimatedNumber value={value} format={formatBRLShort} />
      </span>
    </div>
  );
}

/* ---------------- Visão geral ---------------- */

function OverviewView({
  assets,
  hovered,
  onHover,
  onOpenAsset,
  onSelectEvent,
  eventLabel,
  monthText,
  monthTotal,
  eventCount,
}: {
  assets: AssetNode[];
  hovered: string | null;
  onHover: (symbol: string | null) => void;
  onOpenAsset: (a: AssetNode) => void;
  onSelectEvent: (e: TaxEvent) => void;
  eventLabel: (e: TaxEvent) => string;
  monthText: string;
  monthTotal: number;
  eventCount: number;
}) {
  const { t } = useI18n();
  const m = t.dashboard.map;
  const dim = (symbol: string) => (hovered && hovered !== symbol ? 0.18 : 1);

  return (
    <>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 overflow-visible" aria-hidden>
        <defs>
          {assets.map((a, i) => (
            <linearGradient key={a.symbol} id={`map-edge-${i}`} gradientUnits="userSpaceOnUse" x1={CX} y1={CY} x2={a.x} y2={a.y}>
              <stop offset="0%" stopColor="#d4a843" />
              <stop offset="100%" stopColor={`hsl(${tokenHue(a.symbol)} 80% 70%)`} />
            </linearGradient>
          ))}
        </defs>
        {assets.map((a, i) => {
          const leaves = leafPositions(a, Math.min(a.events.length, MAX_LEAVES));
          const d = curve(CX, CY, a.x, a.y);
          return (
            <motion.g key={a.symbol} animate={{ opacity: dim(a.symbol) }} transition={{ duration: 0.3 }}>
              <motion.path
                d={d}
                fill="none"
                stroke={`url(#map-edge-${i})`}
                strokeWidth={1.5 + a.share * 7}
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 0.85 }}
                transition={{ duration: 1, delay: 0.15 + i * 0.08, ease: EASE }}
              />
              <motion.path
                d={d}
                fill="none"
                stroke="#fff"
                strokeWidth={1.2}
                className="map-flow"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.55 }}
                transition={{ delay: 1.1 + i * 0.08 }}
              />
              {leaves.map((p, j) => (
                <motion.path
                  key={j}
                  d={`M ${a.x} ${a.y} L ${p.x} ${p.y}`}
                  stroke={TYPE_COLOR[a.events[j].type]}
                  strokeWidth={1}
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 0.5 }}
                  transition={{ duration: 0.5, delay: 0.7 + i * 0.08 + j * 0.04, ease: EASE }}
                />
              ))}
            </motion.g>
          );
        })}
      </svg>

      {/* Centro: o mês */}
      <motion.div
        aria-hidden
        className="absolute"
        style={{ left: CX - 60, top: CY - 60 }}
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={SPRING}
      >
        <Planet size={120} hue={null} seed={1.3}>
          {/* O mesmo planeta voxel 3D do /login, no lugar da esfera lisa: o mês é esse planeta. */}
          <VoxelPlanet size={66} />
        </Planet>
      </motion.div>
      <motion.div
        className="absolute flex -translate-x-1/2 flex-col items-center rounded-xl border border-white/10 bg-[#0e0a18]/90 px-3.5 py-1.5 backdrop-blur"
        style={{ left: CX, top: CY + 66 }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...SPRING, delay: 0.4 }}
      >
        <span className="font-display text-[13px] font-semibold whitespace-nowrap text-[#f2effb] capitalize">{monthText}</span>
        <span className="font-mono text-[15px] font-medium whitespace-nowrap text-[#f2effb]">
          <AnimatedNumber value={monthTotal} format={formatBRL} />
        </span>
        <span className="text-[11px] text-[#a89fc5]">{m.events(eventCount)}</span>
      </motion.div>

      {/* Ativos e eventos */}
      {assets.map((a, i) => {
        const visible = a.events.slice(0, MAX_LEAVES);
        const leaves = leafPositions(a, visible.length);
        const hue = tokenHue(a.symbol);
        const hidden = a.events.length - visible.length;
        const delay = 0.25 + i * 0.08;
        return (
          <motion.div key={a.symbol} animate={{ opacity: dim(a.symbol) }} transition={{ duration: 0.3 }}>
            {visible.map((e, j) => (
              <motion.div
                key={e.id}
                className="absolute"
                initial={{ left: a.x, top: a.y, scale: 0, opacity: 0 }}
                animate={{ left: leaves[j].x, top: leaves[j].y, scale: 1, opacity: 1 }}
                transition={{ ...SPRING, delay: delay + 0.45 + j * 0.04 }}
              >
                <motion.button
                  type="button"
                  onClick={() => onSelectEvent(e)}
                  aria-label={eventLabel(e)}
                  title={eventLabel(e)}
                  whileHover={{ scale: 1.7 }}
                  whileFocus={{ scale: 1.7 }}
                  className="block size-3 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full"
                  style={{ background: TYPE_COLOR[e.type], boxShadow: `0 0 10px ${TYPE_COLOR[e.type]}` }}
                />
              </motion.div>
            ))}
            {hidden > 0 && (
              <span
                className="absolute -translate-x-1/2 font-mono text-[10px] text-[#a89fc5]"
                style={{ left: leaves[leaves.length - 1].x, top: leaves[leaves.length - 1].y + 10 }}
              >
                +{hidden}
              </span>
            )}
            <motion.div
              className="absolute"
              initial={{ left: CX, top: CY, opacity: 0 }}
              animate={{ left: a.x, top: a.y, opacity: 1 }}
              transition={{ ...SPRING, delay }}
            >
              <motion.button
                type="button"
                onClick={() => onOpenAsset(a)}
                onMouseEnter={() => onHover(a.symbol)}
                onMouseLeave={() => onHover(null)}
                onFocus={() => onHover(a.symbol)}
                onBlur={() => onHover(null)}
                aria-label={`${m.openAsset(a.symbol)} · ${formatBRL(a.value)}`}
                initial={{ scale: 0.3 }}
                animate={{ scale: 1 }}
                whileHover={{ scale: 1.14 }}
                whileTap={{ scale: 0.94 }}
                transition={{ type: "spring", stiffness: 320, damping: 16 }}
                className="flex size-12 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border"
                style={{
                  background: "#140f22",
                  borderColor: `hsl(${hue} 70% 65% / .7)`,
                  boxShadow: `0 0 22px hsl(${hue} 80% 60% / .45)`,
                }}
              >
                <TokenIcon symbol={a.symbol} size={28} />
              </motion.button>
              <motion.div
                className="pointer-events-none absolute flex -translate-x-1/2 flex-col items-center rounded-lg bg-[#0e0a18]/85 px-2 py-0.5 backdrop-blur"
                style={{ left: 0, top: 30 }}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: delay + 0.35 }}
              >
                <span className="text-[13px] font-semibold text-[#f2effb]">{a.symbol}</span>
                <span className="font-mono text-[10px] whitespace-nowrap text-[#c9bcf7]">
                  {formatBRLShort(a.value)} · {Math.round(a.share * 100)}%
                </span>
              </motion.div>
            </motion.div>
          </motion.div>
        );
      })}
    </>
  );
}

/* ---------------- Detalhe de um ativo ---------------- */

const ORB = { x: 170, y: CY };
const CARD = { x: 340, w: 210, h: 62, gap: 16 };
const FAN = { cx: 470, r: 320 };

function FocusView({
  asset,
  selectedType,
  selectedEvent,
  onSelectType,
  onSelectEvent,
  eventLabel,
}: {
  asset: AssetNode;
  selectedType: EventType | null;
  selectedEvent: TaxEvent | null;
  onSelectType: (type: EventType) => void;
  onSelectEvent: (e: TaxEvent) => void;
  eventLabel: (e: TaxEvent) => string;
}) {
  const { t } = useI18n();
  const m = t.dashboard.map;
  const hue = tokenHue(asset.symbol);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const cards = TYPES.map((type) => {
    const evs = asset.events.filter((e) => e.type === type);
    return { type, events: evs, value: valueOf(evs) };
  })
    .filter((c) => c.events.length > 0)
    .sort((a, b) => b.events.length - a.events.length);
  const stackHeight = cards.length * CARD.h + (cards.length - 1) * CARD.gap;
  const cardY = (i: number) => CY - stackHeight / 2 + i * (CARD.h + CARD.gap) + CARD.h / 2;

  const selectedIndex = cards.findIndex((c) => c.type === selectedType);
  const fanEvents = selectedIndex >= 0 ? [...cards[selectedIndex].events].sort((a, b) => b.date.localeCompare(a.date)) : [];
  // Espaçamento vertical IGUAL entre os itens (não ângulo igual): num arco, ângulo igual comprime
  // o espaço em pixels perto das pontas (topo/fundo), e com 15+ itens os cards colavam uns nos
  // outros lá. Posição em y é linear; x volta pro mesmo círculo (sqrt) pra manter a curva do leque.
  const GAP = 46; // >= altura real do card do leque (2 linhas + padding), senão eles se sobrepõem
  const maxSpan = Math.min(CY - 40, H - CY - 40, 280);
  const capacity = Math.min(MAX_FAN, Math.floor((2 * maxSpan) / GAP) + 1);
  const shown = fanEvents.slice(0, capacity);
  const half = (shown.length - 1) / 2;
  const span = Math.min(half * GAP, maxSpan);
  const gap = half > 0 ? span / half : 0;
  // Leque grande esmaece nas pontas (foco no meio); com poucos itens, todos ficam nítidos.
  const fadeAmount = 0.55 * Math.min(1, Math.max(0, shown.length - 3) / 8);
  const fan = shown.map((e, i) => {
    const dy = (i - half) * gap;
    const x = FAN.cx + Math.sqrt(Math.max(0, FAN.r * FAN.r - dy * dy));
    const edge = half > 0 ? Math.abs(i - half) / half : 0;
    return { e, x, y: CY + dy, fade: 1 - fadeAmount * edge * edge };
  });
  const fromX = CARD.x + CARD.w;
  const fromY = selectedIndex >= 0 ? cardY(selectedIndex) : CY;

  return (
    <>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 overflow-visible" aria-hidden>
        <defs>
          <filter id="map-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {fan.map(({ e, x, y }) => (
            <linearGradient key={e.id} id={`map-fan-${e.id}`} gradientUnits="userSpaceOnUse" x1={fromX} y1={fromY} x2={x} y2={y}>
              <stop offset="0%" stopColor="#d4a843" />
              <stop offset="100%" stopColor={TYPE_COLOR[e.type]} />
            </linearGradient>
          ))}
        </defs>
        {cards.map((c, i) => (
          <motion.path
            key={c.type}
            d={bezier(ORB.x + 70, ORB.y, CARD.x, cardY(i))}
            fill="none"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{
              pathLength: 1,
              opacity: c.type === selectedType ? 0.95 : 0.35,
              stroke: c.type === selectedType ? "#d4a843" : "#c9bcf7",
              strokeWidth: c.type === selectedType ? 1.8 : 1,
            }}
            transition={{ pathLength: { duration: 0.7, delay: 0.35 + i * 0.08, ease: EASE }, default: { duration: 0.3 } }}
          />
        ))}
        <AnimatePresence>
          {fan.map(({ e, x, y, fade }, i) => (
            <motion.g key={`${selectedType}-${e.id}`} exit={{ opacity: 0, transition: { duration: 0.15 } }}>
              <motion.path
                d={bundle(fromX, fromY, x, y)}
                fill="none"
                stroke={`url(#map-fan-${e.id})`}
                strokeWidth={selectedEvent?.id === e.id ? 2 : 1.2}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 0.8 * fade }}
                transition={{ duration: 0.8, delay: 0.15 + i * 0.035, ease: EASE }}
              />
              <motion.circle
                cx={x}
                cy={y}
                r={3.4}
                fill={TYPE_COLOR[e.type]}
                filter="url(#map-glow)"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: fade }}
                transition={{ ...SPRING, delay: 0.6 + i * 0.035 }}
              />
            </motion.g>
          ))}
        </AnimatePresence>
      </svg>

      {/* Orbe do ativo: voa da posição que ocupava na visão geral */}
      <motion.div
        className="absolute"
        initial={{ left: asset.x - 70, top: asset.y - 70, scale: 0.5 }}
        animate={{ left: ORB.x - 70, top: ORB.y - 70, scale: 1 }}
        transition={SPRING}
      >
        <Planet size={140} hue={hue} seed={hue / 40}>
          <span
            className="flex size-full items-center justify-center rounded-full border"
            style={{ background: "#140f22", borderColor: `hsl(${hue} 70% 65% / .8)`, boxShadow: `0 0 36px hsl(${hue} 80% 60% / .5)` }}
          >
            <TokenIcon symbol={asset.symbol} size={40} />
          </span>
        </Planet>
      </motion.div>
      <motion.span
        className="absolute -translate-x-1/2 font-display text-[19px] font-semibold text-[#f2effb]"
        style={{ left: ORB.x, top: ORB.y - 104 }}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        {asset.symbol}
      </motion.span>
      <motion.div
        className="absolute flex -translate-x-1/2 flex-col items-center gap-1"
        style={{ left: ORB.x, top: ORB.y + 84 }}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
      >
        <span className="font-mono text-[14px] font-medium text-[#f2effb]">
          <AnimatedNumber value={asset.value} format={formatBRL} />
        </span>
        <span className="rounded-md bg-white/10 px-2 py-0.5 font-mono text-[10.5px] whitespace-nowrap text-[#c9bcf7]">
          {m.events(asset.events.length)} · {m.share(`${Math.round(asset.share * 100)}%`)}
        </span>
      </motion.div>

      {/* Cards por tipo */}
      {cards.map((c, i) => {
        const I = TYPE_ICON[c.type];
        const selected = c.type === selectedType;
        const delay = 0.35 + i * 0.08;
        return (
          <motion.button
            key={c.type}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelectType(c.type)}
            initial={{ opacity: 0, x: -40 }}
            animate={{
              opacity: 1,
              x: 0,
              borderColor: selected ? "rgba(212,168,67,.55)" : "rgba(255,255,255,0.14)",
              boxShadow: selected
                ? "0 8px 28px rgba(212,168,67,.22), inset 0 1px 0 rgba(255,255,255,.14)"
                : "0 4px 16px rgba(0,0,0,.2), inset 0 1px 0 rgba(255,255,255,.07)",
              background: selected
                ? "linear-gradient(135deg, rgba(212,168,67,.22), rgba(36,26,16,.55))"
                : "linear-gradient(135deg, rgba(255,255,255,.07), rgba(255,255,255,.015))",
            }}
            whileHover={{ x: 4 }}
            whileTap={{ scale: 0.97 }}
            transition={{ x: { ...SPRING, delay }, opacity: { duration: 0.4, delay }, default: { duration: 0.3 } }}
            className="map-glass absolute flex -translate-y-1/2 cursor-pointer items-center gap-3 rounded-xl border px-3.5 text-left"
            style={{ left: CARD.x, top: cardY(i), width: CARD.w, height: CARD.h }}
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg" style={{ background: `${TYPE_COLOR[c.type]}22`, color: TYPE_COLOR[c.type] }}>
              <I size={17} aria-hidden />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="font-display text-[20px] leading-none font-semibold text-[#f2effb]">{c.events.length}</span>
              <span className="truncate text-[11.5px] text-[#c9bcf7]">
                {t.eventType[c.type]} · {formatBRLShort(c.value)}
              </span>
            </span>
          </motion.button>
        );
      })}

      {/* Leque de eventos do card escolhido */}
      <AnimatePresence>
        {fan.map(({ e, x, y, fade }, i) => {
          const active = selectedEvent?.id === e.id;
          return (
            <motion.div
              key={`${selectedType}-${e.id}`}
              className="absolute"
              initial={{ left: fromX, top: fromY, opacity: 0, scale: 0.6 }}
              animate={{ left: x + 10, top: y, opacity: active ? 1 : fade, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.15 } }}
              transition={{ ...SPRING, delay: 0.2 + i * 0.035 }}
            >
              <motion.button
                type="button"
                onClick={() => onSelectEvent(e)}
                aria-label={eventLabel(e)}
                aria-pressed={active}
                whileHover={{ x: 6 }}
                whileTap={{ scale: 0.97 }}
                className="map-glass flex w-[200px] -translate-y-1/2 cursor-pointer flex-col gap-1 rounded-lg border px-2.5 py-1.5 text-left"
                style={{
                  background: active
                    ? "linear-gradient(135deg, rgba(212,168,67,.26), rgba(36,26,16,.6))"
                    : "linear-gradient(135deg, rgba(255,255,255,.065), rgba(255,255,255,.015))",
                  borderColor: active ? "rgba(212,168,67,.55)" : "rgba(255,255,255,.1)",
                  boxShadow: active
                    ? "0 6px 20px rgba(212,168,67,.2), inset 0 1px 0 rgba(255,255,255,.12)"
                    : "inset 0 1px 0 rgba(255,255,255,.06)",
                }}
              >
                <span className="truncate text-[12px] font-medium text-[#f2effb]">{e.asset}</span>
                <span className="flex items-center gap-1.5">
                  <span className="rounded bg-white/10 px-1.5 font-mono text-[10px] text-[#c9bcf7]">{formatDate(e.date)}</span>
                  <span
                    className="rounded px-1.5 font-mono text-[10px]"
                    style={{ background: `${TYPE_COLOR[e.type]}22`, color: e.valueBrl === null ? "#f59e0b" : TYPE_COLOR[e.type] }}
                  >
                    {e.valueBrl === null ? m.noPrice : formatBRLShort(e.valueBrl)}
                  </span>
                </span>
              </motion.button>
            </motion.div>
          );
        })}
      </AnimatePresence>
      {fanEvents.length > shown.length && fan.length > 0 && (
        // Logo abaixo do último card visível (não um ponto fixo): a posição real do leque muda
        // com a quantidade de itens, então um "+N" em coordenada fixa acabava caindo em cima do
        // último card quando o leque é alto. É um link de verdade agora: antes só dizia "no modo
        // simples" sem dar um jeito de chegar lá — leva pro modo simples já filtrado pelo tipo.
        <Link
          href={(() => {
            const q = new URLSearchParams(searchParams.toString());
            q.delete("modo");
            if (selectedType) q.set("tipo", selectedType);
            const query = q.toString();
            return query ? `${pathname}?${query}` : pathname;
          })()}
          className="absolute translate-y-4 font-mono text-[11px] text-[#c9bcf7] underline decoration-white/20 underline-offset-2 hover:text-[#f2effb] hover:decoration-white/40"
          style={{ left: fan[fan.length - 1].x + 10, top: fan[fan.length - 1].y }}
        >
          {m.more(fanEvents.length - shown.length)}
        </Link>
      )}
    </>
  );
}

/* ---------------- Painel lateral do evento ---------------- */

function EventPanel({ event: e, onClose, onDetails }: { event: TaxEvent; onClose: () => void; onDetails: () => void }) {
  const { t } = useI18n();
  const m = t.dashboard.map;
  const d = t.eventDialog;
  const cost = eventCost(e);
  const status =
    e.valueBrl === null
      ? { label: t.dashboard.noPrice, color: "#f59e0b" }
      : cost.costUnknown
        ? { label: t.report.costUnknownBadge, color: "#f59e0b" }
        : { label: m.priced, color: "#4ade80" };
  const gain = e.gainBrl ?? null;
  const stats = [
    { label: d.quantity, value: `${formatQty(e.quantity)} ${e.quantityAsset}` },
    { label: d.cost, value: e.costBrl == null ? "—" : formatBRL(e.costBrl) },
    { label: d.fees, value: e.feesBrl == null ? "—" : formatBRL(e.feesBrl) },
    { label: "PTAX", value: e.ptax == null ? "—" : formatPtax(e.ptax) },
  ];

  return (
    <motion.aside
      aria-label={e.asset}
      initial={{ x: 80, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 80, opacity: 0, transition: { duration: 0.2 } }}
      transition={{ type: "spring", stiffness: 200, damping: 24 }}
      className="absolute top-3 right-3 flex max-h-[calc(100%-12px-172px)] w-[320px] flex-col overflow-y-auto rounded-2xl border border-white/10 bg-[#140f22]/90 p-3.5 shadow-[0_0_50px_rgba(0,0,0,.5)] backdrop-blur-md max-md:top-16 max-md:left-3 max-md:max-h-[calc(100%-64px-172px)] max-md:w-auto"
    >
      <motion.div
        className="flex flex-col gap-2.5"
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.08 } } }}
      >
        <motion.div variants={ITEM} className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2 text-[12px] text-[#c9bcf7]">
            <TokenIcon symbol={e.quantityAsset} size={20} />
            <span className="truncate">
              {e.network === "solana" ? "Solana" : "Hyperliquid"}
              {e.protocol ? ` · ${e.protocol}` : ""}
            </span>
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label={m.closeDetails}
            className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-[#c9bcf7] hover:bg-white/10"
          >
            <XIcon size={16} aria-hidden />
          </button>
        </motion.div>

        <motion.div variants={ITEM} className="flex flex-col gap-1.5">
          <h3 className="m-0 font-display text-[21px] leading-tight font-semibold text-[#f2effb]">{e.asset}</h3>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[#a89fc5]">
            <span className="rounded-md px-2 py-0.5 text-[11px] font-medium" style={{ background: `${status.color}22`, color: status.color }}>
              {status.label}
            </span>
            {t.eventType[e.type]} · {formatDateTime(e.date)}
            {e.wallet?.label ? ` · ${e.wallet.label}` : ""}
          </span>
        </motion.div>

        <motion.div
          variants={ITEM}
          className="flex flex-col gap-1 rounded-xl border border-white/10 p-3"
          style={{ background: "linear-gradient(135deg, rgba(91,53,200,.28), rgba(20,15,34,.6))" }}
        >
          <span className="font-mono text-[10px] tracking-[0.06em] text-[#a89fc5] uppercase">{d.value}</span>
          <span className="font-mono text-[26px] leading-none font-medium text-[#f2effb]">
            {e.valueBrl === null ? "—" : <AnimatedNumber value={e.valueBrl} format={formatBRL} />}
          </span>
          {gain !== null && (
            <span className="font-mono text-[12px]" style={{ color: gain >= 0 ? "#4ade80" : "#f87171" }}>
              {d.gain}: {gain >= 0 ? "+" : ""}
              {formatBRL(gain)}
            </span>
          )}
        </motion.div>

        <motion.div variants={ITEM} className="grid grid-cols-2 gap-2">
          {stats.map((s) => (
            <div key={s.label} className="flex min-w-0 flex-col gap-0.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5">
              <span className="truncate text-[10.5px] text-[#a89fc5]">{s.label}</span>
              <span className="truncate font-mono text-[13px] text-[#f2effb]">{s.value}</span>
            </div>
          ))}
        </motion.div>

        <motion.button
          variants={ITEM}
          type="button"
          onClick={onDetails}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex h-9 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] text-[13px] font-medium text-[#f2effb] hover:bg-white/10"
        >
          {m.details}
          <ArrowSquareOutIcon size={15} aria-hidden />
        </motion.button>
      </motion.div>
    </motion.aside>
  );
}

const ITEM = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 22 } } } as const;
