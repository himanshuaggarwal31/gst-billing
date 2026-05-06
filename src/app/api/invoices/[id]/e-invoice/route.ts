import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { resolveOwnerId } from "@/lib/resolve-owner";

const EInvoiceSchema = z.object({
  irn:             z.string().min(1).max(64).optional().nullable(),
  ack_no:          z.string().optional().nullable(),
  ack_date:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  signed_qr:       z.string().optional().nullable(),
  status:          z.enum(["pending", "generated", "cancelled"]).default("pending"),
  cancel_irn_hash: z.string().optional().nullable(),
  cancel_date:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  cancel_remark:   z.string().optional().nullable(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(apiError("Unauthorized", "UNAUTHORIZED"), { status: 401 });
  const { ownerId } = await resolveOwnerId(supabase, user.id, user.email!);

  const { data, error } = await supabase
    .from("e_invoices")
    .select("*")
    .eq("invoice_id", id)
    .eq("user_id", ownerId)
    .maybeSingle();

  if (error) return NextResponse.json(apiError(error.message, "INTERNAL_ERROR"), { status: 500 });
  return NextResponse.json(apiSuccess(data));
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(apiError("Unauthorized", "UNAUTHORIZED"), { status: 401 });
  const { ownerId, role, isDelegate } = await resolveOwnerId(supabase, user.id, user.email!);

  if (isDelegate && role === "viewer") {
    return NextResponse.json(apiError("Viewers cannot edit e-Invoices", "FORBIDDEN"), { status: 403 });
  }

  // Verify invoice belongs to owner
  const { data: invoice } = await supabase
    .from("invoices")
    .select("id")
    .eq("id", id)
    .eq("user_id", ownerId)
    .single();
  if (!invoice) return NextResponse.json(apiError("Invoice not found", "NOT_FOUND"), { status: 404 });

  const body = await req.json();
  const parsed = EInvoiceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(apiError(parsed.error.issues[0].message, "VALIDATION_ERROR"), { status: 400 });
  }

  const { data, error } = await supabase
    .from("e_invoices")
    .upsert(
      { invoice_id: id, user_id: ownerId, ...parsed.data, updated_at: new Date().toISOString() },
      { onConflict: "invoice_id" }
    )
    .select()
    .single();

  if (error) return NextResponse.json(apiError(error.message, "INTERNAL_ERROR"), { status: 500 });
  return NextResponse.json(apiSuccess(data));
}
