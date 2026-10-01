"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "@/lib/api";

interface State<T> {
  data: T | null;
  error: string | null;
  /** Chave da última requisição concluída; loading = chave atual ainda não concluída. */
  settledKey: string | null;
}

/**
 * Hook mínimo de busca de dados: { data, error, loading, reload, setData }.
 * `deps` controla quando buscar de novo (ex.: troca de mês) e devem ser valores simples (strings/números).
 * Enquanto recarrega, os dados anteriores continuam visíveis. Respostas antigas são descartadas.
 */
export function useApi<T>(fetcher: () => Promise<T>, deps: readonly unknown[], enabled = true) {
  const [state, setState] = useState<State<T>>({ data: null, error: null, settledKey: null });
  const [nonce, setNonce] = useState(0);
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  const key = `${JSON.stringify(deps)}#${nonce}`;

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    fetcherRef.current().then(
      (data) => alive && setState({ data, error: null, settledKey: key }),
      (err) => alive && setState((s) => ({ ...s, error: errorMessage(err), settledKey: key })),
    );
    return () => {
      alive = false;
    };
  }, [key, enabled]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const setData = useCallback((update: T | null | ((prev: T | null) => T | null)) => {
    setState((s) => ({ ...s, data: typeof update === "function" ? (update as (p: T | null) => T | null)(s.data) : update }));
  }, []);

  return {
    data: state.data,
    error: state.settledKey === key ? state.error : null,
    loading: enabled && state.settledKey !== key,
    reload,
    setData,
  };
}
