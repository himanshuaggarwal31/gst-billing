import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { resolveOwnerId } from "@/lib/resolve-owner";

const PaymentSchema = z.object({
  amount: z.number().positive("Amount must be greater than 0"),
  payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  method: z.enum(["bank_transfer", "upi", "cheque", "cash", "card", "other"]).default("bank_transfer"),
  reference_number: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
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

  // Verify invoice belongs to owner
  const { data: invoice } = await supabase
    .from("invoices")
    .select("id")
    .eq("id", id)
    .eq("user_id", ownerId)
    .single();

  if (!invoice) return NextResponse.json(apiError("Invoice not found", "NOT_FOUND"), { status: 404 });

  const { data, error } = await supabase
    .from("invoice_payments")
    .select("*")
    .eq("invoice_id", id)
    .order("payment_date", { ascending: false });

  if (error) return NextResponse.json(apiError(error.message, "INTERNAL_ERROR"), { status: 500 });
  return NextResponse.json(apiSuccess(data ?? []));
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(apiError("Unauthorized", "UNAUTHORIZED"), { status: 401 });
  const { ownerId, actorEmail, role, isDelegate } = await resolveOwnerId(supabase, user.id, user.email!);

  if (isDelegate && role === "viewer") {
    return NextResponse.json(apiError("Viewers cannot record payments", "FORBIDDEN"), { status: 403 });
  }

  const body = await req.json();
  const parsed = PaymentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      apiError(parsed.error.issues[0].message, "VALIDATION_ERROR"),
      { status: 400 }
    );
  }

  // Fetch invoice to get total and current paid amount
  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .select("id, total_amount, payment_status")
    .eq("id", id)
    .eq("user_id", ownerId)
    .single();

  if (invErr || !invoice) {
    return NextResponse.json(apiError("Invoice not found", "NOT_FOUND"), { status: 404 });
  }

  // Insert payment record
  const { data: payment, error: payErr } = await supabase
    .from("invoice_payments")
    .insert({
      invoice_id: id,
      user_id: ownerId,
      amount: parsed.data.amount,
      payment_date: parsed.data.payment_date,
      method: parsed.data.method,
      reference_number: parsed.data.reference_number || null,
      notes: parsed.data.notes || null,
      recorded_by_email: actorEmail,
    })
    .select()
    .single();

  if (payErr) {
    return NextResponse.json(apiError(payErr.message, "INTERNAL_ERROR"), { status: 500 });
  }

  // Recalculate total paid and update invoice status
  const { data: allPayments } = await supabase
    .from("invoice_payments")
    .select("amount")
    .eq("invoice_id", id);

  const totalPaid = (allPayments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
  const newStatus =
    totalPaid <= 0
      ? "pending"
      : totalPaid >= Number(invoice.total_amount)
      ? "paid"
      : "partial";

  await supabase
    .from("invoices")
    .update({ payment_status: newStatus })
    .eq("id", id)
    .eq("user_id", ownerId);

  return NextResponse.json(apiSuccess({ payment, new_status: newStatus, total_paid: totalPaid }), { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(req.url);
  const paymentId = url.searchParams.get("payment_id");
  if (!paymentId) return NextResponse.json(apiError("payment_id required", "VALIDATION_ERROR"), { status: 400 });

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(apiError("Unauthorized", "UNAUTHORIZED"), { status: 401 });
  const { ownerId, role, isDelegate } = await resolveOwnerId(supabase, user.id, user.email!);

  if (isDelegate && role === "viewer") {
    return NextResponse.json(apiError("Viewers cannot delete payments", "FORBIDDEN"), { status: 403 });
  }

  const { error } = await supabase
    .from("invoice_payments")
    .delete()
    .eq("id", paymentId)
    .eq("invoice_id", id)
    .eq("user_id", ownerId);

  if (error) return NextResponse.json(apiError(error.message, "INTERNAL_ERROR"), { status: 500 });

  // Recalculate status after deletion
  const { data: invoice } = await supabase
    .from("invoices")
    .select("total_amount")
    .eq("id", id)
    .eq("user_id", ownerId)
    .single();

  const { data: allPayments } = await supabase
    .from("invoice_payments")
    .select("amount")
    .eq("invoice_id", id);

  const totalPaid = (allPayments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
  const newStatus =
    totalPaid <= 0
      ? "pending"
      : totalPaid >= Number(invoice?.total_amount ?? 0)
      ? "paid"
      : "partial";

  await supabase
    .from("invoices")
    .update({ payment_status: newStatus })
    .eq("id", id)
    .eq("user_id", ownerId);

  return NextResponse.json(apiSuccess({ deleted: true, new_status: newStatus }));
}
