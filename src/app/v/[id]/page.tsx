import type { Metadata } from "next";
import { getMessages } from "@/lib/i18n/server";
import { VerifyView } from "./verify-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.meta.verify, description: t.meta.verifyDescription };
}

export default async function VerifyPage({ params }: PageProps<"/v/[id]">) {
  const { id } = await params;
  return <VerifyView publicId={id} />;
}
