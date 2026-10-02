import type { Metadata } from "next";
import { getMessages } from "@/lib/i18n/server";
import { SyncView } from "./sync-view";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).meta.sync };
}

export default function SyncPage() {
  return <SyncView />;
}
