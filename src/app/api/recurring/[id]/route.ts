import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { calculateInvoiceTotals } from "@/lib/gst";
import { resolveOwnerId } from "@/lib/resolve-owner";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(apiError("Unauthorized", "UNAUTHORIZED"), { status: 401 });
  const { ownerId, role, isDelegate } = await resolveOwnerId(supabase, user.id, user.email!);

  if (isDelegate && role === "viewer") {
    return NextResponse.json(apiError("Viewers cannot edit templates", "FORBIDDEN"), { status: 403 });
  }

  const body = await req.json();
  const { data, error } = await supabase
    .from("recurring_templates")
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", ownerId)
    .select()
    .single();

  if (error) return NextResponse.json(apiError(error.message, "INTERNAL_ERROR"), { status: 500 });
  return NextResponse.json(apiSuccess(data));
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(apiError("Unauthorized", "UNAUTHORIZED"), { status: 401 });
  const { ownerId } = await resolveOwnerId(supabase, user.id, user.email!);

  const { error } = await supabase
    .from("recurring_templates")
    .delete()
    .eq("id", id)
    .eq("user_id", ownerId);

  if (error) return NextResponse.json(apiError(error.message, "INTERNAL_ERROR"), { status: 500 });
  return NextResponse.json(apiSuccess({ id }));
}

// POST /api/recurring/[id]/run — generate an invoice from template
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(apiError("Unauthorized", "UNAUTHORIZED"), { status: 401 });
  const { ownerId, actorId, actorEmail } = await resolveOwnerId(supabase, user.id, user.email!);

  const { data: template, error: tErr } = await supabase
    .from("recurring_templates")
    .select("*, clients(state_code)")
    .eq("id", id)
    .eq("user_id", ownerId)
    .single();

  if (tErr || !template) {
    return NextResponse.json(apiError("Template not found", "NOT_FOUND"), { status: 404 });
  }

  // Suggest next invoice number
  const { data: last } = await supabase
    .from("invoices")
    .select("invoice_number")
    .eq("user_id", ownerId)
    .like("invoice_number", `${template.invoice_number_prefix}%`)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  let nextNumber = `${template.invoice_number_prefix}001`;
  if (last?.invoice_number) {
    const num = parseInt(last.invoice_number.replace(template.invoice_number_prefix, ""), 10);
    if (!isNaN(num)) {
      nextNumber = `${template.invoice_number_prefix}${String(num + 1).padStart(3, "0")}`;
    }
  }

  const clientStateCode = (template.clients as { state_code: string })?.state_code ?? "";
  const items = (template.line_items as Array<{
    description: string;
    hsn_sac_code: string;
    quantity: number;
    rate: number;
    gst_rate: number;
    discount_percent: number;
  }>).map((li) => ({
    description: li.description,
    hsnSacCode: li.hsn_sac_code,
    quantity: li.quantity,
    rate: li.rate,
    gstRate: li.gst_rate,
    discountPercent: li.discount_percent ?? 0,
  }));

  const { lines: lineCalc, summary } = calculateInvoiceTotals(items, template.seller_state_code, clientStateCode);
  const today = new Date().toISOString().split("T")[0];

  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .insert({
      user_id: ownerId,
      created_by_user_id: actorId,
      created_by_email: actorEmail,
      client_id: template.client_id,
      invoice_number: nextNumber,
      invoice_date: today,
      due_date: null,
      seller_state_code: template.seller_state_code,
      buyer_state_code: clientStateCode,
      is_inter_state: template.seller_state_code !== clientStateCode,
      notes: template.notes,
      payment_status: "pending",
      taxable_amount: summary.taxableAmount,
      total_cgst: summary.cgst,
      total_sgst: summary.sgst,
      total_igst: summary.igst,
      total_gst: summary.totalGst,
      total_amount: summary.totalAmount,
    })
    .select()
    .single();

  if (invErr || !invoice) {
    return NextResponse.json(apiError(invErr?.message ?? "Failed to create invoice", "INTERNAL_ERROR"), { status: 500 });
  }

  // Insert line items
  const lineRows = lineCalc.map((li, i) => ({
    invoice_id: invoice.id,
    sort_order: i + 1,
    description: items[i].description,
    hsn_sac_code: items[i].hsnSacCode,
    quantity: li.quantity,
    rate: li.rate,
    discount_percent: li.discountPercent,
    gst_rate: li.gstRate,
    taxable_amount: li.taxableAmount,
    cgst: li.cgst,
    sgst: li.sgst,
    igst: li.igst,
    total_gst: li.totalGst,
    line_total: li.lineTotal,
  }));

  await supabase.from("invoice_line_items").insert(lineRows);

  // Advance next_run_date
  const nextRun = new Date(template.next_run_date);
  if (template.frequency === "monthly") nextRun.setMonth(nextRun.getMonth() + 1);
  else if (template.frequency === "quarterly") nextRun.setMonth(nextRun.getMonth() + 3);
  else nextRun.setFullYear(nextRun.getFullYear() + 1);

  await supabase
    .from("recurring_templates")
    .update({
      last_run_date: today,
      next_run_date: nextRun.toISOString().split("T")[0],
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  return NextResponse.json(apiSuccess({ invoice_id: invoice.id, invoice_number: nextNumber }), { status: 201 });
}
