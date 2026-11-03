import { NextRequest, NextResponse } from "next/server";
import { createClient, temSupabase } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  if (!temSupabase()) {
    return NextResponse.json({
      message: "Supabase não configurado. Use o modo demo em / ou preencha .env.local.",
    }, { status: 400 });
  }
  const { email } = await req.json().catch(() => ({ email: "" }));
  if (!email || typeof email !== "string") {
    return NextResponse.json({ message: "E-mail inválido." }, { status: 400 });
  }
  const supabase = await createClient();
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }
  return NextResponse.json({ message: "Link enviado. Confira o e-mail." });
}
