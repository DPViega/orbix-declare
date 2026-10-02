import type { Metadata } from "next";
import { getMessages } from "@/lib/i18n/server";
import { Suspense } from "react";
import { LoginView } from "./login-view";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).meta.login };
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginView />
    </Suspense>
  );
}
