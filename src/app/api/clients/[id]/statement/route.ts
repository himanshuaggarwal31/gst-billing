import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { resolveOwnerId } from "@/lib/resolve-owner";

/**
 * GET /api/clients/[id]/statement
 *
 * Returns a full statement of accounts for a client:
 * - All invoices (number, date, amount, status)
 * - All payments recorded against those invoices
 * - All credit notes issued
 * - Running balance (total billed − total paid − credits)
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(apiError("Unauthorized", "UNAUTHORIZED"), { status: 401 });
  const { ownerId } = await resolveOwnerId(supabase, user.id, user.email!);

  // Verify client ownership
  const { data: client, error: cErr } = await supabase
    .from("clients")
    .select("id, name, gstin, email, phone, address, city, state_code")
    .eq("id", id)
    .eq("user_id", ownerId)
    .single();

  if (cErr || !client) {
    return NextResponse.json(apiError("Client not found", "NOT_FOUND"), { status: 404 });
  }

  // Invoices for this client
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, invoice_number, invoice_date, due_date, total_amount, total_gst, taxable_amount, payment_status")
    .eq("user_id", ownerId)
    .eq("client_id", id)
    .order("invoice_date", { ascending: true });

  const invoiceIds = (invoices ?? []).map((inv) => inv.id);

  // Payments against those invoices
  const { data: payments } = invoiceIds.length
    ? await supabase
        .from("invoice_payments")
        .select("invoice_id, amount, payment_date, method, reference_number")
        .in("invoice_id", invoiceIds)
        .order("payment_date", { ascending: true })
    : { data: [] };

  // Credit notes for this client
  const { data: creditNotes } = await supabase
    .from("credit_notes")
    .select("id, credit_note_number, credit_note_date, total_amount, reason, invoice_id")
    .eq("user_id", ownerId)
    .eq("client_id", id)
    .order("credit_note_date", { ascending: true });

  // Totals
  const totalBilled = (invoices ?? []).reduce((s, inv) => s + Number(inv.total_amount), 0);
  const totalPaid = (payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const totalCredits = (creditNotes ?? []).reduce((s, cn) => s + Number(cn.total_amount), 0);
  const balance = totalBilled - totalPaid - totalCredits;

  return NextResponse.json(
    apiSuccess({
      client,
      invoices: invoices ?? [],
      payments: payments ?? [],
      creditNotes: creditNotes ?? [],
      summary: {
        totalBilled,
        totalPaid,
        totalCredits,
        balance, // positive = client owes; negative = overpaid / credit balance
      },
    })
  );
}
