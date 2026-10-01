import type { Metadata } from "next";
import { SyncView } from "./sync-view";

export const metadata: Metadata = { title: "Sincronização" };

export default function SyncPage() {
  return <SyncView />;
}
