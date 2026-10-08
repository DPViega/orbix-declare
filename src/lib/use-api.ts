"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

interface State<T> {
  data: T | null;
  /** deps que geraram `data`; dados de outras deps (ex.: outro mês) nunca são expostos. */
  dataKey: string | null;
  error: string | null;
  /** Chave da última requisição concluída; loading = chave atual ainda não concluída. */
  settledKey: string | null;
}

/**
 * Hook mínimo de busca de dados: { data, error, loading, reload, setData }.
 * `deps` controla quando buscar de novo (ex.: troca de mês) e devem ser valores simples (strings/números).
 * Ao trocar `deps`, `data` volta a null até chegar a resposta nova: nada do mês anterior aparece como se fosse do novo.
 * Já em `reload` (mesmas deps), os dados anteriores continuam visíveis enquanto recarrega. Respostas antigas são descartadas.
 */
export function useApi<T>(fetcher: () => Promise<T>, deps: readonly unknown[], enabled = true) {
  const [state, setState] = useState<State<T>>({ data: null, dataKey: null, error: null, settledKey: null });
  const [nonce, setNonce] = useState(0);
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  // F14: o back traduz textos (limitações, motivos de pendência); trocar o idioma busca de novo.
  const { locale } = useI18n();
  const depsKey = JSON.stringify([...deps, locale]);
  const key = `${depsKey}#${nonce}`;
  const depsKeyRef = useRef(depsKey);
  useEffect(() => {
    depsKeyRef.current = depsKey;
  });

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    fetcherRef.current().then(
      (data) => alive && setState({ data, dataKey: depsKey, error: null, settledKey: key }),
      (err) => alive && setState((s) => ({ ...s, error: errorMessage(err), settledKey: key })),
    );
    return () => {
      alive = false;
    };
  }, [key, depsKey, enabled]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const setData = useCallback((update: T | null | ((prev: T | null) => T | null)) => {
    setState((s) => {
      const current = depsKeyRef.current;
      const prev = s.dataKey === current ? s.data : null;
      const data = typeof update === "function" ? (update as (p: T | null) => T | null)(prev) : update;
      return { ...s, data, dataKey: current };
    });
  }, []);

  return {
    data: state.dataKey === depsKey ? state.data : null,
    error: state.settledKey === key ? state.error : null,
    loading: enabled && state.settledKey !== key,
    reload,
    setData,
  };
}
