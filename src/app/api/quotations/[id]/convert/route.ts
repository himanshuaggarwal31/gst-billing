import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { resolveOwnerId } from "@/lib/resolve-owner";

/**
 * POST /api/quotations/[id]/convert
 *
 * Converts an accepted quotation into a Tax Invoice.
 * - Copies all line items, amounts, client, and notes to a new invoice
 * - Auto-generates the next invoice number
 * - Marks the quotation status as "converted" and links the invoice id
 * - Returns { invoice_id } on success
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(apiError("Unauthorized", "UNAUTHORIZED"), { status: 401 });
  const { ownerId, actorEmail, role, isDelegate } = await resolveOwnerId(supabase, user.id, user.email!);

  if (isDelegate && role === "viewer") {
    return NextResponse.json(apiError("Viewers cannot convert quotations", "FORBIDDEN"), { status: 403 });
  }

  // Load quotation with line items and client state
  const { data: quote, error: qErr } = await supabase
    .from("quotations")
    .select(`*, clients(state_code), quotation_line_items(*)`)
    .eq("id", id)
    .eq("user_id", ownerId)
    .single();

  if (qErr || !quote) {
    return NextResponse.json(apiError("Quotation not found", "NOT_FOUND"), { status: 404 });
  }
  if (quote.status === "converted") {
    return NextResponse.json(apiError("Quotation already converted to invoice", "VALIDATION_ERROR"), { status: 400 });
  }

  // Generate next invoice number
  const { data: lastInvoice } = await supabase
    .from("invoices")
    .select("invoice_number")
    .eq("user_id", ownerId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let nextNumber = "INV-001";
  if (lastInvoice?.invoice_number) {
    const match = lastInvoice.invoice_number.match(/(\D*)(\d+)$/);
    if (match) {
      const prefix = match[1];
      const num = parseInt(match[2], 10) + 1;
      nextNumber = `${prefix}${String(num).padStart(match[2].length, "0")}`;
    }
  }

  const today = new Date().toISOString().split("T")[0];

  // Create invoice
  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .insert({
      user_id: ownerId,
      client_id: quote.client_id,
      invoice_number: nextNumber,
      invoice_date: today,
      due_date: null,
      seller_state_code: quote.seller_state_code,
      buyer_state_code: quote.clients.state_code,
      notes: quote.notes,
      theme: quote.theme,
      taxable_amount: quote.taxable_amount,
      total_cgst: quote.total_cgst,
      total_sgst: quote.total_sgst,
      total_igst: quote.total_igst,
      total_gst: quote.total_gst,
      total_amount: quote.total_amount,
      payment_status: "pending",
      created_by_email: actorEmail,
    })
    .select("id")
    .single();

  if (invErr || !invoice) {
    return NextResponse.json(apiError(invErr?.message ?? "Failed to create invoice", "INTERNAL_ERROR"), { status: 500 });
  }

  // Copy line items to invoice_line_items
  const isInterState = quote.seller_state_code !== quote.clients.state_code;
  const lineItems = (quote.quotation_line_items as Array<{
    description: string;
    hsn_sac_code: string;
    quantity: number;
    rate: number;
    gst_rate: number;
    discount_percent: number;
    taxable_amount: number;
    gst_amount: number;
    total_amount: number;
    sort_order: number;
  }>).map((li) => ({
    invoice_id: invoice.id,
    user_id: ownerId,
    description: li.description,
    hsn_sac_code: li.hsn_sac_code,
    quantity: li.quantity,
    rate: li.rate,
    gst_rate: li.gst_rate,
    discount_percent: li.discount_percent,
    taxable_amount: li.taxable_amount,
    cgst: isInterState ? 0 : li.gst_amount / 2,
    sgst: isInterState ? 0 : li.gst_amount / 2,
    igst: isInterState ? li.gst_amount : 0,
    total_gst: li.gst_amount,
    line_total: li.total_amount,
    sort_order: li.sort_order,
  }));

  const { error: liErr } = await supabase.from("invoice_line_items").insert(lineItems);
  if (liErr) {
    // Rollback invoice
    await supabase.from("invoices").delete().eq("id", invoice.id);
    return NextResponse.json(apiError(liErr.message, "INTERNAL_ERROR"), { status: 500 });
  }

  // Mark quotation as converted
  await supabase
    .from("quotations")
    .update({ status: "converted", converted_invoice_id: invoice.id, updated_at: new Date().toISOString() })
    .eq("id", id);

  // Increment invoice counter on the profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("invoice_count_this_month")
    .eq("id", ownerId)
    .single();
  if (profile) {
    await supabase
      .from("profiles")
      .update({ invoice_count_this_month: (profile.invoice_count_this_month ?? 0) + 1 })
      .eq("id", ownerId);
  }

  return NextResponse.json(apiSuccess({ invoice_id: invoice.id, invoice_number: nextNumber }), { status: 201 });
}
