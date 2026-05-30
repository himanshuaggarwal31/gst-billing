import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { resolveOwnerId } from "@/lib/resolve-owner";

const CreditNoteSchema = z.object({
  invoice_id: z.string().uuid(),
  client_id: z.string().uuid(),
  credit_note_number: z.string().min(1),
  credit_note_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().min(1),
  taxable_amount: z.number().min(0),
  total_cgst: z.number().min(0).default(0),
  total_sgst: z.number().min(0).default(0),
  total_igst: z.number().min(0).default(0),
  total_gst: z.number().min(0).default(0),
  total_amount: z.number().min(0),
});

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(apiError("Unauthorized", "UNAUTHORIZED"), { status: 401 });
  const { ownerId } = await resolveOwnerId(supabase, user.id, user.email!);

  const { data, error } = await supabase
    .from("credit_notes")
    .select("*, clients(name), invoices(invoice_number)")
    .eq("user_id", ownerId)
    .order("credit_note_date", { ascending: false });

  if (error) return NextResponse.json(apiError(error.message, "INTERNAL_ERROR"), { status: 500 });
  return NextResponse.json(apiSuccess(data));
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(apiError("Unauthorized", "UNAUTHORIZED"), { status: 401 });
  const { ownerId, role, isDelegate } = await resolveOwnerId(supabase, user.id, user.email!);

  if (isDelegate && role === "viewer") {
    return NextResponse.json(apiError("Viewers cannot create credit notes", "FORBIDDEN"), { status: 403 });
  }

  const body = await req.json();
  const parsed = CreditNoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      apiError(parsed.error.issues[0].message, "VALIDATION_ERROR"),
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("credit_notes")
    .insert({ ...parsed.data, user_id: ownerId })
    .select()
    .single();

  if (error) return NextResponse.json(apiError(error.message, "INTERNAL_ERROR"), { status: 500 });
  return NextResponse.json(apiSuccess(data), { status: 201 });
}
