import type { Locale } from "../locale";
import { en } from "./en";
import { pt, type Messages } from "./pt";

export const messagesFor = (l: Locale): Messages => (l === "en" ? en : pt);
export type { Messages };
