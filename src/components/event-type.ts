import { ArrowsDownUpIcon, ArrowsLeftRightIcon, ChartLineUpIcon, CoinsIcon, type Icon } from "@phosphor-icons/react";
import type { EventType } from "@/lib/api";

/** Cor e ícone de cada tipo de evento — os mesmos no mapa interativo e nos cards do painel. */
export const EVENT_TYPES: EventType[] = ["swap", "perp", "funding", "transfer"];

export const TYPE_COLOR: Record<EventType, string> = {
  swap: "#a78cf0",
  perp: "#f472b6",
  funding: "#4ade80",
  transfer: "#d4a843",
};

export const TYPE_ICON: Record<EventType, Icon> = {
  swap: ArrowsLeftRightIcon,
  perp: ChartLineUpIcon,
  funding: CoinsIcon,
  transfer: ArrowsDownUpIcon,
};
