import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { calculateInvoiceTotals } from "@/lib/gst";
import { resolveOwnerId } from "@/lib/resolve-owner";
import { requireFeature } from "@/lib/feature-access";

const LineItemSchema = z.object({
  description: z.string().min(1),
  hsn_sac_code: z.string().min(4),
  quantity: z.number().positive(),
  rate: z.number().positive(),
  gst_rate: z.number().min(0).max(28),
  discount_percent: z.number().min(0).max(100).default(0),
});

const InvoiceSchema = z.object({
  client_id: z.string().uuid(),
  invoice_number: z.string().min(1),
  invoice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  seller_state_code: z.string().length(2),
  notes: z.string().optional().nullable(),
  theme: z.enum(["classic", "minimal", "modern"]).default("classic"),
  line_items: z.array(LineItemSchema).min(1, "At least one line item is required"),
});

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(apiError("Unauthorized", "UNAUTHORIZED"), { status: 401 });
  const { ownerId } = await resolveOwnerId(supabase, user.id, user.email!);

  const { data, error } = await supabase
    .from("invoices")
    .select(`
      id, invoice_number, invoice_date, due_date, public_token,
      taxable_amount, total_gst, total_amount, payment_status, created_at,
      created_by_email,
      clients(id, name, state_code, email)
    `)
    .eq("user_id", ownerId)
    .order("invoice_date", { ascending: false });

  if (error) return NextResponse.json(apiError(error.message, "INTERNAL_ERROR"), { status: 500 });
  return NextResponse.json(apiSuccess(data));
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(apiError("Unauthorized", "UNAUTHORIZED"), { status: 401 });
  const { ownerId, actorId, actorEmail, role, isDelegate } = await resolveOwnerId(supabase, user.id, user.email!);

  // Viewers cannot create invoices
  if (isDelegate && role === "viewer") {
    return NextResponse.json(apiError("Viewers cannot create invoices", "FORBIDDEN"), { status: 403 });
  }

  // Check feature access and monthly limit via the unified feature system
  const guard = await requireFeature(ownerId, "invoices");
  if (!guard.allowed) return guard.response;

  const monthlyLimit = guard.limits["per_month"] ?? Infinity;

  // Lazy monthly reset: if stored month differs from current month, treat count as 0
  const { data: profile } = await supabase
    .from("profiles")
    .select("invoice_count_this_month, invoice_count_reset_month")
    .eq("id", ownerId)
    .single();

  const currentMonth = new Date().toISOString().slice(0, 7);
  const effectiveCount =
    profile?.invoice_count_reset_month === currentMonth
      ? (profile?.invoice_count_this_month ?? 0)
      : 0;

  if (monthlyLimit !== Infinity && effectiveCount >= monthlyLimit) {
    return NextResponse.json(
      apiError(`Monthly invoice limit (${monthlyLimit}) reached. Upgrade to create more.`, "LIMIT_REACHED"),
      { status: 403 }
    );
  }

  const body = await req.json();
  const parsed = InvoiceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      apiError(parsed.error.issues[0].message, "VALIDATION_ERROR"),
      { status: 400 }
    );
  }

  const { line_items, seller_state_code, theme, ...invoiceFields } = parsed.data;

  // Fetch client to get buyer state code
  const { data: client, error: clientErr } = await supabase
    .from("clients")
    .select("state_code")
    .eq("id", invoiceFields.client_id)
    .eq("user_id", ownerId)
    .single();

  if (clientErr || !client) {
    return NextResponse.json(apiError("Client not found", "NOT_FOUND"), { status: 404 });
  }

  // Calculate GST totals
  const gstLineItems = line_items.map((item) => ({
    description: item.description,
    hsnSacCode: item.hsn_sac_code,
    quantity: item.quantity,
    rate: item.rate,
    gstRate: item.gst_rate,
    discountPercent: item.discount_percent,
  }));
  const { lines, summary } = calculateInvoiceTotals(
    gstLineItems,
    seller_state_code,
    client.state_code
  );

  const isInterState = seller_state_code !== client.state_code;

  // Insert invoice
  const { data: invoice, error: invoiceErr } = await supabase
    .from("invoices")
    .insert({
      ...invoiceFields,
      theme,
      user_id: ownerId,
      created_by_user_id: actorId,
      created_by_email: actorEmail,
      seller_state_code,
      buyer_state_code: client.state_code,
      taxable_amount: summary.taxableAmount,
      total_cgst: summary.cgst,
      total_sgst: summary.sgst,
      total_igst: summary.igst,
      total_gst: summary.totalGst,
      total_amount: summary.totalAmount,
    })
    .select()
    .single();

  if (invoiceErr) {
    return NextResponse.json(apiError(invoiceErr.message, "INTERNAL_ERROR"), { status: 500 });
  }

  // Insert line items
  const lineItemRows = lines.map((line, idx) => ({
    invoice_id: invoice.id,
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

  const { error: lineErr } = await supabase
    .from("invoice_line_items")
    .insert(lineItemRows);

  if (lineErr) {
    // Rollback invoice
    await supabase.from("invoices").delete().eq("id", invoice.id);
    return NextResponse.json(apiError(lineErr.message, "INTERNAL_ERROR"), { status: 500 });
  }

  // Increment monthly invoice counter (resets automatically when month changes)
  await supabase
    .from("profiles")
    .update({ invoice_count_this_month: effectiveCount + 1, invoice_count_reset_month: currentMonth })
    .eq("id", ownerId);

  return NextResponse.json(apiSuccess(invoice), { status: 201 });
}
