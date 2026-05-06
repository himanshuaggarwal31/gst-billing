import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { resolveOwnerId } from "@/lib/resolve-owner";

const EWayBillSchema = z.object({
  supply_type:      z.enum(["O", "I"]).default("O"),
  sub_supply_type:  z.number().int().min(1).max(12).default(1),
  transport_mode:   z.enum(["1", "2", "3", "4"]).default("1"),
  distance_km:      z.number().int().min(0).default(0),
  transporter_name: z.string().optional().nullable(),
  transporter_id:   z.string().optional().nullable(),
  vehicle_no:       z.string().optional().nullable(),
  vehicle_type:     z.enum(["R", "O"]).default("R"),
  trans_doc_no:     z.string().optional().nullable(),
  trans_doc_date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  eway_bill_number: z.string().optional().nullable(),
  valid_until:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
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
    .from("eway_bills")
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
    return NextResponse.json(apiError("Viewers cannot edit e-Way Bills", "FORBIDDEN"), { status: 403 });
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
  const parsed = EWayBillSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(apiError(parsed.error.issues[0].message, "VALIDATION_ERROR"), { status: 400 });
  }

  const { data, error } = await supabase
    .from("eway_bills")
    .upsert(
      { invoice_id: id, user_id: ownerId, ...parsed.data, updated_at: new Date().toISOString() },
      { onConflict: "invoice_id" }
    )
    .select()
    .single();

  if (error) return NextResponse.json(apiError(error.message, "INTERNAL_ERROR"), { status: 500 });
  return NextResponse.json(apiSuccess(data));
}
