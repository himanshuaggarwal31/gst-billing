import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { calculateInvoiceTotals } from "@/lib/gst";
import { resolveOwnerId } from "@/lib/resolve-owner";

const LineItemSchema = z.object({
  description: z.string().min(1),
  hsn_sac_code: z.string().default(""),
  quantity: z.number().positive(),
  rate: z.number().positive(),
  gst_rate: z.number().min(0).max(28),
  discount_percent: z.number().min(0).max(100).default(0),
});

const QuotationSchema = z.object({
  client_id: z.string().uuid(),
  quote_number: z.string().min(1),
  quote_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
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
    .from("quotations")
    .select(`
      id, quote_number, quote_date, valid_until, status,
      total_amount, total_gst, taxable_amount,
      converted_invoice_id, created_at,
      clients(id, name, email, state_code)
    `)
    .eq("user_id", ownerId)
    .order("quote_date", { ascending: false });

  if (error) return NextResponse.json(apiError(error.message, "INTERNAL_ERROR"), { status: 500 });
  return NextResponse.json(apiSuccess(data));
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(apiError("Unauthorized", "UNAUTHORIZED"), { status: 401 });
  const { ownerId, actorEmail, role, isDelegate } = await resolveOwnerId(supabase, user.id, user.email!);

  if (isDelegate && role === "viewer") {
    return NextResponse.json(apiError("Viewers cannot create quotations", "FORBIDDEN"), { status: 403 });
  }

  const body = await req.json();
  const parsed = QuotationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(apiError(parsed.error.issues[0].message, "VALIDATION_ERROR"), { status: 400 });
  }

  const { client_id, quote_number, quote_date, valid_until, seller_state_code, notes, theme, line_items } = parsed.data;

  // Verify client belongs to owner
  const { data: client } = await supabase
    .from("clients")
    .select("state_code")
    .eq("id", client_id)
    .eq("user_id", ownerId)
    .single();
  if (!client) return NextResponse.json(apiError("Client not found", "NOT_FOUND"), { status: 404 });

  // Compute totals
  const { lines: lineCalc, summary } = calculateInvoiceTotals(
    line_items.map((li) => ({
      description: li.description,
      hsnSacCode: li.hsn_sac_code,
      quantity: li.quantity,
      rate: li.rate,
      gstRate: li.gst_rate,
      discountPercent: li.discount_percent,
    })),
    seller_state_code,
    client.state_code
  );

  // Insert quotation header
  const { data: quote, error: qErr } = await supabase
    .from("quotations")
    .insert({
      user_id: ownerId,
      client_id,
      quote_number,
      quote_date,
      valid_until: valid_until || null,
      seller_state_code,
      notes: notes || null,
      theme,
      taxable_amount: summary.taxableAmount,
      total_cgst: summary.totalCgst,
      total_sgst: summary.totalSgst,
      total_igst: summary.totalIgst,
      total_gst: summary.totalGst,
      total_amount: summary.totalAmount,
      status: "draft",
      created_by_email: actorEmail,
    })
    .select("id")
    .single();

  if (qErr || !quote) {
    return NextResponse.json(apiError(qErr?.message ?? "Failed to create quotation", "INTERNAL_ERROR"), { status: 500 });
  }

  // Insert line items
  const lineRows = lineCalc.map((item, i) => ({
    quotation_id: quote.id,
    description: line_items[i].description,
    hsn_sac_code: line_items[i].hsn_sac_code,
    quantity: line_items[i].quantity,
    rate: line_items[i].rate,
    gst_rate: line_items[i].gst_rate,
    discount_percent: line_items[i].discount_percent,
    taxable_amount: item.taxableAmount,
    gst_amount: item.cgst + item.sgst + item.igst,
    total_amount: item.lineTotal,
    sort_order: i,
  }));

  const { error: liErr } = await supabase.from("quotation_line_items").insert(lineRows);
  if (liErr) {
    await supabase.from("quotations").delete().eq("id", quote.id);
    return NextResponse.json(apiError(liErr.message, "INTERNAL_ERROR"), { status: 500 });
  }

  return NextResponse.json(apiSuccess({ id: quote.id }), { status: 201 });
}
