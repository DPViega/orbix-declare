import type { Metadata } from "next";
import { VerifyView } from "./verify-view";

export const metadata: Metadata = {
  title: "Verificação pública",
  description: "Confira se um relatório do Orbix Declare foi alterado, comparando seu hash com o registro na blockchain Solana.",
};

export default async function VerifyPage({ params }: PageProps<"/v/[id]">) {
  const { id } = await params;
  return <VerifyView publicId={id} />;
}
