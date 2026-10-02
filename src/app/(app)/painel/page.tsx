import type { Metadata } from "next";
import { getMessages } from "@/lib/i18n/server";
import { Suspense } from "react";
import { DashboardView } from "./dashboard-view";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).meta.dashboard };
}

export default function PainelPage() {
  return (
    <Suspense>
      <DashboardView />
    </Suspense>
  );
}
