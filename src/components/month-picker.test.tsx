import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/lib/i18n";
import { MonthPicker } from "@/components/month-picker";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const MONTHS = ["2026-09", "2026-08", "2026-07"];

function setup(onChange = vi.fn(), value = "2026-09") {
  render(
    <I18nProvider initialLocale="pt">
      <MonthPicker value={value} months={MONTHS} onChange={onChange} />
    </I18nProvider>,
  );
  return { onChange, user: userEvent.setup() };
}

describe("MonthPicker", () => {
  it("mostra o mês atual no botão, sem a lista aberta", () => {
    setup();
    expect(screen.getByRole("button", { name: /setembro 2026/i })).toBeInTheDocument();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("clicar no botão abre a lista com o mês atual marcado", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: /setembro 2026/i }));

    const list = screen.getByRole("listbox");
    const options = within(list).getAllByRole("option");
    expect(options.map((o) => o.textContent?.trim())).toEqual(["Setembro 2026", "Agosto 2026", "Julho 2026"]);
    expect(within(list).getByRole("option", { name: /setembro 2026/i })).toHaveAttribute("aria-selected", "true");
  });

  it("escolher um mês chama onChange e fecha a lista", async () => {
    const { onChange, user } = setup();
    await user.click(screen.getByRole("button", { name: /setembro 2026/i }));
    await user.click(screen.getByRole("option", { name: /agosto 2026/i }));

    expect(onChange).toHaveBeenCalledWith("2026-08");
    expect(onChange).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
  });

  it("Escape fecha a lista e devolve o foco ao botão, sem chamar onChange", async () => {
    const { onChange, user } = setup();
    const trigger = screen.getByRole("button", { name: /setembro 2026/i });
    await user.click(trigger);
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("clicar fora fecha a lista", async () => {
    const { user } = setup();
    render(<button type="button">fora</button>);
    await user.click(screen.getByRole("button", { name: /setembro 2026/i }));
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    await user.click(screen.getByText("fora"));

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("desabilitado não abre a lista", async () => {
    const onChange = vi.fn();
    render(
      <I18nProvider initialLocale="pt">
        <MonthPicker value="2026-09" months={MONTHS} onChange={onChange} disabled />
      </I18nProvider>,
    );
    const trigger = screen.getByRole("button", { name: /setembro 2026/i });
    expect(trigger).toBeDisabled();
    await userEvent.setup().click(trigger);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("ArrowDown move o foco para a próxima opção", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: /setembro 2026/i }));

    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveFocus(); // abrir foca o mês selecionado

    await user.keyboard("{ArrowDown}");
    expect(options[1]).toHaveFocus();
  });
});
