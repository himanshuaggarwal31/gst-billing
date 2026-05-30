import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { resolveOwnerId } from "@/lib/resolve-owner";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(apiError("Unauthorized", "UNAUTHORIZED"), { status: 401 });
  const { ownerId } = await resolveOwnerId(supabase, user.id, user.email!);

  const [{ data: profile }, { data: last }] = await Promise.all([
    supabase.from("profiles").select("quotation_prefix").eq("id", ownerId).maybeSingle(),
    supabase.from("quotations").select("quote_number").eq("user_id", ownerId)
      .order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const prefix = profile?.quotation_prefix ?? "QUO-";
  let next = `${prefix}001`;
  if (last?.quote_number) {
    const match = last.quote_number.match(/(\D*)(\d+)$/);
    if (match) {
      const num = parseInt(match[2], 10) + 1;
      next = `${match[1]}${String(num).padStart(match[2].length, "0")}`;
    }
  }

  return NextResponse.json(apiSuccess({ next_number: next }));
}
