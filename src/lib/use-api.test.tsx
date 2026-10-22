import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/lib/i18n";
import { useApi } from "@/lib/use-api";

// useApi lê o idioma atual via useI18n() (para refazer a busca quando ele troca); o provider
// usa next/navigation por baixo, que não existe fora de uma rota real do Next.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

/** Mesmo provider de idioma que a aplicação usa, fixo em português nos testes. */
function wrapper({ children }: { children: ReactNode }) {
  return <I18nProvider initialLocale="pt">{children}</I18nProvider>;
}

/** Promise controlada de fora, para testar ordem de resolução entre buscas concorrentes. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("useApi", () => {
  it("começa carregando e expõe o dado depois que a promise resolve", async () => {
    const d = deferred<string>();
    const fetcher = vi.fn(() => d.promise);
    const { result } = renderHook(() => useApi(fetcher, []), { wrapper });

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();

    await act(async () => d.resolve("ok"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBe("ok");
    expect(result.current.error).toBeNull();
  });

  it("em erro, expõe a mensagem e mantém data nulo", async () => {
    const fetcher = vi.fn(() => Promise.reject(new Error("falhou")));
    const { result } = renderHook(() => useApi(fetcher, []), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe("falhou");
  });

  it("ao trocar deps, o dado some na hora (não mostra o mês anterior como se fosse o novo)", async () => {
    const fetcher = vi.fn((month: string) => Promise.resolve(`dados de ${month}`));
    const { result, rerender } = renderHook(({ month }) => useApi(() => fetcher(month), [month]), {
      initialProps: { month: "2026-09" },
      wrapper,
    });

    await waitFor(() => expect(result.current.data).toBe("dados de 2026-09"));

    rerender({ month: "2026-10" });
    // o dado do mês anterior não deve aparecer um instante sequer como se fosse do mês novo
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.data).toBe("dados de 2026-10"));
  });

  it("reload() com as mesmas deps mantém o dado anterior visível enquanto recarrega", async () => {
    let call = 0;
    const d2 = deferred<string>();
    const fetcher = vi.fn(() => (call++ === 0 ? Promise.resolve("primeiro") : d2.promise));
    const { result } = renderHook(() => useApi(fetcher, []), { wrapper });

    await waitFor(() => expect(result.current.data).toBe("primeiro"));

    act(() => result.current.reload());
    // ainda buscando de novo, mas o dado anterior continua na tela
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBe("primeiro");

    await act(async () => d2.resolve("segundo"));
    await waitFor(() => expect(result.current.data).toBe("segundo"));
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("resposta antiga que chega depois de uma troca de deps é descartada (sem corrida)", async () => {
    const slow = deferred<string>();
    const fast = deferred<string>();
    const fetcher = vi.fn((month: string) => (month === "2026-09" ? slow.promise : fast.promise));
    const { result, rerender } = renderHook(({ month }) => useApi(() => fetcher(month), [month]), {
      initialProps: { month: "2026-09" },
      wrapper,
    });

    rerender({ month: "2026-10" });
    // a resposta do mês novo chega primeiro
    await act(async () => fast.resolve("dados de 2026-10"));
    await waitFor(() => expect(result.current.data).toBe("dados de 2026-10"));

    // a resposta do mês antigo chega depois: não deve sobrescrever o que já está na tela
    await act(async () => slow.resolve("dados de 2026-09 (atrasado)"));
    expect(result.current.data).toBe("dados de 2026-10");
  });

  it("enabled=false nunca chama o fetcher", async () => {
    const fetcher = vi.fn(() => Promise.resolve("ok"));
    const { result } = renderHook(() => useApi(fetcher, [], false), { wrapper });

    expect(fetcher).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
  });

  it("setData atualiza o dado na hora, sem esperar o back (otimista)", async () => {
    const fetcher = vi.fn(() => Promise.resolve({ n: 1 }));
    const { result } = renderHook(() => useApi(fetcher, []), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual({ n: 1 }));

    act(() => result.current.setData((prev) => ({ n: (prev?.n ?? 0) + 1 })));
    expect(result.current.data).toEqual({ n: 2 });
  });
});
