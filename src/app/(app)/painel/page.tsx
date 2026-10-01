import type { Metadata } from "next";
import { Suspense } from "react";
import { DashboardView } from "./dashboard-view";

export const metadata: Metadata = { title: "Painel" };

export default function PainelPage() {
  return (
    <Suspense>
      <DashboardView />
    </Suspense>
  );
}
