import { createClient, temSupabase } from "@/lib/supabase/server";
import type { Papel } from "@/domain/types";

export type CrmOperador = {
  id: string;
  nome: string;
  papel: Papel;
  email: string | null;
  user_id: string | null;
};

/** Operador logado via magic link. Sem Supabase → null (modo demo). */
export async function getCrmOperador(): Promise<CrmOperador | null> {
  if (!temSupabase()) return null;
  try {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return null;
    const { data } = await supabase
      .from("crm_operadores")
      .select("id, nome, papel, email, user_id")
      .eq("user_id", auth.user.id)
      .eq("ativo", true)
      .maybeSingle();
    if (!data) return null;
    return data as CrmOperador;
  } catch {
    return null;
  }
}

export function podeEscrever(papel: Papel): boolean {
  return papel === "dono" || papel === "vendedor";
}
