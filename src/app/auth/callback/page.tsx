import type { Metadata } from "next";
import { getMessages } from "@/lib/i18n/server";
import { Suspense } from "react";
import { CallbackView } from "./callback-view";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).authCallback.title };
}

export default function AuthCallbackPage() {
  return (
    <Suspense>
      <CallbackView />
    </Suspense>
  );
}
