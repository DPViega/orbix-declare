"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import { api, type Session, type User } from "@/lib/api";
import { setAuthToken, setUnauthorizedHandler } from "@/lib/api/client";

/**
 * Sessão do usuário no navegador.
 *
 * O back-end devolve um token após verificar a assinatura da carteira (POST /api/auth/verify).
 * Guardamos o token em localStorage para sobreviver a recarregamentos. Alternativa mais segura,
 * se o back-end preferir: cookie httpOnly + SameSite (aí o front não guarda nada; ver docs/API_CONTRACT.md).
 */

const STORAGE_KEY = "orbix.session";

/* ---------- Store externo (localStorage + memória) ---------- */

let current: Session | null | undefined; // undefined = ainda não lido
const listeners = new Set<() => void>();

function readStored(): Session | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    if (!s.token || new Date(s.expiresAt).getTime() < Date.now()) return null;
    return s;
  } catch {
    return null;
  }
}

function setCurrent(s: Session | null) {
  current = s;
  setAuthToken(s?.token ?? null);
  try {
    if (s) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* modo privado / storage bloqueado: sessão só em memória */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Sincroniza login/logout entre abas.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return;
    current = readStored();
    setAuthToken(current?.token ?? null);
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): Session | null {
  if (current === undefined) {
    current = readStored();
    setAuthToken(current?.token ?? null);
  }
  return current;
}

/** No servidor a sessão é desconhecida: status "loading". */
const getServerSnapshot = () => undefined;

/* ---------- Contexto ---------- */

type Status = "loading" | "authenticated" | "anonymous";

interface SessionContextValue {
  status: Status;
  user: User | null;
  signIn: (session: Session) => void;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<User | null>;
  setUser: (u: User) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const session = useSyncExternalStore<Session | null | undefined>(subscribe, getSnapshot, getServerSnapshot);
  const status: Status = session === undefined ? "loading" : session ? "authenticated" : "anonymous";

  useEffect(() => {
    setUnauthorizedHandler(() => setCurrent(null));
    return () => setUnauthorizedHandler(null);
  }, []);

  const signIn = useCallback((s: Session) => setCurrent(s), []);

  const signOut = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      /* mesmo com erro no servidor, a sessão local é encerrada */
    }
    setCurrent(null);
  }, []);

  const setUser = useCallback((user: User) => {
    if (current) setCurrent({ ...current, user });
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const u = await api.me();
      setUser(u);
      return u;
    } catch {
      return null;
    }
  }, [setUser]);

  const value = useMemo<SessionContextValue>(
    () => ({ status, user: session?.user ?? null, signIn, signOut, refreshUser, setUser }),
    [status, session, signIn, signOut, refreshUser, setUser],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession precisa estar dentro de <SessionProvider>.");
  return ctx;
}
