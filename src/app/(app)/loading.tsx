import { Skeleton } from "@/components/ui";

/**
 * Mostrado enquanto o Next busca o payload da rota (antes de o componente da página montar).
 * Os dados de cada tela já têm o próprio esqueleto em useApi/Skeleton; este é só a transição
 * entre rotas, para a troca de aba na sidebar nunca parecer travada.
 */
export default function AppLoading() {
  return (
    <div aria-hidden className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-8 w-56" />
      </div>
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
