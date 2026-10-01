import { redirect } from "next/navigation";

/** A raiz leva ao painel; sem sessão, o layout da área logada manda para /login. */
export default function Home() {
  redirect("/painel");
}
