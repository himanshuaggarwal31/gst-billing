import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { calculateInvoiceTotals } from "@/lib/gst";
import { resolveOwnerId } from "@/lib/resolve-owner";

const LineItemSchema = z.object({
  description: z.string().min(1),
  hsn_sac_code: z.string().min(4),
  quantity: z.number().positive(),
  rate: z.number().positive(),
  gst_rate: z.number().min(0).max(28),
  discount_percent: z.number().min(0).max(100).default(0),
});

const FullUpdateSchema = z.object({
  client_id: z.string().uuid(),
  invoice_number: z.string().min(1),
  invoice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  seller_state_code: z.string().length(2),
  notes: z.string().optional().nullable(),
  theme: z.enum(["classic", "minimal", "modern"]).default("classic"),
  line_items: z.array(LineItemSchema).min(1),
});

const StatusUpdateSchema = z.object({
  payment_status: z.enum(["pending", "paid", "partial"]),
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
    .from("invoices")
    .select(`
      *,
      clients(*),
      invoice_line_items(*)
    `)
    .eq("id", id)
    .eq("user_id", ownerId)
    .single();

  if (error || !data) return NextResponse.json(apiError("Invoice not found", "NOT_FOUND"), { status: 404 });
  return NextResponse.json(apiSuccess(data));
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(apiError("Unauthorized", "UNAUTHORIZED"), { status: 401 });
  const { ownerId, role, isDelegate } = await resolveOwnerId(supabase, user.id, user.email!);

  if (isDelegate && role === "viewer") {
    return NextResponse.json(apiError("Viewers cannot edit invoices", "FORBIDDEN"), { status: 403 });
  }

  const body = await req.json();

  // Status-only update (from "Mark paid" button)
  if ("payment_status" in body && Object.keys(body).length === 1) {
    const parsed = StatusUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(apiError("Invalid payment_status", "VALIDATION_ERROR"), { status: 400 });
    }
    const { data, error } = await supabase
      .from("invoices")
      .update({ payment_status: parsed.data.payment_status })
      .eq("id", id)
      .eq("user_id", ownerId)
      .select()
      .single();
    if (error || !data) return NextResponse.json(apiError("Invoice not found", "NOT_FOUND"), { status: 404 });
    return NextResponse.json(apiSuccess(data));
  }

  // Full invoice update
  const parsed = FullUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(apiError(parsed.error.issues[0].message, "VALIDATION_ERROR"), { status: 400 });
  }

  const { line_items, seller_state_code, theme, ...invoiceFields } = parsed.data;

  const { data: client, error: clientErr } = await supabase
    .from("clients")
    .select("state_code")
    .eq("id", invoiceFields.client_id)
    .eq("user_id", ownerId)
    .single();

  if (clientErr || !client) {
    return NextResponse.json(apiError("Client not found", "NOT_FOUND"), { status: 404 });
  }

  const gstLineItems = line_items.map((item) => ({
    description: item.description,
    hsnSacCode: item.hsn_sac_code,
    quantity: item.quantity,
    rate: item.rate,
    gstRate: item.gst_rate,
    discountPercent: item.discount_percent,
  }));
  const { lines, summary } = calculateInvoiceTotals(gstLineItems, seller_state_code, client.state_code);
  const isInterState = seller_state_code !== client.state_code;

  const { data: invoice, error: invoiceErr } = await supabase
    .from("invoices")
    .update({
      ...invoiceFields,
      theme,
      seller_state_code,
      buyer_state_code: client.state_code,
      taxable_amount: summary.taxableAmount,
      total_cgst: summary.cgst,
      total_sgst: summary.sgst,
      total_igst: summary.igst,
      total_gst: summary.totalGst,
      total_amount: summary.totalAmount,
    })
    .eq("id", id)
    .eq("user_id", ownerId)
    .select()
    .single();

  if (invoiceErr || !invoice) {
    return NextResponse.json(apiError(invoiceErr?.message ?? "Not found", "INTERNAL_ERROR"), { status: 500 });
  }

  // Replace line items
  await supabase.from("invoice_line_items").delete().eq("invoice_id", id);

  const lineItemRows = lines.map((line, idx) => ({
    invoice_id: id,
    user_id: ownerId,
    description: line.description,
    hsn_sac_code: line.hsnSacCode,
    quantity: line.quantity,
    rate: line.rate,
    discount_percent: line.discountPercent,
    gst_rate: line.gstRate,
    taxable_amount: line.taxableAmount,
    cgst: isInterState ? 0 : line.cgst,
    sgst: isInterState ? 0 : line.sgst,
    igst: isInterState ? line.igst : 0,
    total_gst: line.totalGst,
    line_total: line.lineTotal,
    sort_order: idx,
  }));

  const { error: lineErr } = await supabase.from("invoice_line_items").insert(lineItemRows);
  if (lineErr) return NextResponse.json(apiError(lineErr.message, "INTERNAL_ERROR"), { status: 500 });

  return NextResponse.json(apiSuccess(invoice));
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(apiError("Unauthorized", "UNAUTHORIZED"), { status: 401 });
  const { ownerId, role, isDelegate } = await resolveOwnerId(supabase, user.id, user.email!);

  if (isDelegate && role === "viewer") {
    return NextResponse.json(apiError("Viewers cannot delete invoices", "FORBIDDEN"), { status: 403 });
  }

  const { error } = await supabase
    .from("invoices")
    .delete()
    .eq("id", id)
    .eq("user_id", ownerId);

  if (error) return NextResponse.json(apiError(error.message, "INTERNAL_ERROR"), { status: 500 });
  return NextResponse.json(apiSuccess({ deleted: true }));
}
