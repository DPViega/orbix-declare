import { cn } from "@/components/ui";

/**
 * Tabela no estilo dos mockups: cabeçalho em mono maiúsculo, linhas com divisória,
 * colunas de largura fixa (colgroup). Em telas estreitas rola na horizontal dentro do painel.
 */
export function Table({
  columns,
  minWidth = 880,
  children,
  footer,
  dense,
  caption,
}: {
  columns: { label: string; width?: string; align?: "left" | "right" }[];
  minWidth?: number;
  children: React.ReactNode;
  footer?: React.ReactNode;
  dense?: boolean;
  caption?: string;
}) {
  const px = dense ? "first:pl-5 last:pr-5" : "first:pl-6 last:pr-6";
  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed border-collapse" style={{ minWidth }}>
        {caption && <caption className="sr-only">{caption}</caption>}
        <colgroup>
          {columns.map((c, i) => (
            <col key={i} style={c.width ? { width: c.width } : undefined} />
          ))}
        </colgroup>
        <thead>
          <tr className="border-b border-line">
            {columns.map((c, i) => (
              <th
                key={i}
                scope="col"
                className={cn(
                  "px-2 py-3.5 font-mono font-normal text-muted uppercase",
                  dense ? "text-[10.5px] tracking-[0.06em]" : "text-[11px] tracking-[0.08em]",
                  c.align === "right" ? "text-right" : "text-left",
                  px,
                )}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&>tr]:border-b [&>tr]:border-line [&>tr:last-child]:border-b-0">{children}</tbody>
        {footer && <tfoot>{footer}</tfoot>}
      </table>
    </div>
  );
}

export function Td({
  children,
  align,
  className,
  colSpan,
}: {
  children?: React.ReactNode;
  align?: "left" | "right";
  className?: string;
  colSpan?: number;
}) {
  return (
    <td colSpan={colSpan} className={cn("px-2 py-[13px] align-middle first:pl-6 last:pr-6", align === "right" && "text-right", className)}>
      {children}
    </td>
  );
}
