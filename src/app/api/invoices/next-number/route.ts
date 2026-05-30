import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/api-response";

/**
 * Parses an invoice number into a prefix and trailing integer.
 * e.g. "INV-042"  → { prefix: "INV-", n: 42, pad: 3 }
 *      "2024/001" → { prefix: "2024/", n: 1,  pad: 3 }
 *      "MYCO-5"   → { prefix: "MYCO-", n: 5,  pad: 1 }
 * Returns null when no trailing digit sequence is found.
 */
function parse(invoiceNumber: string): { prefix: string; n: number; pad: number } | null {
  const match = invoiceNumber.match(/^(.*?)(\d+)$/);
  if (!match) return null;
  return { prefix: match[1], n: parseInt(match[2], 10), pad: match[2].length };
}

function suggest(last: string | null, defaultPrefix: string): string {
  const fallback = `${defaultPrefix}001`;
  if (!last) return fallback;
  const parsed = parse(last);
  if (!parsed) return fallback;
  const next = parsed.n + 1;
  return parsed.prefix + String(next).padStart(parsed.pad, "0");
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(apiError("Unauthorized", "UNAUTHORIZED"), { status: 401 });

  const [{ data: profile }, { data: last }] = await Promise.all([
    supabase.from("profiles").select("invoice_prefix").eq("id", user.id).maybeSingle(),
    supabase.from("invoices").select("invoice_number").eq("user_id", user.id)
      .order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const prefix = profile?.invoice_prefix ?? "INV-";
  return NextResponse.json(apiSuccess({ next_number: suggest(last?.invoice_number ?? null, prefix) }));
}
